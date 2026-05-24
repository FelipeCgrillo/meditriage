/**
 * Triage API Fallback Safety Tests
 *
 * Verifies that the /api/triage route never leaves a patient stuck:
 *
 *   1. Missing ANTHROPIC_API_KEY -> 200 streamed fallback with the
 *      Spanish safe-fallback payload (no HTTP 500).
 *   2. Validation errors (empty messages, wrong role, invalid JSON)
 *      -> 400 (never 500).
 *   3. Mid-stream provider error (`3:` frame) BEFORE any text-delta
 *      is rewritten to a full FALLBACK_PAYLOAD `0:` frame + finish
 *      frame, so useChat does not surface a fatal error.
 *   4. Mid-stream provider error AFTER partial text-delta is appended
 *      with a Spanish interruption notice + finish frame, preserving
 *      the partial assistant output.
 *   5. GET health check responds 200 with ai_configured flag.
 *
 * Run standalone:
 *   npx tsx __tests__/safety/api-triage-fallback.test.ts
 */

import { buildSafeStreamTransformer, FALLBACK_JSON, PARTIAL_INTERRUPTION_NOTICE } from '../../src/lib/ai/safe-stream';

type ApiHandler = (req: Request) => Promise<Response>;

async function loadHandler(): Promise<{ POST: ApiHandler; GET: () => Promise<Response> }> {
    const mod = await import('../../src/app/api/triage/route');
    return mod as unknown as { POST: ApiHandler; GET: () => Promise<Response> };
}

interface TestCase {
    name: string;
    run: () => Promise<void>;
}

const FAILED: string[] = [];

function assert(cond: unknown, msg: string) {
    if (!cond) throw new Error(`Assertion failed: ${msg}`);
}

/** Pipe a list of wire-format lines through the safe-stream transformer
 *  and return the collected output as a string. */
async function runTransformer(inputLines: string[]): Promise<string> {
    const encoder = new TextEncoder();
    const transformer = buildSafeStreamTransformer();
    const source = new ReadableStream<Uint8Array>({
        start(controller) {
            for (const line of inputLines) controller.enqueue(encoder.encode(line));
            controller.close();
        },
    });
    const piped = source.pipeThrough(transformer);
    const reader = piped.getReader();
    const decoder = new TextDecoder();
    let out = '';
    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        out += decoder.decode(value, { stream: true });
    }
    out += decoder.decode();
    return out;
}

const cases: TestCase[] = [
    {
        name: 'Missing API key returns a streamed 200 fallback payload (no HTTP 500)',
        run: async () => {
            const originalKey = process.env.ANTHROPIC_API_KEY;
            delete process.env.ANTHROPIC_API_KEY;
            try {
                const { POST } = await loadHandler();
                const req = new Request('http://localhost/api/triage', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        messages: [{ role: 'user', content: 'dolor de cabeza leve desde ayer, sin fiebre' }],
                    }),
                });
                const res = await POST(req);
                assert(res.status === 200, `expected 200, got ${res.status}`);
                assert(res.headers.get('X-Triage-Fallback') === '1', 'expected X-Triage-Fallback header');
                const text = await res.text();
                assert(text.startsWith('0:'), `expected data-stream chunk, got "${text.slice(0, 40)}"`);
                assert(/no está disponible|urgencias/i.test(text), 'expected Spanish fallback content');
            } finally {
                if (originalKey !== undefined) process.env.ANTHROPIC_API_KEY = originalKey;
            }
        },
    },
    {
        name: 'Empty messages array returns 400 (bad request, not 500)',
        run: async () => {
            const { POST } = await loadHandler();
            const req = new Request('http://localhost/api/triage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: [] }),
            });
            const res = await POST(req);
            assert(res.status === 400, `expected 400, got ${res.status}`);
        },
    },
    {
        name: 'Last message must be from user (returns 400)',
        run: async () => {
            const { POST } = await loadHandler();
            const req = new Request('http://localhost/api/triage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [{ role: 'assistant', content: 'hello' }],
                }),
            });
            const res = await POST(req);
            assert(res.status === 400, `expected 400, got ${res.status}`);
        },
    },
    {
        name: 'Invalid JSON body returns 400 (does not crash)',
        run: async () => {
            const { POST } = await loadHandler();
            const req = new Request('http://localhost/api/triage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: 'not json{',
            });
            const res = await POST(req);
            assert(res.status === 400, `expected 400, got ${res.status}`);
        },
    },
    {
        name: 'GET health check responds 200 with ai_configured flag',
        run: async () => {
            const { GET } = await loadHandler();
            const res = await GET();
            assert(res.status === 200, `expected 200, got ${res.status}`);
            const body = await res.json();
            assert(typeof body.ok === 'boolean', 'body.ok should be boolean');
            assert(typeof body.ai_configured === 'boolean', 'body.ai_configured should be boolean');
        },
    },
    {
        name: 'Mid-stream AI error BEFORE any text-delta is replaced with FALLBACK_PAYLOAD',
        run: async () => {
            // Simulate the upstream stream emitting only a start frame, then
            // an error frame (e.g. provider 429 / 503 before any content).
            const input = [
                'f:{"messageId":"m1"}\n',
                '3:"AI_APICallError: rate limit exceeded"\n',
                // Anything after the error frame must be suppressed.
                '0:"should not be emitted"\n',
                'd:{"finishReason":"stop","usage":{"promptTokens":1,"completionTokens":0}}\n',
            ];
            const out = await runTransformer(input);

            // Should preserve start frame.
            assert(out.includes('f:{"messageId":"m1"}'), 'start frame should pass through');
            // Should NOT include the original error frame.
            assert(!out.includes('3:"AI_APICallError'), 'error frame should be removed');
            // Should include the structured fallback as a text-delta.
            assert(out.includes(`0:${JSON.stringify(FALLBACK_JSON)}`), 'fallback payload should be emitted as 0: frame');
            // Should NOT include any post-error content.
            assert(!out.includes('should not be emitted'), 'post-error content must be suppressed');
            // Should include a synthetic finish frame.
            assert(out.includes('d:{"finishReason":"error"'), 'finish frame should be emitted');
        },
    },
    {
        name: 'Mid-stream AI error AFTER partial text-delta appends interruption notice',
        run: async () => {
            const input = [
                'f:{"messageId":"m2"}\n',
                '0:"{\\"status\\":\\"needs_info\\","\n',
                '0:"\\"follow_up_question\\":\\"¿Desde cuándo?\\"}"\n',
                '3:"AI_APICallError: connection reset"\n',
                'd:{"finishReason":"stop","usage":{"promptTokens":1,"completionTokens":0}}\n',
            ];
            const out = await runTransformer(input);

            // Partial text-delta frames should pass through (their inner JSON
            // is double-encoded on the wire, so we check for the encoded form).
            assert(out.includes('follow_up_question'), 'partial assistant output should be preserved');
            assert(!out.includes('3:"AI_APICallError'), 'error frame should be removed');
            assert(
                out.includes(`0:${JSON.stringify(PARTIAL_INTERRUPTION_NOTICE)}`),
                'partial-interruption notice should be appended as 0: frame',
            );
            assert(out.includes('d:{"finishReason":"error"'), 'finish frame should be emitted');
        },
    },
    {
        name: 'Clean stream with no errors passes through unchanged',
        run: async () => {
            const input = [
                'f:{"messageId":"m3"}\n',
                '0:"hello"\n',
                '0:" world"\n',
                'd:{"finishReason":"stop","usage":{"promptTokens":1,"completionTokens":2}}\n',
            ];
            const out = await runTransformer(input);
            assert(out.includes('0:"hello"'), 'hello chunk preserved');
            assert(out.includes('0:" world"'), 'world chunk preserved');
            assert(out.includes('d:{"finishReason":"stop"'), 'original finish frame preserved');
            assert(!out.includes('finishReason":"error"'), 'should not inject synthetic finish');
        },
    },
];

async function main() {
    console.log('=== Triage API fallback tests ===\n');
    for (const c of cases) {
        try {
            await c.run();
            console.log(`✅ ${c.name}`);
        } catch (e) {
            FAILED.push(c.name);
            console.error(`❌ ${c.name}`);
            console.error(`   ${(e as Error).message}`);
        }
    }
    console.log(`\nTotal: ${cases.length}  Passed: ${cases.length - FAILED.length}  Failed: ${FAILED.length}`);
    if (FAILED.length > 0) process.exit(1);
}

const isMain =
    typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module;
if (isMain) {
    void main();
}

export { cases };

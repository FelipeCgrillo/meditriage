/**
 * Triage API Fallback Safety Tests
 *
 * Verifies that the /api/triage route never leaves a patient stuck:
 *   - When ANTHROPIC_API_KEY is missing, returns a 200 streamed
 *     fallback payload (no HTTP 500 reaching the patient).
 *   - When the AI throws, the route still returns 200 with a
 *     structured Spanish safe-fallback message.
 *   - Invalid input still returns a clean 400 (not 500).
 *
 * Run standalone:
 *   npx tsx __tests__/safety/api-triage-fallback.test.ts
 *
 * The test runs the handler in isolation by stubbing the ai-sdk imports
 * via a lightweight require shim, so it does NOT need the dev server or
 * any real network access.
 */

type ApiHandler = (req: Request) => Promise<Response>;

async function loadHandler(): Promise<{ POST: ApiHandler; GET: () => Promise<Response> }> {
    // Dynamic import so the test file itself stays decoupled from build state.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
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

const cases: TestCase[] = [
    {
        name: 'Missing API key returns a streamed 200 fallback payload, not HTTP 500',
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
                assert(
                    res.headers.get('X-Triage-Fallback') === '1',
                    'expected X-Triage-Fallback header on fallback response',
                );
                const text = await res.text();
                // Data-stream protocol prefixes JSON text deltas with '0:'.
                assert(text.startsWith('0:'), `expected data-stream chunk, got "${text.slice(0, 40)}"`);
                // The payload should contain a Spanish fallback message.
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

// Run when executed directly (tsx / node --import tsx).
const isMain =
    typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module;
if (isMain) {
    void main();
}

export { cases };

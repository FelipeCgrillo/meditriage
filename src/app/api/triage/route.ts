import { streamText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { TRIAGE_SYSTEM_PROMPT } from '@/lib/ai/prompts';
import { sanitizeForAI } from '@/lib/utils/pii-filter';
import { DEFAULT_ANTHROPIC_MODEL, getAnthropicModelId } from '@/lib/ai/config';
import {
    FALLBACK_PAYLOAD,
    buildFallbackStreamResponse,
    buildSafeStreamTransformer,
} from '@/lib/ai/safe-stream';

export const runtime = 'edge';

/**
 * POST /api/triage
 * Analiza los síntomas del paciente y devuelve la clasificación ESI estructurada.
 *
 * Robustness contract:
 *   - Never returns HTTP 500 to the patient client.
 *   - Missing API key / synchronous AI failures return a streamed
 *     safe-fallback JSON so the chat UI can render a clear Spanish
 *     message and offer a retry.
 *   - Mid-stream provider errors (rate limits, 4xx/5xx, network
 *     drops, timeouts) are intercepted by buildSafeStreamTransformer
 *     and rewritten so the patient sees either a full safe-fallback
 *     bubble or, if streaming had already started, a clear Spanish
 *     interruption notice and a clean finish frame.
 */
export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => null);
        if (!body) {
            return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };
        const { messages } = body as { messages?: ChatMessage[] };

        if (!messages || messages.length === 0) {
            return new Response(JSON.stringify({ error: 'Messages are required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const lastUserMessage = messages[messages.length - 1];
        if (lastUserMessage.role !== 'user') {
            return new Response(JSON.stringify({ error: 'Last message must be from user' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Guard against missing API key (most common production cause of 500).
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            console.error('[triage] ANTHROPIC_API_KEY is not configured');
            return buildFallbackStreamResponse(FALLBACK_PAYLOAD);
        }

        // Sanitize EVERY user message (not only the last one) so previously
        // submitted symptoms don't leak PII into the AI context on follow-ups.
        const sanitizedMessages = messages.map((m) =>
            m.role === 'user' ? { ...m, content: sanitizeForAI(m.content) } : m,
        );

        const anthropic = createAnthropic({ apiKey });
        const modelId = getAnthropicModelId();

        const result = await streamText({
            model: anthropic(modelId),
            system: TRIAGE_SYSTEM_PROMPT,
            messages: sanitizedMessages,
            temperature: 0.1,
        });

        const upstream = result.toDataStreamResponse({
            getErrorMessage: (err) => {
                // Surface enough provider context to debug without leaking
                // the API key. AI SDK errors expose `statusCode` / `responseBody`.
                const e = err as {
                    name?: string;
                    message?: string;
                    statusCode?: number;
                    cause?: unknown;
                } | null;
                const name = e?.name ?? 'Error';
                const message = e?.message ?? String(err);
                const status = e?.statusCode;
                console.error('[triage] provider stream error', {
                    model: modelId,
                    name,
                    status,
                    message,
                });
                return status ? `${name} [${status}]: ${message}` : `${name}: ${message}`;
            },
        });

        if (!upstream.body) {
            console.error('[triage] toDataStreamResponse returned no body, sending fallback');
            return buildFallbackStreamResponse(FALLBACK_PAYLOAD);
        }

        const safeStream = upstream.body.pipeThrough(buildSafeStreamTransformer());

        return new Response(safeStream, {
            status: 200,
            headers: upstream.headers,
        });
    } catch (error) {
        const e = error as { name?: string; message?: string; statusCode?: number } | null;
        console.error('[triage] AI error', {
            model: getAnthropicModelId(),
            name: e?.name,
            status: e?.statusCode,
            message: e?.message,
        });
        return buildFallbackStreamResponse(FALLBACK_PAYLOAD);
    }
}

/**
 * GET /api/triage
 * Lightweight health check that does NOT call the AI model.
 * Reports the resolved model id and whether ANTHROPIC_MODEL was overridden,
 * so operators can confirm Vercel env config without exposing the API key.
 */
export async function GET() {
    const modelId = getAnthropicModelId();
    return new Response(
        JSON.stringify({
            ok: true,
            ai_configured: Boolean(process.env.ANTHROPIC_API_KEY),
            model: modelId,
            model_override: Boolean(
                process.env.ANTHROPIC_MODEL && process.env.ANTHROPIC_MODEL.trim().length > 0,
            ),
            default_model: DEFAULT_ANTHROPIC_MODEL,
        }),
        {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        },
    );
}

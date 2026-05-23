import { streamText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { TRIAGE_SYSTEM_PROMPT, FALLBACK_MESSAGE } from '@/lib/ai/prompts';
import { sanitizeForAI } from '@/lib/utils/pii-filter';

export const runtime = 'edge';

/**
 * Structured safe-fallback payload returned when AI is unavailable.
 * Returned as a streaming chunk so the client (useChat) renders it
 * inside the assistant bubble instead of breaking the conversation.
 */
const FALLBACK_PAYLOAD = {
    status: 'success' as const,
    esi_level: null as number | null,
    reasoning: 'Servicio de IA no disponible.',
    suggested_action:
        'El asistente clínico no está disponible en este momento. Por favor, presente sus síntomas directamente al personal de enfermería del CESFAM. Si presenta dolor torácico, dificultad para respirar u otro signo de alarma, acuda inmediatamente al servicio de urgencias o llame al 131.',
    follow_up_question: null as string | null,
    error: true,
    message: FALLBACK_MESSAGE,
};

/**
 * Build a Vercel AI SDK-compatible data stream that delivers a single
 * JSON payload as the assistant message. This lets us return a safe
 * fallback without ever sending an HTTP 500 to the patient client.
 */
function buildFallbackStreamResponse(payload: unknown, statusCode: number = 200) {
    const json = JSON.stringify(payload);
    // Data-stream protocol: '0:' is a text-delta frame. We send the
    // entire JSON as a single text chunk so the client receives
    // message.content === JSON.stringify(payload) and existing parsing logic works.
    const encoder = new TextEncoder();
    const chunk = `0:${JSON.stringify(json)}\n`;
    const stream = new ReadableStream({
        start(controller) {
            controller.enqueue(encoder.encode(chunk));
            controller.close();
        },
    });
    return new Response(stream, {
        status: statusCode,
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'X-Triage-Fallback': '1',
        },
    });
}

/**
 * POST /api/triage
 * Analiza los síntomas del paciente y devuelve la clasificación ESI estructurada.
 *
 * Robustness contract:
 *   - Never returns HTTP 500 to the patient client.
 *   - When the AI service is unavailable (missing key, upstream error,
 *     timeout), returns a streamed safe-fallback JSON so the chat UI
 *     can render a clear Spanish message and offer a retry.
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
        // Returning a structured fallback ensures the patient never gets stuck.
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            console.error('[triage] ANTHROPIC_API_KEY is not configured');
            return buildFallbackStreamResponse(FALLBACK_PAYLOAD);
        }

        const sanitizedContent = sanitizeForAI(lastUserMessage.content);

        const anthropic = createAnthropic({ apiKey });

        const result = await streamText({
            model: anthropic('claude-3-5-sonnet-20240620'),
            system: TRIAGE_SYSTEM_PROMPT,
            messages: [
                ...messages.slice(0, -1),
                { ...lastUserMessage, content: sanitizedContent },
            ],
            temperature: 0.1,
        });

        return result.toDataStreamResponse();
    } catch (error) {
        console.error('[triage] AI error:', error);
        // Return a safe fallback stream so the chat client never sees HTTP 500.
        return buildFallbackStreamResponse(FALLBACK_PAYLOAD);
    }
}

/**
 * GET /api/triage
 * Lightweight health check that does NOT call the AI model.
 */
export async function GET() {
    return new Response(
        JSON.stringify({
            ok: true,
            ai_configured: Boolean(process.env.ANTHROPIC_API_KEY),
        }),
        {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        },
    );
}

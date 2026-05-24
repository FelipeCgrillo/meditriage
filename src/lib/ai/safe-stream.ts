/**
 * Safe data-stream helpers for /api/triage.
 *
 * Extracted so the mid-stream error handling can be unit-tested without
 * spinning up the AI SDK or hitting Anthropic.
 *
 * The Vercel AI SDK data-stream wire format encodes events as
 * `<code>:<json>\n` lines:
 *   0:"..."   text-delta (assistant content)
 *   3:"..."   error
 *   d:{...}   finish_message
 *   f:{...}   start_step
 *   e:{...}   finish_step
 * See node_modules/@ai-sdk/ui-utils/dist/index.mjs (streamParts).
 */

import { FALLBACK_MESSAGE } from './prompts';

export interface FallbackPayload {
    status: 'success';
    esi_level: number | null;
    reasoning: string;
    suggested_action: string;
    follow_up_question: string | null;
    error: true;
    message: string;
}

export const FALLBACK_PAYLOAD: FallbackPayload = {
    status: 'success',
    esi_level: null,
    reasoning: 'Servicio de IA no disponible.',
    suggested_action:
        'El asistente clínico no está disponible en este momento. Por favor, presente sus síntomas directamente al personal de enfermería del CESFAM. Si presenta dolor torácico, dificultad para respirar u otro signo de alarma, acuda inmediatamente al servicio de urgencias o llame al 131.',
    follow_up_question: null,
    error: true,
    message: FALLBACK_MESSAGE,
};

export const FALLBACK_JSON = JSON.stringify(FALLBACK_PAYLOAD);

export const PARTIAL_INTERRUPTION_NOTICE =
    '\n\n[Aviso: el análisis se interrumpió por un error del servicio de IA. Por favor reintente o consulte al personal de enfermería.]';

export function textDeltaFrame(text: string): string {
    return `0:${JSON.stringify(text)}\n`;
}

export function finishFrame(reason: string = 'error'): string {
    return `d:${JSON.stringify({ finishReason: reason, usage: { promptTokens: 0, completionTokens: 0 } })}\n`;
}

/**
 * Wrap a data-stream so mid-stream errors are swallowed and converted
 * into a safe-fallback text frame.
 *
 * Behavior:
 *   - If we have already emitted any `0:` text-delta chunk, an error
 *     mid-stream is appended as a Spanish interruption notice plus a
 *     finish frame. Partial assistant output is preserved.
 *   - If no `0:` chunk has been emitted yet, we replace the error
 *     entirely with the full FALLBACK_PAYLOAD plus a finish frame.
 */
export function buildSafeStreamTransformer(): TransformStream<Uint8Array, Uint8Array> {
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let buffer = '';
    let emittedTextDelta = false;
    let injectedFallback = false;

    return new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
            if (injectedFallback) return;

            buffer += decoder.decode(chunk, { stream: true });

            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
                if (!line) continue;
                const colonIdx = line.indexOf(':');
                if (colonIdx === -1) {
                    controller.enqueue(encoder.encode(line + '\n'));
                    continue;
                }
                const code = line.slice(0, colonIdx);

                if (code === '3') {
                    // eslint-disable-next-line no-console
                    console.error('[triage] mid-stream AI error frame intercepted:', line.slice(colonIdx + 1));
                    if (emittedTextDelta) {
                        controller.enqueue(encoder.encode(textDeltaFrame(PARTIAL_INTERRUPTION_NOTICE)));
                    } else {
                        controller.enqueue(encoder.encode(textDeltaFrame(FALLBACK_JSON)));
                    }
                    controller.enqueue(encoder.encode(finishFrame('error')));
                    injectedFallback = true;
                    return;
                }

                if (code === '0') {
                    emittedTextDelta = true;
                }
                controller.enqueue(encoder.encode(line + '\n'));
            }
        },
        flush(controller) {
            if (injectedFallback) return;
            if (buffer.length > 0) {
                controller.enqueue(encoder.encode(buffer));
            }
        },
    });
}

/**
 * Build a fully fallback data-stream response (no upstream AI involved).
 */
export function buildFallbackStreamResponse(payload: unknown = FALLBACK_PAYLOAD, statusCode: number = 200): Response {
    const json = JSON.stringify(payload);
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        start(controller) {
            controller.enqueue(encoder.encode(textDeltaFrame(json)));
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

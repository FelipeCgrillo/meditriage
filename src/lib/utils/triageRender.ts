/**
 * Pure helpers for rendering streaming assistant content in the patient
 * triage chat. Kept in a dependency-free module so the JSON-streaming
 * suppression logic can be unit-tested without spinning up React /
 * Vercel AI SDK / lucide.
 */

import { extractJSON } from './validation';

export interface TriageResponsePayload {
    status: 'success' | 'needs_info' | 'error';
    esi_level: number | null;
    reasoning?: string;
    suggested_action?: string;
    follow_up_question?: string | null;
    response_options?: string[];
    error?: boolean;
    message?: string;
}

export interface RenderedAssistant {
    hideBubble: boolean;
    content: string;
    options?: string[];
    esiLevel?: number | null;
}

export const STREAM_UNPARSEABLE_FALLBACK =
    'No fue posible interpretar la respuesta del asistente clínico. Por favor reintente o describa sus síntomas al personal de enfermería.';

/**
 * Decide what (if anything) to render for an assistant message.
 *
 * The /api/triage endpoint streams a structured JSON object token by
 * token. While that JSON is still incomplete, rendering the raw text
 * would briefly flash braces/keys to the patient. We therefore hide
 * the bubble entirely until a balanced JSON object is available (or
 * the stream settles into a recognisable shape).
 */
export function renderAssistantContent(
    raw: string,
    isStreaming: boolean,
    isLatest: boolean,
): RenderedAssistant {
    const payload = extractJSON<TriageResponsePayload>(raw);

    if (payload) {
        const visibleText =
            payload.status === 'needs_info'
                ? payload.follow_up_question || payload.suggested_action || ''
                : payload.suggested_action || payload.message || '';
        const options = Array.isArray(payload.response_options)
            ? payload.response_options.filter(
                  (o) => typeof o === 'string' && o.trim().length > 0,
              )
            : undefined;
        return {
            hideBubble: false,
            content: visibleText || '',
            options,
            esiLevel: payload.esi_level ?? null,
        };
    }

    // No parseable payload yet. While the latest message is still
    // streaming, suppress the bubble — the TypingIndicator already
    // signals progress.
    if (isStreaming && isLatest) {
        return { hideBubble: true, content: '' };
    }

    // Stream is settled but content never parsed: show a neutral
    // message instead of leaking braces/JSON keys.
    return { hideBubble: false, content: STREAM_UNPARSEABLE_FALLBACK };
}

/**
 * Pure helpers for rendering streaming assistant content in the patient
 * triage chat. Kept in a dependency-free module so the JSON-streaming
 * suppression logic can be unit-tested without spinning up React /
 * Vercel AI SDK / lucide.
 */

import { extractJSON } from './validation';

export interface TriageResponsePayload {
    status?: 'success' | 'needs_info' | 'error' | string;
    esi_level: number | null;
    reasoning?: string;
    suggested_action?: string;
    follow_up_question?: string | null;
    response_options?: string[];
    error?: boolean;
    message?: string;
}

function hasActionableFollowUp(payload: TriageResponsePayload): boolean {
    const q = payload.follow_up_question;
    if (typeof q === 'string' && q.trim().length > 0) return true;
    if (Array.isArray(payload.response_options)) {
        const nonEmpty = payload.response_options.filter(
            (o) => typeof o === 'string' && o.trim().length > 0,
        );
        if (nonEmpty.length > 0) return true;
    }
    return false;
}

/**
 * True when a parsed assistant payload represents a final triage
 * classification that the UI should finalize on.
 *
 * The model is *supposed* to emit `status: 'success'` for terminal
 * turns, but in practice it sometimes drops the status field, sends a
 * variant ('complete', 'done', etc.) or wraps the JSON in prose. We
 * treat any payload with a valid ESI level (1..5) as terminal as long
 * as it's not explicitly an error or a needs_info turn.
 *
 * Importantly, we DO NOT block finalization just because the payload
 * has residual `follow_up_question` or `response_options` fields — the
 * model occasionally emits both a `suggested_action` (terminal
 * recommendation) AND a follow-up template. If `status === 'success'`
 * the suggested_action wins; if there's no explicit status we still
 * trust a valid ESI level + a non-empty `suggested_action`.
 *
 * Errors and `needs_info` turns are explicitly excluded.
 */
export function isTerminalTriageResult(
    payload: TriageResponsePayload | null | undefined,
): boolean {
    if (!payload) return false;
    if (payload.error === true) return false;
    if (payload.status === 'error') return false;
    if (payload.status === 'needs_info') return false;
    const lvl = payload.esi_level;
    if (
        typeof lvl !== 'number' ||
        !Number.isInteger(lvl) ||
        lvl < 1 ||
        lvl > 5
    ) {
        return false;
    }
    // Explicit success: terminal regardless of leftover follow-up fields.
    if (payload.status === 'success') return true;
    // No explicit status: trust ESI + suggested_action as terminal.
    const action = payload.suggested_action;
    if (typeof action === 'string' && action.trim().length > 0) return true;
    // Otherwise, fall back to the conservative rule.
    if (hasActionableFollowUp(payload)) return false;
    return true;
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
        const terminal = isTerminalTriageResult(payload);
        const options =
            !terminal && Array.isArray(payload.response_options)
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

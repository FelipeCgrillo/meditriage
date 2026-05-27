/**
 * Pure helpers for assembling the `clinical_records` payload that the
 * patient triage chat persists to Supabase.
 *
 * Kept in a dependency-free module so the row-shape contract (which the
 * Supabase RLS policy enforces: patient_consent=true, symptoms_text length
 * >= 3, ai_response not null, esi_level 1..5) can be unit-tested without
 * spinning up React / Vercel AI SDK / Supabase.
 */

import type { TriageResponsePayload } from './triageRender';

export interface ChatMessageLike {
    role: 'user' | 'assistant' | 'system' | 'data' | 'tool';
    content: string;
}

export interface ConversationTurn {
    role: 'patient' | 'ai';
    content: string;
}

export interface DemographicData {
    gender: string | null;
    ageGroup: string | null;
}

export interface ClinicalRecordPayload {
    patient_consent: true;
    symptoms_text: string;
    ai_response: Record<string, unknown>;
    esi_level: number;
    nurse_validated: false;
    anonymous_code: string;
    patient_gender: string | null;
    patient_age_group: string | null;
    conversation_history: ConversationTurn[];
}

/**
 * Minimum length enforced by the `clinical_records` RLS check on
 * `symptoms_text`. Mirrored here so the client can produce a payload
 * that will survive the insert (and so callers can pre-detect the
 * "no symptoms captured" failure mode before round-tripping to PostgREST).
 */
export const SYMPTOMS_TEXT_MIN_LENGTH = 3;

/**
 * Pick the patient's free-text symptom messages out of the chat log.
 *
 * The first user turn after the demographic flow is the chief complaint
 * — quick-reply chips emitted later are also surfaced as `user` messages
 * by useChat, so we join them all with newlines to produce a single
 * symptoms blob that reflects the full free-text history (which is what
 * the researcher panel and ESI re-classification need).
 *
 * Returns an empty string when there are no user messages — callers
 * should treat that as a save-blocking error rather than silently
 * persisting an empty symptoms field.
 */
export function extractSymptomsText(messages: ChatMessageLike[]): string {
    return messages
        .filter((m) => m.role === 'user' && typeof m.content === 'string')
        .map((m) => m.content.trim())
        .filter((c) => c.length > 0)
        .join('\n')
        .trim();
}

/**
 * Build the researcher-facing conversation_history JSONB column.
 *
 * Maps user turns to `{role: 'patient'}` and assistant turns to
 * `{role: 'ai'}`. Assistant content is kept verbatim (it is the JSON
 * payload streamed by the model) so the investigator panel can replay
 * the full exchange, including follow-up questions and quick replies.
 *
 * Empty / non-string content is dropped so the array never carries
 * placeholder rows that would confuse downstream analysis.
 */
export function buildConversationHistory(
    messages: ChatMessageLike[],
): ConversationTurn[] {
    const turns: ConversationTurn[] = [];
    for (const m of messages) {
        if (m.role !== 'user' && m.role !== 'assistant') continue;
        if (typeof m.content !== 'string') continue;
        const content = m.content.trim();
        if (content.length === 0) continue;
        turns.push({
            role: m.role === 'user' ? 'patient' : 'ai',
            content,
        });
    }
    return turns;
}

/**
 * Assemble the full insert payload for the `clinical_records` table.
 *
 * Returns null when the payload would violate the RLS contract (no
 * symptoms captured, invalid ESI level, or missing AI response) so the
 * caller can surface a clear Spanish error instead of attempting the
 * insert and showing the "Evaluación Finalizada" screen on failure.
 */
export function buildClinicalRecordPayload(args: {
    messages: ChatMessageLike[];
    demographics: DemographicData;
    anonymousCode: string;
    aiResponse: TriageResponsePayload;
}): ClinicalRecordPayload | null {
    const symptomsText = extractSymptomsText(args.messages);
    if (symptomsText.length < SYMPTOMS_TEXT_MIN_LENGTH) return null;

    const esiLevel = args.aiResponse.esi_level;
    if (
        typeof esiLevel !== 'number' ||
        !Number.isInteger(esiLevel) ||
        esiLevel < 1 ||
        esiLevel > 5
    ) {
        return null;
    }

    return {
        patient_consent: true,
        symptoms_text: symptomsText,
        ai_response: args.aiResponse as unknown as Record<string, unknown>,
        esi_level: esiLevel,
        nurse_validated: false,
        anonymous_code: args.anonymousCode,
        patient_gender: args.demographics.gender,
        patient_age_group: args.demographics.ageGroup,
        conversation_history: buildConversationHistory(args.messages),
    };
}

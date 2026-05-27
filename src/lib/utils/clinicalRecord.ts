/**
 * Builders for the clinical_records insert payload used by the patient
 * triage chat. Pulled out of the React component so persistence logic can
 * be unit-tested without rendering the chat tree.
 */

export interface ChatMessageLike {
    role: 'user' | 'assistant' | 'system' | 'data' | 'tool' | string;
    content: string;
}

export interface ConversationTurn {
    role: 'patient' | 'ai';
    content: string;
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

export interface BuildPayloadInput {
    messages: ChatMessageLike[];
    aiResponse: Record<string, unknown>;
    esiLevel: number;
    anonymousCode: string;
    gender: string | null;
    ageGroup: string | null;
}

export function buildConversationHistory(
    messages: ChatMessageLike[],
): ConversationTurn[] {
    return messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({
            role: m.role === 'user' ? 'patient' : 'ai',
            content: m.content,
        }));
}

export function buildSymptomsText(messages: ChatMessageLike[]): string {
    return messages
        .filter((m) => m.role === 'user')
        .map((m) => m.content)
        .join('\n')
        .trim();
}

export function buildClinicalRecordPayload(
    input: BuildPayloadInput,
): ClinicalRecordPayload {
    return {
        patient_consent: true,
        symptoms_text: buildSymptomsText(input.messages),
        ai_response: input.aiResponse,
        esi_level: input.esiLevel,
        nurse_validated: false,
        anonymous_code: input.anonymousCode,
        patient_gender: input.gender,
        patient_age_group: input.ageGroup,
        conversation_history: buildConversationHistory(input.messages),
    };
}

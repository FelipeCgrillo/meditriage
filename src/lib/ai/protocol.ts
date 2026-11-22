import { TRIAGE_SYSTEM_PROMPT } from '@/lib/ai/prompts';
import { ANTHROPIC_EFFORT, getAnthropicModelId } from '@/lib/ai/config';
import { RULES_VERSION } from '@/lib/triage/rules';
import { DEID_VERSION } from '@/lib/dau/deidentify';

/**
 * Huella del protocolo congelado del estudio. Cada corrida DAU la registra
 * para demostrar que el modelo, el prompt, las reglas y el detector de
 * desidentificación no cambiaron entre corridas (protocolo CEC: "la versión
 * de reglas y de prompt queda congelada antes del análisis").
 */
export interface ProtocolFingerprint {
    model_id: string;
    prompt_sha256: string;
    rules_version: string;
    deid_version: string;
    effort: string;
}

async function sha256Hex(text: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

export async function getProtocolFingerprint(): Promise<ProtocolFingerprint> {
    return {
        model_id: getAnthropicModelId(),
        prompt_sha256: await sha256Hex(TRIAGE_SYSTEM_PROMPT),
        rules_version: RULES_VERSION,
        deid_version: DEID_VERSION,
        effort: ANTHROPIC_EFFORT,
    };
}

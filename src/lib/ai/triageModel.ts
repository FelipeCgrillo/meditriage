import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import {
    ANTHROPIC_EFFORT,
    ANTHROPIC_MAX_TOKENS,
    getAnthropicModelId,
} from '@/lib/ai/config';
import { TriageModelOutputSchema, type TriageModelOutput } from '@/lib/ai/schemas';

/**
 * Llamada única al modelo de triage mediante el SDK oficial de Anthropic,
 * con salida estructurada (`output_config.format`) derivada del esquema Zod.
 *
 * Compartida por el chat del paciente (/api/triage) y el análisis
 * retrospectivo DAU (classifyFromText). La respuesta se valida SIEMPRE con
 * Zod antes de usarse. Ante cualquier falla devuelve `{ ok: false }` y el
 * llamador emite el payload de contingencia segura.
 *
 * Resguardos del protocolo CEC (observación 6):
 *   - Solicitud independiente, sin Batch API ni Files API.
 *   - Sin identificadores del registro: el llamador entrega solo el relato
 *     sanitizado y el contexto demográfico.
 */

export interface TriageModelMessage {
    role: 'user' | 'assistant';
    content: string;
}

export type TriageModelResult =
    | { ok: true; data: TriageModelOutput; model: string }
    | { ok: false; reason: string; model: string };

/** Permite inyectar un cliente simulado en pruebas. */
export type TriageClientFactory = (apiKey: string) => Pick<Anthropic, 'messages'>;

let clientFactory: TriageClientFactory = (apiKey) => new Anthropic({ apiKey });

export function setTriageClientFactoryForTests(factory: TriageClientFactory | null): void {
    clientFactory = factory ?? ((apiKey) => new Anthropic({ apiKey }));
}

export async function callTriageModel(input: {
    system: string;
    messages: TriageModelMessage[];
}): Promise<TriageModelResult> {
    const model = getAnthropicModelId();
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return { ok: false, reason: 'missing_api_key', model };

    try {
        const client = clientFactory(apiKey);
        const response = await client.messages.parse({
            model,
            max_tokens: ANTHROPIC_MAX_TOKENS,
            system: input.system,
            messages: input.messages,
            output_config: {
                effort: ANTHROPIC_EFFORT,
                format: zodOutputFormat(TriageModelOutputSchema),
            },
        });

        if (response.stop_reason === 'refusal') {
            console.error('[triageModel] refusal', { model, stop_details: response.stop_details });
            return { ok: false, reason: 'refusal', model };
        }
        if (response.stop_reason === 'max_tokens') {
            return { ok: false, reason: 'max_tokens', model };
        }

        const parsed = TriageModelOutputSchema.safeParse(response.parsed_output);
        if (!parsed.success) {
            console.error('[triageModel] safeParse falló', {
                model,
                issues: parsed.error.issues.slice(0, 5),
            });
            return { ok: false, reason: 'schema_mismatch', model };
        }
        return { ok: true, data: parsed.data, model: response.model ?? model };
    } catch (err) {
        if (err instanceof Anthropic.APIError) {
            console.error('[triageModel] API error', { model, status: err.status, message: err.message });
            return { ok: false, reason: `api_error_${err.status ?? 'unknown'}`, model };
        }
        const e = err as { name?: string; message?: string } | null;
        console.error('[triageModel] error', { model, name: e?.name, message: e?.message });
        return { ok: false, reason: 'unexpected_error', model };
    }
}

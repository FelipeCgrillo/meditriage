import Anthropic from '@anthropic-ai/sdk';
import { extractJSON } from '@/lib/utils/validation';
import {
    ANTHROPIC_EFFORT,
    ANTHROPIC_MAX_TOKENS,
    getAnthropicModelId,
} from '@/lib/ai/config';
import { TriageModelOutputSchema, type TriageModelOutput } from '@/lib/ai/schemas';

/**
 * Llamada única al modelo de triage mediante el SDK oficial de Anthropic.
 *
 * El prompt exige un objeto JSON y nada más. La respuesta se extrae con un
 * parser tolerante y se valida SIEMPRE con Zod (`safeParse`) antes de usarse:
 * lo que no cumple el esquema se descarta y se emite la contingencia segura.
 *
 * No se usa la salida estructurada con gramática (`output_config.format`)
 * porque la API rechaza el esquema del CMD por complejidad ("Schema is too
 * complex"). La validación con Zod ofrece la misma garantía de forma:
 * ninguna respuesta malformada llega a la capa de aplicación.
 *
 * Compartida por el chat del paciente (/api/triage) y el análisis
 * retrospectivo DAU (classifyFromText).
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
        const response = await client.messages.create({
            model,
            max_tokens: ANTHROPIC_MAX_TOKENS,
            system: input.system,
            messages: input.messages,
            output_config: { effort: ANTHROPIC_EFFORT },
        });

        if (response.stop_reason === 'refusal') {
            console.error('[triageModel] refusal', { model, stop_details: response.stop_details });
            return { ok: false, reason: 'refusal', model };
        }
        if (response.stop_reason === 'max_tokens') {
            return { ok: false, reason: 'max_tokens', model };
        }

        const text = response.content
            .filter((b): b is Anthropic.TextBlock => b.type === 'text')
            .map((b) => b.text)
            .join('');
        const candidate = extractJSON<unknown>(text);
        if (candidate == null) {
            return { ok: false, reason: 'no_json', model };
        }

        const parsed = TriageModelOutputSchema.safeParse(candidate);
        if (!parsed.success) {
            console.error('[triageModel] safeParse falló', {
                model,
                issues: parsed.error.issues.slice(0, 5),
            });
            // Solo rutas y códigos de los campos inválidos, nunca sus valores.
            const where = parsed.error.issues
                .slice(0, 4)
                .map((i) => `${i.path.join('.')}:${i.code}`)
                .join(',');
            return { ok: false, reason: `schema_mismatch ${where}`, model };
        }
        return { ok: true, data: parsed.data, model: response.model ?? model };
    } catch (err) {
        if (err instanceof Anthropic.APIError) {
            console.error('[triageModel] API error', { model, status: err.status, message: err.message });
            // Diagnóstico sin datos del paciente: estado, tipo y mensaje del proveedor.
            const body = (err as unknown as { error?: { error?: { type?: string; message?: string } } }).error?.error;
            const detail = `${body?.type ?? ''} ${body?.message ?? ''}`.replace(/[^A-Za-z0-9_.:\- ]/g, '').trim();
            return { ok: false, reason: `api_error_${err.status ?? 'unknown'} ${detail}`.slice(0, 160), model };
        }
        const e = err as { name?: string; message?: string } | null;
        console.error('[triageModel] error', { model, name: e?.name, message: e?.message });
        return { ok: false, reason: 'unexpected_error', model };
    }
}

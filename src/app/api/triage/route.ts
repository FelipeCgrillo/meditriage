import { TRIAGE_SYSTEM_PROMPT } from '@/lib/ai/prompts';
import { sanitizeForAI } from '@/lib/utils/pii-filter';
import { DEFAULT_ANTHROPIC_MODEL, getAnthropicModelId } from '@/lib/ai/config';
import { FALLBACK_PAYLOAD, buildFallbackStreamResponse, finishFrame, textDeltaFrame } from '@/lib/ai/safe-stream';
import { callTriageModel } from '@/lib/ai/triageModel';
import { applyRuleEngineSafeguard, buildDemographicsSystemMessage } from '@/lib/triage/classify';

export const runtime = 'nodejs';

/** Límites de la conversación aceptada desde el cliente (abuso y costo). */
const MAX_MESSAGES = 30;
const MAX_MESSAGE_CHARS = 4000;

/**
 * POST /api/triage
 * Analiza los síntomas auto-reportados del paciente y devuelve la
 * clasificación ESI ESTRUCTURADA y validada por Zod.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * Salida estructurada REAL (Brecha 2):
 *   - Usa el SDK oficial de Anthropic con salida estructurada derivada de
 *     `TriageModelOutputSchema`, restringiendo la forma de la respuesta.
 *   - El objeto final se valida SIEMPRE con `safeParse` antes de emitirse.
 *     Si la validación falla → fallback seguro. Esto NO garantiza ausencia de
 *     alucinaciones de contenido; ELIMINA respuestas malformadas y restringe
 *     el espacio de salida.
 *
 * Safeguard híbrido + motor de reglas (Brecha 1):
 *   1. El LLM extrae las features del CMD (extracted_features) y propone un
 *      esi_level.
 *   2. `evaluateRules(features)` corre como salvaguarda determinista.
 *   3. Si el motor detecta ESI 1/2 y el LLM propuso un nivel menos grave,
 *      GANA el motor (principio del peor caso) → decision_source =
 *      'rule_engine_override'. Si el motor exige más info, se fuerza
 *      needs_info (fallo seguro).
 *   4. El payload reporta matched_rule, rule_rationale y decision_source.
 *
 * RESTRICCIÓN CLÍNICA: las features son AUTO-REPORTADAS; no se instrumentan
 * signos vitales.
 *
 * Robustez: nunca devuelve HTTP 500 al paciente; ante fallo de IA o de
 * validación emite un stream de fallback seguro en español.
 * ───────────────────────────────────────────────────────────────────────────
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

        type ChatMessage = { role: 'user' | 'assistant'; content: string };
        type Demographics = {
            gender?: string | null;
            ageGroup?: string | null;
        };
        const { messages: rawMessages, demographics } = body as {
            messages?: unknown;
            demographics?: Demographics;
        };

        // Solo se aceptan turnos user/assistant con texto acotado. Un rol
        // `system` enviado por el cliente se descarta (inyección de prompt).
        const messages: ChatMessage[] = Array.isArray(rawMessages)
            ? rawMessages
                  .filter(
                      (m): m is ChatMessage =>
                          !!m &&
                          typeof m === 'object' &&
                          ((m as ChatMessage).role === 'user' || (m as ChatMessage).role === 'assistant') &&
                          typeof (m as ChatMessage).content === 'string',
                  )
                  .slice(-MAX_MESSAGES)
                  .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }))
            : [];
        // La API exige que la conversación comience con un turno del usuario.
        while (messages.length > 0 && messages[0].role !== 'user') messages.shift();

        if (messages.length === 0) {
            return new Response(JSON.stringify({ error: 'Messages are required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // ---------------------------------------------------------------
        // Bloque de contexto demográfico. El cliente ya recolectó género
        // biológico y grupo etario en el wizard de consentimiento; se inyecta
        // aquí para que el modelo no lo vuelva a preguntar ni formule
        // preguntas anatómicamente imposibles. Helper compartido con el
        // módulo DAU para no duplicar el texto del prompt.
        // ---------------------------------------------------------------
        const demographicsSystemMessage = buildDemographicsSystemMessage(
            demographics?.gender,
            demographics?.ageGroup,
        );

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
            return buildFallbackStreamResponse(FALLBACK_PAYLOAD, 200, 'missing_api_key');
        }

        // Sanitize EVERY user message so previously submitted symptoms don't
        // leak PII into the AI context on follow-ups.
        const sanitizedMessages = messages.map((m) =>
            m.role === 'user' ? { ...m, content: sanitizeForAI(m.content) } : m,
        );

        const result = await callTriageModel({
            system: `${TRIAGE_SYSTEM_PROMPT}\n\n${demographicsSystemMessage}`,
            messages: sanitizedMessages,
        });
        if (!result.ok) {
            return buildFallbackStreamResponse(FALLBACK_PAYLOAD, 200, result.reason);
        }

        // Safeguard híbrido determinista (helper compartido con DAU). Se
        // emite como un único text-delta compatible con useChat.
        const finalResponse = applyRuleEngineSafeguard(result.data);
        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(encoder.encode(textDeltaFrame(JSON.stringify(finalResponse))));
                controller.enqueue(encoder.encode(finishFrame('stop')));
                controller.close();
            },
        });

        return new Response(stream, {
            status: 200,
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'X-Triage-Structured': '1',
            },
        });
    } catch (error) {
        const e = error as { name?: string; message?: string; statusCode?: number } | null;
        console.error('[triage] AI error', {
            model: getAnthropicModelId(),
            name: e?.name,
            status: e?.statusCode,
            message: e?.message,
        });
        return buildFallbackStreamResponse(FALLBACK_PAYLOAD, 200, 'unexpected_error');
    }
}

/**
 * GET /api/triage
 * Health check ligero que NO llama al modelo.
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

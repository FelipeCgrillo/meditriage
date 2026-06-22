import { streamObject } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { TRIAGE_SYSTEM_PROMPT } from '@/lib/ai/prompts';
import { sanitizeForAI } from '@/lib/utils/pii-filter';
import { DEFAULT_ANTHROPIC_MODEL, getAnthropicModelId } from '@/lib/ai/config';
import { FALLBACK_PAYLOAD, buildFallbackStreamResponse } from '@/lib/ai/safe-stream';
import { TriageResponseSchema, type TriageResponse } from '@/lib/ai/schemas';
import { evaluateRules } from '@/lib/triage/ruleEngine';
import type { CMDFeatures } from '@/lib/triage/cmd';

export const runtime = 'edge';

/**
 * POST /api/triage
 * Analiza los síntomas auto-reportados del paciente y devuelve la
 * clasificación ESI ESTRUCTURADA y validada por Zod.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * Salida estructurada REAL (Brecha 2):
 *   - Usa `streamObject` del Vercel AI SDK con `schema: TriageResponseSchema`,
 *     restringiendo el espacio de salida del modelo a la forma del schema.
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

        type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };
        type Demographics = {
            gender?: string | null;
            ageGroup?: string | null;
        };
        const { messages, demographics } = body as {
            messages?: ChatMessage[];
            demographics?: Demographics;
        };

        if (!messages || messages.length === 0) {
            return new Response(JSON.stringify({ error: 'Messages are required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // ---------------------------------------------------------------
        // Bloque de contexto demográfico. El cliente ya recolectó género
        // biológico y grupo etario en el wizard de consentimiento; se inyecta
        // aquí para que el modelo no lo vuelva a preguntar ni formule
        // preguntas anatómicamente imposibles.
        // ---------------------------------------------------------------
        const GENDER_LABEL: Record<string, string> = {
            M: 'masculino',
            F: 'femenino',
            Other: 'otro',
            'Prefer not to say': 'no declarado',
        };
        const AGE_LABEL: Record<string, string> = {
            Pediatric: 'pediátrico (0-17 años)',
            Adult: 'adulto (18-64 años)',
            Geriatric: 'geriátrico (65+ años)',
        };
        const genderText = demographics?.gender
            ? GENDER_LABEL[demographics.gender] ?? demographics.gender
            : 'no declarado';
        const ageText = demographics?.ageGroup
            ? AGE_LABEL[demographics.ageGroup] ?? demographics.ageGroup
            : 'no declarado';
        const demographicsSystemMessage = `### CONTEXTO DEL PACIENTE (ya recolectado en consentimiento)
Sexo biológico declarado: ${genderText}.
Grupo etario declarado: ${ageText}.

Usa estos datos para tus decisiones clínicas. NO los preguntes de nuevo. NO formules preguntas anatómicamente imposibles para el sexo declarado.`;

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
            return buildFallbackStreamResponse(FALLBACK_PAYLOAD);
        }

        // Sanitize EVERY user message so previously submitted symptoms don't
        // leak PII into the AI context on follow-ups.
        const sanitizedMessages = messages.map((m) =>
            m.role === 'user' ? { ...m, content: sanitizeForAI(m.content) } : m,
        );

        const anthropic = createAnthropic({ apiKey });
        const modelId = getAnthropicModelId();

        // ── Salida estructurada con Zod (streamObject) ──────────────────
        const result = await streamObject({
            model: anthropic(modelId),
            schema: TriageResponseSchema,
            system: `${TRIAGE_SYSTEM_PROMPT}\n\n${demographicsSystemMessage}`,
            messages: sanitizedMessages,
            temperature: 0.1,
        });

        // Emitimos un data-stream compatible con useChat: cuando el objeto
        // completo está disponible, aplicamos el safeguard híbrido, validamos
        // con safeParse y enviamos el JSON final como un único text-delta.
        const stream = buildStructuredStream(result, modelId);

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
        return buildFallbackStreamResponse(FALLBACK_PAYLOAD);
    }
}

/**
 * Aplica el safeguard híbrido (motor de reglas determinista) sobre el objeto
 * propuesto por el LLM y devuelve la respuesta final + el origen de la
 * decisión.
 */
function applyRuleEngineSafeguard(llmResponse: TriageResponse): TriageResponse {
    const features = (llmResponse.extracted_features ?? {}) as CMDFeatures;
    const evaluation = evaluateRules(features);

    // Punto de partida: lo que propuso el LLM.
    const merged: TriageResponse = {
        ...llmResponse,
        matched_rule: evaluation.matchedRule,
        rule_rationale: evaluation.rationale,
        decision_source: 'llm',
    };

    // Fallo seguro: el motor exige más información para descartar ESI 1/2.
    if (evaluation.needsInfo) {
        return {
            ...merged,
            status: 'needs_info',
            decision_source: 'rule_engine',
            follow_up_question:
                merged.follow_up_question ??
                'Para clasificar con seguridad necesito un poco más de información. ¿Puede describir si tiene dificultad para respirar, alteración de conciencia o algún otro síntoma grave?',
            reason_for_question:
                merged.reason_for_question ?? `Datos críticos faltantes: ${evaluation.missingCritical.join(', ')}.`,
        };
    }

    // Override del peor caso: si el motor detecta ESI 1/2 y el LLM propuso un
    // nivel MENOS grave (o ninguno), gana el motor.
    if (evaluation.esiLevel === 1 || evaluation.esiLevel === 2) {
        const llmLevel = merged.esi_level ?? Infinity;
        if (merged.status !== 'success' || llmLevel > evaluation.esiLevel) {
            return {
                ...merged,
                status: 'success',
                esi_level: evaluation.esiLevel,
                decision_source: 'rule_engine_override',
                reasoning: `${evaluation.rationale} (Regla ${evaluation.matchedRule}; sobre-escribe la propuesta del modelo por principio del peor caso.)`,
            };
        }
        // El LLM ya proponía un nivel igual o más grave: el motor lo confirma.
        return { ...merged, decision_source: 'rule_engine' };
    }

    // Sin criterio crítico: se conserva la propuesta del LLM en rango no crítico.
    return merged;
}

/**
 * Construye el ReadableStream final. Espera el objeto completo del modelo,
 * aplica el safeguard, valida con safeParse y emite un text-delta del AI SDK
 * (`0:"..."`) seguido de un finish frame, de modo que useChat/extractJSON lo
 * consuman sin cambios mayores en el cliente.
 */
function buildStructuredStream(
    result: { object: Promise<unknown> },
    modelId: string,
): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    const textDeltaFrame = (text: string) => `0:${JSON.stringify(text)}\n`;
    const finishFrame = (reason: string) =>
        `d:${JSON.stringify({ finishReason: reason, usage: { promptTokens: 0, completionTokens: 0 } })}\n`;

    return new ReadableStream<Uint8Array>({
        async start(controller) {
            try {
                // `result.object` resuelve con el objeto completo o rechaza si
                // la generación no produjo un objeto conforme al schema.
                const raw = await result.object;

                // Validación REAL con Zod antes de cualquier persistencia/uso.
                const parsed = TriageResponseSchema.safeParse(raw);
                if (!parsed.success) {
                    console.error('[triage] safeParse falló sobre la salida del modelo', {
                        model: modelId,
                        issues: parsed.error.issues.slice(0, 5),
                    });
                    controller.enqueue(encoder.encode(textDeltaFrame(JSON.stringify(FALLBACK_PAYLOAD))));
                    controller.enqueue(encoder.encode(finishFrame('error')));
                    controller.close();
                    return;
                }

                // Safeguard híbrido determinista.
                const finalResponse = applyRuleEngineSafeguard(parsed.data);

                controller.enqueue(encoder.encode(textDeltaFrame(JSON.stringify(finalResponse))));
                controller.enqueue(encoder.encode(finishFrame('stop')));
                controller.close();
            } catch (err) {
                const e = err as { name?: string; message?: string; statusCode?: number } | null;
                console.error('[triage] provider/stream error', {
                    model: modelId,
                    name: e?.name,
                    status: e?.statusCode,
                    message: e?.message,
                });
                controller.enqueue(encoder.encode(textDeltaFrame(JSON.stringify(FALLBACK_PAYLOAD))));
                controller.enqueue(encoder.encode(finishFrame('error')));
                controller.close();
            }
        },
    });
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

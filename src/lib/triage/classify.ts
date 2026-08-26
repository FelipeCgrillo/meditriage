import { streamObject } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { TRIAGE_SYSTEM_PROMPT } from '@/lib/ai/prompts';
import { getAnthropicModelId } from '@/lib/ai/config';
import { sanitizeForAI } from '@/lib/utils/pii-filter';
import { FALLBACK_PAYLOAD } from '@/lib/ai/safe-stream';
import { TriageResponseSchema, type TriageResponse } from '@/lib/ai/schemas';
import { evaluateRules } from '@/lib/triage/ruleEngine';
import type { CMDFeatures } from '@/lib/triage/cmd';
import {
    dispositionFromEsi,
    suggestedActionForDisposition,
} from '@/lib/triage/disposition';
import {
    buildCriticalScreeningQuestion,
    enforceSingleQuestion,
    MAX_RULE_ENGINE_FOLLOW_UPS,
    RULE_ENGINE_SAFE_EXIT_ESI,
} from '@/lib/triage/followUp';

/**
 * Helper compartido de clasificación de triage.
 *
 * Centraliza la lógica que antes vivía embebida en
 * `src/app/api/triage/route.ts`:
 *   1. Extracción estructurada de las features del CMD por el LLM
 *      (`streamObject` + `TriageResponseSchema`).
 *   2. Validación REAL con `safeParse`.
 *   3. Salvaguarda determinista (`evaluateRules` + `applyRuleEngineSafeguard`).
 *
 * Lo usan DOS consumidores:
 *   - El chat del paciente (`/api/triage`), en tiempo real.
 *   - El módulo batch de análisis de DAU (`/api/dau`), de forma retrospectiva,
 *     SIMULANDO el chat: solo entra el texto libre auto-reportado + demográficos.
 *
 * RESTRICCIÓN CLÍNICA (no negociable): las features son AUTO-REPORTADAS. El
 * sistema NO instrumenta signos vitales. En la vía DAU jamás se inyectan los
 * signos vitales medidos del registro: solo el motivo de consulta y los
 * síntomas relatados + sexo/edad.
 */

/** Etiquetas legibles del sexo declarado, para el contexto del modelo. */
const GENDER_LABEL: Record<string, string> = {
    M: 'masculino',
    F: 'femenino',
    Other: 'otro',
    'Prefer not to say': 'no declarado',
};

/** Etiquetas legibles del grupo etario declarado. */
const AGE_LABEL: Record<string, string> = {
    Pediatric: 'pediátrico (0-17 años)',
    Adult: 'adulto (18-64 años)',
    Geriatric: 'geriátrico (65+ años)',
};

/**
 * Construye el bloque de contexto demográfico que se inyecta como mensaje de
 * sistema adicional (mismo texto que usaba el chat). Centralizado aquí para
 * que chat y DAU compartan exactamente el mismo prompt de contexto.
 */
export function buildDemographicsSystemMessage(
    gender?: string | null,
    ageGroup?: string | null,
): string {
    const genderText = gender ? GENDER_LABEL[gender] ?? gender : 'no declarado';
    const ageText = ageGroup ? AGE_LABEL[ageGroup] ?? ageGroup : 'no declarado';
    return `### CONTEXTO DEL PACIENTE (ya recolectado en consentimiento)
Sexo biológico declarado: ${genderText}.
Grupo etario declarado: ${ageText}.

Usa estos datos para tus decisiones clínicas. NO los preguntes de nuevo. NO formules preguntas anatómicamente imposibles para el sexo declarado.`;
}

/**
 * Aplica el safeguard híbrido (motor de reglas determinista) sobre el objeto
 * propuesto por el LLM y devuelve la respuesta final + el origen de la
 * decisión. Función PURA: misma entrada → misma salida (delegada al motor
 * determinista). No depende de azar, reloj ni red.
 */
export function applyRuleEngineSafeguard(
    llmResponse: TriageResponse,
    options: { retrospective?: boolean; ruleEngineFollowUps?: number } = {},
): TriageResponse {
    const features = (llmResponse.extracted_features ?? {}) as CMDFeatures;
    const evaluation = evaluateRules(features, { retrospective: options.retrospective });

    // Punto de partida: lo que propuso el LLM. La repregunta se recorta a UNA
    // sola pregunta: la UI admite una respuesta por turno, y las preguntas
    // compuestas dejaban partes sin responder que el modelo repetía después.
    const merged: TriageResponse = {
        ...llmResponse,
        follow_up_question: llmResponse.follow_up_question
            ? enforceSingleQuestion(llmResponse.follow_up_question)
            : llmResponse.follow_up_question,
        matched_rule: evaluation.matchedRule,
        rule_rationale: evaluation.rationale,
        decision_source: 'llm',
    };

    /**
     * Aplica la política de derivación clínica sobre una respuesta ya
     * clasificada como success: calcula `disposition` y reemplaza
     * `suggested_action` por el texto estandarizado. Fuente única de verdad
     * para el chat y el módulo DAU (Brecha /goal PRD).
     */
    const withDisposition = (r: TriageResponse): TriageResponse => {
        if (r.status !== 'success') return r;
        const disposition = dispositionFromEsi(r.esi_level ?? null);
        if (!disposition) return r;
        return {
            ...r,
            disposition,
            suggested_action: suggestedActionForDisposition(disposition),
        };
    };

    // Fallo seguro: el motor exige más información para descartar ESI 1/2.
    if (evaluation.needsInfo) {
        const asked = options.ruleEngineFollowUps ?? 0;

        // Salida segura: agotado el tamizaje, cerramos con una clasificación
        // conservadora en vez de repreguntar sin fin. Sin este tope, un
        // paciente cuyo relato nunca menciona los criterios críticos queda
        // atrapado respondiendo la misma pregunta.
        if (asked >= MAX_RULE_ENGINE_FOLLOW_UPS) {
            const llmLevel = merged.esi_level;
            // Se conserva lo más grave entre la propuesta del modelo y el
            // nivel de salida (principio del peor caso).
            const safeLevel =
                typeof llmLevel === 'number' && llmLevel < RULE_ENGINE_SAFE_EXIT_ESI
                    ? llmLevel
                    : RULE_ENGINE_SAFE_EXIT_ESI;
            return withDisposition({
                ...merged,
                status: 'success',
                esi_level: safeLevel,
                follow_up_question: null,
                response_options: [],
                decision_source: 'rule_engine_safe_exit',
                reasoning: `${evaluation.rationale} Tras ${asked} intentos de tamizaje no fue posible descartar criterios críticos (${evaluation.missingCritical.join(', ')}); se cierra en ESI ${safeLevel} para atención presencial en vez de prolongar el interrogatorio.`,
            });
        }

        // Tamizaje dirigido SOLO a los criterios que siguen faltando, en una
        // sola pregunta con opciones cerradas para que el paciente pueda
        // descartarlos todos de una vez.
        const screening = buildCriticalScreeningQuestion(evaluation.missingCritical);
        return {
            ...merged,
            status: 'needs_info',
            // Un turno de repregunta no lleva nivel: un ESI preliminar aquí
            // se filtraba al paciente antes de que la enfermera lo viera.
            esi_level: null,
            decision_source: 'rule_engine',
            follow_up_question: screening.question,
            response_options: screening.options,
            reason_for_question:
                merged.reason_for_question ??
                `Datos críticos faltantes: ${evaluation.missingCritical.join(', ')}.`,
        };
    }

    // Override del peor caso resuelto abajo. Antes, si el LLM ya llegó a
    // status=success sin criterio crítico, aplicamos disposición al vuelo.

    // Override del peor caso: si el motor detecta ESI 1/2 y el LLM propuso un
    // nivel MENOS grave (o ninguno), gana el motor.
    if (evaluation.esiLevel === 1 || evaluation.esiLevel === 2) {
        const llmLevel = merged.esi_level ?? Infinity;
        if (merged.status !== 'success' || llmLevel > evaluation.esiLevel) {
            return withDisposition({
                ...merged,
                status: 'success',
                esi_level: evaluation.esiLevel,
                decision_source: 'rule_engine_override',
                reasoning: `${evaluation.rationale} (Regla ${evaluation.matchedRule}; sobre-escribe la propuesta del modelo por principio del peor caso.)`,
            });
        }
        // El LLM ya proponía un nivel igual o más grave: el motor lo confirma.
        return withDisposition({ ...merged, decision_source: 'rule_engine' });
    }

    // Sin criterio crítico: se conserva la propuesta del LLM en rango no crítico
    // y se aplica la política de derivación (ESI 3 → APS mismo día, ESI 4-5 →
    // atención al día siguiente).
    return withDisposition(merged);
}

/** Entrada de la clasificación a partir de texto libre auto-reportado. */
export interface ClassifyFromTextInput {
    /** Motivo de consulta (texto libre auto-referido). ENTRA al modelo. */
    chiefComplaint: string;
    /** Síntomas/antecedentes relatados (texto libre). ENTRA al modelo. */
    reportedSymptoms?: string | null;
    /** Sexo biológico declarado: 'M' | 'F' | 'Other' | etc. Contexto, no clínico. */
    gender?: string | null;
    /** Grupo etario: 'Pediatric' | 'Adult' | 'Geriatric'. Contexto, no clínico. */
    ageGroup?: string | null;
    /**
     * Modo retrospectivo de un solo turno (Vía B / DAU). Cuando es `true`, los
     * criterios críticos no referidos se asumen ausentes (negativo presunto) en
     * vez de forzar `needs_info`. El chat en vivo lo deja en `false` (default).
     */
    retrospective?: boolean;
}

/**
 * Concatena motivo de consulta + síntomas relatados en un único "mensaje de
 * usuario" simulado, equivalente a lo que el paciente habría escrito en el chat.
 * SOLO texto libre auto-reportado: nunca signos vitales instrumentados.
 */
export function buildSimulatedUserMessage(input: ClassifyFromTextInput): string {
    const parts = [input.chiefComplaint?.trim(), input.reportedSymptoms?.trim()]
        .filter((p): p is string => Boolean(p && p.length > 0));
    return parts.join('. ');
}

/**
 * Clasifica un caso de triage a partir de texto libre auto-reportado.
 *
 * Internamente:
 *   - Construye el mensaje de usuario simulado (motivo + síntomas).
 *   - Sanitiza PII antes de enviarlo al modelo.
 *   - Llama a `streamObject` con `schema: TriageResponseSchema` (temperature 0.1).
 *   - DRENA el stream para forzar la resolución del objeto (ver nota de regresión).
 *   - Valida con `safeParse`; si falla → payload de fallback seguro.
 *   - Corre el safeguard híbrido determinista.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * NOTA DE REGRESIÓN (chat colgado en "Analizando síntomas…"):
 *   `streamObject(...).object` es una promesa que SOLO se resuelve cuando el
 *   `originalStream` del resultado se consume (la resolución ocurre dentro del
 *   `transform`/`flush` del stream, ver node_modules/ai/dist/index.mjs). Si se
 *   hace `await result.object` SIN consumir ningún stream, la promesa nunca
 *   resuelve y el endpoint queda colgado → el cliente nunca recibe frames y se
 *   queda en "Analizando síntomas…". Aquí drenamos `partialObjectStream` para
 *   empujar la generación y permitir que `result.object` resuelva.
 * ───────────────────────────────────────────────────────────────────────────
 */
export async function classifyFromText(input: ClassifyFromTextInput): Promise<TriageResponse> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        // Sin API key no podemos clasificar; devolvemos el fallback seguro.
        return { ...(FALLBACK_PAYLOAD as unknown as TriageResponse) };
    }

    const simulated = buildSimulatedUserMessage(input);
    const sanitized = sanitizeForAI(simulated);

    const anthropic = createAnthropic({ apiKey });
    const modelId = getAnthropicModelId();
    const demographicsSystemMessage = buildDemographicsSystemMessage(input.gender, input.ageGroup);

    try {
        const result = await streamObject({
            model: anthropic(modelId),
            schema: TriageResponseSchema,
            system: `${TRIAGE_SYSTEM_PROMPT}\n\n${demographicsSystemMessage}`,
            messages: [{ role: 'user', content: sanitized }],
            temperature: 0.1,
        });

        // Drenar el stream para DRIVE la generación (ver nota de regresión).
        // No usamos los parciales; solo necesitamos que el transform corra y
        // resuelva `result.object`.
        // eslint-disable-next-line no-empty
        for await (const _partial of result.partialObjectStream) {
            void _partial;
        }

        const raw = await result.object;
        const parsed = TriageResponseSchema.safeParse(raw);
        if (!parsed.success) {
            console.error('[classify] safeParse falló sobre la salida del modelo', {
                model: modelId,
                issues: parsed.error.issues.slice(0, 5),
            });
            return { ...(FALLBACK_PAYLOAD as unknown as TriageResponse) };
        }

        return applyRuleEngineSafeguard(parsed.data, { retrospective: input.retrospective });
    } catch (err) {
        const e = err as { name?: string; message?: string; statusCode?: number } | null;
        console.error('[classify] provider/validation error', {
            model: modelId,
            name: e?.name,
            status: e?.statusCode,
            message: e?.message,
        });
        return { ...(FALLBACK_PAYLOAD as unknown as TriageResponse) };
    }
}

import { z } from 'zod/v4';
import { CMDSchema } from '@/lib/triage/cmd';

/**
 * Origen de la decisión ESI final.
 *  - 'llm'                 → el nivel propuesto por el LLM se mantuvo.
 *  - 'rule_engine'         → el motor determinista asignó el nivel directamente.
 *  - 'rule_engine_override'→ el motor detectó ESI 1/2 y sobre-escribió un nivel
 *                            menos grave propuesto por el LLM (peor caso).
 */
export const DecisionSourceSchema = z.enum(['llm', 'rule_engine', 'rule_engine_override']);
export type DecisionSource = z.infer<typeof DecisionSourceSchema>;

/**
 * Zod schema for completed ESI Triage Result
 * Used when AI has enough information to classify
 */
export const TriageResultSchema = z.object({
    esi_level: z
        .number()
        .int()
        .min(1)
        .max(5)
        .describe('Emergency Severity Index Level (1=Critical, 5=Non-Urgent)'),

    critical_signs: z
        .array(z.string())
        .describe('Array of identified critical signs or symptoms'),

    reasoning: z
        .string()
        .min(20)
        .describe('Detailed clinical reasoning using medical terminology in Spanish'),

    suggested_specialty: z
        .string()
        .describe('Recommended medical specialty (e.g., Traumatología, Medicina General, Cardiología)'),
});

export type TriageResult = z.infer<typeof TriageResultSchema>;

/**
 * Schema flexible para respuestas del agente de triage.
 *
 * IMPORTANTE: el valor de `status` debe coincidir EXACTAMENTE con el que
 * pide el system prompt (ver src/lib/ai/prompts.ts). Históricamente este
 * schema usaba 'completed' mientras que el prompt y todo el runtime
 * (ChatInterface, TriageChatLegacy) usan 'success'. Eso producía dos
 * fuentes de verdad y dejaba el schema inservible para validar.
 * Aquí lo alineamos a 'success' | 'needs_info'.
 */
export const TriageResponseSchema = z.object({
    // Status field - determina el tipo de respuesta.
    status: z
        .enum(['success', 'needs_info'])
        .describe("Response status: 'success' if AI can classify, 'needs_info' if more information is needed"),

    // Campos cuando status='success' (todos opcionales en el schema porque
    // su presencia depende del status; el API route puede validar la
    // combinación correcta).
    esi_level: z
        .number()
        .int()
        .min(1)
        .max(5)
        .nullable()
        .optional()
        .describe('Emergency Severity Index Level (1=Critical, 5=Non-Urgent). Required when status=success'),

    reasoning: z
        .string()
        .optional()
        .describe('Detailed clinical reasoning using medical terminology in Spanish. Required when status=success'),

    suggested_action: z
        .string()
        .optional()
        .describe('Clear and direct instruction for the patient (e.g., where to go, what to do while waiting). Required when status=success'),

    critical_signs: z
        .array(z.string())
        .optional()
        .describe('Optional array of identified critical signs or symptoms (legacy field, kept for backwards compatibility)'),

    suggested_specialty: z
        .string()
        .optional()
        .describe('Optional recommended medical specialty (legacy field, kept for backwards compatibility)'),

    // Campos cuando status='needs_info'.
    follow_up_question: z
        .string()
        .nullable()
        .optional()
        .describe("Clinical question to clarify ambiguity. Required when status=needs_info. Example: '¿Desde hace cuánto?' or '¿Tiene ideas suicidas?'"),

    reason_for_question: z
        .string()
        .optional()
        .describe("Explanation of why more information is needed. Required when status=needs_info. Example: 'Input vago sin síntomas físicos'"),

    response_options: z
        .array(z.string())
        .max(5)
        .optional()
        .describe("Suggested quick reply options for the patient (max 5). Example: ['Sí', 'No', 'No estoy seguro']. Recommended when status=needs_info."),

    // ── Features estructuradas del CMD extraídas por el LLM ──────────────
    // El LLM rellena SOLO lo que el paciente refirió en la conversación
    // (auto-reporte; el sistema no instrumenta signos vitales). El motor de
    // reglas determinista (ruleEngine.ts) opera sobre este objeto.
    extracted_features: CMDSchema.optional().describe(
        'CMD auto-reportado extraído de la conversación. Rellenar solo lo que el paciente refirió; el resto se omite.',
    ),

    // ── Campos del motor de reglas (se añaden SERVER-SIDE tras evaluar) ──
    // No los rellena el LLM; los completa route.ts tras correr el motor.
    matched_rule: z
        .string()
        .nullable()
        .optional()
        .describe('Id de la regla ESI que disparó en el motor determinista (P1.1–P5.1), o null.'),

    rule_rationale: z
        .string()
        .optional()
        .describe('Justificación clínica de la regla disparada o del fallo seguro del motor.'),

    decision_source: DecisionSourceSchema.optional().describe(
        'Origen de la decisión final: llm | rule_engine | rule_engine_override.',
    ),

    // ── Disposición clínica (política de derivación por nivel ESI) ─────
    // Se completa SIEMPRE server-side a partir de esi_level en
    // applyRuleEngineSafeguard. El LLM NO la rellena.
    disposition: z
        .enum(['emergency', 'same_day_primary_care', 'next_day_primary_care'])
        .nullable()
        .optional()
        .describe(
            'Vía de atención derivada del nivel ESI: emergency (ESI 1-2), same_day_primary_care (ESI 3), next_day_primary_care (ESI 4-5).',
        ),

    // ── Trazabilidad para el análisis de ablación (server-side) ─────────
    // Nivel y estado que propuso el LLM ANTES del safeguard determinista.
    // Permite medir por separado el LLM aislado y el sistema integrado.
    llm_esi_level: z
        .number()
        .int()
        .min(1)
        .max(5)
        .nullable()
        .optional()
        .describe('ESI propuesto por el LLM antes del motor de reglas (server-side).'),
    llm_status: z
        .enum(['success', 'needs_info'])
        .optional()
        .describe('Estado propuesto por el LLM antes del motor de reglas (server-side).'),
});

export type TriageResponse = z.infer<typeof TriageResponseSchema>;

/**
 * Esquema que se entrega al modelo como salida estructurada. Excluye los
 * campos que completa SOLO el servidor (motor de reglas, disposición y
 * trazabilidad), para que el modelo no pueda rellenarlos.
 */
/**
 * CMD que se ofrece al modelo. La salida estructurada de Anthropic limita la
 * cantidad de parámetros opcionales del esquema, así que:
 *   - Las variables cualitativas pasan a OBLIGATORIAS: el modelo responde
 *     "no_referido" cuando el paciente no las mencionó. El motor de reglas ya
 *     trata 'no_referido' y la ausencia de la clave de forma idéntica.
 *   - consent_signed y anonymous_code (metadata) no se ofrecen al modelo.
 */
export const CMDModelSchema = CMDSchema.omit({ consent_signed: true, anonymous_code: true }).required({
    symptom_onset: true,
    age_group: true,
    vital_signs_abnormal: true,
    oxygen_sat_reported: true,
    heart_rate_reported: true,
    respiratory_difficulty_reported: true,
    bp_reported: true,
    fever_reported: true,
    consciousness_reported: true,
    pregnancy_status: true,
});

/**
 * Esquema que se entrega al modelo como salida estructurada. Excluye los
 * campos que completa SOLO el servidor (motor de reglas, disposición y
 * trazabilidad) y los campos heredados que ningún consumidor usa
 * (critical_signs, suggested_specialty).
 */
export const TriageModelOutputSchema = TriageResponseSchema.omit({
    matched_rule: true,
    rule_rationale: true,
    decision_source: true,
    disposition: true,
    llm_esi_level: true,
    llm_status: true,
    critical_signs: true,
    suggested_specialty: true,
    extracted_features: true,
}).extend({
    extracted_features: CMDModelSchema.describe(
        'CMD auto-reportado extraído de la conversación. Variables cualitativas siempre presentes (no_referido si no se mencionó).',
    ),
});

export type TriageModelOutput = z.infer<typeof TriageModelOutputSchema>;

/**
 * Input schema for triage API
 */
export const TriageInputSchema = z.object({
    symptoms: z
        .string()
        .min(2, 'La respuesta debe tener al menos 2 caracteres')
        .max(2000, 'La respuesta no puede exceder 2000 caracteres'),

    patient_id: z.string().uuid().optional(),
    nurse_id: z.string().uuid().optional(),
});

export type TriageInput = z.infer<typeof TriageInputSchema>;

import { z } from 'zod';

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
});

export type TriageResponse = z.infer<typeof TriageResponseSchema>;

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

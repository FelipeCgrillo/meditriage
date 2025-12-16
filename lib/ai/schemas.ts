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
 * Flexible schema for AI responses with optional fields
 * AI SDK has issues with discriminated unions, so we use optional fields
 * and validate the response type in the API route
 */
export const TriageResponseSchema = z.object({
    // Status field - determines response type
    status: z
        .enum(['completed', 'needs_info'])
        .describe("Response status: 'completed' if AI can classify, 'needs_info' if more information is needed"),

    // Fields for 'completed' status (optional - present when status='completed')
    esi_level: z
        .number()
        .int()
        .min(1)
        .max(5)
        .optional()
        .describe('Emergency Severity Index Level (1=Critical, 5=Non-Urgent). Required when status=completed'),

    critical_signs: z
        .array(z.string())
        .optional()
        .describe('Array of identified critical signs or symptoms. Required when status=completed'),

    reasoning: z
        .string()
        .optional()
        .describe('Detailed clinical reasoning using medical terminology in Spanish. Required when status=completed'),

    suggested_specialty: z
        .string()
        .optional()
        .describe('Recommended medical specialty. Required when status=completed'),

    // Fields for 'needs_info' status (optional - present when status='needs_info')
    follow_up_question: z
        .string()
        .optional()
        .describe("Clinical question to clarify ambiguity. Required when status=needs_info. Example: '¿Desde hace cuánto?' or '¿Tiene ideas suicidas?'"),

    reason_for_question: z
        .string()
        .optional()
        .describe("Explanation of why more information is needed. Required when status=needs_info. Example: 'Input vago sin síntomas físicos'"),
});

export type TriageResponse = z.infer<typeof TriageResponseSchema>;

/**
 * Input schema for triage API
 */
export const TriageInputSchema = z.object({
    symptoms: z
        .string()
        .min(10, 'Los síntomas deben tener al menos 10 caracteres')
        .max(2000, 'Los síntomas no pueden exceder 2000 caracteres'),

    patient_id: z.string().uuid().optional(),
    nurse_id: z.string().uuid().optional(),
});

export type TriageInput = z.infer<typeof TriageInputSchema>;

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
 * Flexible schema for AI responses with optional/nullable fields
 * AI SDK has issues with discriminated unions, so we use optional fields
 * and validate the response type in the API route
 * 
 * JSON Consistency Rules:
 * - When status='completed': esi_level, critical_signs, reasoning, suggested_specialty are REQUIRED
 * - When status='needs_info': those fields should be null, and follow_up_question is REQUIRED
 */
export const TriageResponseSchema = z.object({
    // Status field - determines response type
    status: z
        .enum(['completed', 'needs_info'])
        .describe("Response status: 'completed' if AI can classify, 'needs_info' if more information is needed"),

    // Fields for 'completed' status (nullable - null when status='needs_info')
    esi_level: z
        .number()
        .int()
        .min(1)
        .max(5)
        .nullable()
        .optional()
        .describe('Emergency Severity Index Level (1=Critical, 5=Non-Urgent). Required when status=completed, null when status=needs_info'),

    critical_signs: z
        .preprocess(
            // AI sometimes returns a single string instead of array - normalize it
            // Also handle null values
            (val) => {
                if (val === null || val === undefined) return null;
                return typeof val === 'string' ? [val] : val;
            },
            z.array(z.string()).nullable()
        )
        .optional()
        .describe('Array of identified critical signs or symptoms. Required when status=completed, null when status=needs_info'),

    reasoning: z
        .string()
        .nullable()
        .optional()
        .describe('Detailed clinical reasoning using medical terminology in Spanish. Required when status=completed, null when status=needs_info'),

    suggested_specialty: z
        .string()
        .nullable()
        .optional()
        .describe('Recommended medical specialty. Required when status=completed, null when status=needs_info'),

    // Fields for 'needs_info' status (optional - present only when status='needs_info')
    follow_up_question: z
        .string()
        .optional()
        .describe("Clinical question to clarify ambiguity. Required when status=needs_info. Example: '¿Desde hace cuánto?' or '¿Tiene ideas suicidas?'"),

    reason_for_question: z
        .string()
        .optional()
        .describe("Explanation of why more information is needed. Required when status=needs_info. Example: 'Input vago sin síntomas físicos'"),

    // Quick-reply options for conversational flow
    suggested_options: z
        .array(z.string())
        .max(5)
        .optional()
        .describe("Array of quick-reply options when status=needs_info. Max 5 options. Example: ['Dolor fuerte', 'Dolor moderado', 'Dolor leve']"),
});

export type TriageResponse = z.infer<typeof TriageResponseSchema>;

/**
 * Input schema for triage API
 */
export const TriageInputSchema = z.object({
    symptoms: z
        .string()
        .min(3, 'Los síntomas deben tener al menos 3 caracteres')
        .max(2000, 'Los síntomas no pueden exceder 2000 caracteres'),

    patient_id: z.string().uuid().optional(),
    nurse_id: z.string().uuid().optional(),
});

export type TriageInput = z.infer<typeof TriageInputSchema>;

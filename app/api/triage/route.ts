import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { TRIAGE_SYSTEM_PROMPT, FALLBACK_MESSAGE } from '@/lib/ai/prompts';
import { sanitizeForAI } from '@/lib/utils/pii-filter';

export const runtime = 'edge';

/**
 * POST /api/triage
 * Analyzes patient symptoms and returns ESI classification via streaming
 */
export async function POST(req: Request) {
    try {
        const body = await req.json();
        let { symptoms } = body;

        if (!symptoms) {
            return new Response(JSON.stringify({ error: 'Symptoms are required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // 1. Sanitizar datos del paciente (PII)
        const sanitizedSymptoms = sanitizeForAI(symptoms);

        // 2. Llamada a la IA con Streaming
        const result = await streamText({
            model: anthropic('claude-3-5-sonnet-20240620'),
            system: TRIAGE_SYSTEM_PROMPT,
            prompt: `Paciente presenta los siguientes síntomas: ${sanitizedSymptoms}`,
            temperature: 0.3,
        });

        return result.toDataStreamResponse();

    } catch (error) {
        console.error('Triage AI Error:', error);

        // Respuesta de fallback de seguridad
        return new Response(
            JSON.stringify({
                status: 'error',
                esi_level: 2, // Por precaución asumimos prioridad alta en error
                reasoning: 'Error técnico en el procesamiento de IA.',
                suggested_action: 'Error técnico, acuda a urgencias por precaución.',
                follow_up_question: null,
                message: FALLBACK_MESSAGE
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
}




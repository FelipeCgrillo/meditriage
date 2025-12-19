import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { TRIAGE_SYSTEM_PROMPT, FALLBACK_MESSAGE } from '@/lib/ai/prompts';
import { sanitizeForAI } from '@/lib/utils/pii-filter';

export const runtime = 'edge';

/**
 * POST /api/triage
 * Analiza los síntomas del paciente y devuelve la clasificación ESI estructurada
 */
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { messages } = body;

        if (!messages || messages.length === 0) {
            return new Response(JSON.stringify({ error: 'Messages are required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Obtener el último mensaje del usuario
        const lastUserMessage = messages[messages.length - 1];
        if (lastUserMessage.role !== 'user') {
            return new Response(JSON.stringify({ error: 'Last message must be from user' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // 1. Sanitizar input para evitar PII (identificadores personales)
        const sanitizedContent = sanitizeForAI(lastUserMessage.content);

        // 2. Ejecutar análisis con IA (Claude 3.5 Sonnet)
        const result = await streamText({
            model: anthropic('claude-3-5-sonnet-20240620'),
            system: TRIAGE_SYSTEM_PROMPT,
            messages: [
                ...messages.slice(0, -1),
                { ...lastUserMessage, content: sanitizedContent }
            ],
            temperature: 0.1, // Baja temperatura para mayor consistencia Clínica
        });

        return result.toDataStreamResponse();

    } catch (error) {
        console.error('Triage AI Error:', error);

        return new Response(
            JSON.stringify({
                status: 'error',
                esi_level: 2,
                reasoning: 'Error técnico en el procesamiento de IA.',
                suggested_action: 'Por seguridad, acuda a su centro de urgencias más cercano.',
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




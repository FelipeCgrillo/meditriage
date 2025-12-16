import { NextRequest, NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { aiModel, validateAIConfig } from '@/lib/ai/config';
import { TriageResponseSchema, TriageInputSchema } from '@/lib/ai/schemas';
import { ESI_SYSTEM_PROMPT, FALLBACK_MESSAGE } from '@/lib/ai/prompts';

/**
 * POST /api/triage
 * Analyzes patient symptoms and returns ESI classification
 * 
 * PRIVACY: This endpoint is stateless and does not log patient data
 */
export async function POST(request: NextRequest) {
    try {
        // Validate AI configuration
        if (!validateAIConfig()) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'AI service not configured',
                    fallback: true,
                    message: FALLBACK_MESSAGE,
                },
                { status: 503 }
            );
        }

        // Parse and validate request body
        const body = await request.json();
        const validationResult = TriageInputSchema.safeParse(body);

        if (!validationResult.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Invalid input',
                    details: validationResult.error.errors,
                },
                { status: 400 }
            );
        }

        const { symptoms } = validationResult.data;

        // Extract conversation history if present (for multi-turn conversations)
        const conversationHistory = body.conversationHistory as string[] | undefined;

        // Build prompt with conversation history if present
        let userPrompt = '';

        if (conversationHistory && conversationHistory.length > 0) {
            // Multi-turn conversation: include history
            userPrompt = `Esta es una conversación de seguimiento. El paciente inicialmente reportó síntomas vagos y tú solicitaste más información.

CONVERSACIÓN:
${conversationHistory.join('\n')}

NUEVA RESPUESTA DEL PACIENTE:
${symptoms}

Ahora con esta información adicional, evalúa si tienes suficiente contexto para clasificar, o si necesitas más aclaraciones. Proporciona tu evaluación estructurada siguiendo el protocolo ESI.`;
        } else {
            // First interaction
            userPrompt = `Analiza los siguientes síntomas del paciente.

Recuerda: Si el input es vago (sin síntomas físicos específicos, ubicación, o temporalidad), debes solicitar más información usando status: 'needs_info' en lugar de clasificar.

Síntomas reportados:
${symptoms}

Proporciona tu evaluación estructurada siguiendo el protocolo ESI.`;
        }

        // Generate structured triage assessment using AI
        const { object: triageResponse } = await generateObject({
            model: aiModel,
            schema: TriageResponseSchema,
            system: ESI_SYSTEM_PROMPT,
            prompt: userPrompt,
            temperature: 0.3, // Low temperature for consistent medical reasoning
        });

        // Validate the AI response
        const validatedResult = TriageResponseSchema.parse(triageResponse);

        return NextResponse.json({
            success: true,
            data: validatedResult,
        });

    } catch (error) {
        console.error('Triage API Error:', error);

        // Return fallback mode on any error
        // This ensures the system never blocks nurse workflow
        return NextResponse.json(
            {
                success: false,
                error: 'AI analysis failed',
                fallback: true,
                message: FALLBACK_MESSAGE,
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}

/**
 * GET /api/triage
 * Health check endpoint
 */
export async function GET() {
    const isConfigured = validateAIConfig();

    return NextResponse.json({
        status: isConfigured ? 'operational' : 'degraded',
        service: 'ESI Triage API',
        ai_configured: isConfigured,
    });
}

import { NextRequest, NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { aiModel, validateAIConfig } from '@/lib/ai/config';
import { TriageResponseSchema, TriageInputSchema } from '@/lib/ai/schemas';
import { ESI_SYSTEM_PROMPT, FALLBACK_MESSAGE } from '@/lib/ai/prompts';
import { sanitizeForAI } from '@/lib/utils/pii-filter';
import { parseClinicalContent, getFlagsSummary, type ClinicalParseResult } from '@/lib/ai/clinical-parser';

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

        // ==================== PRIVACY: PII SANITIZATION ====================
        // Sanitize symptoms before sending to AI (Ley 19.628 compliance)
        const sanitizedSymptoms = sanitizeForAI(symptoms);

        // Extract messages array if present (for conversational flow)
        interface ChatMessage {
            role: 'user' | 'assistant';
            content: string;
        }
        const messages = body.messages as ChatMessage[] | undefined;

        // ==================== CLINICAL PARSER: FLAGS DETECTION ====================
        // Parse clinical content to detect missing data (OE2 algorithm)
        const parseResult: ClinicalParseResult = parseClinicalContent(sanitizedSymptoms);
        console.log(`[Clinical Parser] ${getFlagsSummary(parseResult)}`);

        // ==================== CONTROL DE FLUJO: LÍMITE DE TURNOS ====================
        // Conteo de preguntas de seguimiento del usuario (excluyendo flujo de consentimiento)
        const CONSENT_KEYWORDS = [
            'sí, acepto', 'si, acepto', 'acepto',
            'masculino', 'femenino', 'otro',
            'adulto', 'pediátrico', 'adulto mayor',
            'menor de 1 año', '1-5 años', '6-12 años', '13-17 años',
            '18-64 años', '65 años o más'
        ];

        let userTurnCount = 0;
        if (messages && messages.length > 0) {
            userTurnCount = messages.filter(msg => {
                if (msg.role !== 'user') return false;
                const content = msg.content.toLowerCase().trim();
                // Excluir mensajes del flujo de consentimiento
                return !CONSENT_KEYWORDS.some(keyword => content.includes(keyword));
            }).length;
        }

        // El userTurnCount incluye el mensaje actual, así que:
        // userTurnCount=1: Motivo de consulta inicial
        // userTurnCount=2: Primera respuesta de seguimiento
        // userTurnCount=3: Segunda respuesta de seguimiento
        // userTurnCount=4: Tercera respuesta de seguimiento
        // userTurnCount>=5: LÍMITE ALCANZADO → FORZAR CLASIFICACIÓN

        const MAX_FOLLOW_UP_QUESTIONS = 3;
        const isAtLimit = userTurnCount >= (MAX_FOLLOW_UP_QUESTIONS + 1); // +1 por el motivo inicial

        // Build prompt with conversation history if present
        let userPrompt = '';
        let systemPrompt = ESI_SYSTEM_PROMPT;

        if (messages && messages.length > 1) {
            // Multi-turn conversation: format the entire chat history
            const conversationHistory = messages
                .slice(0, -1) // Exclude the last message (current user input)
                .map(m => `${m.role === 'user' ? 'PACIENTE' : 'ASISTENTE'}: ${m.content}`)
                .join('\n');

            if (isAtLimit) {
                // ⚠️ LÍMITE ALCANZADO: FORZAR CLASIFICACIÓN
                userPrompt = `Esta es la conversación final del triage. Has alcanzado el límite máximo de preguntas de seguimiento.

HISTORIAL DE CONVERSACIÓN:
${conversationHistory}

ÚLTIMA RESPUESTA DEL PACIENTE:
${sanitizedSymptoms}

🚨 INSTRUCCIÓN OBLIGATORIA: Debes clasificar al paciente AHORA con la información disponible. NO PUEDES hacer más preguntas de seguimiento. Utiliza el protocolo ESI y, en caso de duda, aplica el principio de precaución (clasificación conservadora priorizando seguridad del paciente).

Devuelve status: 'completed' con el nivel ESI, signos críticos, razonamiento y especialidad sugerida.`;

                // Inyectar "system pressure" para forzar cierre
                systemPrompt = `${ESI_SYSTEM_PROMPT}

⚠️⚠️⚠️ SYSTEM ALERT - LÍMITE DE PREGUNTAS ALCANZADO ⚠️⚠️⚠️

You have reached the maximum number of follow-up questions allowed (${MAX_FOLLOW_UP_QUESTIONS} questions).

YOU MUST NOT ASK ANY MORE FOLLOW-UP QUESTIONS.
YOU MUST CLASSIFY THE PATIENT NOW based on the information provided so far.
YOU MUST SET status: 'completed' (NOT 'needs_info').

If information is incomplete or ambiguous:
- Apply the principle of CONSERVATIVE CLASSIFICATION
- Prioritize patient safety (when in doubt, classify as more urgent)
- Use clinical reasoning to make the best judgment with available data

This is a MANDATORY requirement. Failure to classify now would compromise the triage workflow.`;

            } else {
                // Conversación normal (aún dentro del límite)
                const questionsRemaining = MAX_FOLLOW_UP_QUESTIONS - (userTurnCount - 1);
                userPrompt = `Esta es una conversación de seguimiento. Has estado recopilando información del paciente.

HISTORIAL DE CONVERSACIÓN:
${conversationHistory}

NUEVA RESPUESTA DEL PACIENTE:
${sanitizedSymptoms}

Ahora con esta información adicional, evalúa si tienes suficiente contexto para clasificar con el protocolo ESI, o si necesitas más aclaraciones.

⏱️ NOTA: Te quedan ${questionsRemaining} pregunta(s) de seguimiento antes de que debas clasificar obligatoriamente.

Si necesitas más información, proporciona una pregunta específica junto con 3-5 opciones de respuesta rápida en 'suggested_options'. Si ya tienes suficiente información, clasifica al paciente.`;
            }
        } else {
            // First interaction
            userPrompt = `Analiza los siguientes síntomas del paciente.

Recuerda: Si el input es vago (sin síntomas físicos específicos, ubicación, o temporalidad), debes solicitar más información usando status: 'needs_info' con una pregunta de seguimiento y 3-5 opciones de respuesta rápida en 'suggested_options'.

⏱️ NOTA: Dispones de máximo ${MAX_FOLLOW_UP_QUESTIONS} preguntas de seguimiento antes de que debas clasificar obligatoriamente.

Síntomas reportados:
${sanitizedSymptoms}

Proporciona tu evaluación estructurada siguiendo el protocolo ESI.`;
        }

        // Generate structured triage assessment using AI
        const { object: triageResponse } = await generateObject({
            model: aiModel,
            schema: TriageResponseSchema,
            system: systemPrompt, // Usar el prompt modificado si estamos en el límite
            prompt: userPrompt,
            temperature: 0.3, // Low temperature for consistent medical reasoning
        });

        // Validate the AI response
        const validatedResult = TriageResponseSchema.parse(triageResponse);

        return NextResponse.json({
            success: true,
            data: validatedResult,
            // Include parser metadata for auditing (OE4 research metrics)
            parserMetadata: {
                isComplete: parseResult.isComplete,
                detectedFlags: parseResult.detectedFlags.map(f => ({
                    type: f.type,
                    priority: f.priority,
                    reason: f.reason,
                })),
                extractedKeywords: {
                    symptoms: parseResult.extractedData.symptomKeywords,
                    temporality: parseResult.extractedData.temporalityKeywords,
                    location: parseResult.extractedData.locationKeywords,
                    severity: parseResult.extractedData.severityKeywords,
                },
            },
        });

    } catch (error) {
        // Safe error logging - avoid circular reference issues with AI SDK errors
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorName = error instanceof Error ? error.name : 'UnknownError';
        console.error(`Triage API Error [${errorName}]:`, errorMessage);

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

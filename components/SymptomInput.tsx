'use client';

import React, { useState, useEffect } from 'react';
import { Button } from './ui/Button';
import { Spinner } from './ui/Spinner';
import { useVoiceInput } from '@/lib/hooks/useVoiceInput';
import type { TriageResult } from '@/lib/ai/schemas';

interface SymptomInputProps {
    onSuccess: (result: TriageResult, symptoms: string) => void;
}

interface ConversationMessage {
    role: 'patient' | 'ai';
    content: string;
}

export function SymptomInput({ onSuccess }: SymptomInputProps) {
    const [symptoms, setSymptoms] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fallbackMode, setFallbackMode] = useState(false);

    // Conversation state
    const [conversationHistory, setConversationHistory] = useState<string[]>([]);
    const [conversationMessages, setConversationMessages] = useState<ConversationMessage[]>([]);
    const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
    const [isInConversation, setIsInConversation] = useState(false);
    const [initialSymptoms, setInitialSymptoms] = useState('');

    // Voice input
    const {
        isListening,
        transcript,
        interimTranscript,
        error: voiceError,
        isSupported: isVoiceSupported,
        startListening,
        stopListening,
        resetTranscript,
    } = useVoiceInput();

    // Sync voice transcript with symptoms textarea
    useEffect(() => {
        if (transcript) {
            setSymptoms(prev => {
                // Add space if there's existing text
                const separator = prev.trim() ? ' ' : '';
                return prev + separator + transcript;
            });
            resetTranscript();
        }
    }, [transcript, resetTranscript]);

    const characterCount = symptoms.length;
    const maxCharacters = 2000;
    const minCharacters = 10;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (symptoms.length < minCharacters) {
            setError(`Por favor, describa sus síntomas con al menos ${minCharacters} caracteres.`);
            return;
        }

        setIsLoading(true);
        setError(null);
        setFallbackMode(false);

        try {
            // Build request body
            const requestBody: any = { symptoms };

            // Include conversation history if in multi-turn conversation
            if (conversationHistory.length > 0) {
                requestBody.conversationHistory = conversationHistory;
            }

            const response = await fetch('/api/triage', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            const data = await response.json();

            if (!response.ok) {
                if (data.fallback) {
                    setFallbackMode(true);
                    setError(data.message);
                } else {
                    throw new Error(data.error || 'Error al procesar síntomas');
                }
                return;
            }

            if (data.success) {
                const result = data.data;

                // Check discriminated union status
                if (result.status === 'needs_info') {
                    // AI is requesting more information
                    handleNeedsInfo(result.follow_up_question, result.reason_for_question);
                } else if (result.status === 'completed') {
                    // AI has classified, show success
                    // Concatenate conversation if it exists
                    const fullSymptoms = initialSymptoms || symptoms;
                    onSuccess(result, fullSymptoms);
                } else {
                    throw new Error('Respuesta inesperada del servidor');
                }
            } else {
                throw new Error('Respuesta inesperada del servidor');
            }
        } catch (err) {
            console.error('Triage error:', err);
            setError(
                err instanceof Error
                    ? err.message
                    : 'Error al conectar con el sistema. Por favor, intente nuevamente.'
            );
        } finally {
            setIsLoading(false);
        }
    };

    const handleNeedsInfo = (question: string, reason: string) => {
        // Store initial symptoms if this is first question
        if (!isInConversation) {
            setInitialSymptoms(symptoms);
        }

        // Add patient's message to conversation
        const patientMessage: ConversationMessage = {
            role: 'patient',
            content: symptoms,
        };

        // Add AI's question to conversation
        const aiMessage: ConversationMessage = {
            role: 'ai',
            content: question,
        };

        setConversationMessages([...conversationMessages, patientMessage, aiMessage]);

        // Update conversation history in API format
        const newHistory = [
            ...conversationHistory,
            `Paciente: ${symptoms}`,
            `IA: ${question}`,
        ];
        setConversationHistory(newHistory);

        // Set current question and enable conversation mode
        setCurrentQuestion(question);
        setIsInConversation(true);
        setSymptoms(''); // Clear input for new response
        setError(null);
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-medical-primary/10 to-medical-accent/10 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-12">
                    <Spinner size="lg" label="Analizando sus síntomas con IA..." />
                    <p className="text-center text-sm text-gray-500 mt-6">
                        Este proceso puede tomar unos segundos
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-medical-primary/10 to-medical-accent/10 flex items-center justify-center p-4">
            <div className="max-w-3xl w-full bg-white rounded-2xl shadow-2xl p-8 md:p-12">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        {isInConversation ? 'Información Adicional' : 'Descripción de Síntomas'}
                    </h1>
                    <p className="text-medical-neutral text-lg">
                        {isInConversation
                            ? 'Por favor, responda la siguiente pregunta'
                            : 'Por favor, describa detalladamente sus síntomas actuales'}
                    </p>
                </div>

                {/* Conversation History */}
                {isInConversation && conversationMessages.length > 0 && (
                    <div className="mb-6 space-y-3">
                        <h3 className="font-semibold text-gray-900 text-sm mb-3">Conversación:</h3>
                        {conversationMessages.map((msg, idx) => (
                            <div
                                key={idx}
                                className={`p-4 rounded-lg ${msg.role === 'patient'
                                    ? 'bg-blue-50 border border-blue-200'
                                    : 'bg-gray-50 border border-gray-200'
                                    }`}
                            >
                                <p className="text-xs font-semibold text-gray-600 mb-1">
                                    {msg.role === 'patient' ? '👤 Usted' : '🤖 Asistente IA'}
                                </p>
                                <p className="text-gray-800">{msg.content}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Current Follow-up Question */}
                {currentQuestion && (
                    <div className="mb-6 p-4 bg-yellow-50 border-2 border-yellow-300 rounded-lg">
                        <div className="flex items-start gap-3">
                            <span className="text-2xl">❓</span>
                            <div>
                                <p className="font-semibold text-yellow-900 mb-1">
                                    Pregunta del Asistente:
                                </p>
                                <p className="text-yellow-800">{currentQuestion}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Error Display */}
                {error && (
                    <div className={`mb-6 p-4 rounded-lg ${fallbackMode ? 'bg-yellow-50 border border-yellow-200' : 'bg-red-50 border border-red-200'}`}>
                        <div className="flex items-start gap-3">
                            <svg className={`w-5 h-5 flex-shrink-0 mt-0.5 ${fallbackMode ? 'text-yellow-600' : 'text-red-600'}`} fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <div>
                                <p className={`font-medium ${fallbackMode ? 'text-yellow-800' : 'text-red-800'}`}>
                                    {fallbackMode ? 'Modo de Respaldo Activado' : 'Error'}
                                </p>
                                <p className={`text-sm mt-1 ${fallbackMode ? 'text-yellow-700' : 'text-red-700'}`}>
                                    {error}
                                </p>
                                {fallbackMode && (
                                    <p className="text-sm mt-2 text-yellow-700 font-medium">
                                        Por favor, presione el botón de emergencia para solicitar asistencia del personal de enfermería.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Instructions */}
                {!isInConversation && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                        <h3 className="font-semibold text-gray-900 mb-2">Instrucciones:</h3>
                        <ul className="space-y-1 text-sm text-gray-700">
                            <li>• Describa qué síntomas está experimentando</li>
                            <li>• Indique cuándo comenzaron los síntomas</li>
                            <li>• Mencione si el dolor o malestar ha empeorado</li>
                            <li>• Incluya cualquier otra información relevante</li>
                        </ul>
                    </div>
                )}

                {/* Symptom Input Form */}
                <form onSubmit={handleSubmit}>
                    <div className="mb-6">
                        <label htmlFor="symptoms" className="block text-gray-700 font-medium mb-2">
                            {isInConversation ? 'Su Respuesta' : 'Sus Síntomas'}
                        </label>
                        <textarea
                            id="symptoms"
                            value={symptoms}
                            onChange={(e) => setSymptoms(e.target.value)}
                            placeholder={
                                isInConversation
                                    ? 'Escriba su respuesta aquí...'
                                    : 'Ejemplo: Tengo dolor de cabeza intenso desde hace 3 horas, acompañado de náuseas y sensibilidad a la luz. El dolor comenzó de forma repentina mientras estaba trabajando...'
                            }
                            className="w-full h-48 px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-medical-primary focus:ring-2 focus:ring-medical-primary/20 outline-none transition-colors resize-none text-gray-900"
                            maxLength={maxCharacters}
                        />
                        <div className="flex justify-between items-center mt-2">
                            <p className="text-sm text-gray-500">
                                Mínimo {minCharacters} caracteres
                            </p>
                            <p className={`text-sm ${characterCount > maxCharacters * 0.9 ? 'text-medical-warning' : 'text-gray-500'}`}>
                                {characterCount} / {maxCharacters}
                            </p>
                        </div>
                    </div>

                    {/* Voice Input - Available in both initial and follow-up questions */}
                    <div className="mb-6">
                        {isVoiceSupported ? (
                            <div className="space-y-3">
                                <Button
                                    type="button"
                                    variant={isListening ? 'danger' : 'secondary'}
                                    onClick={isListening ? stopListening : startListening}
                                    className={`w-full transition-all duration-300 ${isListening
                                        ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                                        : 'hover:bg-blue-50'
                                        }`}
                                >
                                    {isListening ? (
                                        <>
                                            <span className="w-3 h-3 bg-white rounded-full mr-3 animate-ping inline-block" />
                                            <svg className="w-5 h-5 mr-2 inline" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                                            </svg>
                                            Detener Grabación
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-5 h-5 mr-2 inline text-red-500" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                                            </svg>
                                            🎙️ {isInConversation ? 'Dictar Respuesta por Voz' : 'Dictar Síntomas por Voz'}
                                        </>
                                    )}
                                </Button>

                                {/* Interim transcript display */}
                                {isListening && interimTranscript && (
                                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                        <p className="text-xs text-blue-600 font-medium mb-1">Escuchando...</p>
                                        <p className="text-gray-700 italic">{interimTranscript}</p>
                                    </div>
                                )}

                                {/* Voice error display */}
                                {voiceError && (
                                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                        <p className="text-red-700 text-sm">{voiceError}</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="p-3 bg-gray-100 border border-gray-200 rounded-lg text-center">
                                <p className="text-gray-500 text-sm">
                                    ⚠️ Entrada por voz no disponible en este navegador.
                                    <br />
                                    <span className="text-xs">Use Chrome, Edge o Safari para esta función.</span>
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Submit Button */}
                    <div className="flex gap-4">
                        <Button
                            type="submit"
                            variant="primary"
                            className="flex-1"
                            disabled={characterCount < minCharacters}
                        >
                            {isInConversation ? 'Enviar Respuesta' : 'Analizar Síntomas'}
                        </Button>
                    </div>
                </form>

                {/* Privacy Note */}
                <p className="text-xs text-gray-500 text-center mt-6">
                    🔒 Sus datos están protegidos y solo serán vistos por personal médico autorizado
                </p>
            </div>
        </div>
    );
}

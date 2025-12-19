'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from './ui/Button';
import { useVoiceInput } from '@/lib/hooks/useVoiceInput';
import { supabase } from '@/lib/supabase/client';
import { generateAnonymousCode } from '@/lib/utils/anonymousCode';
import type { TriageResult } from '@/lib/ai/schemas';

interface ConversationMessage {
    role: 'patient' | 'ai' | 'system';
    content: string;
    timestamp?: Date;
    isCodeCard?: boolean;
    isConsentCard?: boolean;
    anonymousCode?: string;
}

interface DemographicData {
    gender?: string | null;
    ageGroup?: string | null;
}

interface ChatInterfaceProps {
    demographics?: DemographicData;
    onReset?: () => void;
}

type OnboardingStep = 'consent' | 'gender' | 'age' | 'ready';

const WELCOME_MESSAGE = `¡Hola! 👋 Soy tu asistente de salud virtual del CESFAM.

Antes de comenzar, necesito tu consentimiento para procesar tus datos de forma segura.`;

const CONSENT_INFO = {
    title: 'Consentimiento para el uso de datos',
    items: [
        'Tus síntomas serán analizados por inteligencia artificial para sugerir una clasificación de urgencia',
        'Un profesional de enfermería validará y confirmará la clasificación antes de tu atención',
        'Tus datos serán almacenados de forma segura y solo accesibles por personal autorizado del CESFAM',
        'Este sistema NO reemplaza la evaluación médica profesional'
    ],
    question: '¿Aceptas el uso de tus datos médicos para el proceso de triaje asistido por IA?'
};

const GENDER_QUESTION = `Gracias por tu consentimiento. 

Para ayudar a evaluar la equidad del sistema, me gustaría conocer algunos datos demográficos (esto es completamente voluntario).

¿Podrías indicarme tu género?`;

const AGE_QUESTION = `¿En qué grupo de edad te encuentras?`;

const READY_MESSAGE = `Perfecto, gracias por la información. 

Ahora sí, estoy listo para ayudarte a evaluar tus síntomas. Por favor, cuéntame con detalle:

• ¿Qué síntomas estás experimentando?
• ¿Cuándo comenzaron?
• ¿Hay algo que los mejore o empeore?

Mientras más detalles me des, mejor podré ayudarte. 🩺`;

export function ChatInterface({ demographics: initialDemographics, onReset }: ChatInterfaceProps) {
    const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>(
        initialDemographics ? 'ready' : 'consent'
    );
    const [hasConsented, setHasConsented] = useState(!!initialDemographics);
    const [demographics, setDemographics] = useState<DemographicData>(
        initialDemographics || { gender: null, ageGroup: null }
    );
    
    const [messages, setMessages] = useState<ConversationMessage[]>(() => {
        if (initialDemographics) {
            return [{ role: 'ai', content: READY_MESSAGE, timestamp: new Date() }];
        }
        return [
            { role: 'ai', content: WELCOME_MESSAGE, timestamp: new Date() },
            { role: 'ai', content: '', isConsentCard: true, timestamp: new Date() }
        ];
    });
    
    // Initialize response options for consent if needed
    useEffect(() => {
        if (onboardingStep === 'consent' && !hasConsented && responseOptions.length === 0) {
            setResponseOptions(['Acepto', 'NO Acepto']);
        }
    }, [onboardingStep, hasConsented]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [conversationHistory, setConversationHistory] = useState<string[]>([]);
    const [initialSymptoms, setInitialSymptoms] = useState('');
    const [isCompleted, setIsCompleted] = useState(false);
    const [anonymousCode, setAnonymousCode] = useState<string | null>(null);
    const [responseOptions, setResponseOptions] = useState<string[]>([]);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

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

    // Sync voice transcript with input
    useEffect(() => {
        if (transcript) {
            setInputValue(prev => {
                const separator = prev.trim() ? ' ' : '';
                return prev + separator + transcript;
            });
            resetTranscript();
        }
    }, [transcript, resetTranscript]);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    // Auto-resize textarea
    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInputValue(e.target.value);
        e.target.style.height = 'auto';
        e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
    };

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();

        if (!inputValue.trim() || isLoading) return;

        const userMessage = inputValue.trim();
        setInputValue('');
        setError(null);

        // Reset textarea height
        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
        }

        // Add user message to chat
        const newUserMessage: ConversationMessage = {
            role: 'patient',
            content: userMessage,
            timestamp: new Date(),
        };
        setMessages(prev => [...prev, newUserMessage]);

        // Handle onboarding flow before processing symptoms
        if (onboardingStep === 'consent') {
            const consentLower = userMessage.toLowerCase().trim();
            const consentKeywords = ['sí', 'si', 'acepto', 'aceptar', 'de acuerdo', 'ok', 'vale', 'entendido', 's'];
            const noConsentKeywords = ['no acepto', 'no aceptar', 'rechazo', 'no', 'no quiero', 'no deseo'];
            
            const hasConsented = consentKeywords.some(keyword => consentLower.includes(keyword) || consentLower === keyword);
            const hasRejected = noConsentKeywords.some(keyword => consentLower.includes(keyword) || consentLower === keyword);
            
            if (hasRejected) {
                const noConsentMessage: ConversationMessage = {
                    role: 'ai',
                    content: 'Entiendo que prefieres no continuar. Para usar este servicio de evaluación de síntomas, necesito tu consentimiento para procesar tus datos de forma segura.',
                    timestamp: new Date(),
                };
                setMessages(prev => [...prev, noConsentMessage]);
                // Show consent card again
                const consentCardMessage: ConversationMessage = {
                    role: 'ai',
                    content: '',
                    isConsentCard: true,
                    timestamp: new Date(),
                };
                setMessages(prev => [...prev, consentCardMessage]);
                setResponseOptions(['Acepto', 'NO Acepto']);
                return;
            } else if (hasConsented) {
                setHasConsented(true);
                setOnboardingStep('gender');
                const genderMessage: ConversationMessage = {
                    role: 'ai',
                    content: GENDER_QUESTION,
                    timestamp: new Date(),
                };
                setMessages(prev => [...prev, genderMessage]);
                setResponseOptions(['Masculino', 'Femenino', 'Otro', 'Prefiero no decir']);
                return;
            } else {
                // If response is unclear, show consent card again
                const unclearMessage: ConversationMessage = {
                    role: 'ai',
                    content: 'Para continuar, necesito tu consentimiento. Por favor, selecciona una opción:',
                    timestamp: new Date(),
                };
                setMessages(prev => [...prev, unclearMessage]);
                const consentCardMessage: ConversationMessage = {
                    role: 'ai',
                    content: '',
                    isConsentCard: true,
                    timestamp: new Date(),
                };
                setMessages(prev => [...prev, consentCardMessage]);
                setResponseOptions(['Acepto', 'NO Acepto']);
                return;
            }
        }

        if (onboardingStep === 'gender') {
            const genderLower = userMessage.toLowerCase().trim();
            let selectedGender: string | null = null;
            
            // More flexible gender recognition
            if (genderLower.includes('masculino') || genderLower.includes('hombre') || genderLower === 'm' || genderLower.includes('varón') || genderLower.includes('varon')) {
                selectedGender = 'M';
            } else if (genderLower.includes('femenino') || genderLower.includes('mujer') || genderLower === 'f' || genderLower.includes('dama')) {
                selectedGender = 'F';
            } else if (genderLower.includes('otro') || genderLower.includes('other') || genderLower.includes('otra')) {
                selectedGender = 'Other';
            } else if (genderLower.includes('prefiero no decir') || genderLower.includes('no decir') || genderLower.includes('prefiero no') || genderLower.includes('no quiero')) {
                selectedGender = 'Prefer not to say';
            }

            setDemographics(prev => ({ ...prev, gender: selectedGender }));
            setOnboardingStep('age');
            setResponseOptions([]);
            
            const ageMessage: ConversationMessage = {
                role: 'ai',
                content: AGE_QUESTION,
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, ageMessage]);
            setResponseOptions(['Pediátrico (0-17 años)', 'Adulto (18-64 años)', 'Geriátrico (65+ años)', 'Prefiero no decir']);
            return;
        }

        if (onboardingStep === 'age') {
            const ageLower = userMessage.toLowerCase().trim();
            let selectedAgeGroup: string | null = null;
            
            // More flexible age group recognition
            if (ageLower.includes('pediátrico') || ageLower.includes('pediatrico') || ageLower.includes('niño') || ageLower.includes('niña') || ageLower.includes('infantil') || ageLower.includes('adolescente')) {
                selectedAgeGroup = 'Pediatric';
            } else if (ageLower.includes('adulto') || ageLower.includes('adult') || ageLower.includes('18') || ageLower.includes('64')) {
                selectedAgeGroup = 'Adult';
            } else if (ageLower.includes('geriátrico') || ageLower.includes('geriatrico') || ageLower.includes('mayor') || ageLower.includes('65') || ageLower.includes('tercera edad')) {
                selectedAgeGroup = 'Geriatric';
            } else if (ageLower.includes('prefiero no decir') || ageLower.includes('no decir') || ageLower.includes('prefiero no') || ageLower.includes('no quiero')) {
                selectedAgeGroup = null; // User prefers not to say
            }

            setDemographics(prev => ({ ...prev, ageGroup: selectedAgeGroup }));
            setOnboardingStep('ready');
            setResponseOptions([]);
            
            const readyMessage: ConversationMessage = {
                role: 'ai',
                content: READY_MESSAGE,
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, readyMessage]);
            return;
        }

        // From here, process symptoms normally
        setIsLoading(true);

        try {
            // Build request body
            const requestBody: any = { symptoms: userMessage };

            // Include conversation history if in multi-turn conversation
            // Limit history to last 6 messages (3 exchanges) to prevent token overflow
            if (conversationHistory.length > 0) {
                const limitedHistory = conversationHistory.slice(-6);
                requestBody.conversationHistory = limitedHistory;
                console.log('[ChatInterface] Sending conversation history:', limitedHistory.length, 'messages');
            }

            // Create abort controller for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

            let response: Response;
            try {
                response = await fetch('/api/triage', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestBody),
                    signal: controller.signal,
                });
                clearTimeout(timeoutId);
            } catch (fetchError) {
                clearTimeout(timeoutId);
                if (fetchError instanceof Error && fetchError.name === 'AbortError') {
                    throw new Error('La solicitud tardó demasiado. Por favor, intenta nuevamente.');
                }
                throw fetchError;
            }

            let data: any;
            try {
                data = await response.json();
            } catch (jsonError) {
                console.error('[ChatInterface] Error parsing JSON response:', jsonError);
                throw new Error('Respuesta inválida del servidor. Por favor, intenta nuevamente.');
            }

            if (!response.ok) {
                if (data.fallback) {
                    setError(data.message);
                    // Add AI message about fallback
                    const fallbackMessage: ConversationMessage = {
                        role: 'ai',
                        content: '⚠️ Lo siento, estoy experimentando dificultades técnicas. Por favor, solicita asistencia al personal de enfermería directamente.',
                        timestamp: new Date(),
                    };
                    setMessages(prev => [...prev, fallbackMessage]);
                } else {
                    throw new Error(data.error || 'Error al procesar síntomas');
                }
                return;
            }

            if (data.success) {
                const result = data.data;
                console.log('[ChatInterface] API response received:', result);
                console.log('[ChatInterface] Response status:', result.status);
                console.log('[ChatInterface] Current conversation history length:', conversationHistory.length);

                if (result.status === 'needs_info') {
                    // Store initial symptoms if this is first interaction
                    if (!initialSymptoms) {
                        setInitialSymptoms(userMessage);
                    }

                    // Update conversation history
                    // Keep only last 6 messages (3 exchanges) to prevent token overflow
                    const currentHistory = conversationHistory.length > 6 
                        ? conversationHistory.slice(-4) 
                        : conversationHistory;
                    const newHistory = [
                        ...currentHistory,
                        `Paciente: ${userMessage}`,
                        `IA: ${result.follow_up_question}`,
                    ];
                    console.log('[ChatInterface] Updated conversation history length:', newHistory.length);
                    setConversationHistory(newHistory);

                    // Add AI question to chat
                    const aiMessage: ConversationMessage = {
                        role: 'ai',
                        content: result.follow_up_question,
                        timestamp: new Date(),
                    };
                    setMessages(prev => [...prev, aiMessage]);

                    // Set response options for quick reply chips
                    if (result.response_options && result.response_options.length > 0) {
                        setResponseOptions(result.response_options);
                    } else {
                        setResponseOptions([]);
                    }

                } else if (result.status === 'completed') {
                    // Clear response options
                    setResponseOptions([]);

                    // Generate anonymous code
                    const patientCode = generateAnonymousCode();
                    setAnonymousCode(patientCode);

                    // Prepare conversation history for saving
                    const fullSymptoms = initialSymptoms || userMessage;
                    const historyToSave = messages.filter(m => m.role === 'patient' || m.role === 'ai');
                    historyToSave.push(newUserMessage);

                    // Save to Supabase
                    try {
                        const { error: dbError } = await supabase
                            .from('clinical_records')
                            .insert({
                                patient_consent: true,
                                symptoms_text: fullSymptoms,
                                ai_response: result as any,
                                esi_level: result.esi_level,
                                nurse_validated: false,
                                anonymous_code: patientCode,
                                patient_gender: demographics?.gender || null,
                                patient_age_group: demographics?.ageGroup || null,
                                conversation_history: historyToSave,
                            } as any);

                        if (dbError) {
                            console.error('Error saving to database:', dbError);
                        }
                    } catch (dbErr) {
                        console.error('Database error:', dbErr);
                    }

                    // Add completion message with the anonymous code card
                    const completionMessage: ConversationMessage = {
                        role: 'system',
                        content: `✅ ¡Evaluación completada!

Tu código de atención es:`,
                        timestamp: new Date(),
                        isCodeCard: true,
                        anonymousCode: patientCode,
                    };
                    setMessages(prev => [...prev, completionMessage]);

                    // Mark as completed to hide input
                    setIsCompleted(true);

                } else {
                    throw new Error('Respuesta inesperada del servidor');
                }
            } else {
                throw new Error('Respuesta inesperada del servidor');
            }
        } catch (err) {
            console.error('[ChatInterface] Triage error:', err);
            const errorMessage = err instanceof Error ? err.message : 'Error al conectar con el sistema';
            setError(errorMessage);

            // Add error message to chat
            const errorAiMessage: ConversationMessage = {
                role: 'ai',
                content: `❌ ${errorMessage}. Por favor, intenta nuevamente.`,
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorAiMessage]);
        } finally {
            console.log('[ChatInterface] Setting isLoading to false');
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Submit on Enter (without Shift)
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
            {/* Header */}
            <header className="bg-slate-800/80 backdrop-blur-lg border-b border-slate-700 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
                    <span className="text-xl">🩺</span>
                </div>
                <div>
                    <h1 className="text-white font-semibold">Asistente de Triage</h1>
                    <p className="text-xs text-slate-400">CESFAM • Evaluación de síntomas</p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    <span className="text-xs text-green-400">En línea</span>
                </div>
            </header>

            {/* Messages Container */}
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
                {messages.map((message, index) => (
                    <div
                        key={index}
                        className={`flex ${message.role === 'patient' ? 'justify-end' : message.role === 'system' ? 'justify-center' : 'justify-start'} animate-fadeIn`}
                    >
                        {/* AI Avatar */}
                        {message.role === 'ai' && (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center mr-2 flex-shrink-0">
                                <span className="text-sm">🤖</span>
                            </div>
                        )}

                        {/* Consent Card */}
                        {message.role === 'ai' && message.isConsentCard ? (
                            <div className="w-full max-w-2xl">
                                <div className="bg-gradient-to-br from-slate-800/90 to-slate-700/90 border-2 border-blue-500/40 rounded-2xl p-6 shadow-2xl backdrop-blur-sm">
                                    <div className="flex items-start gap-4 mb-5">
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500/30 to-cyan-500/30 flex items-center justify-center flex-shrink-0 border-2 border-blue-400/50">
                                            <span className="text-2xl">🔒</span>
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-white text-xl font-bold mb-4">
                                                {CONSENT_INFO.title}
                                            </h3>
                                            <div className="bg-slate-900/50 rounded-xl p-4 mb-4 border border-slate-600/50">
                                                <ul className="space-y-3">
                                                    {CONSENT_INFO.items.map((item, idx) => (
                                                        <li key={idx} className="flex items-start gap-3 text-slate-200 text-sm leading-relaxed">
                                                            <span className="text-blue-400 mt-0.5 font-bold text-lg">•</span>
                                                            <span className="flex-1">{item}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                            <div className="bg-blue-600/20 border-l-4 border-blue-500 rounded-lg p-4">
                                                <p className="text-white font-semibold text-base">
                                                    {CONSENT_INFO.question}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : message.role === 'system' && message.isCodeCard ? (
                            <div className="w-full max-w-sm">
                                <div className="bg-gradient-to-br from-emerald-600 to-teal-600 rounded-2xl p-6 text-center shadow-xl">
                                    <div className="text-4xl mb-3">✅</div>
                                    <h3 className="text-white text-lg font-semibold mb-2">¡Evaluación Completada!</h3>
                                    <p className="text-emerald-100 text-sm mb-4">Presenta este código al personal de enfermería</p>

                                    <div className="bg-white/20 backdrop-blur rounded-xl p-4 mb-4">
                                        <p className="text-white text-3xl font-mono font-bold tracking-wider">
                                            {message.anonymousCode}
                                        </p>
                                    </div>

                                    <p className="text-emerald-100 text-xs">
                                        🔒 Tu información está protegida y será revisada por personal autorizado
                                    </p>
                                </div>

                                {onReset && (
                                    <button
                                        onClick={onReset}
                                        className="w-full mt-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors"
                                    >
                                        Iniciar Nueva Consulta
                                    </button>
                                )}
                            </div>
                        ) : (
                            /* Regular Message Bubble */
                            <div
                                className={`max-w-[80%] md:max-w-[70%] rounded-2xl px-4 py-3 ${message.role === 'patient'
                                    ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-br-md'
                                    : 'bg-slate-700/80 text-slate-100 rounded-bl-md'
                                    }`}
                            >
                                <p className="whitespace-pre-wrap text-sm md:text-base leading-relaxed">
                                    {message.content}
                                </p>
                                {message.timestamp && (
                                    <p className={`text-xs mt-1 ${message.role === 'patient' ? 'text-blue-200' : 'text-slate-400'
                                        }`}>
                                        {message.timestamp.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Patient Avatar */}
                        {message.role === 'patient' && (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center ml-2 flex-shrink-0">
                                <span className="text-sm">👤</span>
                            </div>
                        )}
                    </div>
                ))}

                {/* Typing Indicator */}
                {isLoading && (
                    <div className="flex justify-start animate-fadeIn">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center mr-2 flex-shrink-0">
                            <span className="text-sm">🤖</span>
                        </div>
                        <div className="bg-slate-700/80 rounded-2xl rounded-bl-md px-4 py-3">
                            <div className="flex gap-1">
                                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Voice listening indicator */}
                {isListening && interimTranscript && (
                    <div className="flex justify-end animate-fadeIn">
                        <div className="bg-blue-600/50 border border-blue-500 rounded-2xl rounded-br-md px-4 py-3 max-w-[80%]">
                            <p className="text-blue-200 text-sm italic">{interimTranscript}</p>
                            <p className="text-xs text-blue-300 mt-1">🎙️ Escuchando...</p>
                        </div>
                    </div>
                )}

                {/* Quick Reply Chips */}
                {responseOptions.length > 0 && !isLoading && (
                    <div className={`flex gap-3 flex-wrap ${onboardingStep === 'consent' ? 'justify-center mt-6' : 'justify-center mt-4'} animate-fadeIn`}>
                        {responseOptions.map((option, idx) => {
                            const isNegative = option.toLowerCase().includes('no acepto') || option.toLowerCase().includes('no');
                            const isPrimary = !isNegative && (option.toLowerCase().includes('acepto') || option.toLowerCase().includes('sí'));
                            
                            return (
                                <button
                                    key={idx}
                                    onClick={() => {
                                        setInputValue(option);
                                        setResponseOptions([]);
                                        // Auto-submit after a short delay
                                        setTimeout(() => {
                                            const form = document.querySelector('form');
                                            form?.requestSubmit();
                                        }, 100);
                                    }}
                                    className={`
                                        ${onboardingStep === 'consent' 
                                            ? isPrimary
                                                ? 'px-8 py-4 bg-gradient-to-r from-blue-600 to-cyan-500 text-white hover:from-blue-700 hover:to-cyan-600 shadow-lg shadow-blue-500/30 text-base font-semibold min-w-[140px]'
                                                : isNegative
                                                    ? 'px-8 py-4 bg-slate-700/60 border-2 border-slate-500/50 text-slate-200 hover:bg-slate-700 hover:border-slate-400 text-base font-semibold min-w-[140px]'
                                                    : 'px-8 py-4 bg-blue-600/30 border-2 border-blue-500/50 text-blue-200 hover:bg-blue-600/50 hover:border-blue-400 text-base font-semibold min-w-[140px]'
                                            : 'px-4 py-2 bg-blue-600/20 border border-blue-500/50 rounded-full text-blue-300 hover:bg-blue-600/40 hover:border-blue-400 text-sm font-medium'
                                        }
                                        rounded-xl transition-all duration-200 transform hover:scale-105 active:scale-95
                                    `}
                                >
                                    {option}
                                </button>
                            );
                        })}
                    </div>
                )}



                <div ref={messagesEndRef} />
            </div>

            {/* Input Area - Hidden when completed */}
            {!isCompleted && (
                <div className="bg-slate-800/90 backdrop-blur-lg border-t border-slate-700 px-4 py-3 sticky bottom-0">
                    {/* Error Display */}
                    {(error || voiceError) && (
                        <div className="mb-3 p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
                            <p className="text-red-300 text-sm">{error || voiceError}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="flex items-end gap-2">
                        {/* Voice Button */}
                        {isVoiceSupported && (
                            <button
                                type="button"
                                onClick={isListening ? stopListening : startListening}
                                className={`p-3 rounded-full transition-all duration-300 flex-shrink-0 ${isListening
                                    ? 'bg-red-500 text-white animate-pulse'
                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                    }`}
                            >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                                </svg>
                            </button>
                        )}

                        {/* Text Input */}
                        <div className="flex-1 relative">
                            <textarea
                                ref={inputRef}
                                value={inputValue}
                                onChange={handleInputChange}
                                onKeyDown={handleKeyDown}
                                placeholder="Escribe tus síntomas aquí..."
                                className="w-full bg-slate-700/80 text-white placeholder-slate-400 rounded-2xl px-4 py-3 pr-12 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                rows={1}
                                disabled={isLoading}
                                style={{ minHeight: '48px', maxHeight: '120px' }}
                            />
                        </div>

                        {/* Send Button */}
                        <button
                            type="submit"
                            disabled={!inputValue.trim() || isLoading}
                            className={`p-3 rounded-full transition-all duration-300 flex-shrink-0 ${inputValue.trim() && !isLoading
                                ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white hover:shadow-lg hover:shadow-blue-500/30'
                                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                }`}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                        </button>
                    </form>

                    {/* Helper text */}
                    <p className="text-xs text-slate-500 text-center mt-2">
                        🔒 Tu información está protegida • Presiona Enter para enviar
                    </p>
                </div>
            )}

            {/* Custom animation styles */}
            <style jsx>{`
                @keyframes fadeIn {
                    from {
                        opacity: 0;
                        transform: translateY(10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                .animate-fadeIn {
                    animation: fadeIn 0.3s ease-out forwards;
                }
            `}</style>
        </div>
    );
}

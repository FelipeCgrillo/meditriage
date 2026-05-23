'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useChat } from 'ai/react';
import { Send, AlertTriangle, ShieldCheck, Bot, Loader2, CheckCircle2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { generateAnonymousCode } from '@/lib/utils/anonymousCode';
import { extractJSON } from '@/lib/utils/validation';

interface TriageResponse {
    status: 'success' | 'needs_info' | 'error';
    esi_level: number | null;
    reasoning: string;
    suggested_action: string;
    follow_up_question: string | null;
    response_options?: string[];
    error?: boolean;
    message?: string;
}

export default function ChatInterface() {
    const [consentAccepted, setConsentAccepted] = useState(false);
    const [showEmergencyAlert, setShowEmergencyAlert] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const [anonymousCode, setAnonymousCode] = useState<string | null>(null);
    // Track which assistant message indices have already had their quick-reply
    // buttons used so we can freeze them and prevent contaminating the
    // medical context with contradictory answers later.
    const [answeredOptions, setAnsweredOptions] = useState<Record<string, string>>({});
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const {
        messages,
        input,
        handleInputChange,
        handleSubmit,
        isLoading,
        error,
        reload,
        append,
    } = useChat({
        api: '/api/triage',
        onFinish: async (message) => {
            try {
                const json = extractJSON<TriageResponse>(message.content);
                if (!json) {
                    console.warn('[triage] assistant message did not contain parseable JSON');
                    return;
                }

                // Bail out on fallback/error payloads — do NOT persist or
                // mark the flow as finished, so the user can retry.
                if (json.error || json.status === 'error') return;

                if (json.status === 'success' && json.esi_level) {
                    if (json.esi_level <= 2) {
                        setShowEmergencyAlert(true);
                    }

                    const code = generateAnonymousCode();
                    setAnonymousCode(code);

                    if (isSupabaseConfigured) {
                        const { error: dbError } = await supabase
                            .from('clinical_records')
                            .insert({
                                patient_consent: true,
                                symptoms_text: messages
                                    .filter((m) => m.role === 'user')
                                    .map((m) => m.content)
                                    .join('\n'),
                                ai_response: json as any,
                                esi_level: json.esi_level,
                                nurse_validated: false,
                                anonymous_code: code,
                            } as any);

                        if (dbError) console.error('Error saving record:', dbError);
                    } else {
                        console.warn('[triage] Supabase not configured; skipping clinical record persistence');
                    }
                    setIsFinished(true);
                }
            } catch (e) {
                console.error('Error parsing AI response:', e);
            }
        },
    });

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    const handleQuickReply = (messageId: string, option: string) => {
        if (isLoading || answeredOptions[messageId]) return;
        setAnsweredOptions((prev) => ({ ...prev, [messageId]: option }));
        // Send the selected option as the next user message
        append({ role: 'user', content: option });
    };

    if (!consentAccepted) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100">
                    <div className="bg-medical-primary p-6 text-white text-center">
                        <div className="inline-flex items-center justify-center w-12 h-12 bg-white/20 rounded-full mb-3">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <h2 className="text-xl font-bold">Consentimiento Informado</h2>
                    </div>
                    <div className="p-8 space-y-4">
                        <div className="bg-blue-50 border-l-4 border-medical-primary p-4 rounded-r-lg">
                            <p className="text-sm text-medical-primary font-bold mb-2">IMPORTANTE:</p>
                            <p className="text-gray-700 text-sm leading-relaxed">
                                Este sistema utiliza Inteligencia Artificial para sugerir una clasificación de urgencia.
                                <span className="font-bold underline ml-1">No sustituye el juicio clínico de un profesional de salud.</span>
                            </p>
                        </div>
                        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
                            <p className="text-sm text-red-600 font-bold mb-1">EMERGENCIA VITAL:</p>
                            <p className="text-red-700 font-bold text-base leading-tight">
                                En caso de riesgo vital inmediato, llame al 131 o acuda al centro de urgencias más cercano.
                            </p>
                        </div>
                        <p className="text-[10px] text-slate-400 text-center uppercase tracking-widest font-bold">
                            Al continuar, acepta el procesamiento anónimo de sus datos para fines de tesis.
                        </p>
                        <Button
                            className="w-full mt-4 py-6 text-lg font-bold"
                            onClick={() => setConsentAccepted(true)}
                        >
                            Comprendo y Acepto
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    if (isFinished && anonymousCode) {
        return (
            <div className="max-w-xl mx-auto mt-12 animate-in fade-in zoom-in duration-500">
                <div className="bg-white rounded-[32px] shadow-2xl border border-slate-100 p-8 text-center space-y-6">
                    <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 className="w-10 h-10" />
                    </div>
                    <h2 className="text-3xl font-black text-slate-900 leading-tight">Evaluación Finalizada</h2>
                    <p className="text-slate-500 text-lg">
                        Su información ha sido procesada de forma segura. Por favor, presente el siguiente código al personal de salud:
                    </p>
                    <div className="bg-slate-50 border-2 border-dashed border-slate-200 p-6 rounded-2xl">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Código de Seguimiento</p>
                        <p className="text-5xl font-black text-medical-primary tracking-tighter">{anonymousCode}</p>
                    </div>
                    <div className="bg-slate-900 text-white p-6 rounded-2xl text-left">
                        <h4 className="font-bold mb-2 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-yellow-400" />
                            Instrucciones Finales
                        </h4>
                        <p className="text-sm text-slate-300 leading-relaxed">
                            Acuda a su centro de salud más cercano y mencione que ha realizado este triaje.
                            Este código nos ayuda a vincular su registro de forma anónima para nuestra investigación clínica.
                        </p>
                    </div>
                    <Button
                        variant="secondary"
                        className="w-full py-4 rounded-xl font-bold"
                        onClick={() => window.location.reload()}
                    >
                        Nueva Evaluación
                    </Button>
                </div>
            </div>
        );
    }

    const lastAssistantIndex = (() => {
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === 'assistant') return i;
        }
        return -1;
    })();

    // Detect a fallback/error payload in the latest assistant message so we can
    // surface the retry banner even though the API responded with HTTP 200.
    const latestAssistantPayload =
        lastAssistantIndex >= 0
            ? extractJSON<TriageResponse>(messages[lastAssistantIndex].content)
            : null;
    const latestAssistantHasError = Boolean(
        latestAssistantPayload && (latestAssistantPayload.error || latestAssistantPayload.status === 'error'),
    );
    const showErrorBanner = !isLoading && (Boolean(error) || latestAssistantHasError);

    const handleRetry = () => {
        // Prefer reload() when the last turn is an assistant reply (retries
        // the last user message); fall back to a no-op otherwise.
        try {
            reload();
        } catch (e) {
            console.error('[triage] reload failed:', e);
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-6rem)] max-w-2xl mx-auto bg-white shadow-2xl rounded-3xl overflow-hidden border border-slate-200">
            {/* Header */}
            <div className="bg-medical-primary p-5 flex items-center gap-4 text-white shadow-lg">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                    <Bot className="w-7 h-7" />
                </div>
                <div>
                    <h1 className="font-extrabold text-xl tracking-tight">Asistente de Triage</h1>
                    <p className="text-xs text-blue-100 font-medium uppercase tracking-wider">CESFAM - Soporte IA</p>
                </div>
            </div>

            {/* Emergency Global Alert */}
            {showEmergencyAlert && (
                <div className="bg-red-600 p-4 flex flex-col items-center gap-2 text-white animate-pulse">
                    <div className="flex items-center gap-2 text-center">
                        <AlertTriangle className="w-8 h-8" />
                        <h2 className="text-xl font-black uppercase tracking-tighter">ALTA PRIORIDAD CLÍNICA</h2>
                    </div>
                    <p className="text-sm font-bold text-center">Diríjase al Servicio de Urgencia inmediatamente.</p>
                </div>
            )}

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center p-12 space-y-6">
                        <div className="w-20 h-20 bg-blue-100 rounded-3xl flex items-center justify-center animate-bounce-slow">
                            <Bot className="w-10 h-10 text-medical-primary" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-lg font-bold text-slate-800">¿Cómo se siente hoy?</h3>
                            <p className="text-sm text-slate-500 max-w-xs mx-auto leading-relaxed">
                                Describa sus síntomas con sus propias palabras. Por ejemplo: &quot;Me duele el pecho hace 2 horas&quot;.
                            </p>
                        </div>
                    </div>
                )}

                {messages.map((m, idx) => {
                    const isUser = m.role === 'user';
                    let content = m.content;
                    let triageData: TriageResponse | null = null;
                    let responseOptions: string[] | undefined;

                    if (!isUser) {
                        const parsed = extractJSON<TriageResponse>(m.content);
                        if (parsed) {
                            triageData = parsed;
                            const visibleText = triageData.status === 'needs_info'
                                ? (triageData.follow_up_question || triageData.suggested_action)
                                : (triageData.suggested_action || triageData.message || '');
                            content = visibleText || content;
                            responseOptions = Array.isArray(triageData.response_options)
                                ? triageData.response_options.filter(
                                    (o) => typeof o === 'string' && o.trim().length > 0,
                                )
                                : undefined;
                        }
                        // Otherwise: still streaming or not JSON — render raw content.
                    }

                    const selectedOption = answeredOptions[m.id];
                    const isLatestAssistant = idx === lastAssistantIndex;

                    return (
                        <div
                            key={m.id}
                            className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}
                        >
                            <div
                                className={`max-w-[85%] rounded-[24px] px-5 py-4 shadow-sm ${isUser
                                    ? 'bg-medical-primary text-white rounded-tr-none'
                                    : 'bg-white text-slate-800 border border-slate-100 rounded-tl-none ring-1 ring-slate-200/50'
                                    }`}
                            >
                                {!isUser && (
                                    <div className="text-[10px] font-black text-medical-primary uppercase mb-2 flex items-center gap-1.5 opacity-70">
                                        <Bot className="w-3.5 h-3.5" /> IA Clínica
                                    </div>
                                )}
                                <div className="text-[15px] leading-relaxed whitespace-pre-wrap font-medium">
                                    {content}
                                </div>
                                {triageData?.esi_level && !isLoading && (
                                    <div
                                        className={`mt-3 text-[10px] px-3 py-1 rounded-full inline-block font-black uppercase tracking-wider ${triageData.esi_level <= 2 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                                            }`}
                                    >
                                        Criterio IA: ESI {triageData.esi_level}
                                    </div>
                                )}

                                {/* Quick-reply option buttons (only active for the latest assistant
                                    message; once answered, all buttons disable to avoid
                                    contaminating the medical context with later clicks). */}
                                {!isUser && responseOptions && responseOptions.length > 0 && (
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {responseOptions.map((opt) => {
                                            const isSelected = selectedOption === opt;
                                            const disabled = Boolean(selectedOption) || !isLatestAssistant || isLoading;
                                            return (
                                                <button
                                                    key={opt}
                                                    type="button"
                                                    disabled={disabled}
                                                    aria-pressed={isSelected}
                                                    onClick={() => handleQuickReply(m.id, opt)}
                                                    className={`text-sm font-bold px-4 py-2 rounded-full border transition-all
                                                        ${isSelected
                                                            ? 'bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-200'
                                                            : disabled
                                                                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed line-through opacity-60'
                                                                : 'bg-white text-medical-primary border-medical-primary hover:bg-blue-50 active:scale-95'
                                                        }`}
                                                >
                                                    {opt}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}

                {/* Visible typing/loading indicator while waiting for AI response. */}
                {isLoading && (
                    <div
                        role="status"
                        aria-live="polite"
                        aria-label="Analizando síntomas"
                        className="flex justify-start"
                    >
                        <div className="bg-white text-slate-500 rounded-2xl rounded-tl-none px-5 py-4 border border-slate-200 shadow-sm flex items-center gap-3">
                            <Loader2 className="w-5 h-5 animate-spin text-medical-primary" />
                            <span className="text-xs font-bold uppercase tracking-widest">Analizando síntomas…</span>
                            <span className="flex gap-1 ml-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-medical-primary animate-pulse" style={{ animationDelay: '0ms' }} />
                                <span className="w-1.5 h-1.5 rounded-full bg-medical-primary animate-pulse" style={{ animationDelay: '150ms' }} />
                                <span className="w-1.5 h-1.5 rounded-full bg-medical-primary animate-pulse" style={{ animationDelay: '300ms' }} />
                            </span>
                        </div>
                    </div>
                )}

                {/* Error banner with retry — surfaced both when the request itself fails
                    (transport / useChat.error) and when the assistant returned a
                    structured fallback payload with error: true (e.g. AI provider
                    outage handled by the API route). */}
                {showErrorBanner && (
                    <div
                        role="alert"
                        className="flex justify-start"
                    >
                        <div className="bg-red-50 border border-red-200 text-red-800 rounded-2xl px-5 py-4 flex flex-col gap-3 max-w-[85%]">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5" />
                                <span className="font-bold text-sm">No se pudo procesar la respuesta</span>
                            </div>
                            <p className="text-sm leading-relaxed">
                                {latestAssistantPayload?.message ||
                                    'Hubo un problema temporal con el asistente clínico. Por favor, inténtelo nuevamente o describa sus síntomas directamente al personal de enfermería. Si presenta una emergencia, llame al 131.'}
                            </p>
                            <button
                                type="button"
                                onClick={handleRetry}
                                className="self-start inline-flex items-center gap-2 text-sm font-bold bg-red-600 text-white px-4 py-2 rounded-full hover:bg-red-700 transition-colors"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Reintentar
                            </button>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form
                onSubmit={(e) => {
                    if (!input.trim() || isLoading) {
                        e.preventDefault();
                        return;
                    }
                    handleSubmit(e);
                }}
                className="p-5 bg-white border-t border-slate-100 flex gap-3 items-center"
            >
                <input
                    className="flex-1 bg-slate-50 border-none rounded-2xl px-5 py-4 text-[15px] focus:ring-2 focus:ring-medical-primary/20 outline-none transition-all placeholder:text-slate-400 font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                    value={input}
                    placeholder={isLoading ? 'Analizando síntomas…' : 'Describa sus malestares aquí…'}
                    onChange={handleInputChange}
                    disabled={isLoading || isFinished}
                    aria-disabled={isLoading || isFinished}
                />
                <button
                    type="submit"
                    disabled={isLoading || !input.trim() || isFinished}
                    aria-label={isLoading ? 'Esperando respuesta' : 'Enviar mensaje'}
                    className="w-14 h-14 bg-medical-primary text-white rounded-2xl flex items-center justify-center hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xl shadow-blue-100 active:scale-95 group"
                >
                    {isLoading ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                        <Send className="w-6 h-6 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    )}
                </button>
            </form>

            <style jsx global>{`
                @keyframes bounce-slow {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }
                .animate-bounce-slow {
                    animation: bounce-slow 3s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
}

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useChat } from 'ai/react';
import { Send, AlertTriangle, ShieldCheck, User, Bot, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase/client';
import { generateAnonymousCode } from '@/lib/utils/anonymousCode';

interface TriageResponse {
    status: 'success' | 'needs_info';
    esi_level: number | null;
    reasoning: string;
    suggested_action: string;
    follow_up_question: string | null;
}

export default function ChatInterface() {
    const [consentAccepted, setConsentAccepted] = useState(false);
    const [showEmergencyAlert, setShowEmergencyAlert] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const [anonymousCode, setAnonymousCode] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
        api: '/api/triage',
        onFinish: async (message) => {
            try {
                const json = JSON.parse(message.content) as TriageResponse;

                // Si la clasificación es exitosa (success) y tiene un nivel ESI, guardamos el registro
                if (json.status === 'success' && json.esi_level) {
                    if (json.esi_level <= 2) {
                        setShowEmergencyAlert(true);
                    }

                    const code = generateAnonymousCode();
                    setAnonymousCode(code);

                    const { error } = await supabase
                        .from('clinical_records')
                        .insert({
                            patient_consent: true,
                            symptoms_text: messages.filter(m => m.role === 'user').map(m => m.content).join('\n'),
                            ai_response: json as any,
                            esi_level: json.esi_level,
                            nurse_validated: false,
                            anonymous_code: code,
                        } as any);

                    if (error) console.error('Error saving record:', error);
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
                                Describa sus síntomas con sus propias palabras. Por ejemplo: "Me duele el pecho hace 2 horas".
                            </p>
                        </div>
                    </div>
                )}

                {messages.map((m) => {
                    const isUser = m.role === 'user';
                    let content = m.content;
                    let triageData: TriageResponse | null = null;

                    if (!isUser) {
                        try {
                            const parsed = JSON.parse(m.content);
                            triageData = parsed as TriageResponse;
                            content = triageData.status === 'needs_info'
                                ? (triageData.follow_up_question || triageData.suggested_action)
                                : triageData.suggested_action;
                        } catch (e) {
                            // Not JSON yet or error
                        }
                    }

                    return (
                        <div key={m.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
                            <div className={`max-w-[85%] rounded-[24px] px-5 py-4 shadow-sm ${isUser
                                ? 'bg-medical-primary text-white rounded-tr-none'
                                : 'bg-white text-slate-800 border border-slate-100 rounded-tl-none ring-1 ring-slate-200/50'
                                }`}>
                                {!isUser && (
                                    <div className="text-[10px] font-black text-medical-primary uppercase mb-2 flex items-center gap-1.5 opacity-70">
                                        <Bot className="w-3.5 h-3.5" /> IA Clínica
                                    </div>
                                )}
                                <div className="text-[15px] leading-relaxed whitespace-pre-wrap font-medium">
                                    {content}
                                </div>
                                {triageData?.esi_level && !isLoading && (
                                    <div className={`mt-3 text-[10px] px-3 py-1 rounded-full inline-block font-black uppercase tracking-wider ${triageData.esi_level <= 2 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                                        }`}>
                                        Criterio IA: ESI {triageData.esi_level}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}

                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-white text-slate-400 rounded-2xl rounded-tl-none px-5 py-4 border border-slate-100 shadow-sm flex items-center gap-3">
                            <Loader2 className="w-5 h-5 animate-spin text-medical-primary" />
                            <span className="text-xs font-bold uppercase tracking-widest">Analizando...</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={handleSubmit} className="p-5 bg-white border-t border-slate-100 flex gap-3 items-center">
                <input
                    className="flex-1 bg-slate-50 border-none rounded-2xl px-5 py-4 text-[15px] focus:ring-2 focus:ring-medical-primary/20 outline-none transition-all placeholder:text-slate-400 font-medium"
                    value={input}
                    placeholder="Describa sus malestares aqui..."
                    onChange={handleInputChange}
                    disabled={isLoading || isFinished}
                />
                <button
                    type="submit"
                    disabled={isLoading || !input.trim() || isFinished}
                    className="w-14 h-14 bg-medical-primary text-white rounded-2xl flex items-center justify-center hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xl shadow-blue-100 active:scale-95 group"
                >
                    <Send className="w-6 h-6 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
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

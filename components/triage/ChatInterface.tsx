'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useChat } from 'ai/react';
import { Send, AlertTriangle, ShieldCheck, User, Bot, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';

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
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
        api: '/api/triage',
        onFinish: (message) => {
            try {
                const json = JSON.parse(message.content) as TriageResponse;
                if (json.esi_level === 1 || json.esi_level === 2) {
                    setShowEmergencyAlert(true);
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
                <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100 italic">
                    <div className="bg-medical-primary p-6 text-white text-center">
                        <div className="inline-flex items-center justify-center w-12 h-12 bg-white/20 rounded-full mb-3">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <h2 className="text-xl font-bold">Consentimiento Informado</h2>
                    </div>
                    <div className="p-8 space-y-4">
                        <div className="bg-blue-50 border-l-4 border-medical-primary p-4 rounded-r-lg">
                            <p className="text-sm text-medical-primary font-bold mb-2">IMPORTANTE:</p>
                            <p className="text-gray-700 leading-relaxed font-sans non-italic">
                                Este sistema utiliza Inteligencia Artificial para sugerir una clasificación de urgencia.
                                <span className="font-bold underline ml-1">No sustituye el juicio clínico de un médico o profesional de salud.</span>
                            </p>
                        </div>
                        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
                            <p className="text-sm text-red-600 font-bold mb-1">EMERGENCIA VITAL:</p>
                            <p className="text-red-700 font-bold text-lg font-sans non-italic">
                                En caso de riesgo vital inmediato, llame al 131 o acuda al centro de urgencias más cercano.
                            </p>
                        </div>
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

    return (
        <div className="flex flex-col h-[calc(100vh-2rem)] max-w-2xl mx-auto bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-200 mt-4 mb-4">
            {/* Header */}
            <div className="bg-medical-primary p-4 flex items-center gap-3 text-white shadow-md">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                    <Bot className="w-6 h-6" />
                </div>
                <div>
                    <h1 className="font-bold text-lg">Asistente de Triage</h1>
                    <p className="text-xs text-blue-100">CESFAM - Soporte IA</p>
                </div>
            </div>

            {/* Emergency Global Alert */}
            {showEmergencyAlert && (
                <div className="bg-red-600 p-4 flex flex-col items-center gap-2 text-white animate-pulse">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="w-8 h-8" />
                        <h2 className="text-xl font-black uppercase tracking-tighter">ACUDA A URGENCIAS INMEDIATAMENTE</h2>
                    </div>
                    <p className="text-sm font-medium text-center">Su situación ha sido clasificada como ALTA PRIORIDAD. No espere.</p>
                    <button
                        onClick={() => setShowEmergencyAlert(false)}
                        className="text-xs underline mt-1 opacity-80"
                    >
                        Entendido
                    </button>
                </div>
            )}

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 p-8 space-y-4">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                            <User className="w-8 h-8" />
                        </div>
                        <p className="text-sm">Inicie describiendo sus síntomas o el motivo de su consulta para recibir una orientación inicial.</p>
                    </div>
                )}

                {messages.map((m) => {
                    const isUser = m.role === 'user';
                    let content = m.content;
                    let triageData: TriageResponse | null = null;

                    if (!isUser) {
                        try {
                            // Attempt to parse JSON from AI response
                            const parsed = JSON.parse(m.content);
                            triageData = parsed as TriageResponse;
                            content = parsed.suggested_action || parsed.reasoning || m.content;
                        } catch (e) {
                            // Not JSON yet or error, keep original content
                        }
                    }

                    return (
                        <div key={m.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${isUser
                                ? 'bg-medical-primary text-white rounded-tr-none'
                                : 'bg-white text-gray-800 border border-gray-200 rounded-tl-none'
                                }`}>
                                {!isUser && (
                                    <div className="text-[10px] font-bold text-medical-primary uppercase mb-1 flex items-center gap-1">
                                        <Bot className="w-3 h-3" /> Asistente Médico
                                    </div>
                                )}
                                <div className="text-sm leading-relaxed whitespace-pre-wrap">
                                    {content}
                                </div>
                                {triageData && triageData.follow_up_question && (
                                    <div className="mt-3 pt-2 border-t border-gray-100 text-medical-primary font-medium italic italic">
                                        {triageData.follow_up_question}
                                    </div>
                                )}
                                {!isUser && triageData?.esi_level && (
                                    <div className={`mt-2 text-[10px] px-2 py-0.5 rounded-full inline-block font-bold ${triageData.esi_level <= 2 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                                        }`}>
                                        ESI {triageData.esi_level}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}

                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-white text-gray-500 rounded-2xl rounded-tl-none px-4 py-3 border border-gray-200 shadow-sm flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-medical-primary" />
                            <span className="text-xs font-medium">Escribiendo...</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={handleSubmit} className="p-4 bg-white border-t border-gray-200 flex gap-2 items-center">
                <input
                    className="flex-1 bg-gray-100 border-none rounded-full px-4 py-3 text-sm focus:ring-2 focus:ring-medical-primary outline-none transition-all"
                    value={input}
                    placeholder="Escriba sus síntomas aquí..."
                    onChange={handleInputChange}
                    disabled={isLoading || showEmergencyAlert}
                />
                <button
                    type="submit"
                    disabled={isLoading || !input.trim() || showEmergencyAlert}
                    className="w-10 h-10 bg-medical-primary text-white rounded-full flex items-center justify-center hover:bg-medical-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md flex-shrink-0"
                >
                    <Send className="w-5 h-5" />
                </button>
            </form>
        </div>
    );
}

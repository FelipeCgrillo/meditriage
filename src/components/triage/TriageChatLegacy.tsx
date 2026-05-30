'use client';

/**
 * TriageChatLegacy — restored "old" chat UI for /paciente.
 *
 * Visual design preserved from commit 36d8da4 (pre-restructure):
 *   - Header "Chat de Triage ESI" + "Asistente médico virtual" (teal dot)
 *   - Violet/indigo gradient bubbles, WhatsApp-style layout
 *   - Spanish consent flow with "Sí, autorizo" / "No autorizo"
 *   - Demographic capture via chat options (gender + age group)
 *   - Quick-reply chips for AI follow-ups
 *
 * Adapted to the PR #1 backend contract: consumes the streaming
 * /api/triage via Vercel AI SDK useChat. The assistant streams a
 * JSON payload (status, esi_level, follow_up_question,
 * response_options, optional error/message) — parsed with the
 * tolerant extractJSON helper. Quick-reply buttons freeze after a
 * pick to avoid contaminating the medical context with later clicks.
 *
 * No new dependencies (no radix scroll-area, no toast, no voice
 * input) — uses plain divs + an inline error banner.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from 'ai/react';
import { Bot, Send, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { generateAnonymousCode } from '@/lib/utils/anonymousCode';
import { extractJSON } from '@/lib/utils/validation';
import {
    isTerminalTriageResult,
    renderAssistantContent,
} from '@/lib/utils/triageRender';
import {
    buildClinicalRecordPayload,
    type ClinicalRecordPayload,
} from '@/lib/utils/clinicalRecord';

interface TriageResponse {
    status?: 'success' | 'needs_info' | 'error' | string;
    esi_level: number | null;
    reasoning?: string;
    suggested_action?: string;
    follow_up_question?: string | null;
    response_options?: string[];
    error?: boolean;
    message?: string;
}

interface DemographicData {
    gender: string | null;
    ageGroup: string | null;
}

type ConsentStep = 'welcome' | 'gender' | 'age' | 'completed';

interface PreMessage {
    id: string;
    role: 'assistant' | 'user';
    content: string;
    options?: string[];
}

const MIN_INPUT_LENGTH = 3;

const GENDER_MAP: Record<string, string> = {
    Masculino: 'M',
    Femenino: 'F',
    Otro: 'Other',
    'Prefiero no decir': 'Prefer not to say',
};

const AGE_MAP: Record<string, string | null> = {
    'Pediátrico (0-17 años)': 'Pediatric',
    'Adulto (18-64 años)': 'Adult',
    'Geriátrico (65+ años)': 'Geriatric',
    'Prefiero no decir': null,
};

interface TriageChatLegacyProps {
    onFinished?: (anonymousCode: string, demographics: DemographicData) => void;
}


export default function TriageChatLegacy({ onFinished }: TriageChatLegacyProps) {
    const [consentStep, setConsentStep] = useState<ConsentStep>('welcome');
    const [demographics, setDemographics] = useState<DemographicData>({
        gender: null,
        ageGroup: null,
    });
    const [preMessages, setPreMessages] = useState<PreMessage[]>([
        {
            id: 'welcome',
            role: 'assistant',
            content:
                'Hola. Soy el asistente virtual del CESFAM. Este sistema usa IA para pre-clasificar su urgencia bajo supervisión de enfermería.\n\n¿Autoriza el uso de sus datos para la evaluación?',
            options: ['Sí, autorizo', 'No autorizo'],
        },
    ]);
    const [declined, setDeclined] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const [anonymousCode, setAnonymousCode] = useState<string | null>(null);
    const [answeredOptions, setAnsweredOptions] = useState<Record<string, string>>({});
    const [saveError, setSaveError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    /**
     * streamError + autoRetryRef: en Safari iOS el stream de
     * /api/triage a veces se corta silenciosamente (el SDK termina
     * onFinish con content vacío o no-JSON, sin disparar onError).
     * Cuando eso ocurre intentamos un reload() automático una vez;
     * si vuelve a fallar mostramos un banner con botón "Reintentar".
     */
    const [streamError, setStreamError] = useState<string | null>(null);
    const autoRetryRef = useRef(false);
    const pendingPayloadRef = useRef<ClinicalRecordPayload | null>(null);
    const demographicsRef = useRef(demographics);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Keep demographics ref in sync so the streaming-finish callback never
    // reads a stale closure value.
    useEffect(() => {
        demographicsRef.current = demographics;
    }, [demographics]);

    const messagesRef = useRef<Array<{ role: string; content: string }>>([]);

    const persistRecord = useCallback(
        async (payload: ClinicalRecordPayload): Promise<void> => {
            if (!isSupabaseConfigured) {
                console.warn(
                    '[triage] Supabase not configured; skipping clinical record persistence',
                );
                return;
            }
            const { error: dbError } = await supabase
                .from('clinical_records')
                .insert(payload as never);
            if (dbError) {
                console.error('Error saving record:', dbError);
                throw new Error(dbError.message || 'insert failed');
            }
        },
        [],
    );

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
        onError: (err) => {
            // Stream / network / 5xx — muestra un banner accionable.
            // No reintenta automáticamente aquí porque el SDK ya
            // terminó mal el ciclo; el usuario toca "Reintentar".
            console.error('[triage] stream onError:', err);
            setStreamError(
                'La conexión con el asistente se interrumpió. Por favor reintente o describa sus síntomas nuevamente.',
            );
        },
        onFinish: async (message) => {
            try {
                const json = extractJSON<TriageResponse>(message.content);
                // Stream terminó pero el contenido es vacío / no-JSON:
                // síntoma típico de Safari iOS cuando el stream se cae a
                // mitad. Intentamos un reload() automático una sola vez;
                // si tras el reintento sigue sin JSON, mostramos banner.
                if (!json) {
                    const content = (message.content ?? '').trim();
                    const isEmptyOrPartial =
                        content.length === 0 ||
                        !content.includes('{') ||
                        !content.includes('}');
                    if (isEmptyOrPartial && !autoRetryRef.current) {
                        autoRetryRef.current = true;
                        // El SDK ya escribió el mensaje vacío del asistente
                        // en la lista; reload() lo regenera con la misma
                        // última entrada del usuario.
                        try {
                            await reload();
                        } catch (e) {
                            console.error('[triage] auto-retry reload failed:', e);
                            setStreamError(
                                'La conexión con el asistente se interrumpió. Por favor reintente o describa sus síntomas nuevamente.',
                            );
                        }
                        return;
                    }
                    if (isEmptyOrPartial) {
                        setStreamError(
                            'La conexión con el asistente se interrumpió. Por favor reintente o describa sus síntomas nuevamente.',
                        );
                    }
                    return;
                }
                // Stream llegó con JSON válido — reseteamos el retry guard
                // para que un fallo futuro vuelva a tener su único reintento.
                autoRetryRef.current = false;
                setStreamError(null);
                // Finalize on any payload that names a valid ESI level
                // and no longer asks the patient anything — regardless
                // of whether `status` is exactly 'success'. The model
                // occasionally drops or varies the status field even
                // when the classification itself is terminal.
                if (!isTerminalTriageResult(json)) return;
                const esiLevel = json.esi_level as number;

                const code = generateAnonymousCode();
                const currentDemographics = demographicsRef.current;
                // messagesRef is updated on every render and always reflects
                // the latest streamed transcript — plus the just-completed
                // assistant turn is appended below so we never persist with
                // an empty assistant payload.
                const transcript = [
                    ...messagesRef.current,
                ];
                const lastMessage = transcript[transcript.length - 1];
                if (
                    !lastMessage ||
                    lastMessage.role !== 'assistant' ||
                    lastMessage.content !== message.content
                ) {
                    transcript.push({
                        role: 'assistant',
                        content: message.content,
                    });
                }
                const payload = buildClinicalRecordPayload({
                    messages: transcript,
                    aiResponse: json as unknown as Record<string, unknown>,
                    esiLevel,
                    anonymousCode: code,
                    gender: currentDemographics.gender,
                    ageGroup: currentDemographics.ageGroup,
                });
                pendingPayloadRef.current = payload;
                setAnonymousCode(code);
                setSaveError(null);
                setIsSaving(true);
                try {
                    await persistRecord(payload);
                    pendingPayloadRef.current = null;
                    setIsFinished(true);
                    onFinished?.(code, currentDemographics);
                } catch (e) {
                    const msg = e instanceof Error ? e.message : 'desconocido';
                    setSaveError(
                        `No se pudo guardar la evaluación (${msg}). Sus datos están listos; puede reintentar el guardado.`,
                    );
                } finally {
                    setIsSaving(false);
                }
            } catch (e) {
                console.error('Error parsing AI response:', e);
            }
        },
    });

    const handleSaveRetry = useCallback(async () => {
        const payload = pendingPayloadRef.current;
        if (!payload || isSaving) return;
        setSaveError(null);
        setIsSaving(true);
        try {
            await persistRecord(payload);
            pendingPayloadRef.current = null;
            setIsFinished(true);
            onFinished?.(payload.anonymous_code, demographicsRef.current);
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'desconocido';
            setSaveError(
                `No se pudo guardar la evaluación (${msg}). Sus datos están listos; puede reintentar el guardado.`,
            );
        } finally {
            setIsSaving(false);
        }
    }, [isSaving, onFinished, persistRecord]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, preMessages, isLoading]);

    useEffect(() => {
        messagesRef.current = messages.map((m) => ({
            role: m.role,
            content: m.content,
        }));
    }, [messages]);

    const pushPre = (msg: Omit<PreMessage, 'id'>) => {
        setPreMessages((prev) => [
            ...prev,
            { ...msg, id: `pre-${Date.now()}-${prev.length}` },
        ]);
    };

    const handlePreOption = (messageId: string, option: string) => {
        if (answeredOptions[messageId]) return;
        setAnsweredOptions((prev) => ({ ...prev, [messageId]: option }));

        pushPre({ role: 'user', content: option });

        if (consentStep === 'welcome') {
            if (option === 'Sí, autorizo') {
                setConsentStep('gender');
                pushPre({
                    role: 'assistant',
                    content: 'Para comenzar, indique su género biológico:',
                    options: ['Masculino', 'Femenino', 'Otro', 'Prefiero no decir'],
                });
            } else {
                setDeclined(true);
                pushPre({
                    role: 'assistant',
                    content:
                        'Sin su autorización no se puede proceder con la evaluación.\n\nSi cambia de opinión, recargue la página.',
                });
            }
        } else if (consentStep === 'gender') {
            setDemographics((d) => ({ ...d, gender: GENDER_MAP[option] ?? null }));
            setConsentStep('age');
            pushPre({
                role: 'assistant',
                content: 'Indique su grupo etario:',
                options: [
                    'Pediátrico (0-17 años)',
                    'Adulto (18-64 años)',
                    'Geriátrico (65+ años)',
                    'Prefiero no decir',
                ],
            });
        } else if (consentStep === 'age') {
            setDemographics((d) => ({ ...d, ageGroup: AGE_MAP[option] ?? null }));
            setConsentStep('completed');
            pushPre({
                role: 'assistant',
                content:
                    '¿Cuál es el motivo principal de su consulta? (Describa sus síntomas brevemente).',
            });
        }
    };

    const handleAIQuickReply = (messageId: string, option: string) => {
        if (isLoading || answeredOptions[messageId]) return;
        setAnsweredOptions((prev) => ({ ...prev, [messageId]: option }));
        append({ role: 'user', content: option });
    };

    const handleRetry = () => {
        // Reset the stream-error state so the banner disappears as the
        // new request starts; reload() re-issues the last user turn.
        setStreamError(null);
        autoRetryRef.current = false;
        try {
            reload();
        } catch (e) {
            console.error('[triage] reload failed:', e);
            setStreamError(
                'No se pudo reintentar automáticamente. Vuelva a describir sus síntomas en el cuadro de texto.',
            );
        }
    };

    const lastAssistantIdx = useMemo(() => {
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === 'assistant') return i;
        }
        return -1;
    }, [messages]);

    const latestAssistantPayload =
        lastAssistantIdx >= 0
            ? extractJSON<TriageResponse>(messages[lastAssistantIdx].content)
            : null;
    const latestAssistantHasError = Boolean(
        latestAssistantPayload &&
            (latestAssistantPayload.error || latestAssistantPayload.status === 'error'),
    );
    const showErrorBanner =
        !isLoading &&
        (Boolean(error) || latestAssistantHasError || Boolean(streamError));

    // Final success screen — anonymous code reveal.
    if (isFinished && anonymousCode) {
        return (
            <FinishedScreen
                code={anonymousCode}
                onRestart={() => window.location.reload()}
            />
        );
    }

    const inputDisabled =
        isLoading || isFinished || declined || consentStep !== 'completed';

    return (
        <div className="flex flex-col h-screen md:h-[calc(100vh-4rem)] w-full md:max-w-5xl md:mx-auto bg-gradient-to-b from-indigo-50/80 via-white to-white md:shadow-2xl md:rounded-t-2xl overflow-hidden">
            {/* Header — old design preserved */}
            <header className="bg-white/80 backdrop-blur-sm shadow-sm h-16 md:h-18 flex items-center px-4 md:px-6 flex-shrink-0 border-b border-indigo-100/30">
                <div className="flex items-center gap-3 md:gap-4">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center">
                        <Bot className="h-5 w-5 md:h-6 md:w-6 text-indigo-600" />
                    </div>
                    <div>
                        <h1 className="text-gray-900 font-bold text-base md:text-lg tracking-tight">
                            Chat de Triage ESI
                        </h1>
                        <p className="text-gray-500 text-xs md:text-sm font-medium flex items-center gap-1.5">
                            <span className="w-2 h-2 bg-teal-400 rounded-full" />
                            <span>Asistente médico virtual</span>
                        </p>
                    </div>
                </div>
            </header>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-3 md:px-6 py-4 md:py-6">
                <div className="space-y-4 md:space-y-5 max-w-4xl mx-auto">
                    {/* Pre-flow consent messages */}
                    {preMessages.map((m) => (
                        <Bubble
                            key={m.id}
                            role={m.role}
                            content={m.content}
                            options={m.options}
                            selectedOption={answeredOptions[m.id]}
                            onOptionClick={(opt) => handlePreOption(m.id, opt)}
                            disabled={isLoading}
                            isLatestWithOptions={
                                // Latest pre-message with options is the active one
                                preMessages
                                    .filter((p) => p.options && p.options.length > 0)
                                    .slice(-1)[0]?.id === m.id && consentStep !== 'completed'
                            }
                        />
                    ))}

                    {/* AI conversation messages (after consent flow) */}
                    {messages.map((m, idx) => {
                        const isUser = m.role === 'user';
                        const rendered = !isUser
                            ? renderAssistantContent(m.content, isLoading, idx === lastAssistantIdx)
                            : null;

                        // Suppress the assistant bubble while the JSON payload is
                        // still streaming — the typing indicator carries the UX.
                        if (!isUser && rendered?.hideBubble) return null;

                        const isLatest = idx === lastAssistantIdx;
                        const bubbleRole: 'assistant' | 'user' = isUser ? 'user' : 'assistant';
                        return (
                            <Bubble
                                key={m.id}
                                role={bubbleRole}
                                content={isUser ? m.content : rendered?.content ?? ''}
                                options={!isUser ? rendered?.options : undefined}
                                selectedOption={answeredOptions[m.id]}
                                onOptionClick={(opt) => handleAIQuickReply(m.id, opt)}
                                disabled={isLoading}
                                isLatestWithOptions={isLatest}
                                esiLevel={rendered?.esiLevel ?? null}
                            />
                        );
                    })}

                    {/* Typing indicator */}
                    {isLoading && <TypingIndicator />}

                    {/* Save-error banner — shown when the AI finished but the
                        Supabase insert failed. Lets the patient retry the save
                        without re-running the AI. */}
                    {saveError && (
                        <div role="alert" className="flex justify-start">
                            <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl px-5 py-4 flex flex-col gap-3 max-w-[85%]">
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className="w-5 h-5" />
                                    <span className="font-bold text-sm">
                                        Error al guardar la evaluación
                                    </span>
                                </div>
                                <p className="text-sm leading-relaxed">{saveError}</p>
                                <button
                                    type="button"
                                    onClick={handleSaveRetry}
                                    disabled={isSaving}
                                    className="self-start inline-flex items-center gap-2 text-sm font-bold bg-amber-600 text-white px-4 py-2 rounded-full hover:bg-amber-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                                >
                                    {isSaving ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <RefreshCw className="w-4 h-4" />
                                    )}
                                    Reintentar guardado
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Error / fallback banner with retry */}
                    {showErrorBanner && (
                        <div role="alert" className="flex justify-start">
                            <div className="bg-red-50 border border-red-200 text-red-800 rounded-2xl px-5 py-4 flex flex-col gap-3 max-w-[85%]">
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className="w-5 h-5" />
                                    <span className="font-bold text-sm">
                                        No se pudo procesar la respuesta
                                    </span>
                                </div>
                                <p className="text-sm leading-relaxed">
                                    {streamError ||
                                        latestAssistantPayload?.message ||
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
            </div>

            {/* Input footer — old floating pill design */}
            <div className="bg-transparent p-3 md:p-5 flex-shrink-0">
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (inputDisabled) return;
                        if (input.trim().length < MIN_INPUT_LENGTH) return;
                        handleSubmit(e);
                    }}
                    className="flex items-end gap-2 md:gap-3 max-w-4xl mx-auto bg-white rounded-full shadow-xl shadow-indigo-100/50 px-2 md:px-3 py-2 border border-indigo-50"
                >
                    <div className="flex-1 relative">
                        <input
                            value={input}
                            onChange={handleInputChange}
                            placeholder={
                                consentStep === 'completed'
                                    ? 'Describe tus síntomas aquí...'
                                    : 'Selecciona una opción arriba...'
                            }
                            className="w-full rounded-full border-0 bg-gray-50 px-4 md:px-5 py-2.5 md:py-3 text-sm md:text-base focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-gray-100 disabled:text-gray-400"
                            disabled={inputDisabled}
                            maxLength={500}
                        />
                        {input.length > 0 && consentStep === 'completed' && (
                            <span className="absolute right-3 bottom-2 text-xs text-slate-400">
                                {input.length}/500
                            </span>
                        )}
                    </div>

                    <button
                        type="submit"
                        className="flex items-center justify-center flex-shrink-0 rounded-full h-10 w-10 md:h-11 md:w-11 bg-gradient-to-r from-violet-600 to-indigo-600 hover:shadow-lg hover:shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        disabled={
                            inputDisabled || input.trim().length < MIN_INPUT_LENGTH
                        }
                        aria-label={isLoading ? 'Esperando respuesta' : 'Enviar mensaje'}
                    >
                        {isLoading ? (
                            <Loader2 className="h-5 w-5 animate-spin text-white" />
                        ) : (
                            <Send className="h-5 w-5 text-white" />
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────────
// Subcomponents

interface BubbleProps {
    role: 'assistant' | 'user';
    content: string;
    options?: string[];
    selectedOption?: string;
    onOptionClick?: (opt: string) => void;
    disabled?: boolean;
    isLatestWithOptions?: boolean;
    esiLevel?: number | null;
}

function Bubble({
    role,
    content,
    options,
    selectedOption,
    onOptionClick,
    disabled,
    isLatestWithOptions,
    esiLevel,
}: BubbleProps) {
    const isUser = role === 'user';
    const lines = content.split('\n').map((l, idx) => {
        const cleaned = l.replace(/^[A-Z]+\|/, '');
        return cleaned ? (
            <div key={idx} className="mb-1.5">
                {cleaned}
            </div>
        ) : (
            <div key={idx} className="h-2" />
        );
    });

    return (
        <div
            className={`flex animate-in fade-in-50 slide-in-from-bottom-2 duration-500 ${
                isUser ? 'justify-end' : 'justify-start'
            }`}
        >
            <div
                className={`flex flex-col gap-2 md:gap-2.5 max-w-[85%] sm:max-w-[80%] md:max-w-[70%] ${
                    isUser ? 'items-end' : ''
                }`}
            >
                <div
                    className={`rounded-[24px] px-4 py-3 md:px-5 md:py-3.5 ${
                        isUser
                            ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-indigo-200 rounded-br-sm'
                            : 'bg-white text-slate-700 shadow-sm rounded-bl-sm'
                    }`}
                >
                    <div className="text-sm md:text-base leading-relaxed">{lines}</div>
                    {esiLevel ? (
                        <div
                            className={`mt-2 text-[10px] px-2.5 py-0.5 rounded-full inline-block font-black uppercase tracking-wider ${
                                esiLevel <= 2
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-indigo-100 text-indigo-700'
                            }`}
                        >
                            Criterio IA: ESI {esiLevel}
                        </div>
                    ) : null}
                </div>

                {options && options.length > 0 && !isUser && (
                    <div className="flex flex-wrap gap-2 md:gap-2.5">
                        {options.map((option, idx) => {
                            const isSelected = selectedOption === option;
                            const isDisabled =
                                Boolean(selectedOption) || !isLatestWithOptions || disabled;
                            return (
                                <button
                                    key={`${option}-${idx}`}
                                    type="button"
                                    onClick={() =>
                                        !isDisabled && onOptionClick?.(option)
                                    }
                                    disabled={isDisabled}
                                    aria-pressed={isSelected}
                                    className={`cursor-pointer rounded-full bg-white shadow-sm ring-1 text-xs md:text-sm py-2.5 md:py-3 px-4 md:px-5 font-medium transition-all duration-200 ${
                                        isSelected
                                            ? 'bg-emerald-50 text-emerald-700 ring-emerald-300 ring-2'
                                            : isDisabled
                                              ? 'bg-slate-50 text-slate-400 ring-slate-100 cursor-not-allowed opacity-60'
                                              : 'text-slate-700 ring-slate-100 hover:ring-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 hover:-translate-y-0.5'
                                    }`}
                                >
                                    {option}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

function TypingIndicator() {
    return (
        <div
            role="status"
            aria-live="polite"
            aria-label="Analizando síntomas"
            className="flex justify-start animate-in fade-in-50 slide-in-from-bottom-2 duration-300"
        >
            <div className="flex items-center gap-3 bg-white rounded-[24px] rounded-bl-sm px-4 md:px-5 py-3 md:py-3.5 shadow-sm">
                <span className="text-xs md:text-sm text-slate-600 font-medium">
                    Escribiendo
                </span>
                <div className="flex gap-1.5">
                    <div
                        className="w-2 h-2 md:w-2.5 md:h-2.5 bg-indigo-400 rounded-full animate-bounce"
                        style={{ animationDelay: '0ms' }}
                    />
                    <div
                        className="w-2 h-2 md:w-2.5 md:h-2.5 bg-violet-400 rounded-full animate-bounce"
                        style={{ animationDelay: '150ms' }}
                    />
                    <div
                        className="w-2 h-2 md:w-2.5 md:h-2.5 bg-indigo-400 rounded-full animate-bounce"
                        style={{ animationDelay: '300ms' }}
                    />
                </div>
            </div>
        </div>
    );
}

function FinishedScreen({
    code,
    onRestart,
}: {
    code: string;
    onRestart: () => void;
}) {
    return (
        <div className="min-h-screen bg-gradient-to-b from-indigo-50/80 via-white to-white flex items-center justify-center p-4">
            <div className="max-w-xl w-full bg-white rounded-[32px] shadow-2xl border border-slate-100 p-8 text-center space-y-6">
                <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                    <Bot className="w-10 h-10" />
                </div>
                <h2 className="text-3xl font-black text-slate-900 leading-tight">
                    Evaluación Finalizada
                </h2>
                <p className="text-slate-500 text-lg">
                    Su información ha sido procesada de forma segura. Por favor,
                    presente el siguiente código al personal de salud:
                </p>
                <div className="bg-slate-50 border-2 border-dashed border-slate-200 p-6 rounded-2xl">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                        Código de Seguimiento
                    </p>
                    <p className="text-5xl font-black text-indigo-600 tracking-tighter">
                        {code}
                    </p>
                </div>
                <button
                    onClick={onRestart}
                    className="w-full py-4 rounded-xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:shadow-lg hover:shadow-indigo-200 transition-all"
                >
                    Nueva Evaluación
                </button>
            </div>
        </div>
    );
}

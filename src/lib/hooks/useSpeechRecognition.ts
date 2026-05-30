/**
 * useSpeechRecognition — wrapper para Web Speech API
 *
 * Provee dictado por voz nativo del navegador (gratis, sin servidor).
 * Funciona en Chrome (desktop + Android), Edge, Safari iOS 14.5+,
 * Samsung Internet, Opera. No funciona en Firefox.
 *
 * El hook:
 *  - detecta soporte (`isSupported`)
 *  - inicia/detiene la escucha (`start` / `stop`)
 *  - reporta texto parcial (`interimTranscript`) y final (`finalTranscript`)
 *  - reporta errores en lenguaje cercano al usuario
 *  - se cancela automáticamente al desmontar el componente
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// Tipos mínimos del Web Speech API (TypeScript no los incluye por defecto
// porque no son estándar W3C todavía).
interface SpeechRecognitionResultLike {
    readonly isFinal: boolean;
    readonly length: number;
    item(index: number): { transcript: string };
    [index: number]: { transcript: string };
}

interface SpeechRecognitionResultList {
    readonly length: number;
    item(index: number): SpeechRecognitionResultLike;
    [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionEventLike {
    readonly resultIndex: number;
    readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEventLike {
    readonly error: string;
    readonly message?: string;
}

interface SpeechRecognitionInstance {
    lang: string;
    interimResults: boolean;
    continuous: boolean;
    maxAlternatives: number;
    onresult: ((e: SpeechRecognitionEventLike) => void) | null;
    onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
    onend: (() => void) | null;
    onstart: (() => void) | null;
    start(): void;
    stop(): void;
    abort(): void;
}

interface SpeechRecognitionConstructor {
    new (): SpeechRecognitionInstance;
}

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
    if (typeof window === 'undefined') return null;
    const w = window as unknown as {
        SpeechRecognition?: SpeechRecognitionConstructor;
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export type SpeechErrorCode =
    | 'not-supported'
    | 'no-permission'
    | 'no-speech'
    | 'audio-capture'
    | 'network'
    | 'aborted'
    | 'unknown';

export interface UseSpeechRecognitionOptions {
    /** Idioma BCP-47. Default 'es-CL'. */
    lang?: string;
    /** Si true, sigue escuchando aunque haya pausas. Default true. */
    continuous?: boolean;
}

export interface UseSpeechRecognitionResult {
    isSupported: boolean;
    isListening: boolean;
    /** Texto final ya confirmado por el motor. */
    finalTranscript: string;
    /** Texto parcial mientras el usuario sigue hablando. */
    interimTranscript: string;
    /** Mensaje de error en lenguaje cercano al usuario, o null. */
    error: string | null;
    /** Inicia la escucha. Limpia transcripciones previas. */
    start: () => void;
    /** Detiene la escucha (procesa lo que tenga acumulado). */
    stop: () => void;
    /** Limpia finalTranscript e interimTranscript. */
    reset: () => void;
}

function mapError(code: string): { code: SpeechErrorCode; message: string } {
    switch (code) {
        case 'not-allowed':
        case 'service-not-allowed':
            return {
                code: 'no-permission',
                message:
                    'Permite el acceso al micrófono en tu navegador para usar el dictado por voz.',
            };
        case 'no-speech':
            return {
                code: 'no-speech',
                message: 'No se detectó voz. Intenta hablar más cerca del micrófono.',
            };
        case 'audio-capture':
            return {
                code: 'audio-capture',
                message:
                    'No se pudo acceder al micrófono. Revisa que esté conectado y disponible.',
            };
        case 'network':
            return {
                code: 'network',
                message: 'Error de red durante el reconocimiento. Intenta de nuevo.',
            };
        case 'aborted':
            return { code: 'aborted', message: '' };
        default:
            return {
                code: 'unknown',
                message: 'No se pudo iniciar el dictado por voz. Intenta de nuevo.',
            };
    }
}

export function useSpeechRecognition(
    options: UseSpeechRecognitionOptions = {},
): UseSpeechRecognitionResult {
    const { lang = 'es-CL', continuous = true } = options;

    const ctorRef = useRef<SpeechRecognitionConstructor | null>(null);
    const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
    // Buffer del texto final acumulado dentro de UNA sesión de escucha.
    // El Web Speech API entrega resultados parciales y finales por separado,
    // así que armamos el texto final concatenando los finales que llegan.
    const finalBufferRef = useRef<string>('');

    const [isSupported, setIsSupported] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [finalTranscript, setFinalTranscript] = useState('');
    const [interimTranscript, setInterimTranscript] = useState('');
    const [error, setError] = useState<string | null>(null);

    // Detección de soporte (solo en cliente).
    useEffect(() => {
        const ctor = getSpeechRecognitionCtor();
        ctorRef.current = ctor;
        setIsSupported(Boolean(ctor));
    }, []);

    // Cleanup en desmontaje.
    useEffect(() => {
        return () => {
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.abort();
                } catch {
                    /* noop */
                }
                recognitionRef.current = null;
            }
        };
    }, []);

    const reset = useCallback(() => {
        finalBufferRef.current = '';
        setFinalTranscript('');
        setInterimTranscript('');
        setError(null);
    }, []);

    const stop = useCallback(() => {
        const rec = recognitionRef.current;
        if (!rec) return;
        try {
            rec.stop();
        } catch {
            /* noop — puede pasar si ya se detuvo */
        }
    }, []);

    const start = useCallback(() => {
        const Ctor = ctorRef.current;
        if (!Ctor) {
            setError(mapError('not-supported').message || null);
            return;
        }
        // Si ya hay una instancia activa, abortala antes de crear otra.
        if (recognitionRef.current) {
            try {
                recognitionRef.current.abort();
            } catch {
                /* noop */
            }
            recognitionRef.current = null;
        }

        finalBufferRef.current = '';
        setFinalTranscript('');
        setInterimTranscript('');
        setError(null);

        const rec = new Ctor();
        rec.lang = lang;
        rec.interimResults = true;
        rec.continuous = continuous;
        rec.maxAlternatives = 1;

        rec.onstart = () => {
            setIsListening(true);
        };

        rec.onresult = (event) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                const piece = result[0]?.transcript ?? '';
                if (result.isFinal) {
                    finalBufferRef.current =
                        (finalBufferRef.current
                            ? finalBufferRef.current + ' '
                            : '') + piece.trim();
                } else {
                    interim += piece;
                }
            }
            setFinalTranscript(finalBufferRef.current);
            setInterimTranscript(interim);
        };

        rec.onerror = (event) => {
            const mapped = mapError(event.error);
            if (mapped.code !== 'aborted') {
                setError(mapped.message);
            }
            setIsListening(false);
        };

        rec.onend = () => {
            setIsListening(false);
            setInterimTranscript('');
        };

        recognitionRef.current = rec;
        try {
            rec.start();
        } catch (e) {
            // Suele pasar si start() se llama dos veces seguidas sin haber
            // terminado la sesión previa.
            console.error('[speech] failed to start:', e);
            setError(mapError('unknown').message);
            setIsListening(false);
        }
    }, [lang, continuous]);

    return {
        isSupported,
        isListening,
        finalTranscript,
        interimTranscript,
        error,
        start,
        stop,
        reset,
    };
}

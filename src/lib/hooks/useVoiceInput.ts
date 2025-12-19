'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// TypeScript declarations for Web Speech API
interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
    resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
    error: string;
    message: string;
}

interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start(): void;
    stop(): void;
    abort(): void;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
    onend: (() => void) | null;
    onstart: (() => void) | null;
}

declare global {
    interface Window {
        SpeechRecognition: new () => SpeechRecognition;
        webkitSpeechRecognition: new () => SpeechRecognition;
    }
}

export interface UseVoiceInputReturn {
    isListening: boolean;
    transcript: string;
    interimTranscript: string;
    error: string | null;
    isSupported: boolean;
    startListening: () => void;
    stopListening: () => void;
    resetTranscript: () => void;
}

export function useVoiceInput(): UseVoiceInputReturn {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [interimTranscript, setInterimTranscript] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSupported, setIsSupported] = useState(false);

    const recognitionRef = useRef<SpeechRecognition | null>(null);

    // Check browser support on mount
    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        setIsSupported(!!SpeechRecognition);

        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'es-CL'; // Chilean Spanish

            recognition.onresult = (event: SpeechRecognitionEvent) => {
                let finalTranscript = '';
                let interim = '';

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const result = event.results[i];
                    if (result.isFinal) {
                        finalTranscript += result[0].transcript;
                    } else {
                        interim += result[0].transcript;
                    }
                }

                if (finalTranscript) {
                    setTranscript(prev => prev + finalTranscript);
                }
                setInterimTranscript(interim);
            };

            recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
                console.error('Speech recognition error:', event.error);

                switch (event.error) {
                    case 'no-speech':
                        setError('No se detectó voz. Por favor, intente nuevamente.');
                        break;
                    case 'audio-capture':
                        setError('No se encontró micrófono. Verifique su dispositivo.');
                        break;
                    case 'not-allowed':
                        setError('Permiso de micrófono denegado. Habilítelo en su navegador.');
                        break;
                    case 'network':
                        setError('Error de red. Verifique su conexión.');
                        break;
                    default:
                        setError('Error de reconocimiento de voz. Intente nuevamente.');
                }

                setIsListening(false);
            };

            recognition.onend = () => {
                setIsListening(false);
                setInterimTranscript('');
            };

            recognition.onstart = () => {
                setIsListening(true);
                setError(null);
            };

            recognitionRef.current = recognition;
        }

        // Cleanup
        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.abort();
            }
        };
    }, []);

    const startListening = useCallback(() => {
        if (recognitionRef.current && !isListening) {
            setError(null);
            try {
                recognitionRef.current.start();
            } catch (err) {
                // Recognition might already be running
                console.warn('Recognition start error:', err);
            }
        }
    }, [isListening]);

    const stopListening = useCallback(() => {
        if (recognitionRef.current && isListening) {
            recognitionRef.current.stop();
        }
    }, [isListening]);

    const resetTranscript = useCallback(() => {
        setTranscript('');
        setInterimTranscript('');
        setError(null);
    }, []);

    return {
        isListening,
        transcript,
        interimTranscript,
        error,
        isSupported,
        startListening,
        stopListening,
        resetTranscript,
    };
}

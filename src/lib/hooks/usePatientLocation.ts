'use client';

/**
 * Obtención de la ubicación del paciente para la derivación
 * (PRD D1, RF-06 a RF-11).
 *
 * Dos vías, en este orden:
 *   1. Geolocalización del navegador, con permiso explícito.
 *   2. Comuna declarada, cuando la anterior no está disponible, es denegada o
 *      falla.
 *
 * PRIVACIDAD: las coordenadas viven SOLO en memoria durante la sesión y se
 * mandan al servidor para ordenar los centros. No se persisten (RF-11); lo
 * único que puede quedar guardado con el caso es la comuna.
 *
 * El fallo NUNCA bloquea: si no hay permiso ni comuna, el estado queda en
 * 'unavailable' y el flujo continúa con la recomendación genérica (RF-10).
 */

import { useCallback, useState } from 'react';

export type LocationStatus =
    | 'idle'
    | 'requesting'
    | 'granted'
    | 'denied'
    | 'unsupported'
    | 'unavailable';

export interface PatientLocationState {
    status: LocationStatus;
    latitude: number | null;
    longitude: number | null;
    comuna: string | null;
}

/** Plazo máximo de espera del navegador antes de caer a comuna declarada. */
const GEOLOCATION_TIMEOUT_MS = 8000;

export function usePatientLocation() {
    const [state, setState] = useState<PatientLocationState>({
        status: 'idle',
        latitude: null,
        longitude: null,
        comuna: null,
    });

    const requestGeolocation = useCallback(() => {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
            setState((s) => ({ ...s, status: 'unsupported' }));
            return;
        }
        setState((s) => ({ ...s, status: 'requesting' }));
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setState((s) => ({
                    ...s,
                    status: 'granted',
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                }));
            },
            (error) => {
                // PERMISSION_DENIED = 1. Cualquier otro fallo se trata igual:
                // se le pide la comuna. Nunca se interrumpe el flujo.
                setState((s) => ({
                    ...s,
                    status: error.code === 1 ? 'denied' : 'unavailable',
                }));
            },
            { timeout: GEOLOCATION_TIMEOUT_MS, maximumAge: 0, enableHighAccuracy: false },
        );
    }, []);

    const setComuna = useCallback((comuna: string) => {
        setState((s) => ({ ...s, comuna: comuna.trim() || null }));
    }, []);

    const skip = useCallback(() => {
        setState((s) => ({ ...s, status: 'unavailable' }));
    }, []);

    return { location: state, requestGeolocation, setComuna, skip };
}

/**
 * Comunas ofrecidas cuando el paciente declara su ubicación a mano.
 *
 * Acotada a la cobertura del piloto: son las comunas donde el directorio
 * sembrado tiene centros. Ampliar esta lista sin sumar centros produciría
 * derivaciones a centros lejanos.
 */
export const COMUNA_OPTIONS = [
    'Peñalolén',
    'Macul',
    'Ñuñoa',
    'Puente Alto',
    'San Bernardo',
    'Independencia',
    'Providencia',
] as const;

/**
 * Reglas de elegibilidad de la derivación (PRD D1, RF-12 a RF-16, RF-20, RNF-03).
 *
 * ───────────────────────────────────────────────────────────────────────────
 * SEGURIDAD CLÍNICA (RNF-03, no negociable):
 *   Un paciente con disposición `emergency` (ESI 1-2) NUNCA recibe la opción
 *   de agendar, bajo ninguna condición. Esa regla vive AQUÍ, en el servidor, y
 *   está cubierta por pruebas. No puede depender de que la interfaz oculte un
 *   botón: si mañana alguien cambia el JSX, la regla debe seguir en pie.
 *
 *   El paciente con disposición `same_day_primary_care` (ESI 3) tampoco
 *   agenda: necesita atención HOY, y ofrecerle una hora para otro día sería
 *   retrasarla (RF-15).
 *
 *   Solo `next_day_primary_care` (ESI 4-5) es agendable.
 * ───────────────────────────────────────────────────────────────────────────
 *
 * Módulo PURO: sin red, sin reloj, sin estado.
 */

import type { Disposition } from '@/lib/triage/disposition';
import type { CenterType, PatientLocation } from '@/lib/referral/geo';
import { hasUsableLocation } from '@/lib/referral/geo';

/**
 * Motivo por el cual no se ofreció agendamiento. Alineado con el CHECK de
 * `clinical_records.referral_no_offer_reason` (RF-36).
 */
export type NoOfferReason = 'urgency_level' | 'no_location' | 'no_slots';

export interface ReferralPlan {
    /** ¿Se le ofrece agendar una hora? */
    offerScheduling: boolean;
    /** Motivo cuando NO se ofrece. Null cuando sí se ofrece. */
    noOfferReason: NoOfferReason | null;
    /** Tipo de centro que se le debe mostrar, o null si no hay ubicación. */
    centerType: CenterType | null;
}

/** True solo para la única disposición agendable. Fuente única de la regla. */
export function isSchedulableDisposition(
    disposition: Disposition | null | undefined,
): boolean {
    return disposition === 'next_day_primary_care';
}

/**
 * Decide qué se le muestra al paciente al cerrar la conversación.
 *
 * El orden de evaluación importa y es deliberado: la exclusión por nivel de
 * urgencia se resuelve ANTES que la falta de ubicación, para que un paciente
 * urgente sin ubicación quede registrado como excluido por urgencia y no como
 * "sin ubicación". Así el motivo persistido describe la causa real (RF-36).
 */
export function planReferral(
    disposition: Disposition | null | undefined,
    location: PatientLocation | null | undefined,
): ReferralPlan {
    const locationKnown = hasUsableLocation(location);

    // 1. Urgencia hospitalaria: centro más cercano, jamás agendamiento.
    if (disposition === 'emergency') {
        return {
            offerScheduling: false,
            noOfferReason: 'urgency_level',
            centerType: locationKnown ? 'emergency_hospital' : null,
        };
    }

    // 2. Atención primaria HOY: centro más cercano, tampoco agendamiento.
    if (disposition === 'same_day_primary_care') {
        return {
            offerScheduling: false,
            noOfferReason: 'urgency_level',
            centerType: locationKnown ? 'cesfam' : null,
        };
    }

    // 3. Atención al día siguiente: única vía agendable.
    if (disposition === 'next_day_primary_care') {
        if (!locationKnown) {
            // Sin ubicación no hay forma de proponer un centro cercano; el
            // paciente conserva la recomendación genérica (RF-10, CA-06).
            return {
                offerScheduling: false,
                noOfferReason: 'no_location',
                centerType: null,
            };
        }
        return {
            offerScheduling: true,
            noOfferReason: null,
            centerType: 'partner_clinic',
        };
    }

    // 4. Sin disposición (caso `needs_info` o error): no se deriva a nada.
    return { offerScheduling: false, noOfferReason: null, centerType: null };
}

/** Máximo de cupos que se muestran al paciente (RF-18). */
export const MAX_SLOTS_SHOWN = 5;

/**
 * Recorta la lista de cupos a lo que se le muestra al paciente.
 *
 * El orden de entrada ya viene por proximidad del centro y luego por fecha
 * (RF-18); esta función solo aplica el tope, para que el criterio viva en un
 * único lugar y sea verificable.
 */
export function limitSlotsShown<T>(slots: T[]): T[] {
    return slots.slice(0, MAX_SLOTS_SHOWN);
}

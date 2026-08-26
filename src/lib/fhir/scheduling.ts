/**
 * Contrato de agendamiento FHIR R4 (PRD D1, RF-17, RF-22, RNF-06, RNF-07).
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUÉ EXISTE ESTA INTERFAZ
 *   El incremento D1 opera contra agendas SIMULADAS. El D2 las reemplaza por
 *   los endpoints reales de cada centro aliado. RNF-07 exige que ese cambio no
 *   toque la lógica de derivación, así que todo el acceso a agendas pasa por
 *   `SchedulingAdapter`. Cambiar de servidor es cambiar la implementación de
 *   esta interfaz, nada más.
 *
 *   Por eso el contrato habla en recursos FHIR (`Slot`, `Appointment`) y no en
 *   filas de nuestra base de datos: si hablara de filas, el día de la
 *   integración real habría que reescribir a los consumidores (RNF-06).
 * ───────────────────────────────────────────────────────────────────────────
 *
 * Los constructores de recursos de este módulo son PUROS y testeables.
 */

import type { Disposition } from '@/lib/triage/disposition';

/** Recurso FHIR R4 `Slot` (subconjunto que este incremento usa). */
export interface FHIRSlot {
    resourceType: 'Slot';
    id: string;
    status: 'free' | 'busy';
    start: string;
    end: string;
    schedule: { reference: string };
    serviceType?: Array<{ coding: Array<{ system: string; code: string; display: string }> }>;
}

/** Recurso FHIR R4 `Appointment` (subconjunto que este incremento usa). */
export interface FHIRAppointment {
    resourceType: 'Appointment';
    id?: string;
    status: 'booked';
    start: string;
    end: string;
    slot: Array<{ reference: string }>;
    /** Código de seguimiento anónimo: el único vínculo con el caso (RF-32). */
    identifier: Array<{ system: string; value: string }>;
    /** Nivel de urgencia. NUNCA el relato clínico (RF-33). */
    reasonCode?: Array<{ coding: Array<{ system: string; code: string; display: string }> }>;
    participant: Array<{
        actor: { display: string; reference?: string };
        status: 'accepted';
    }>;
}

/** Cupo tal como lo consume la interfaz del paciente. */
export interface AvailableSlot {
    slotId: string;
    centerId: string;
    centerName: string;
    centerAddress: string;
    centerComuna: string;
    /** Distancia al paciente en kilómetros, o null si se ordenó por comuna. */
    distanceKm: number | null;
    start: string;
    end: string;
}

export interface CreateAppointmentInput {
    slotId: string;
    anonymousCode: string;
    patientName: string;
    disposition: Disposition | null;
}

export type CreateAppointmentResult =
    | { ok: true; appointmentId: string; start: string; end: string }
    | { ok: false; reason: 'slot_taken' | 'slot_not_found' | 'unavailable' };

/**
 * Puerto de agendamiento. D1 lo implementa contra agendas simuladas; D2 lo
 * implementará contra los endpoints FHIR de los centros aliados.
 */
export interface SchedulingAdapter {
    /** Cupos libres de los centros indicados, ordenados por quien llama. */
    searchSlots(centerIds: string[], limit: number): Promise<FHIRSlot[]>;
    /** Reserva un cupo. Nunca lanza: devuelve el motivo del fallo. */
    createAppointment(input: CreateAppointmentInput): Promise<CreateAppointmentResult>;
    /**
     * Devuelve un cupo a la agenda. Compensa el caso en que el cupo se tomó
     * pero la reserva no llegó a completarse, para no dejar cupos bloqueados
     * sin cita asociada.
     */
    releaseSlot(slotId: string): Promise<void>;
}

const ESI_SYSTEM = 'http://meditriage.cl/fhir/CodeSystem/disposition';
const CODE_SYSTEM = 'http://meditriage.cl/fhir/NamingSystem/anonymous-code';

/** Etiqueta legible de cada disposición, para el `reasonCode` del recurso. */
const DISPOSITION_DISPLAY: Record<Disposition, string> = {
    emergency: 'Urgencia hospitalaria',
    same_day_primary_care: 'Atención primaria el mismo día',
    next_day_primary_care: 'Atención primaria al día siguiente',
};

/**
 * Construye el recurso `Appointment` que se envía al centro.
 *
 * PRIVACIDAD (RF-33): el recurso lleva el código anónimo, el nombre de
 * contacto y el nivel de urgencia. NO lleva el relato clínico del paciente, ni
 * su RUT, ni su teléfono, ni las respuestas de la conversación.
 */
export function buildAppointmentResource(input: {
    slotId: string;
    start: string;
    end: string;
    anonymousCode: string;
    patientName: string;
    disposition: Disposition | null;
}): FHIRAppointment {
    const appointment: FHIRAppointment = {
        resourceType: 'Appointment',
        status: 'booked',
        start: input.start,
        end: input.end,
        slot: [{ reference: `Slot/${input.slotId}` }],
        identifier: [{ system: CODE_SYSTEM, value: input.anonymousCode }],
        participant: [{ actor: { display: input.patientName }, status: 'accepted' }],
    };

    if (input.disposition) {
        appointment.reasonCode = [
            {
                coding: [
                    {
                        system: ESI_SYSTEM,
                        code: input.disposition,
                        display: DISPOSITION_DISPLAY[input.disposition],
                    },
                ],
            },
        ];
    }

    return appointment;
}

/** Convierte una fila de cupo del almacén simulado en un recurso `Slot`. */
export function buildSlotResource(row: {
    id: string;
    care_center_id: string;
    slot_start: string;
    slot_end: string;
    status: string;
}): FHIRSlot {
    return {
        resourceType: 'Slot',
        id: row.id,
        status: row.status === 'busy' ? 'busy' : 'free',
        start: row.slot_start,
        end: row.slot_end,
        schedule: { reference: `Schedule/${row.care_center_id}` },
    };
}

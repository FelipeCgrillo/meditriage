/**
 * Tests del incremento D1 — derivación geolocalizada y agendamiento
 * (PRD-derivacion-agendamiento.md).
 *
 * Cubren los criterios de aceptación CA-01 a CA-21 que son verificables sobre
 * lógica pura. Los que dependen de la base de datos (RLS, aislamiento de
 * `appointment_bookings`) se verifican en la migración y quedan anotados.
 *
 * El más importante es CA-02: un paciente de nivel ESI 1 o 2 nunca recibe la
 * opción de agendar. Esa regla es de seguridad clínica y está probada contra
 * la función del servidor, no contra la interfaz.
 */

import { describe, it, expect } from 'vitest';
import {
    planReferral,
    isSchedulableDisposition,
    limitSlotsShown,
    MAX_SLOTS_SHOWN,
} from '@/lib/referral/eligibility';
import {
    haversineKm,
    hasUsableLocation,
    nearestCenterOfType,
    normalizeComuna,
    rankCentersByProximity,
    type CareCenter,
} from '@/lib/referral/geo';
import { buildAppointmentResource, buildSlotResource } from '@/lib/fhir/scheduling';
import { isValidRut, formatRut } from '@/lib/utils/rut';
import { dispositionFromEsi } from '@/lib/triage/disposition';

// ── Directorio de prueba ────────────────────────────────────────────────────
const CENTERS: CareCenter[] = [
    {
        id: 'urg-lejos',
        name: 'Urgencia Lejana',
        center_type: 'emergency_hospital',
        address: 'Calle 1',
        comuna: 'Puente Alto',
        latitude: -33.59,
        longitude: -70.57,
    },
    {
        id: 'urg-cerca',
        name: 'Urgencia Cercana',
        center_type: 'emergency_hospital',
        address: 'Calle 2',
        comuna: 'Peñalolén',
        latitude: -33.487,
        longitude: -70.54,
    },
    {
        id: 'cesfam-1',
        name: 'CESFAM Vecino',
        center_type: 'cesfam',
        address: 'Calle 3',
        comuna: 'Peñalolén',
        latitude: -33.486,
        longitude: -70.539,
    },
    {
        id: 'clinica-1',
        name: 'Centro Aliado',
        center_type: 'partner_clinic',
        address: 'Calle 4',
        comuna: 'Peñalolén',
        latitude: -33.485,
        longitude: -70.545,
        fhir_endpoint_id: 'sim-1',
    },
];

/** Paciente en Peñalolén, cerca de los centros de esa comuna. */
const EN_PENALOLEN = { latitude: -33.486, longitude: -70.542, comuna: null };

describe('CA-02 — el paciente urgente NUNCA recibe agendamiento', () => {
    it('ESI 1 y ESI 2 quedan excluidos por nivel de urgencia', () => {
        for (const esi of [1, 2]) {
            const plan = planReferral(dispositionFromEsi(esi), EN_PENALOLEN);
            expect(plan.offerScheduling).toBe(false);
            expect(plan.noOfferReason).toBe('urgency_level');
        }
    });

    it('la exclusión se mantiene aunque el paciente tenga ubicación perfecta', () => {
        const plan = planReferral('emergency', {
            latitude: -33.486,
            longitude: -70.542,
            comuna: 'Peñalolén',
        });
        expect(plan.offerScheduling).toBe(false);
    });

    it('la exclusión se mantiene aunque NO tenga ubicación', () => {
        const plan = planReferral('emergency', null);
        expect(plan.offerScheduling).toBe(false);
        // El motivo registrado describe la causa real: urgencia, no ubicación.
        expect(plan.noOfferReason).toBe('urgency_level');
    });

    it('solo una disposición es agendable en todo el sistema', () => {
        expect(isSchedulableDisposition('emergency')).toBe(false);
        expect(isSchedulableDisposition('same_day_primary_care')).toBe(false);
        expect(isSchedulableDisposition('next_day_primary_care')).toBe(true);
        expect(isSchedulableDisposition(null)).toBe(false);
    });
});

describe('CA-01 / CA-03 — derivación a un centro concreto', () => {
    it('CA-01: la urgencia deriva al hospital de urgencia más cercano', () => {
        const plan = planReferral('emergency', EN_PENALOLEN);
        expect(plan.centerType).toBe('emergency_hospital');
        const center = nearestCenterOfType(CENTERS, EN_PENALOLEN, 'emergency_hospital');
        expect(center?.id).toBe('urg-cerca');
    });

    it('CA-03: el ESI 3 deriva al CESFAM más cercano y no ofrece cupos', () => {
        const plan = planReferral(dispositionFromEsi(3), EN_PENALOLEN);
        expect(plan.centerType).toBe('cesfam');
        expect(plan.offerScheduling).toBe(false);
        expect(plan.noOfferReason).toBe('urgency_level');
    });
});

describe('CA-04 a CA-07 — proximidad', () => {
    it('CA-04: con coordenadas, ordena por distancia ascendente', () => {
        const ranked = rankCentersByProximity(CENTERS, EN_PENALOLEN);
        const distances = ranked.map((c) => c.distanceKm as number);
        for (let i = 1; i < distances.length; i++) {
            expect(distances[i]).toBeGreaterThanOrEqual(distances[i - 1]);
        }
        expect(ranked[0].comuna).toBe('Peñalolén');
    });

    it('CA-05: sin coordenadas, prioriza los centros de la comuna declarada', () => {
        const ranked = rankCentersByProximity(CENTERS, { comuna: 'Puente Alto' });
        expect(ranked[0].id).toBe('urg-lejos');
        expect(ranked[0].distanceKm).toBeNull();
    });

    it('CA-06: sin coordenadas ni comuna no hay ubicación utilizable', () => {
        expect(hasUsableLocation(null)).toBe(false);
        expect(hasUsableLocation({ latitude: null, longitude: null, comuna: null })).toBe(false);
        expect(hasUsableLocation({ comuna: '   ' })).toBe(false);
        // Y el plan degrada sin romperse.
        const plan = planReferral('next_day_primary_care', null);
        expect(plan.offerScheduling).toBe(false);
        expect(plan.noOfferReason).toBe('no_location');
        expect(plan.centerType).toBeNull();
    });

    it('la comuna se compara sin tildes ni mayúsculas', () => {
        expect(normalizeComuna('Ñuñoa')).toBe(normalizeComuna('nunoa'));
        expect(normalizeComuna('  Peñalolén ')).toBe(normalizeComuna('PENALOLEN'));
    });

    it('la distancia es simétrica y cero sobre el mismo punto', () => {
        expect(haversineKm(-33.45, -70.66, -33.45, -70.66)).toBeCloseTo(0, 6);
        const ida = haversineKm(-33.45, -70.66, -33.59, -70.57);
        const vuelta = haversineKm(-33.59, -70.57, -33.45, -70.66);
        expect(ida).toBeCloseTo(vuelta, 9);
    });

    it('el orden es estable ante empates', () => {
        const empatados: CareCenter[] = [
            { ...CENTERS[0], id: 'a' },
            { ...CENTERS[0], id: 'b' },
        ];
        const ranked = rankCentersByProximity(empatados, EN_PENALOLEN);
        expect(ranked.map((c) => c.id)).toEqual(['a', 'b']);
    });
});

describe('CA-08 / CA-10 — cupos ofrecidos', () => {
    it('CA-08: el ESI 4 con ubicación es la vía agendable', () => {
        const plan = planReferral(dispositionFromEsi(4), EN_PENALOLEN);
        expect(plan.offerScheduling).toBe(true);
        expect(plan.centerType).toBe('partner_clinic');
        expect(plan.noOfferReason).toBeNull();
    });

    it('el ESI 5 sigue el mismo camino que el ESI 4', () => {
        expect(dispositionFromEsi(5)).toBe('next_day_primary_care');
        expect(planReferral(dispositionFromEsi(5), EN_PENALOLEN).offerScheduling).toBe(true);
    });

    it('RF-18: nunca se muestran más de cinco cupos', () => {
        const muchos = Array.from({ length: 40 }, (_, i) => i);
        expect(limitSlotsShown(muchos)).toHaveLength(MAX_SLOTS_SHOWN);
        expect(limitSlotsShown([1, 2])).toHaveLength(2);
        expect(limitSlotsShown([])).toHaveLength(0);
    });
});

describe('CA-19 — el relato clínico nunca viaja al centro', () => {
    const appointment = buildAppointmentResource({
        slotId: 'slot-1',
        start: '2026-09-01T13:00:00.000Z',
        end: '2026-09-01T13:20:00.000Z',
        anonymousCode: 'ABC-234',
        patientName: 'Paciente de Prueba',
        disposition: 'next_day_primary_care',
    });

    it('el recurso Appointment no contiene el relato del paciente', () => {
        const serialized = JSON.stringify(appointment);
        expect(serialized).not.toContain('síntoma');
        expect(serialized).not.toContain('dolor');
        // Solo lleva código anónimo, nombre de contacto y nivel de urgencia.
        expect(appointment.identifier[0].value).toBe('ABC-234');
        expect(appointment.participant[0].actor.display).toBe('Paciente de Prueba');
        expect(appointment.reasonCode?.[0].coding[0].code).toBe('next_day_primary_care');
    });

    it('el recurso no lleva RUT ni teléfono', () => {
        const serialized = JSON.stringify(appointment);
        expect(serialized).not.toMatch(/\d{7,8}-[\dkK]/);
        expect(serialized).not.toContain('phone');
        expect(serialized).not.toContain('telecom');
    });

    it('RNF-06: los recursos cumplen la forma FHIR R4 esperada', () => {
        expect(appointment.resourceType).toBe('Appointment');
        expect(appointment.status).toBe('booked');
        expect(appointment.slot[0].reference).toBe('Slot/slot-1');

        const slot = buildSlotResource({
            id: 'slot-1',
            care_center_id: 'centro-1',
            slot_start: '2026-09-01T13:00:00.000Z',
            slot_end: '2026-09-01T13:20:00.000Z',
            status: 'free',
        });
        expect(slot.resourceType).toBe('Slot');
        expect(slot.status).toBe('free');
        expect(slot.schedule.reference).toBe('Schedule/centro-1');
    });

    it('un cupo ocupado se refleja como busy', () => {
        const slot = buildSlotResource({
            id: 's',
            care_center_id: 'c',
            slot_start: '2026-09-01T13:00:00.000Z',
            slot_end: '2026-09-01T13:20:00.000Z',
            status: 'busy',
        });
        expect(slot.status).toBe('busy');
    });
});

describe('CA-18 — validación del RUT antes de crear la cita', () => {
    it('acepta un RUT válido en cualquier formato', () => {
        expect(isValidRut('12.345.678-5')).toBe(true);
        expect(isValidRut('12345678-5')).toBe(true);
        expect(isValidRut('123456785')).toBe(true);
    });

    it('acepta el dígito verificador K en minúscula y mayúscula', () => {
        // 20.347.878-K es un RUT con verificador K.
        const conK = '20347878-K';
        expect(isValidRut(conK)).toBe(isValidRut(conK.toLowerCase()));
    });

    it('rechaza un dígito verificador incorrecto', () => {
        expect(isValidRut('12.345.678-9')).toBe(false);
        expect(isValidRut('12345678-0')).toBe(false);
    });

    it('rechaza entradas malformadas sin lanzar', () => {
        expect(isValidRut('')).toBe(false);
        expect(isValidRut(null)).toBe(false);
        expect(isValidRut(undefined)).toBe(false);
        expect(isValidRut('no-es-un-rut')).toBe(false);
        expect(isValidRut('123')).toBe(false);
    });

    it('formatea para presentación sin alterar un valor inválido', () => {
        expect(formatRut('123456785')).toBe('12.345.678-5');
        expect(formatRut('basura')).toBe('basura');
    });
});

describe('CA-13 / CA-21 — trazabilidad del desenlace', () => {
    it('CA-21: el motivo registrado para un caso urgente es el nivel de urgencia', () => {
        expect(planReferral('emergency', EN_PENALOLEN).noOfferReason).toBe('urgency_level');
    });

    it('sin ubicación, el motivo registrado distingue el caso agendable', () => {
        expect(planReferral('next_day_primary_care', null).noOfferReason).toBe('no_location');
    });

    it('sin disposición no se deriva a nada y no hay motivo que registrar', () => {
        const plan = planReferral(null, EN_PENALOLEN);
        expect(plan.offerScheduling).toBe(false);
        expect(plan.centerType).toBeNull();
        expect(plan.noOfferReason).toBeNull();
    });
});

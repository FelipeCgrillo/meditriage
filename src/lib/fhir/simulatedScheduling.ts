/**
 * Adaptador de agendamiento SIMULADO (PRD D1).
 *
 * Implementa `SchedulingAdapter` contra las tablas `care_center_slots` y
 * `appointment_bookings` de nuestra propia Supabase, exponiendo el resultado
 * como recursos FHIR R4. Las agendas son ficticias: existen para ejercitar el
 * flujo completo antes de firmar convenio con ningún centro real.
 *
 * El incremento D2 reemplaza ESTE archivo por un adaptador contra los
 * endpoints FHIR de cada centro. Nada fuera de este módulo sabe que hoy las
 * agendas viven en nuestra base de datos (RNF-07).
 *
 * La reserva se hace con una actualización condicional (`status = 'free'` en
 * el WHERE) para que dos pacientes que eligen el mismo cupo no puedan
 * quedárselo los dos: gana quien llegue primero y el segundo recibe
 * `slot_taken` (RF-24, CA-11).
 */

import { createServiceRoleClient } from '@/lib/supabase/server';
import {
    buildAppointmentResource,
    buildSlotResource,
    type CreateAppointmentInput,
    type CreateAppointmentResult,
    type FHIRSlot,
    type SchedulingAdapter,
} from '@/lib/fhir/scheduling';

export function createSimulatedSchedulingAdapter(): SchedulingAdapter {
    return {
        async searchSlots(centerIds: string[], limit: number): Promise<FHIRSlot[]> {
            if (centerIds.length === 0) return [];
            const supabase = createServiceRoleClient();
            const { data, error } = await supabase
                .from('care_center_slots')
                .select('id, care_center_id, slot_start, slot_end, status')
                .in('care_center_id', centerIds)
                .eq('status', 'free')
                .gt('slot_start', new Date().toISOString())
                .order('slot_start', { ascending: true })
                .limit(limit);

            if (error || !data) {
                console.error('[scheduling] searchSlots falló', error?.message);
                return [];
            }
            return data.map(buildSlotResource);
        },

        async createAppointment(
            input: CreateAppointmentInput,
        ): Promise<CreateAppointmentResult> {
            const supabase = createServiceRoleClient();

            const { data: slot, error: slotError } = await supabase
                .from('care_center_slots')
                .select('id, care_center_id, slot_start, slot_end, status')
                .eq('id', input.slotId)
                .maybeSingle();

            if (slotError || !slot) return { ok: false, reason: 'slot_not_found' };
            if (slot.status !== 'free') return { ok: false, reason: 'slot_taken' };

            // Toma condicional del cupo: solo prospera si sigue libre.
            const { data: taken, error: takeError } = await supabase
                .from('care_center_slots')
                .update({ status: 'busy' })
                .eq('id', input.slotId)
                .eq('status', 'free')
                .select('id');

            if (takeError) {
                console.error('[scheduling] no se pudo tomar el cupo', takeError.message);
                return { ok: false, reason: 'unavailable' };
            }
            if (!taken || taken.length === 0) {
                // Otro paciente ganó la carrera entre el SELECT y el UPDATE.
                return { ok: false, reason: 'slot_taken' };
            }

            // El recurso que recibiría el centro. En D1 no se envía a ninguna
            // red: se construye igual para que su forma quede fijada por las
            // pruebas y D2 solo tenga que hacer el POST.
            const appointment = buildAppointmentResource({
                slotId: input.slotId,
                start: slot.slot_start,
                end: slot.slot_end,
                anonymousCode: input.anonymousCode,
                patientName: input.patientName,
                disposition: input.disposition,
            });

            return {
                ok: true,
                appointmentId: `sim-${appointment.slot[0].reference.replace('Slot/', '')}`,
                start: slot.slot_start,
                end: slot.slot_end,
            };
        },

        async releaseSlot(slotId: string): Promise<void> {
            // Compensación: si la reserva no se pudo completar después de
            // tomar el cupo, se devuelve a la agenda para que no quede un
            // cupo bloqueado sin cita asociada.
            const supabase = createServiceRoleClient();
            const { error } = await supabase
                .from('care_center_slots')
                .update({ status: 'free' })
                .eq('id', slotId);
            if (error) {
                console.error('[scheduling] no se pudo liberar el cupo', error.message);
            }
        },
    };
}

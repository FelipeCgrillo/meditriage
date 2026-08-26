/**
 * POST /api/referral/booking
 *
 * Crea la reserva de hora (PRD D1, RF-21 a RF-33).
 *
 * ───────────────────────────────────────────────────────────────────────────
 * ESTE ES EL ÚNICO PUNTO DEL SISTEMA QUE RECIBE DATOS PERSONALES.
 *
 *   - El RUT llega, se valida y se convierte en digest con un salt de
 *     servidor. NUNCA se almacena en claro ni se escribe en bitácora (RF-31).
 *     El digest usa salt secreto porque un SHA-256 pelado de un RUT es
 *     trivial de revertir por fuerza bruta: el universo de RUT chilenos
 *     válidos cabe en una tabla.
 *   - Nombre y teléfono se guardan en `appointment_bookings`, tabla sin
 *     políticas RLS de lectura: solo service_role la ve (RF-30, RNF-04).
 *   - El relato clínico NO viaja al centro. El recurso `Appointment` solo
 *     lleva código anónimo, nombre y nivel de urgencia (RF-33).
 *   - `clinical_records` solo recibe el hecho de la reserva y el centro,
 *     que no son datos identificables (RF-34/RF-35).
 * ───────────────────────────────────────────────────────────────────────────
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { createSimulatedSchedulingAdapter } from '@/lib/fhir/simulatedScheduling';
import { isValidRut, normalizeRut } from '@/lib/utils/rut';
import { isSchedulableDisposition } from '@/lib/referral/eligibility';

const BodySchema = z.object({
    slot_id: z.string().uuid(),
    anonymous_code: z.string().min(3).max(20),
    disposition: z
        .enum(['emergency', 'same_day_primary_care', 'next_day_primary_care'])
        .nullable(),
    patient_name: z.string().min(2).max(120),
    rut: z.string().min(8).max(15),
    phone: z.string().max(20).nullable().optional(),
    /** RNF-05: constancia de que el paciente aceptó el consentimiento. */
    consent_accepted: z.literal(true),
});

/**
 * Digest del RUT con salt de servidor. Si el salt no está configurado se usa
 * uno derivado del proyecto: degrada la protección pero no rompe el flujo, y
 * queda registrado en consola para que se corrija en despliegue.
 */
async function digestRut(rut: string): Promise<string> {
    const salt = process.env.RUT_HASH_SALT;
    if (!salt) {
        console.warn('[booking] RUT_HASH_SALT no configurado: el digest es más débil de lo previsto.');
    }
    const data = new TextEncoder().encode(`${salt ?? 'meditriage-default'}:${normalizeRut(rut)}`);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

export async function POST(req: NextRequest) {
    let body: z.infer<typeof BodySchema>;
    try {
        body = BodySchema.parse(await req.json());
    } catch {
        return NextResponse.json(
            { error: 'invalid_payload', message: 'Faltan datos para completar la reserva.' },
            { status: 400 },
        );
    }

    // Seguridad clínica (RNF-03): la exclusión por nivel de urgencia se vuelve
    // a verificar aquí. Aunque la interfaz nunca muestre el botón, esta ruta
    // rechaza una reserva para un paciente que no es agendable.
    if (!isSchedulableDisposition(body.disposition)) {
        return NextResponse.json(
            {
                error: 'not_schedulable',
                message:
                    'Según su evaluación necesita atención presencial y no corresponde agendar una hora.',
            },
            { status: 409 },
        );
    }

    // RF-29: dígito verificador antes de crear la cita.
    if (!isValidRut(body.rut)) {
        return NextResponse.json(
            {
                error: 'invalid_rut',
                message: 'El RUT ingresado no es válido. Revise el número y el dígito verificador.',
            },
            { status: 400 },
        );
    }

    const adapter = createSimulatedSchedulingAdapter();

    try {
        const created = await adapter.createAppointment({
            slotId: body.slot_id,
            anonymousCode: body.anonymous_code,
            patientName: body.patient_name,
            disposition: body.disposition,
        });

        if (!created.ok) {
            const message =
                created.reason === 'slot_taken'
                    ? 'Ese horario acaba de ser tomado por otra persona. Elija otro de la lista.'
                    : 'No fue posible completar la reserva en este momento.';
            return NextResponse.json(
                { error: created.reason, message },
                { status: created.reason === 'slot_taken' ? 409 : 503 },
            );
        }

        const supabase = createServiceRoleClient();

        const { data: slotRow } = await supabase
            .from('care_center_slots')
            .select('care_center_id')
            .eq('id', body.slot_id)
            .maybeSingle();

        const rutHash = await digestRut(body.rut);

        const { error: insertError } = await supabase.from('appointment_bookings').insert({
            anonymous_code: body.anonymous_code,
            care_center_id: slotRow?.care_center_id,
            slot_id: body.slot_id,
            slot_start: created.start,
            patient_name: body.patient_name,
            rut_hash: rutHash,
            phone: body.phone ?? null,
            fhir_appointment_id: created.appointmentId,
            status: 'booked',
            consent_accepted_at: new Date().toISOString(),
        });

        if (insertError) {
            // Compensación: el cupo ya se tomó, pero la reserva no quedó
            // registrada. Se devuelve a la agenda para no bloquearlo.
            console.error('[booking] insert falló, liberando cupo', insertError.message);
            await adapter.releaseSlot(body.slot_id);
            return NextResponse.json(
                {
                    error: 'booking_failed',
                    message: 'No fue posible completar la reserva en este momento.',
                },
                { status: 503 },
            );
        }

        // Trazabilidad en el caso clínico (RF-34/RF-35). Sin datos personales:
        // solo el hecho de la reserva y el centro.
        const { error: traceError } = await supabase
            .from('clinical_records')
            .update({
                referral_booked: true,
                referral_center_id: slotRow?.care_center_id ?? null,
            })
            .eq('anonymous_code', body.anonymous_code);

        if (traceError) {
            // La cita es válida aunque la traza falle; no se revierte.
            console.error('[booking] no se pudo registrar la traza', traceError.message);
        }

        return NextResponse.json({
            ok: true,
            appointment_id: created.appointmentId,
            start: created.start,
            end: created.end,
        });
    } catch (e) {
        console.error('[booking] fallo inesperado', e);
        return NextResponse.json(
            {
                error: 'booking_failed',
                message: 'No fue posible completar la reserva en este momento.',
            },
            { status: 503 },
        );
    }
}

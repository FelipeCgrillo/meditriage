/**
 * POST /api/referral
 *
 * Resuelve la derivación del paciente al cerrar la conversación
 * (PRD D1, RF-06 a RF-20). Devuelve o bien el centro al que debe acudir, o
 * bien los cupos que puede reservar, según su disposición clínica y su
 * ubicación.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * SEGURIDAD CLÍNICA (RNF-03): la decisión de si se ofrece agendamiento se toma
 * AQUÍ, en el servidor, con `planReferral`. El cliente no puede pedirle cupos
 * al sistema para un paciente de urgencia: aunque los pida, esta ruta no se
 * los da.
 *
 * PRIVACIDAD (RF-11): las coordenadas del paciente entran por el cuerpo, se
 * usan para ordenar y se descartan. Solo la comuna vuelve al cliente para que
 * la persista con el caso.
 * ───────────────────────────────────────────────────────────────────────────
 *
 * Nunca devuelve 5xx al paciente: ante cualquier fallo responde una derivación
 * degradada con la recomendación genérica (RNF-02).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { planReferral, limitSlotsShown, MAX_SLOTS_SHOWN } from '@/lib/referral/eligibility';
import { rankCentersByProximity, nearestCenterOfType, type CareCenter } from '@/lib/referral/geo';
import { createSimulatedSchedulingAdapter } from '@/lib/fhir/simulatedScheduling';
import type { AvailableSlot } from '@/lib/fhir/scheduling';

const BodySchema = z.object({
    disposition: z
        .enum(['emergency', 'same_day_primary_care', 'next_day_primary_care'])
        .nullable(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    comuna: z.string().max(80).nullable().optional(),
});

/** Plazo máximo de la consulta de cupos (RNF-01). */
const SLOT_LOOKUP_TIMEOUT_MS = 3000;

function withTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((resolve) => setTimeout(() => resolve(fallback), SLOT_LOOKUP_TIMEOUT_MS)),
    ]);
}

export async function POST(req: NextRequest) {
    let body: z.infer<typeof BodySchema>;
    try {
        body = BodySchema.parse(await req.json());
    } catch {
        return NextResponse.json(
            { error: 'invalid_payload', message: 'El cuerpo de la solicitud no es válido.' },
            { status: 400 },
        );
    }

    const location = {
        latitude: body.latitude ?? null,
        longitude: body.longitude ?? null,
        comuna: body.comuna ?? null,
    };

    // La regla de elegibilidad corre ANTES de tocar la base de datos: un
    // paciente de urgencia nunca llega siquiera a la consulta de cupos.
    const plan = planReferral(body.disposition, location);

    // Sin tipo de centro que mostrar (sin ubicación o sin disposición): el
    // paciente conserva la recomendación genérica y el flujo termina bien.
    if (!plan.centerType) {
        return NextResponse.json({
            offerScheduling: false,
            noOfferReason: plan.noOfferReason,
            center: null,
            slots: [],
        });
    }

    try {
        const supabase = createServiceRoleClient();
        const { data, error } = await supabase
            .from('care_centers')
            .select('id, name, center_type, address, comuna, latitude, longitude, fhir_endpoint_id')
            .eq('is_active', true);

        if (error || !data) {
            console.error('[referral] no se pudo leer el directorio', error?.message);
            return NextResponse.json({
                offerScheduling: false,
                noOfferReason: plan.offerScheduling ? 'no_slots' : plan.noOfferReason,
                center: null,
                slots: [],
            });
        }

        const centers = data as CareCenter[];

        // Vía NO agendable (urgencia u atención el mismo día): solo el centro
        // más cercano del tipo que corresponda (RF-12, RF-15).
        if (!plan.offerScheduling) {
            const center = nearestCenterOfType(centers, location, plan.centerType);
            return NextResponse.json({
                offerScheduling: false,
                noOfferReason: plan.noOfferReason,
                center,
                slots: [],
            });
        }

        // Vía agendable: cupos de los centros aliados con agenda publicada,
        // ordenados por proximidad del centro y luego por fecha (RF-18).
        const partners = rankCentersByProximity(
            centers.filter((c) => c.center_type === 'partner_clinic' && c.fhir_endpoint_id),
            location,
        );

        if (partners.length === 0) {
            return NextResponse.json({
                offerScheduling: false,
                noOfferReason: 'no_slots',
                center: null,
                slots: [],
            });
        }

        const adapter = createSimulatedSchedulingAdapter();
        const fhirSlots = await withTimeout(
            adapter.searchSlots(
                partners.map((p) => p.id),
                MAX_SLOTS_SHOWN * partners.length,
            ),
            [],
        );

        const byCenter = new Map(partners.map((p, i) => [p.id, { center: p, rank: i }]));
        const slots: AvailableSlot[] = fhirSlots
            .map((slot) => {
                const centerId = slot.schedule.reference.replace('Schedule/', '');
                const entry = byCenter.get(centerId);
                if (!entry) return null;
                return {
                    slotId: slot.id,
                    centerId,
                    centerName: entry.center.name,
                    centerAddress: entry.center.address,
                    centerComuna: entry.center.comuna,
                    distanceKm: entry.center.distanceKm,
                    start: slot.start,
                    end: slot.end,
                    _rank: entry.rank,
                } as AvailableSlot & { _rank: number };
            })
            .filter((s): s is AvailableSlot & { _rank: number } => s !== null)
            .sort((a, b) => a._rank - b._rank || a.start.localeCompare(b.start))
            .map(({ _rank, ...slot }) => {
                void _rank;
                return slot;
            });

        const shown = limitSlotsShown(slots);

        // Sin cupos: recomendación genérica, y se explica que no hay horas.
        // No es un error del paciente (RF-20, CA-10).
        if (shown.length === 0) {
            return NextResponse.json({
                offerScheduling: false,
                noOfferReason: 'no_slots',
                center: null,
                slots: [],
            });
        }

        return NextResponse.json({
            offerScheduling: true,
            noOfferReason: null,
            center: null,
            slots: shown,
        });
    } catch (e) {
        // RNF-02: la caída del agendamiento no puede tumbar el triaje.
        console.error('[referral] fallo inesperado', e);
        return NextResponse.json({
            offerScheduling: false,
            noOfferReason: plan.offerScheduling ? 'no_slots' : plan.noOfferReason,
            center: null,
            slots: [],
        });
    }
}

/**
 * POST /api/referral/trace
 *
 * Registra en el caso clínico qué pasó con la derivación
 * (PRD D1, RF-11, RF-34, RF-36).
 *
 * Se llama una vez resuelta la derivación, ANTES de que el paciente decida si
 * reserva o no. Deja constancia de si se le ofreció agendamiento y, cuando no,
 * del motivo. Sin esto no habría manera de saber por qué un caso terminó sin
 * hora, que es justamente la métrica que el piloto necesita medir.
 *
 * PRIVACIDAD: acepta la comuna y nada más de la ubicación. Las coordenadas no
 * se reciben aquí ni se persisten en ninguna parte (RF-11).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/server';

const BodySchema = z.object({
    anonymous_code: z.string().min(3).max(20),
    referral_offered: z.boolean(),
    no_offer_reason: z
        .enum(['urgency_level', 'no_location', 'no_slots'])
        .nullable()
        .optional(),
    comuna: z.string().max(80).nullable().optional(),
});

export async function POST(req: NextRequest) {
    let body: z.infer<typeof BodySchema>;
    try {
        body = BodySchema.parse(await req.json());
    } catch {
        return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
    }

    try {
        const supabase = createServiceRoleClient();
        const { error } = await supabase
            .from('clinical_records')
            .update({
                referral_offered: body.referral_offered,
                referral_no_offer_reason: body.no_offer_reason ?? null,
                patient_comuna: body.comuna ?? null,
            })
            .eq('anonymous_code', body.anonymous_code);

        if (error) {
            console.error('[referral/trace] no se pudo registrar', error.message);
            return NextResponse.json({ ok: false }, { status: 200 });
        }
        return NextResponse.json({ ok: true });
    } catch (e) {
        // La traza es observabilidad, no parte del acto clínico: si falla, el
        // paciente no debe enterarse ni ver su pantalla degradada.
        console.error('[referral/trace] fallo inesperado', e);
        return NextResponse.json({ ok: false }, { status: 200 });
    }
}

/**
 * POST /api/patient/record
 *
 * Persiste el registro clínico del paciente anónimo al cierre de la
 * conversación. El API valida el slug de organización server-side (no
 * confía en el cliente) y usa `service_role` para insertar respetando la
 * RLS estricta introducida por la migración 012.
 *
 * Contexto PRD I1 (RF-03, RF-06, RF-07, CA-04, CA-05):
 *   - El link del paciente incluye `?org=<slug>`.
 *   - El chat entrega ese slug al server junto con el resultado del triaje.
 *   - Si el slug no resuelve a una organización activa, respondemos 400
 *     con mensaje genérico y NO creamos ningún registro.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { resolveOrganizationIdBySlug } from '@/lib/organizations';

/** Payload mínimo necesario para persistir un caso de éxito. */
const BodySchema = z.object({
    org_slug: z.string().min(3).max(60),
    anonymous_code: z.string().min(3).max(20),
    symptoms_text: z.string().min(1),
    ai_response: z.record(z.string(), z.unknown()),
    esi_level: z.number().int().min(1).max(5),
    disposition: z
        .enum(['emergency', 'same_day_primary_care', 'next_day_primary_care'])
        .nullable()
        .optional(),
    cmd_features: z.record(z.string(), z.unknown()).nullable().optional(),
    patient_gender: z.string().nullable().optional(),
    patient_age_group: z.string().nullable().optional(),
    conversation_history: z.array(z.record(z.string(), z.unknown())).nullable().optional(),
});

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

    const organizationId = await resolveOrganizationIdBySlug(body.org_slug);
    if (!organizationId) {
        // Mensaje genérico: no confirmamos si el slug existe o no (CA-05).
        return NextResponse.json(
            {
                error: 'invalid_organization',
                message: 'Este enlace no es válido, consulte con su CESFAM.',
            },
            { status: 400 },
        );
    }

    const supabase = createServiceRoleClient();
    const { error } = await supabase.from('clinical_records').insert({
        organization_id: organizationId,
        patient_consent: true,
        symptoms_text: body.symptoms_text,
        ai_response: body.ai_response as any,
        esi_level: body.esi_level,
        nurse_validated: false,
        anonymous_code: body.anonymous_code,
        cmd_features: (body.cmd_features ?? null) as any,
        disposition: body.disposition ?? null,
        patient_gender: body.patient_gender ?? null,
        patient_age_group: body.patient_age_group ?? null,
        conversation_history: (body.conversation_history ?? null) as any,
    } as any);

    if (error) {
        // No filtramos detalle interno; sí lo dejamos en el log del server.
        console.error('[patient/record] insert error:', error);
        return NextResponse.json(
            { error: 'persist_failed', message: 'No se pudo guardar el registro.' },
            { status: 500 },
        );
    }

    return NextResponse.json({ ok: true }, { status: 201 });
}

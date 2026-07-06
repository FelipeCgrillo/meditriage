import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';

/**
 * GET /api/admin/clinical-records
 * Lista los registros clínicos (triages de pacientes) para el panel de admin.
 * Protegido: solo rol admin. Usa service_role para leer todo el conjunto.
 *
 * Devuelve un subconjunto de columnas relevante para inspección/auditoría:
 * código anónimo, ESI de la IA, ESI de la enfermera, demográficos, estado de
 * validación y fecha. NO devuelve el fhir_bundle ni el ai_response completos
 * para mantener la respuesta liviana.
 */
export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET() {
    const auth = await requireAdmin();
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    if (!supabaseServiceKey) {
        return NextResponse.json({ error: 'Service role key not configured' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await supabaseAdmin
        .from('clinical_records')
        .select(
            'id, anonymous_code, symptoms_text, esi_level, nurse_override_level, nurse_validated, patient_gender, patient_age_group, consent_eligible, created_at',
        )
        .order('created_at', { ascending: false })
        .limit(500);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ records: data ?? [] });
}

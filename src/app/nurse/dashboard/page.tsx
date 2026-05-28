import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import NurseDashboardClient, { type ClinicalRecord } from './NurseDashboardClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Server Component — obtiene la sesión y los registros clínicos iniciales
 * usando cookies del request. El middleware ya validó que el usuario tiene
 * rol nurse/admin antes de llegar aquí; este componente es redundante pero
 * defensivo en caso de un edge case.
 *
 * Al hacer F5: este RSC se ejecuta server-side usando las cookies HTTP del
 * request (createServerClient lee cookies()). Si el usuario está autenticado,
 * la lista de pacientes se renderiza SSR — NUNCA queda en spinner.
 */
export default async function NurseDashboardPage() {
    const supabase = await createSupabaseServerClient();

    // Verifica sesión (defensivo — middleware ya lo hizo).
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        redirect('/login/nurse?redirect=/nurse/dashboard');
    }

    // Verifica rol (defensivo — middleware ya lo hizo).
    const { data: profile } = await supabase
        .from('user_profiles')
        .select('id, email, role, full_name')
        .eq('id', user.id)
        .maybeSingle();

    if (!profile || (profile.role !== 'nurse' && profile.role !== 'admin')) {
        redirect('/unauthorized');
    }

    // Fetch inicial de registros — server-side, sin riesgo de spinner.
    const { data: recordsData, error: recordsError } = await supabase
        .from('clinical_records')
        .select('id, anonymous_code, esi_level, nurse_override_level, symptoms_text, patient_gender, patient_age_group, consent_eligible, nurse_validated, ai_response, created_at, updated_at')
        .order('created_at', { ascending: false })
        .limit(100);

    const initialRecords: ClinicalRecord[] = (recordsData as ClinicalRecord[] | null) ?? [];

    return (
        <NurseDashboardClient
            initialRecords={initialRecords}
            initialError={recordsError?.message ?? null}
            userEmail={profile.email}
            userName={profile.full_name}
        />
    );
}

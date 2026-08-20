/**
 * POST /api/account/change-password
 *
 * Cambia la contrase\u00f1a del usuario autenticado y baja el flag
 * `must_change_password` en su perfil. Verifica primero la contrase\u00f1a
 * actual autenticando de nuevo contra Supabase para evitar que un atacante
 * con acceso a la sesi\u00f3n cambie la clave sin conocerla.
 *
 * PRD I1 CA-14.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServerClient, createServiceRoleClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
    const { currentPassword, newPassword } = (await req.json().catch(() => ({}))) as {
        currentPassword?: string;
        newPassword?: string;
    };

    if (!currentPassword || !newPassword || newPassword.length < 8) {
        return NextResponse.json(
            { error: 'Contrase\u00f1a actual y nueva son obligatorias; la nueva requiere al menos 8 caracteres.' },
            { status: 400 },
        );
    }
    if (currentPassword === newPassword) {
        return NextResponse.json(
            { error: 'La nueva contrase\u00f1a debe ser distinta de la actual.' },
            { status: 400 },
        );
    }

    const ssr = await createSupabaseServerClient();
    const {
        data: { user },
        error: authError,
    } = await ssr.auth.getUser();
    if (authError || !user || !user.email) {
        return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
    }

    // Reautenticaci\u00f3n independiente para verificar la contrase\u00f1a actual.
    // Usamos un cliente separado para no interferir con la sesi\u00f3n del SSR.
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) {
        return NextResponse.json({ error: 'Configuraci\u00f3n incompleta.' }, { status: 500 });
    }
    const verify = createClient(url, anon, { auth: { persistSession: false } });
    const { error: signInError } = await verify.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
    });
    if (signInError) {
        return NextResponse.json(
            { error: 'La contrase\u00f1a actual es incorrecta.' },
            { status: 400 },
        );
    }

    const admin = createServiceRoleClient();
    const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
        password: newPassword,
    });
    if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    const { error: flagError } = await admin
        .from('user_profiles')
        .update({ must_change_password: false })
        .eq('id', user.id);
    if (flagError) {
        // La contrase\u00f1a ya se cambi\u00f3; loggeamos pero devolvemos ok.
        console.error('[change-password] no se pudo bajar el flag:', flagError);
    }

    return NextResponse.json({ ok: true });
}

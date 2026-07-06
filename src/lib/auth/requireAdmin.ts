import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Verifica que la petición provenga de un usuario AUTENTICADO con rol `admin`.
 *
 * Devuelve `{ ok: true, userId }` si autoriza, o `{ ok: false, status, error }`
 * con el código HTTP adecuado (401 sin sesión, 403 sin rol admin) para que el
 * endpoint responda de forma consistente.
 *
 * Motivo: las rutas /api/admin/* usan la service_role key (que ignora RLS), así
 * que DEBEN verificar el rol explícitamente. De lo contrario quedarían abiertas
 * a cualquiera en internet.
 */
export async function requireAdmin(): Promise<
    { ok: true; userId: string } | { ok: false; status: number; error: string }
> {
    const supabase = await createSupabaseServerClient();

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        return { ok: false, status: 401, error: 'No autenticado.' };
    }

    const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (profileError || !profile || profile.role !== 'admin') {
        return { ok: false, status: 403, error: 'Requiere rol de administrador.' };
    }

    return { ok: true, userId: user.id };
}

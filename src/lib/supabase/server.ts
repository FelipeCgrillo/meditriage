import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/**
 * Create a Supabase client for Server Components
 * This client has read-only access to cookies
 */
export async function createSupabaseServerClient() {
    const cookieStore = await cookies();

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        );
                    } catch {
                        // The `setAll` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing sessions.
                    }
                },
            },
        }
    );
}

/**
 * Get the current user's profile with role
 */
export async function getCurrentUserProfile() {
    const supabase = await createSupabaseServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return null;
    }

    const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (profileError || !profile) {
        return null;
    }

    return {
        user,
        profile
    };
}

/**
 * Cliente Supabase con service_role.
 *
 * USO EXCLUSIVO en rutas de API server-side donde:
 *   - el paciente anónimo necesita insertar un registro clínico y no puede
 *     verse afectado por RLS del anon (que el I1 endurece), o
 *   - un admin de plataforma debe crear organizaciones o usuarios que
 *     todavía no existen y, por definición, no puede validar contra ninguna
 *     RLS que dependa de auth.uid().
 *
 * NUNCA exponer este cliente al navegador. Requiere la env
 * SUPABASE_SERVICE_ROLE_KEY (server-only).
 */
export function createServiceRoleClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
        throw new Error(
            'Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY para el cliente con service_role.',
        );
    }
    return createClient(url, serviceKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });
}

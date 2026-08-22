/**
 * Helpers de organización (tenant) para MediTriage.
 *
 * Server-only. Encapsulan la validación del slug del paciente
 * (/paciente?org=<slug>) y la resolución a `organization_id`.
 */

import { createServiceRoleClient } from '@/lib/supabase/server';

/**
 * Resuelve un slug de organización a su id. Devuelve null si el slug no
 * existe o la organización está inactiva. NO devuelve el objeto completo
 * para minimizar exposición en el flujo del paciente anónimo.
 */
export async function resolveOrganizationIdBySlug(
    slug: string | null | undefined,
): Promise<string | null> {
    if (!slug) return null;
    const normalized = slug.trim().toLowerCase();
    // Validación barata antes de tocar la DB (evita queries con basura).
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(normalized) || normalized.length < 3 || normalized.length > 60) {
        return null;
    }

    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
        .from('organizations')
        .select('id, is_active')
        .eq('slug', normalized)
        .maybeSingle();

    if (error || !data || !data.is_active) return null;
    return data.id as string;
}

/**
 * Slug de la organización por defecto para instalaciones sin URL parámetro.
 * En I1 se decidió exigir el parámetro `?org=` en el link del paciente:
 * si falta, el sistema muestra un mensaje de enlace no válido. Este helper
 * existe para tests y para la organización semilla creada por la migración
 * 012.
 */
export const SEED_ORGANIZATION_SLUG = 'meditriage-piloto';

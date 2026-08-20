/**
 * Helpers de organizaci\u00f3n (tenant) para MediTriage.
 *
 * Server-only. Encapsulan la validaci\u00f3n del slug del paciente
 * (/paciente?org=<slug>) y la resoluci\u00f3n a `organization_id`.
 */

import { createServiceRoleClient } from '@/lib/supabase/server';

/**
 * Resuelve un slug de organizaci\u00f3n a su id. Devuelve null si el slug no
 * existe o la organizaci\u00f3n est\u00e1 inactiva. NO devuelve el objeto completo
 * para minimizar exposici\u00f3n en el flujo del paciente an\u00f3nimo.
 */
export async function resolveOrganizationIdBySlug(
    slug: string | null | undefined,
): Promise<string | null> {
    if (!slug) return null;
    const normalized = slug.trim().toLowerCase();
    // Validaci\u00f3n barata antes de tocar la DB (evita queries con basura).
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
 * Slug de la organizaci\u00f3n por defecto para instalaciones sin URL par\u00e1metro.
 * En I1 se decidi\u00f3 exigir el par\u00e1metro `?org=` en el link del paciente:
 * si falta, el sistema muestra un mensaje de enlace no v\u00e1lido. Este helper
 * existe para tests y para la organizaci\u00f3n semilla creada por la migraci\u00f3n
 * 012.
 */
export const SEED_ORGANIZATION_SLUG = 'meditriage-piloto';

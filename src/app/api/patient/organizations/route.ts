/**
 * GET /api/patient/organizations
 *
 * Lista las organizaciones activas (slug + nombre) para el selector
 * previo de /paciente cuando el link no trae `?org=` (PRD mejoras UX
 * RF-01, mitigación definida en PRD I1 riesgos). No expone ids internos
 * ni organizaciones inactivas.
 */

import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
        .from('organizations')
        .select('slug, name')
        .eq('is_active', true)
        .order('name', { ascending: true })
        .limit(50);

    if (error) {
        return NextResponse.json({ organizations: [] }, { status: 200 });
    }
    return NextResponse.json(
        {
            organizations: (data ?? []).map((o) => ({
                slug: o.slug as string,
                name: o.name as string,
            })),
        },
        { status: 200 },
    );
}

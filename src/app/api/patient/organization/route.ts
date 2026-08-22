/**
 * GET /api/patient/organization?slug=<slug>
 *
 * Valida que el slug corresponda a una organización activa y devuelve
 * su `name` para poder mostrarlo al paciente. No expone el `id` interno
 * ni ningún otro campo (defensa en profundidad, CA-05).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
    const slug = req.nextUrl.searchParams.get('slug');
    if (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length < 3 || slug.length > 60) {
        return NextResponse.json({ valid: false }, { status: 400 });
    }
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
        .from('organizations')
        .select('name, is_active')
        .eq('slug', slug.toLowerCase())
        .maybeSingle();
    if (error || !data || !data.is_active) {
        return NextResponse.json({ valid: false }, { status: 200 });
    }
    return NextResponse.json({ valid: true, name: data.name as string }, { status: 200 });
}

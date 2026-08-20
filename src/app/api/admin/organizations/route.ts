/**
 * POST /api/admin/organizations
 * GET  /api/admin/organizations
 *
 * Alta y lectura de organizaciones (tenants). Solo el admin de plataforma
 * (rol admin sin `organization_id`) puede crear organizaciones nuevas.
 * Un admin de tenant solo puede leer su propia organizaci\u00f3n.
 *
 * PRD I1 RF-02, CA-01, CA-07.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { createServiceRoleClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export async function POST(req: NextRequest) {
    const auth = await requireAdmin();
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    if (!auth.isPlatformAdmin) {
        return NextResponse.json(
            { error: 'Solo el administrador de plataforma puede crear organizaciones.' },
            { status: 403 },
        );
    }

    const { slug, name } = (await req.json().catch(() => ({}))) as {
        slug?: string;
        name?: string;
    };
    const cleanSlug = (slug ?? '').trim().toLowerCase();
    const cleanName = (name ?? '').trim();

    if (
        !cleanSlug ||
        cleanSlug.length < 3 ||
        cleanSlug.length > 60 ||
        !SLUG_RE.test(cleanSlug)
    ) {
        return NextResponse.json(
            { error: 'Slug inv\u00e1lido: usar solo min\u00fasculas, n\u00fameros y guiones (3-60 caracteres).' },
            { status: 400 },
        );
    }
    if (!cleanName || cleanName.length > 200) {
        return NextResponse.json(
            { error: 'Nombre inv\u00e1lido (1-200 caracteres).' },
            { status: 400 },
        );
    }

    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
        .from('organizations')
        .insert({ slug: cleanSlug, name: cleanName, is_active: true })
        .select('id, slug, name, is_active, created_at, updated_at')
        .single();

    if (error) {
        // 23505 = unique_violation
        if ((error as { code?: string }).code === '23505') {
            return NextResponse.json({ error: 'Ese slug ya est\u00e1 en uso.' }, { status: 409 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ organization: data }, { status: 201 });
}

export async function GET() {
    const auth = await requireAdmin();
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const supabase = createServiceRoleClient();
    let query = supabase
        .from('organizations')
        .select('id, slug, name, is_active, created_at, updated_at')
        .order('created_at', { ascending: false });
    if (!auth.isPlatformAdmin && auth.organizationId) {
        query = query.eq('id', auth.organizationId);
    }
    const { data, error } = await query;
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ organizations: data ?? [] });
}

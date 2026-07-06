import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * GET /api/dau/runs        → lista las corridas guardadas (metadatos + métricas).
 * GET /api/dau/runs?id=UUID → devuelve una corrida con todos sus dau_results.
 *
 * Lectura restringida por RLS a personal autenticado (nurse|researcher|admin).
 */
export const runtime = 'nodejs';

export async function GET(req: Request): Promise<Response> {
    const supabase = await createSupabaseServerClient();

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
        return json({ error: 'No autenticado.' }, 401);
    }

    const id = new URL(req.url).searchParams.get('id');

    if (id) {
        const { data: run, error: runErr } = await supabase
            .from('dau_runs')
            .select('*')
            .eq('id', id)
            .single();
        if (runErr || !run) {
            return json({ error: 'Corrida no encontrada.' }, 404);
        }
        const { data: results, error: resErr } = await supabase
            .from('dau_results')
            .select('*')
            .eq('run_id', id)
            .order('created_at', { ascending: true });
        if (resErr) {
            return json({ error: 'No se pudieron leer los resultados.' }, 500);
        }
        return json({ run, results: results ?? [] }, 200);
    }

    const { data: runs, error } = await supabase
        .from('dau_runs')
        .select(
            'id, file_name, total, classified, needs_info, comparable, agreements, simple_agreement, created_at',
        )
        .order('created_at', { ascending: false })
        .limit(100);

    if (error) {
        return json({ error: 'No se pudieron leer las corridas.' }, 500);
    }

    return json({ runs: runs ?? [] }, 200);
}

function json(data: unknown, status: number): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

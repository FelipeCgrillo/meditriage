import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { DAUClassification, DAURecord, DAUSummary } from '@/lib/dau/types';

/**
 * POST /api/dau/save
 * Persiste una corrida COMPLETA del análisis retrospectivo de DAU.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * A diferencia de POST /api/dau (que clasifica y devuelve resultados EFÍMEROS),
 * este endpoint escribe en la base de datos:
 *   - una fila en `dau_runs`     → metadatos del archivo + métricas globales.
 *   - N filas en `dau_results`   → una por registro clasificado, uniendo el
 *                                  resultado con su registro DAU original para
 *                                  conservar el texto libre y los demográficos.
 *
 * SEGURIDAD: usa el cliente de servidor con la sesión del usuario. Las RLS de
 * `dau_runs` / `dau_results` exigen rol nurse | researcher | admin; un usuario
 * no autorizado recibirá un error de la base de datos (lo devolvemos como 403).
 * ───────────────────────────────────────────────────────────────────────────
 */
export const runtime = 'nodejs';

interface SavePayload {
    file_name?: string | null;
    records: DAURecord[];
    results: DAUClassification[];
    summary: DAUSummary;
}

export async function POST(req: Request): Promise<Response> {
    let body: SavePayload;
    try {
        body = (await req.json()) as SavePayload;
    } catch {
        return json({ error: 'Invalid JSON body' }, 400);
    }

    const { file_name, records, results, summary } = body ?? {};

    if (!Array.isArray(results) || results.length === 0 || !summary) {
        return json({ error: 'Faltan results o summary; no hay nada que guardar.' }, 400);
    }

    const supabase = await createSupabaseServerClient();

    // Debe haber una sesión (RLS lo exigiría igual, pero damos mejor mensaje).
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
        return json({ error: 'No autenticado. Inicia sesión para guardar la corrida.' }, 401);
    }

    // 1) Insertar la corrida (dau_runs).
    const { data: run, error: runError } = await supabase
        .from('dau_runs')
        .insert({
            file_name: file_name ?? null,
            created_by: user.id,
            total: summary.total,
            classified: summary.classified,
            needs_info: summary.needs_info,
            with_gold_standard: summary.with_gold_standard,
            comparable: summary.comparable,
            agreements: summary.agreements,
            simple_agreement: summary.simple_agreement,
            confusion_matrix: summary.confusion_matrix,
        })
        .select('id')
        .single();

    if (runError || !run) {
        // 42501 = insufficient_privilege (RLS lo bloqueó).
        const status = (runError as { code?: string } | null)?.code === '42501' ? 403 : 500;
        console.error('[dau/save] error insertando dau_runs', runError);
        return json(
            {
                error:
                    status === 403
                        ? 'No tienes permiso para guardar corridas (se requiere rol nurse, researcher o admin).'
                        : 'No se pudo crear la corrida en la base de datos.',
            },
            status,
        );
    }

    // Índice de registros originales por record_id para recuperar texto libre.
    const byId = new Map<string, DAURecord>();
    for (const rec of records ?? []) byId.set(rec.record_id, rec);

    // 2) Insertar los resultados (dau_results).
    const rows = results.map((r) => {
        const src = byId.get(r.record_id);
        return {
            run_id: run.id,
            record_id: r.record_id,
            chief_complaint: src?.chief_complaint ?? null,
            reported_symptoms: src?.reported_symptoms ?? null,
            sex: src?.sex ?? null,
            age_group: src?.age_group ?? null,
            age_years: src?.age_years ?? null,
            predicted_esi: r.predicted_esi,
            status: r.status,
            decision_source: r.decision_source,
            matched_rule: r.matched_rule,
            rule_rationale: r.rule_rationale ?? null,
            extracted_features: r.extracted_features ?? null,
            nurse_esi: r.nurse_esi,
            agreement: r.agreement,
        };
    });

    const { error: resultsError } = await supabase.from('dau_results').insert(rows);

    if (resultsError) {
        console.error('[dau/save] error insertando dau_results', resultsError);
        // Rollback manual: la corrida quedó sin filas → la eliminamos para no
        // dejar corridas huérfanas/incompletas.
        await supabase.from('dau_runs').delete().eq('id', run.id);
        return json({ error: 'No se pudieron guardar los resultados; se revirtió la corrida.' }, 500);
    }

    return json({ ok: true, run_id: run.id, saved: rows.length }, 200);
}

function json(data: unknown, status: number): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

import { createSupabaseServerClient, createServiceRoleClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/requireAdmin';
import { getProtocolFingerprint, type ProtocolFingerprint } from '@/lib/ai/protocol';
import { computeStudyMetrics, isCritical, isHighSeverity } from '@/lib/dau/metrics';
import { SEED_ORGANIZATION_SLUG } from '@/lib/organizations';
import type { DAUClassification, DAURecord, DAUSummary } from '@/lib/dau/types';

/**
 * POST /api/dau/save
 * Persiste una corrida COMPLETA del análisis retrospectivo de DAU.
 *
 * ───────────────────────────────────────────────────────────────────────────
 *   - una fila en `dau_runs`   → metadatos, huella del protocolo congelado y
 *                                métricas del estudio (recalculadas aquí).
 *   - N filas en `dau_results` → una por registro. El texto que se guarda es
 *                                el DESIDENTIFICADO que se envió al modelo,
 *                                nunca el texto original del archivo.
 *
 * Integridad del protocolo: si la huella con que se clasificó la corrida
 * (modelo, prompt, reglas, detector) difiere de la vigente, se rechaza con
 * 409 para no mezclar versiones.
 * ───────────────────────────────────────────────────────────────────────────
 */
export const runtime = 'nodejs';

interface SavePayload {
    file_name?: string | null;
    records: DAURecord[];
    results: DAUClassification[];
    summary: DAUSummary;
    protocol?: ProtocolFingerprint | null;
    organization_slug?: string | null;
}

const FINGERPRINT_KEYS: (keyof ProtocolFingerprint)[] = [
    'model_id',
    'prompt_sha256',
    'rules_version',
    'deid_version',
    'effort',
];

export async function POST(req: Request): Promise<Response> {
    const auth = await requireRole(['researcher', 'admin']);
    if (!auth.ok) return json({ error: auth.error }, auth.status);

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

    const protocol = await getProtocolFingerprint();
    if (body.protocol) {
        const mismatch = FINGERPRINT_KEYS.filter((k) => body.protocol?.[k] !== protocol[k]);
        if (mismatch.length > 0) {
            return json(
                {
                    error: `La corrida se clasificó con otra versión del protocolo (${mismatch.join(', ')}). No se mezclan versiones: vuelva a procesar el archivo.`,
                },
                409,
            );
        }
    }

    // Organización: la del usuario. El admin de plataforma (sin tenant) guarda
    // en la organización indicada o, por defecto, en la organización semilla.
    let organizationId = auth.organizationId;
    if (!organizationId) {
        const slug = (body.organization_slug ?? SEED_ORGANIZATION_SLUG).trim().toLowerCase();
        const { data: org } = await createServiceRoleClient()
            .from('organizations')
            .select('id, is_active')
            .eq('slug', slug)
            .maybeSingle();
        if (!org || !org.is_active) {
            return json({ error: 'No se encontró una organización activa donde guardar la corrida.' }, 400);
        }
        organizationId = org.id as string;
    }

    // Las métricas se recalculan en el servidor: no se confía en el cliente.
    const study = computeStudyMetrics(results);

    const supabase = await createSupabaseServerClient();
    const { data: run, error: runError } = await supabase
        .from('dau_runs')
        .insert({
            organization_id: organizationId,
            file_name: file_name ?? null,
            created_by: auth.userId,
            total: summary.total,
            classified: summary.classified,
            needs_info: summary.needs_info,
            with_gold_standard: summary.with_gold_standard,
            comparable: summary.comparable,
            agreements: summary.agreements,
            simple_agreement: summary.simple_agreement,
            confusion_matrix: summary.confusion_matrix,
            model_id: protocol.model_id,
            prompt_sha256: protocol.prompt_sha256,
            rules_version: protocol.rules_version,
            deid_version: protocol.deid_version,
            effort: protocol.effort,
            study_metrics: study,
        })
        .select('id')
        .single();

    if (runError || !run) {
        const status = (runError as { code?: string } | null)?.code === '42501' ? 403 : 500;
        console.error('[dau/save] error insertando dau_runs', runError?.code, runError?.message);
        return json(
            {
                error:
                    status === 403
                        ? 'No tienes permiso para guardar corridas en esta organización.'
                        : 'No se pudo crear la corrida en la base de datos.',
            },
            status,
        );
    }

    const byId = new Map<string, DAURecord>();
    for (const rec of records ?? []) byId.set(rec.record_id, rec);

    const rows = results.map((r) => {
        const src = byId.get(r.record_id);
        return {
            run_id: run.id,
            record_id: r.record_id,
            // Solo el texto desidentificado que efectivamente salió al modelo.
            chief_complaint: r.sent_text ?? null,
            reported_symptoms: null,
            sex: r.sex ?? src?.sex ?? null,
            age_group: r.age_group ?? src?.age_group ?? null,
            age_years: null,
            age_band: src?.age_band ?? null,
            period: src?.period ?? null,
            time_band: src?.time_band ?? null,
            predicted_esi: r.predicted_esi,
            llm_esi: r.llm_esi ?? null,
            model_error: r.model_error ?? false,
            insufficient_info: r.insufficient_info ?? false,
            status: r.status,
            decision_source: r.decision_source,
            matched_rule: r.matched_rule,
            rule_rationale: r.rule_rationale ?? null,
            extracted_features: r.extracted_features ?? null,
            tens_esi: r.tens_esi,
            agreement: r.agreement,
            outcome: r.outcome ?? null,
            high_severity: r.outcome ? isHighSeverity(r.outcome) : null,
            critical: r.outcome ? isCritical(r.outcome) : null,
            vitals_removed: r.vitals_removed ?? false,
            deid_categories: r.deid_categories ?? null,
            complaint_key: r.complaint_key ?? null,
        };
    });

    const { error: resultsError } = await supabase.from('dau_results').insert(rows);
    if (resultsError) {
        console.error('[dau/save] error insertando dau_results', resultsError.code, resultsError.message);
        await supabase.from('dau_runs').delete().eq('id', run.id);
        return json({ error: 'No se pudieron guardar los resultados; se revirtió la corrida.' }, 500);
    }

    return json({ ok: true, run_id: run.id, saved: rows.length, protocol }, 200);
}

function json(data: unknown, status: number): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

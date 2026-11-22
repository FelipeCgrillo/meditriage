'use client';

import React, { useMemo, useState } from 'react';
import { parseDAUFile, type DAUParseError } from '@/lib/dau/parser';
import { summarizeDAU } from '@/lib/dau/summary';
import {
    computeStudyMetrics,
    INTERPRETATION_LABELS,
    type ComparisonBlock,
    type InterpretationCell,
    type StratumMetrics,
    type StudyMetrics,
} from '@/lib/dau/metrics';
import {
    mergeReference,
    prepareRecords,
    reviewSampleIndices,
    toOutbound,
    INITIAL_REVIEW_LOT,
    type PreparedRecord,
} from '@/lib/dau/review';
import type { ProtocolFingerprint } from '@/lib/ai/protocol';
import type { Interval, Proportion } from '@/lib/stats';
import type { DAUClassification, DAUSummary, DAUBatchResponse } from '@/lib/dau/types';

/**
 * Tamaño de cada tanda enviada al servidor: cada registro implica una
 * llamada al modelo y la función serverless tiene un tiempo límite.
 */
const BATCH_SIZE = 2;

function chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

const pct = (v: number | null | undefined, digits = 1) => (v == null ? '—' : `${(v * 100).toFixed(digits)} %`);
const ci = (i: Interval | null | undefined, digits = 1) =>
    i ? `${(i.lower * 100).toFixed(digits)} a ${(i.upper * 100).toFixed(digits)} %` : '—';
const num = (v: number | null | undefined, digits = 3) => (v == null ? '—' : v.toFixed(digits));

function download(name: string, content: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
}

type ReviewDecision = 'ok' | 'excluir';

/**
 * Análisis retrospectivo de DAU según el protocolo aprobado por el CEC.
 *
 * Flujo:
 *   1. Carga del CSV o JSON entregado por el custodio.
 *   2. Desidentificación automática EN EL NAVEGADOR.
 *   3. Revisión manual obligatoria: 100% del lote inicial de 100 textos y
 *      una muestra aleatoria del 10% del resto. Nada sale antes de aprobar.
 *   4. Clasificación: al servidor viajan solo id, relato desidentificado,
 *      sexo y grupo etario. El ESI TENS y el desenlace quedan aquí.
 *   5. Métricas frente al desenlace, criterio de continuidad y exportes
 *      (resultados, métricas y bitácora de envíos).
 */
export default function DAUAnalysisPage() {
    const [prepared, setPrepared] = useState<PreparedRecord[]>([]);
    const [parseErrors, setParseErrors] = useState<DAUParseError[]>([]);
    const [parseWarnings, setParseWarnings] = useState<DAUParseError[]>([]);
    const [reviewIdx, setReviewIdx] = useState<number[]>([]);
    const [decisions, setDecisions] = useState<Record<number, ReviewDecision>>({});
    const [reviewApproved, setReviewApproved] = useState(false);
    const [results, setResults] = useState<DAUClassification[]>([]);
    const [summary, setSummary] = useState<DAUSummary | null>(null);
    const [study, setStudy] = useState<StudyMetrics | null>(null);
    const [protocol, setProtocol] = useState<ProtocolFingerprint | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string | null>(null);
    const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState<string | null>(null);
    const [savedRunId, setSavedRunId] = useState<string | null>(null);
    const [dragActive, setDragActive] = useState(false);
    const [startedAt, setStartedAt] = useState<string | null>(null);

    const excluded = useMemo(
        () => new Set(Object.entries(decisions).filter(([, d]) => d === 'excluir').map(([i]) => Number(i))),
        [decisions],
    );
    const pendingReview = reviewIdx.filter((i) => decisions[i] == null).length;
    const toSend = useMemo(() => prepared.filter((_, i) => !excluded.has(i)), [prepared, excluded]);

    function resetRun() {
        setResults([]);
        setSummary(null);
        setStudy(null);
        setProtocol(null);
        setProgress(null);
        setSaveMsg(null);
        setSavedRunId(null);
    }

    async function processFile(file: File) {
        const name = file.name.toLowerCase();
        if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
            setError('Guarde el Excel como "Texto (delimitado por tabulaciones)" o "CSV UTF 8" y súbalo nuevamente.');
            return;
        }
        setError(null);
        resetRun();
        setReviewApproved(false);
        setDecisions({});
        setFileName(file.name);
        const parsed = parseDAUFile(await file.text());
        const prep = prepareRecords(parsed.records);
        setPrepared(prep);
        setReviewIdx(reviewSampleIndices(prep.length));
        setParseErrors(parsed.errors);
        setParseWarnings(parsed.warnings ?? []);
        if (parsed.records.length === 0) setError('No se encontraron registros válidos en el archivo.');
    }

    async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (file) await processFile(file);
    }

    function handleDrop(e: React.DragEvent<HTMLLabelElement>) {
        e.preventDefault();
        setDragActive(false);
        const file = e.dataTransfer.files?.[0];
        if (file) processFile(file);
    }

    async function runAnalysis() {
        if (toSend.length === 0 || !reviewApproved) return;
        setLoading(true);
        setError(null);
        resetRun();
        setStartedAt(new Date().toISOString());
        const accumulated: DAUClassification[] = [];
        let runProtocol: ProtocolFingerprint | null = null;
        setProgress({ done: 0, total: toSend.length });

        try {
            for (const batch of chunk(toSend, BATCH_SIZE)) {
                const res = await fetch('/api/dau', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ records: batch.map(toOutbound) }),
                });
                const raw = await res.text();
                let data: (DAUBatchResponse & { error?: string; protocol?: ProtocolFingerprint }) | null = null;
                try {
                    data = JSON.parse(raw);
                } catch {
                    throw new Error(
                        res.ok
                            ? 'El servidor devolvió una respuesta no válida.'
                            : `Error del servidor (${res.status}). La tanda pudo exceder el tiempo límite.`,
                    );
                }
                if (!res.ok || !data) throw new Error(data?.error ?? `Error del servidor (${res.status}).`);

                // Huella del protocolo: debe ser idéntica en todas las tandas.
                if (data.protocol) {
                    if (runProtocol && JSON.stringify(runProtocol) !== JSON.stringify(data.protocol)) {
                        throw new Error('Cambió la versión del protocolo durante la corrida. Se detiene el análisis.');
                    }
                    runProtocol = data.protocol;
                    setProtocol(data.protocol);
                }

                const byId = new Map(batch.map((p) => [p.record.record_id, p]));
                for (const r of data.results) {
                    const p = byId.get(r.record_id);
                    accumulated.push(p ? mergeReference(r, p) : r);
                }
                setResults([...accumulated]);
                setSummary(summarizeDAU(accumulated));
                setProgress({ done: accumulated.length, total: toSend.length });
            }
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }

        if (accumulated.length > 0) {
            const finalStudy = computeStudyMetrics(accumulated);
            setStudy(finalStudy);
            await saveRun(accumulated, { ...summarizeDAU(accumulated), study: finalStudy }, runProtocol);
        }
    }

    async function saveRun(res: DAUClassification[], sum: DAUSummary, prot: ProtocolFingerprint | null) {
        if (res.length === 0) return;
        setSaving(true);
        setSaveMsg(null);
        try {
            const resp = await fetch('/api/dau/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // Solo metadatos disociados del registro: el texto que se guarda
                // es el desidentificado (sent_text) que ya viene en cada resultado.
                body: JSON.stringify({
                    file_name: fileName,
                    records: toSend.map((p) => ({
                        record_id: p.record.record_id,
                        sex: p.record.sex,
                        age_group: p.record.age_group,
                        age_band: p.record.age_band,
                        period: p.record.period,
                        time_band: p.record.time_band,
                        chief_complaint: '',
                    })),
                    results: res,
                    summary: { ...sum, study: undefined },
                    protocol: prot,
                }),
            });
            const data = (await resp.json()) as { ok?: boolean; run_id?: string; saved?: number; error?: string };
            if (!resp.ok || !data.ok) {
                setSaveMsg(data.error ?? `No se pudo guardar (error ${resp.status}).`);
                setSavedRunId(null);
            } else {
                setSaveMsg(`Guardado en la base de datos: ${data.saved} registro(s).`);
                setSavedRunId(data.run_id ?? null);
            }
        } catch (err) {
            setSaveMsg(`Error al guardar: ${(err as Error).message}`);
        } finally {
            setSaving(false);
        }
    }

    function exportResultsCsv() {
        if (results.length === 0) return;
        const header = [
            'record_id', 'esi_herramienta', 'esi_llm', 'esi_tens', 'desenlace', 'concordancia', 'estado',
            'error_modelo', 'origen_decision', 'regla', 'signos_vitales_retirados', 'categorias_desidentificadas',
            'motivo_normalizado',
        ];
        const rows = results.map((r) =>
            [
                r.record_id, r.predicted_esi ?? '', r.llm_esi ?? '', r.tens_esi ?? '', r.outcome ?? '',
                r.agreement == null ? '' : r.agreement ? 'sí' : 'no', r.status, r.model_error ? 'sí' : 'no',
                r.decision_source, r.matched_rule ?? '', r.vitals_removed ? 'sí' : 'no',
                (r.deid_categories ?? []).join('|'), r.complaint_key ?? '',
            ]
                .map((c) => `"${String(c).replace(/"/g, '""')}"`)
                .join(','),
        );
        download('dau_resultados.csv', `﻿${[header.join(','), ...rows].join('\n')}`, 'text/csv;charset=utf-8');
    }

    function exportMetricsJson() {
        if (!study) return;
        download(
            'dau_metricas.json',
            JSON.stringify({ file_name: fileName, started_at: startedAt, protocol, study }, null, 2),
            'application/json',
        );
    }

    /** Paso 5 del protocolo: bitácora con el texto exacto remitido por solicitud. */
    function exportLog() {
        if (results.length === 0) return;
        const lines = results.map((r, i) =>
            JSON.stringify({
                n: i + 1,
                record_id: r.record_id,
                started_at: startedAt,
                model_id: protocol?.model_id,
                prompt_sha256: protocol?.prompt_sha256,
                rules_version: protocol?.rules_version,
                deid_version: protocol?.deid_version,
                sent_text: r.sent_text,
                sex: r.sex,
                age_group: r.age_group,
                deid_categories: r.deid_categories,
                review: decisions[prepared.findIndex((p) => p.record.record_id === r.record_id)] ?? 'no_muestreado',
            }),
        );
        const reviewSummary = JSON.stringify({
            tipo: 'resumen_revision',
            lote_inicial: Math.min(INITIAL_REVIEW_LOT, prepared.length),
            muestra_total: reviewIdx.length,
            excluidos: excluded.size,
        });
        download('dau_bitacora_envios.jsonl', [reviewSummary, ...lines].join('\n'), 'application/x-ndjson');
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="mx-auto max-w-6xl space-y-6">
                <header>
                    <h1 className="text-2xl font-bold text-gray-900">Análisis retrospectivo de DAU</h1>
                    <p className="mt-1 text-sm text-gray-600">
                        Protocolo CEC: la herramienta clasifica solo con el relato desidentificado, el sexo y
                        el grupo etario. El ESI del TENS es el comparador y el <strong>destino al egreso</strong>{' '}
                        es el criterio de referencia. Ninguno de los dos se envía al modelo.
                    </p>
                </header>

                {/* 1. Carga */}
                <section className="rounded-lg border border-gray-200 bg-white p-4">
                    <h2 className="text-sm font-semibold text-gray-800">1. Cargar archivo del custodio (CSV, TSV o JSON)</h2>
                    <label
                        htmlFor="dau-file-input"
                        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                        onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
                        onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
                        onDrop={handleDrop}
                        className={`mt-2 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/50'}`}
                    >
                        <span className="text-sm text-gray-700">
                            <strong className="text-blue-600">Arrastra tu archivo aquí</strong> o haz clic para seleccionar
                        </span>
                        <span className="text-xs text-gray-500">
                            Columnas reconocidas: id, sexo, tramo etario, mes, franja horaria, motivo de consulta,
                            síntomas, categoría TENS, destino al egreso
                        </span>
                        <input id="dau-file-input" type="file" accept=".json,.csv,.tsv,.txt,application/json,text/csv,text/tab-separated-values,text/plain" onChange={handleFile} className="hidden" />
                    </label>
                    {fileName && (
                        <p className="mt-2 text-sm text-gray-600">
                            <strong>{prepared.length}</strong> registro(s) válido(s) en <em>{fileName}</em>
                            {parseErrors.length > 0 && <span className="text-amber-700"> · {parseErrors.length} fila(s) descartada(s)</span>}
                            {parseWarnings.length > 0 && <span className="text-amber-700"> · {parseWarnings.length} advertencia(s)</span>}
                        </p>
                    )}
                    {(parseErrors.length > 0 || parseWarnings.length > 0) && (
                        <details className="mt-2 text-xs text-amber-700">
                            <summary className="cursor-pointer">Ver detalle</summary>
                            <ul className="mt-1 list-disc pl-5">
                                {[...parseErrors, ...parseWarnings].slice(0, 50).map((e, i) => (
                                    <li key={i}>fila {e.row}: {e.reason}</li>
                                ))}
                            </ul>
                        </details>
                    )}
                </section>

                {/* 2. Revisión de desidentificación */}
                {prepared.length > 0 && (
                    <ReviewSection
                        prepared={prepared}
                        reviewIdx={reviewIdx}
                        decisions={decisions}
                        setDecisions={setDecisions}
                        approved={reviewApproved}
                        onApprove={() => setReviewApproved(true)}
                        pending={pendingReview}
                    />
                )}

                {/* 3. Clasificación */}
                {prepared.length > 0 && (
                    <section className="rounded-lg border border-gray-200 bg-white p-4">
                        <h2 className="text-sm font-semibold text-gray-800">3. Clasificar y calcular métricas</h2>
                        <p className="mt-1 text-xs text-gray-500">
                            Se enviarán {toSend.length} registro(s){excluded.size > 0 ? `, ${excluded.size} excluido(s) en la revisión` : ''}.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-3">
                            <button
                                onClick={runAnalysis}
                                disabled={!reviewApproved || toSend.length === 0 || loading}
                                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                            >
                                {loading && progress ? `Clasificando… ${progress.done}/${progress.total}` : 'Analizar lote'}
                            </button>
                            <button onClick={exportResultsCsv} disabled={results.length === 0} className="btn-secondary rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                                Resultados CSV
                            </button>
                            <button onClick={exportMetricsJson} disabled={!study} className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                                Métricas JSON
                            </button>
                            <button onClick={exportLog} disabled={results.length === 0} className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                                Bitácora de envíos
                            </button>
                            <button
                                onClick={() => summary && saveRun(results, summary, protocol)}
                                disabled={results.length === 0 || loading || saving}
                                className="rounded-md border border-blue-300 bg-white px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                            >
                                {saving ? 'Guardando…' : 'Guardar en base de datos'}
                            </button>
                        </div>
                        {!reviewApproved && (
                            <p className="mt-2 text-xs text-amber-700">Primero complete y apruebe la revisión de desidentificación.</p>
                        )}
                        {saveMsg && (
                            <p className={`mt-3 text-sm ${savedRunId ? 'text-green-700' : 'text-amber-700'}`}>
                                {saveMsg}
                                {savedRunId && <span className="ml-1 font-mono text-xs text-gray-500">(corrida {savedRunId.slice(0, 8)}…)</span>}
                            </p>
                        )}
                        {protocol && (
                            <p className="mt-2 font-mono text-[11px] text-gray-500">
                                modelo {protocol.model_id} · prompt {protocol.prompt_sha256.slice(0, 12)} · reglas {protocol.rules_version} · desidentificación {protocol.deid_version} · esfuerzo {protocol.effort}
                            </p>
                        )}
                        {progress && progress.total > 0 && (
                            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-gray-200">
                                <div className="h-full rounded-full bg-blue-600 transition-all duration-300" style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} />
                            </div>
                        )}
                        <p className="mt-3 text-[11px] text-gray-500">
                            La bitácora contiene el texto exacto remitido al proveedor. Guárdela solo en el equipo con cifrado de disco completo.
                        </p>
                    </section>
                )}

                {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

                {study && <StudyPanel study={study} />}

                {summary && summary.comparable > 0 && <ConfusionMatrixTable summary={summary} />}

                {results.length > 0 && <ResultsTable results={results} />}
            </div>
        </div>
    );
}

function ReviewSection(props: {
    prepared: PreparedRecord[];
    reviewIdx: number[];
    decisions: Record<number, ReviewDecision>;
    setDecisions: React.Dispatch<React.SetStateAction<Record<number, ReviewDecision>>>;
    approved: boolean;
    onApprove: () => void;
    pending: number;
}) {
    const { prepared, reviewIdx, decisions, setDecisions, approved, onApprove, pending } = props;
    const [page, setPage] = useState(0);
    const perPage = 20;
    const pageItems = reviewIdx.slice(page * perPage, (page + 1) * perPage);
    const pages = Math.ceil(reviewIdx.length / perPage);
    const set = (i: number, d: ReviewDecision) => setDecisions((prev) => ({ ...prev, [i]: d }));

    return (
        <section className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-gray-800">2. Revisión manual de la desidentificación</h2>
            <p className="mt-1 text-xs text-gray-600">
                Protocolo CEC: revisión del 100% del lote inicial ({Math.min(INITIAL_REVIEW_LOT, prepared.length)} textos) y de una muestra
                aleatoria del 10% del resto ({Math.max(0, reviewIdx.length - Math.min(INITIAL_REVIEW_LOT, prepared.length))} textos). Criterio de
                aceptación: cero identificadores residuales. Si encuentra uno, excluya el registro y avise para corregir las reglas.
            </p>
            <p className="mt-1 text-xs text-gray-500">
                Pendientes: <strong>{pending}</strong> de {reviewIdx.length}. El texto original se muestra solo en este navegador.
            </p>
            <div className="mt-3 space-y-3">
                {pageItems.map((i) => {
                    const p = prepared[i];
                    const flags = [...p.complaint.review_flags, ...(p.symptoms?.review_flags ?? [])];
                    const d = decisions[i];
                    return (
                        <div key={i} className={`rounded border p-3 text-xs ${d === 'ok' ? 'border-green-200 bg-green-50/40' : d === 'excluir' ? 'border-red-200 bg-red-50/40' : 'border-gray-200'}`}>
                            <div className="flex items-center justify-between">
                                <span className="font-mono text-gray-500">#{i + 1} · {p.record.record_id}</span>
                                <div className="flex gap-2">
                                    <button disabled={approved} onClick={() => set(i, 'ok')} className={`rounded px-2 py-1 font-semibold ${d === 'ok' ? 'bg-green-600 text-white' : 'border border-green-300 text-green-700'}`}>Sin identificadores</button>
                                    <button disabled={approved} onClick={() => set(i, 'excluir')} className={`rounded px-2 py-1 font-semibold ${d === 'excluir' ? 'bg-red-600 text-white' : 'border border-red-300 text-red-700'}`}>Excluir</button>
                                </div>
                            </div>
                            <div className="mt-2 grid gap-2 md:grid-cols-2">
                                <div>
                                    <div className="text-[10px] uppercase text-gray-400">Original (local)</div>
                                    <div className="text-gray-600">{p.record.chief_complaint}{p.record.reported_symptoms ? ` · ${p.record.reported_symptoms}` : ''}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] uppercase text-gray-400">Se enviará</div>
                                    <div className="text-gray-900">{p.complaint.text}{p.symptoms?.text ? ` · ${p.symptoms.text}` : ''}</div>
                                </div>
                            </div>
                            {flags.length > 0 && <div className="mt-1 text-amber-700">Revisar posibles nombres: {flags.join(', ')}</div>}
                        </div>
                    );
                })}
            </div>
            {pages > 1 && (
                <div className="mt-3 flex items-center gap-2 text-xs">
                    <button disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded border px-2 py-1 disabled:opacity-40">Anterior</button>
                    <span>Página {page + 1} de {pages}</span>
                    <button disabled={page >= pages - 1} onClick={() => setPage(page + 1)} className="rounded border px-2 py-1 disabled:opacity-40">Siguiente</button>
                </div>
            )}
            <div className="mt-4">
                <button
                    onClick={onApprove}
                    disabled={approved || pending > 0}
                    className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                    {approved ? 'Revisión aprobada' : 'Aprobar revisión'}
                </button>
            </div>
        </section>
    );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'ok' | 'bad' }) {
    return (
        <div className={`rounded-lg border bg-white p-4 ${tone === 'ok' ? 'border-green-300' : tone === 'bad' ? 'border-red-300' : 'border-gray-200'}`}>
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</div>
            <div className="mt-1 text-2xl font-bold text-gray-900">{value}</div>
            {sub && <div className="mt-1 text-xs text-gray-500">{sub}</div>}
        </div>
    );
}

function PropRow({ label, tool, tens }: { label: string; tool: Proportion; tens: Proportion }) {
    return (
        <tr>
            <td className="px-3 py-2 text-gray-700">{label}</td>
            <td className="px-3 py-2">{pct(tool.estimate)} <span className="text-gray-400">({tool.x}/{tool.n})</span></td>
            <td className="px-3 py-2 text-xs">{ci(tool.wilson)}</td>
            <td className="px-3 py-2">{pct(tens.estimate)} <span className="text-gray-400">({tens.x}/{tens.n})</span></td>
            <td className="px-3 py-2 text-xs">{ci(tens.wilson)}</td>
        </tr>
    );
}

function BlockTable({ block }: { block: ComparisonBlock }) {
    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead>
                    <tr className="text-left text-xs uppercase text-gray-500">
                        <th className="px-3 py-2">Métrica</th>
                        <th className="px-3 py-2">Herramienta</th>
                        <th className="px-3 py-2">IC 95% Wilson</th>
                        <th className="px-3 py-2">TENS</th>
                        <th className="px-3 py-2">IC 95% Wilson</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    <PropRow label="Sensibilidad alta gravedad (ESI 1 a 3)" tool={block.sensitivity_tool} tens={block.sensitivity_tens} />
                    <PropRow label="Subtriage relevante (sobre alta gravedad)" tool={block.subtriage_tool} tens={block.subtriage_tens} />
                    <PropRow label="Subtriage relevante (sobre todos los pares)" tool={block.subtriage_tool_all} tens={block.subtriage_tens_all} />
                    <tr>
                        <td className="px-3 py-2 text-gray-700">AUC ROC (DeLong)</td>
                        <td className="px-3 py-2">{num(block.auc.a.auc)}</td>
                        <td className="px-3 py-2 text-xs">{block.auc.a.ci ? `${num(block.auc.a.ci.lower)} a ${num(block.auc.a.ci.upper)}` : '—'}</td>
                        <td className="px-3 py-2">{num(block.auc.b.auc)}</td>
                        <td className="px-3 py-2 text-xs">{block.auc.b.ci ? `${num(block.auc.b.ci.lower)} a ${num(block.auc.b.ci.upper)}` : '—'}</td>
                    </tr>
                </tbody>
            </table>
            <ul className="mt-3 space-y-1 text-xs text-gray-600">
                <li>Pares evaluables: {block.n_paired} · alta gravedad: {block.n_high_severity} · críticos: {block.n_critical}</li>
                <li>
                    Diferencia de sensibilidad (herramienta menos TENS): {pct(block.sensitivity_difference.estimate)} · IC 95% {ci(block.sensitivity_difference.ci)} ·
                    McNemar exacto b={block.mcnemar.b}, c={block.mcnemar.c}, p={num(block.mcnemar.p_value)}
                </li>
                <li>Exceso de subtriage relevante (herramienta menos TENS): {pct(block.subtriage_excess.estimate)} · IC 95% {ci(block.subtriage_excess.ci)}</li>
                <li>Diferencia de AUC: {num(block.auc.difference)} · p={num(block.auc.p_value)}</li>
                <li>
                    Kappa ponderado lineal {num(block.kappa_linear.kappa)} (asintótico {block.kappa_linear.ci_asymptotic ? `${num(block.kappa_linear.ci_asymptotic.lower)} a ${num(block.kappa_linear.ci_asymptotic.upper)}` : '—'},
                    bootstrap {block.kappa_linear.ci_bootstrap ? `${num(block.kappa_linear.ci_bootstrap.lower)} a ${num(block.kappa_linear.ci_bootstrap.upper)}` : '—'}) · cuadrático {num(block.kappa_quadratic.kappa)}
                </li>
            </ul>
        </div>
    );
}

function StrataTable({ title, rows, limit = 25 }: { title: string; rows: StratumMetrics[]; limit?: number }) {
    if (rows.length === 0) return null;
    return (
        <details className="rounded border border-gray-200 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-gray-800">{title} ({rows.length})</summary>
            <table className="mt-2 min-w-full text-xs">
                <thead>
                    <tr className="text-left text-gray-500">
                        <th className="px-2 py-1">Estrato</th><th className="px-2 py-1">n</th><th className="px-2 py-1">Alta gravedad</th>
                        <th className="px-2 py-1">Identifica herramienta</th><th className="px-2 py-1">Identifica TENS</th>
                        <th className="px-2 py-1">Subtriage herramienta</th><th className="px-2 py-1">Subtriage TENS</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.slice(0, limit).map((s) => (
                        <tr key={s.key} className="border-t border-gray-100">
                            <td className="px-2 py-1">{s.key}</td><td className="px-2 py-1">{s.n}</td><td className="px-2 py-1">{s.n_high_severity}</td>
                            <td className="px-2 py-1">{s.tool_identified}</td><td className="px-2 py-1">{s.tens_identified}</td>
                            <td className="px-2 py-1">{s.subtriage_tool}</td><td className="px-2 py-1">{s.subtriage_tens}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </details>
    );
}

function StudyPanel({ study }: { study: StudyMetrics }) {
    const p = study.primary;
    const v = study.continuity;
    return (
        <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="text-lg font-semibold text-gray-900">Resultados frente al desenlace clínico</h2>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Kpi
                    label="Sensibilidad alta gravedad"
                    value={pct(p.sensitivity_tool.estimate)}
                    sub={`Wilson ${ci(p.sensitivity_tool.wilson)} · TENS ${pct(p.sensitivity_tens.estimate)}`}
                    tone={v.sensitivity_ok && v.ci_lower_ok ? 'ok' : v.meets === false ? 'bad' : undefined}
                />
                <Kpi
                    label="Exceso de subtriage"
                    value={p.subtriage_excess.estimate == null ? '—' : `${(p.subtriage_excess.estimate * 100).toFixed(1)} pts`}
                    sub="máximo permitido 5 puntos"
                    tone={v.subtriage_ok ? 'ok' : v.subtriage_ok === false ? 'bad' : undefined}
                />
                <Kpi label="Casos de alta gravedad" value={String(p.n_high_severity)} sub="mínimo del protocolo: 73" tone={p.n_high_severity >= 73 ? 'ok' : 'bad'} />
                <Kpi label="Sin clasificación" value={String(study.missing_tool)} sub={`errores del modelo ${study.model_errors} · sin desenlace ${study.missing_outcome} · sin TENS ${study.missing_tens}`} />
            </div>

            <div className={`rounded-md p-3 text-sm ${v.meets ? 'bg-green-50 text-green-800' : v.meets === false ? 'bg-red-50 text-red-800' : 'bg-gray-50 text-gray-700'}`}>
                <strong>Criterio de continuidad:</strong>{' '}
                {v.meets == null ? 'indeterminado' : v.meets ? 'se cumple, la herramienta es apta para evaluación prospectiva' : 'no se cumple, el relato por sí solo no basta'}. {v.detail}
                {p.n_high_severity < 73 && ' Atención: hay menos de 73 casos de alta gravedad, la precisión del protocolo no se alcanza.'}
            </div>

            <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-800">Análisis principal (sistema integrado)</h3>
                <BlockTable block={p} />
            </div>

            <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-800">Interpretación a priori de las diferencias</h3>
                <table className="min-w-full text-xs">
                    <tbody>
                        {(Object.keys(INTERPRETATION_LABELS) as InterpretationCell[]).map((k) => (
                            <tr key={k} className="border-t border-gray-100">
                                <td className="px-2 py-1 font-semibold">{p.interpretation[k]}</td>
                                <td className="px-2 py-1 text-gray-700">{INTERPRETATION_LABELS[k]}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {study.ablation_llm && (
                <details className="rounded border border-gray-200 p-3">
                    <summary className="cursor-pointer text-sm font-semibold text-gray-800">Ablación: LLM aislado, antes del motor de reglas</summary>
                    <div className="mt-2"><BlockTable block={study.ablation_llm} /></div>
                </details>
            )}
            {study.sensitivity_without_vitals && (
                <details className="rounded border border-gray-200 p-3">
                    <summary className="cursor-pointer text-sm font-semibold text-gray-800">
                        Análisis de sensibilidad: excluye {study.n_vitals_removed} relato(s) con signos vitales u observaciones retiradas
                    </summary>
                    <div className="mt-2"><BlockTable block={study.sensitivity_without_vitals} /></div>
                </details>
            )}
            <StrataTable title="Por motivo de consulta" rows={study.by_complaint} />
            <StrataTable title="Por sexo" rows={study.by_sex} />
            <StrataTable title="Por grupo etario" rows={study.by_age_group} />
        </section>
    );
}

function ConfusionMatrixTable({ summary }: { summary: DAUSummary }) {
    return (
        <section className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="text-lg font-semibold text-gray-900">Matriz de confusión (herramienta frente a TENS)</h2>
            <p className="mb-3 text-xs text-gray-500">
                Filas = ESI de la herramienta · Columnas = ESI del TENS. Concordancia simple {pct(summary.simple_agreement)} sobre {summary.comparable} pares.
            </p>
            <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-center text-sm">
                    <thead>
                        <tr>
                            <th className="border border-gray-200 bg-gray-50 p-2">Herr. ↓ / TENS →</th>
                            {[1, 2, 3, 4, 5].map((n) => <th key={n} className="border border-gray-200 bg-gray-50 p-2">C{n}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {summary.confusion_matrix.map((row, p) => (
                            <tr key={p}>
                                <th className="border border-gray-200 bg-gray-50 p-2">C{p + 1}</th>
                                {row.map((cell, n) => (
                                    <td key={n} className={`border border-gray-200 p-2 ${p === n && cell > 0 ? 'bg-green-100 font-semibold' : cell > 0 ? 'bg-amber-50' : ''}`}>{cell}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

function ResultsTable({ results }: { results: DAUClassification[] }) {
    return (
        <section className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-lg font-semibold text-gray-900">Resultados por registro</h2>
            <div className="max-h-[480px] overflow-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead>
                        <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                            <th className="px-3 py-2">ID</th><th className="px-3 py-2">Herramienta</th><th className="px-3 py-2">LLM</th>
                            <th className="px-3 py-2">TENS</th><th className="px-3 py-2">Desenlace</th><th className="px-3 py-2">Estado</th>
                            <th className="px-3 py-2">Regla</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {results.map((r) => (
                            <tr key={r.record_id}>
                                <td className="px-3 py-2 font-mono text-xs">{r.record_id}</td>
                                <td className="px-3 py-2">{r.predicted_esi ?? '—'}</td>
                                <td className="px-3 py-2 text-gray-500">{r.llm_esi ?? '—'}</td>
                                <td className="px-3 py-2">{r.tens_esi ?? '—'}</td>
                                <td className="px-3 py-2 text-xs">{r.outcome ?? '—'}</td>
                                <td className="px-3 py-2 text-xs">{r.model_error ? 'error del modelo' : r.status}</td>
                                <td className="px-3 py-2 text-xs">{r.matched_rule ?? '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

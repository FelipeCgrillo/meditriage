'use client';

import React, { useMemo, useState } from 'react';
import { parseDAUFile, type DAUParseError } from '@/lib/dau/parser';
import { summarizeDAU } from '@/lib/dau/summary';
import type { DAURecord, DAUClassification, DAUSummary, DAUBatchResponse } from '@/lib/dau/types';

/**
 * Tamaño de cada tanda enviada al servidor. El plan Hobby de Vercel corta las
 * funciones serverless a ~25 s, y cada registro implica una llamada al LLM. Con
 * tandas pequeñas cada POST cabe holgado dentro de ese límite; los resultados
 * se acumulan en el cliente y el resumen (concordancia + matriz de confusión)
 * se recalcula sobre el TOTAL con la misma función pura del servidor.
 *
 * Tamaño 2: el modelo tarda ~6 s por registro, así que 2 por tanda deja un
 * margen cómodo bajo el límite de ~25 s incluso si el LLM responde lento.
 */
const BATCH_SIZE = 2;

function chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

/**
 * Página de análisis retrospectivo de DAU (OE4 Vía B).
 *
 * Flujo: el usuario carga un archivo JSON o CSV con registros DAU. El cliente
 * los parsea (alias de cabeceras en español), los envía a POST /api/dau, y
 * muestra tabla de resultados, KPIs (concordancia, n, needs_info) y la matriz
 * de confusión 5x5. Permite exportar los resultados a CSV.
 *
 * RESTRICCIÓN: solo se envían texto libre + sexo/edad; el ESI de la enfermera
 * es gold standard de comparación, nunca entra al modelo.
 */
export default function DAUAnalysisPage() {
    const [records, setRecords] = useState<DAURecord[]>([]);
    const [parseErrors, setParseErrors] = useState<DAUParseError[]>([]);
    const [results, setResults] = useState<DAUClassification[]>([]);
    const [summary, setSummary] = useState<DAUSummary | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string | null>(null);
    const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

    async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setError(null);
        setResults([]);
        setSummary(null);
        setProgress(null);
        setFileName(file.name);
        const text = await file.text();
        const parsed = parseDAUFile(text);
        setRecords(parsed.records);
        setParseErrors(parsed.errors);
        if (parsed.records.length === 0) {
            setError('No se encontraron registros válidos en el archivo.');
        }
    }

    async function runAnalysis() {
        if (records.length === 0) return;
        setLoading(true);
        setError(null);
        setResults([]);
        setSummary(null);

        const batches = chunk(records, BATCH_SIZE);
        const accumulated: DAUClassification[] = [];
        setProgress({ done: 0, total: records.length });

        try {
            for (const batch of batches) {
                let res: Response;
                try {
                    res = await fetch('/api/dau', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ records: batch }),
                    });
                } catch (netErr) {
                    throw new Error(`Error de red: ${(netErr as Error).message}`);
                }

                // Si el servidor responde con algo que no es JSON (p. ej. una
                // página de error de la plataforma), lo capturamos como texto
                // para dar un mensaje claro en vez de "Unexpected token".
                const raw = await res.text();
                let data: (DAUBatchResponse & { error?: string }) | null = null;
                try {
                    data = JSON.parse(raw) as DAUBatchResponse & { error?: string };
                } catch {
                    throw new Error(
                        res.ok
                            ? 'El servidor devolvió una respuesta no válida.'
                            : `Error del servidor (${res.status}). El lote pudo exceder el tiempo límite; reduce el tamaño de la tanda.`,
                    );
                }

                if (!res.ok || !data) {
                    throw new Error(data?.error ?? `Error del servidor (${res.status}).`);
                }

                accumulated.push(...data.results);
                // Resumen y resultados parciales en vivo, recalculados sobre el
                // total acumulado con la misma función pura del servidor.
                setResults([...accumulated]);
                setSummary(summarizeDAU(accumulated));
                setProgress({ done: accumulated.length, total: records.length });
            }
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    }

    function exportCsv() {
        if (results.length === 0) return;
        const header = [
            'record_id',
            'predicted_esi',
            'nurse_esi',
            'agreement',
            'status',
            'decision_source',
            'matched_rule',
        ];
        const rows = results.map((r) =>
            [
                r.record_id,
                r.predicted_esi ?? '',
                r.nurse_esi ?? '',
                r.agreement == null ? '' : r.agreement ? 'sí' : 'no',
                r.status,
                r.decision_source,
                r.matched_rule ?? '',
            ]
                .map((c) => `"${String(c).replace(/"/g, '""')}"`)
                .join(','),
        );
        const csv = [header.join(','), ...rows].join('\n');
        const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'dau_resultados.csv';
        a.click();
        URL.revokeObjectURL(url);
    }

    const agreementPct = useMemo(() => {
        if (!summary || summary.simple_agreement == null) return null;
        return (summary.simple_agreement * 100).toFixed(1);
    }, [summary]);

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="mx-auto max-w-6xl space-y-6">
                <header>
                    <h1 className="text-2xl font-bold text-gray-900">
                        Análisis retrospectivo de DAU
                    </h1>
                    <p className="mt-1 text-sm text-gray-600">
                        Validación OE4 Vía B. Se clasifica cada registro usando solo el texto libre
                        auto-reportado (motivo de consulta + síntomas) y sexo/edad. El ESI de la
                        enfermera es el <strong>gold standard</strong> de comparación: nunca entra al
                        modelo.
                    </p>
                </header>

                {/* Carga de archivo */}
                <section className="rounded-lg border border-gray-200 bg-white p-4">
                    <label className="block text-sm font-medium text-gray-700">
                        Cargar archivo JSON o CSV
                    </label>
                    <input
                        type="file"
                        accept=".json,.csv,application/json,text/csv"
                        onChange={handleFile}
                        className="mt-2 block w-full text-sm text-gray-600 file:mr-4 file:rounded-md file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-700"
                    />
                    {fileName && (
                        <p className="mt-2 text-sm text-gray-600">
                            <strong>{records.length}</strong> registro(s) válido(s) en{' '}
                            <em>{fileName}</em>
                            {parseErrors.length > 0 && (
                                <span className="text-amber-700">
                                    {' '}
                                    · {parseErrors.length} fila(s) descartada(s)
                                </span>
                            )}
                        </p>
                    )}
                    {parseErrors.length > 0 && (
                        <details className="mt-2 text-xs text-amber-700">
                            <summary className="cursor-pointer">Ver filas descartadas</summary>
                            <ul className="mt-1 list-disc pl-5">
                                {parseErrors.slice(0, 20).map((e, i) => (
                                    <li key={i}>
                                        fila {e.row}: {e.reason}
                                    </li>
                                ))}
                            </ul>
                        </details>
                    )}
                    <div className="mt-4 flex gap-3">
                        <button
                            onClick={runAnalysis}
                            disabled={records.length === 0 || loading}
                            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300 hover:bg-blue-700"
                        >
                            {loading && progress
                                ? `Clasificando… ${progress.done}/${progress.total}`
                                : loading
                                  ? 'Clasificando…'
                                  : 'Analizar lote'}
                        </button>
                        <button
                            onClick={exportCsv}
                            disabled={results.length === 0}
                            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-gray-50"
                        >
                            Exportar CSV
                        </button>
                    </div>

                    {/* Barra de progreso del procesamiento por tandas */}
                    {progress && progress.total > 0 && (
                        <div className="mt-4">
                            <div className="mb-1 flex justify-between text-xs text-gray-500">
                                <span>
                                    Procesando en tandas de {BATCH_SIZE} (para no exceder el tiempo
                                    límite del servidor)
                                </span>
                                <span>
                                    {progress.done} / {progress.total}
                                </span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                                <div
                                    className="h-full rounded-full bg-blue-600 transition-all duration-300"
                                    style={{
                                        width: `${Math.round((progress.done / progress.total) * 100)}%`,
                                    }}
                                />
                            </div>
                        </div>
                    )}
                </section>

                {error && (
                    <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        {error}
                    </div>
                )}

                {/* KPIs */}
                {summary && (
                    <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
                        <Kpi label="Concordancia simple" value={agreementPct ? `${agreementPct}%` : '—'} />
                        <Kpi label="Pares comparables" value={String(summary.comparable)} />
                        <Kpi label="Clasificados" value={String(summary.classified)} />
                        <Kpi label="Needs info" value={String(summary.needs_info)} />
                    </section>
                )}

                {/* Matriz de confusión */}
                {summary && summary.comparable > 0 && (
                    <ConfusionMatrixTable summary={summary} />
                )}

                {/* Tabla de resultados */}
                {results.length > 0 && <ResultsTable results={results} />}
            </div>
        </div>
    );
}

function Kpi({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</div>
            <div className="mt-1 text-2xl font-bold text-gray-900">{value}</div>
        </div>
    );
}

function ConfusionMatrixTable({ summary }: { summary: DAUSummary }) {
    return (
        <section className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="text-lg font-semibold text-gray-900">
                Matriz de confusión (predicho vs enfermera)
            </h2>
            <p className="mb-3 text-xs text-gray-500">
                Filas = ESI predicho por el sistema · Columnas = ESI de la enfermera (gold standard)
            </p>
            <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-center text-sm">
                    <thead>
                        <tr>
                            <th className="border border-gray-200 bg-gray-50 p-2">Pred ↓ / Enf →</th>
                            {[1, 2, 3, 4, 5].map((n) => (
                                <th key={n} className="border border-gray-200 bg-gray-50 p-2">
                                    C{n}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {summary.confusion_matrix.map((row, p) => (
                            <tr key={p}>
                                <th className="border border-gray-200 bg-gray-50 p-2">C{p + 1}</th>
                                {row.map((cell, n) => (
                                    <td
                                        key={n}
                                        className={`border border-gray-200 p-2 ${
                                            p === n && cell > 0
                                                ? 'bg-green-100 font-semibold'
                                                : cell > 0
                                                  ? 'bg-amber-50'
                                                  : ''
                                        }`}
                                    >
                                        {cell}
                                    </td>
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
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead>
                        <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                            <th className="px-3 py-2">ID</th>
                            <th className="px-3 py-2">Predicho</th>
                            <th className="px-3 py-2">Enfermera</th>
                            <th className="px-3 py-2">Concordancia</th>
                            <th className="px-3 py-2">Estado</th>
                            <th className="px-3 py-2">Origen</th>
                            <th className="px-3 py-2">Regla</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {results.map((r) => (
                            <tr key={r.record_id}>
                                <td className="px-3 py-2 font-mono text-xs">{r.record_id}</td>
                                <td className="px-3 py-2">{r.predicted_esi ?? '—'}</td>
                                <td className="px-3 py-2">{r.nurse_esi ?? '—'}</td>
                                <td className="px-3 py-2">
                                    {r.agreement == null ? (
                                        '—'
                                    ) : r.agreement ? (
                                        <span className="text-green-700">sí</span>
                                    ) : (
                                        <span className="text-red-700">no</span>
                                    )}
                                </td>
                                <td className="px-3 py-2">{r.status}</td>
                                <td className="px-3 py-2 text-xs">{r.decision_source}</td>
                                <td className="px-3 py-2 text-xs">{r.matched_rule ?? '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

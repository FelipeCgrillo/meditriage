'use client';

/**
 * Corridas de análisis DAU guardadas (historial del análisis retrospectivo).
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

interface DauRunRow {
    id: string;
    file_name: string | null;
    total: number;
    classified: number;
    needs_info: number;
    comparable: number;
    agreements: number;
    simple_agreement: number | null;
    created_at: string;
}

export default function AdminDauPage() {
    const [runs, setRuns] = useState<DauRunRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch('/api/dau/runs');
                const data = await res.json();
                if (res.ok) setRuns(data.runs || []);
                else setError(data.error || 'Error al cargar corridas.');
            } catch {
                setError('Error de red al cargar corridas.');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    return (
        <div className="mx-auto max-w-6xl">
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-lg font-semibold text-slate-900">Corridas de análisis DAU</h2>
                {loading ? (
                    <p className="text-sm text-slate-500">Cargando…</p>
                ) : error ? (
                    <p className="text-sm text-red-700">{error}</p>
                ) : runs.length === 0 ? (
                    <p className="text-sm text-slate-500">
                        Aún no hay corridas guardadas. Analiza un CSV en el{' '}
                        <Link href="/resultados/dau" className="font-medium text-indigo-600 hover:underline">
                            análisis DAU
                        </Link>{' '}
                        y se guardará automáticamente.
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 text-sm">
                            <thead>
                                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                                    <th className="px-3 py-2">Archivo</th>
                                    <th className="px-3 py-2">Fecha</th>
                                    <th className="px-3 py-2">Total</th>
                                    <th className="px-3 py-2">Comparables</th>
                                    <th className="px-3 py-2">Concordancia</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {runs.map((r) => (
                                    <tr key={r.id} className="transition-colors hover:bg-slate-50">
                                        <td className="px-3 py-2.5 font-medium text-slate-900">
                                            {r.file_name || '(sin nombre)'}
                                        </td>
                                        <td className="px-3 py-2.5 text-xs text-slate-500">
                                            {new Date(r.created_at).toLocaleString('es-CL')}
                                        </td>
                                        <td className="px-3 py-2.5 tabular-nums">{r.total}</td>
                                        <td className="px-3 py-2.5 tabular-nums">{r.comparable}</td>
                                        <td className="px-3 py-2.5 tabular-nums">
                                            {r.simple_agreement == null
                                                ? '—'
                                                : `${(r.simple_agreement * 100).toFixed(1)}%`}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}

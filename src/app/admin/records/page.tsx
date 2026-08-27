'use client';

/**
 * Registros clínicos (triages de pacientes) visibles para el admin.
 */

import React, { useEffect, useState } from 'react';

interface ClinicalRecordRow {
    id: string;
    anonymous_code: string | null;
    symptoms_text: string | null;
    esi_level: number;
    nurse_override_level: number | null;
    nurse_validated: boolean;
    patient_gender: string | null;
    patient_age_group: string | null;
    created_at: string;
}

const ESI_COLORS: Record<number, string> = {
    1: 'bg-red-50 text-red-700 ring-red-200',
    2: 'bg-orange-50 text-orange-700 ring-orange-200',
    3: 'bg-amber-50 text-amber-700 ring-amber-200',
    4: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    5: 'bg-sky-50 text-sky-700 ring-sky-200',
};

function EsiBadge({ level }: { level: number | null }) {
    if (level == null) return <span className="text-slate-400">—</span>;
    return (
        <span
            className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ring-1 ${
                ESI_COLORS[level] || 'bg-slate-50 text-slate-700 ring-slate-200'
            }`}
        >
            {level}
        </span>
    );
}

export default function AdminRecordsPage() {
    const [records, setRecords] = useState<ClinicalRecordRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch('/api/admin/clinical-records');
                const data = await res.json();
                if (res.ok) setRecords(data.records || []);
                else setError(data.error || 'Error al cargar registros.');
            } catch {
                setError('Error de red al cargar registros.');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    return (
        <div className="mx-auto max-w-6xl">
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-lg font-semibold text-slate-900">
                    Registros clínicos (triages de pacientes)
                </h2>
                {loading ? (
                    <p className="text-sm text-slate-500">Cargando…</p>
                ) : error ? (
                    <p className="text-sm text-red-700">{error}</p>
                ) : records.length === 0 ? (
                    <p className="text-sm text-slate-500">No hay registros clínicos.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 text-sm">
                            <thead>
                                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                                    <th className="px-3 py-2">Código</th>
                                    <th className="px-3 py-2">Síntomas</th>
                                    <th className="px-3 py-2">ESI IA</th>
                                    <th className="px-3 py-2">ESI Enf.</th>
                                    <th className="px-3 py-2">Validado</th>
                                    <th className="px-3 py-2">Sexo</th>
                                    <th className="px-3 py-2">Grupo etario</th>
                                    <th className="px-3 py-2">Fecha</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {records.map((r) => (
                                    <tr key={r.id} className="transition-colors hover:bg-slate-50">
                                        <td className="px-3 py-2.5 font-mono text-xs">
                                            {r.anonymous_code || r.id.slice(0, 8)}
                                        </td>
                                        <td
                                            className="max-w-xs truncate px-3 py-2.5 text-slate-600"
                                            title={r.symptoms_text || ''}
                                        >
                                            {r.symptoms_text || '—'}
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <EsiBadge level={r.esi_level} />
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <EsiBadge level={r.nurse_override_level} />
                                        </td>
                                        <td className="px-3 py-2.5">
                                            {r.nurse_validated ? (
                                                <span className="font-medium text-emerald-700">sí</span>
                                            ) : (
                                                <span className="text-slate-400">no</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2.5">{r.patient_gender || '—'}</td>
                                        <td className="px-3 py-2.5">{r.patient_age_group || '—'}</td>
                                        <td className="px-3 py-2.5 text-xs text-slate-500">
                                            {new Date(r.created_at).toLocaleDateString('es-CL')}
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

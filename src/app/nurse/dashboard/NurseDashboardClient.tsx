'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export interface ClinicalRecord {
    id: string;
    anonymous_code: string | null;
    esi_level: number;
    nurse_override_level: number | null;
    symptoms_text: string | null;
    patient_gender: string | null;
    patient_age_group: string | null;
    consent_eligible: boolean | null;
    nurse_validated: boolean;
    ai_response: unknown;
    created_at: string;
    updated_at: string;
}

interface Props {
    initialRecords: ClinicalRecord[];
    initialError: string | null;
    userEmail: string;
    userName: string | null;
}

const esiColors: Record<number, { bg: string; text: string; border: string; label: string }> = {
    1: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300', label: 'Resucitación' },
    2: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300', label: 'Emergencia' },
    3: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300', label: 'Urgencia' },
    4: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300', label: 'Menor' },
    5: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300', label: 'No urgente' },
};

function formatDate(iso: string): string {
    try {
        const d = new Date(iso);
        return d.toLocaleString('es-CL', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return iso;
    }
}

export default function NurseDashboardClient({
    initialRecords,
    initialError,
    userEmail,
    userName,
}: Props) {
    const router = useRouter();
    const [records, setRecords] = useState<ClinicalRecord[]>(initialRecords);
    const [error] = useState<string | null>(initialError);
    const [filterEsi, setFilterEsi] = useState<number | null>(null);
    const [filterValidated, setFilterValidated] = useState<'all' | 'pending' | 'validated'>('all');
    const [isRefreshing, startTransition] = useTransition();
    const [logoutLoading, setLogoutLoading] = useState(false);

    // Realtime subscription — actualiza UI cuando llegan nuevos registros o
    // se modifican los existentes. NO bloquea el render inicial.
    useEffect(() => {
        const channel = supabase
            .channel('clinical_records_dashboard')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'clinical_records' },
                (payload) => {
                    const newRecord = payload.new as ClinicalRecord;
                    setRecords((prev) => {
                        // Evita duplicados si el INSERT llega antes que el fetch.
                        if (prev.find((r) => r.id === newRecord.id)) return prev;
                        return [newRecord, ...prev].slice(0, 100);
                    });
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'clinical_records' },
                (payload) => {
                    const updated = payload.new as ClinicalRecord;
                    setRecords((prev) =>
                        prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r))
                    );
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const filtered = useMemo(() => {
        return records.filter((r) => {
            if (filterEsi !== null && r.esi_level !== filterEsi) return false;
            if (filterValidated === 'pending' && r.nurse_validated) return false;
            if (filterValidated === 'validated' && !r.nurse_validated) return false;
            return true;
        });
    }, [records, filterEsi, filterValidated]);

    const stats = useMemo(() => {
        const total = records.length;
        const validated = records.filter((r) => r.nurse_validated).length;
        const pending = total - validated;
        const byEsi = [1, 2, 3, 4, 5].map((lvl) => records.filter((r) => r.esi_level === lvl).length);
        return { total, validated, pending, byEsi };
    }, [records]);

    async function handleRefresh() {
        // Refresca el Server Component — usa cookies HTTP, no localStorage.
        startTransition(() => {
            router.refresh();
        });
    }

    async function handleLogout() {
        setLogoutLoading(true);
        await supabase.auth.signOut();
        window.location.assign('/login/nurse');
    }

    async function handleValidate(recordId: string, nurseEsi: number) {
        // Optimistic update
        setRecords((prev) =>
            prev.map((r) =>
                r.id === recordId
                    ? { ...r, nurse_validated: true, nurse_override_level: nurseEsi }
                    : r
            )
        );

        const { error: updateError } = await supabase
            .from('clinical_records')
            .update({ nurse_validated: true, nurse_override_level: nurseEsi })
            .eq('id', recordId);

        if (updateError) {
            // Rollback
            setRecords((prev) =>
                prev.map((r) =>
                    r.id === recordId
                        ? { ...r, nurse_validated: false, nurse_override_level: null }
                        : r
                )
            );
            alert(`Error al validar: ${updateError.message}`);
        }
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Panel de Enfermería</h1>
                            <p className="text-xs text-gray-500">{userName || userEmail}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
                        >
                            <svg className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span>{isRefreshing ? 'Actualizando...' : 'Actualizar'}</span>
                        </button>
                        <button
                            onClick={handleLogout}
                            disabled={logoutLoading}
                            className="px-3 py-2 text-sm bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition-colors disabled:opacity-50"
                        >
                            Cerrar sesión
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
                        Error al cargar registros: {error}
                    </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                        <p className="text-xs text-gray-500 uppercase font-medium">Total</p>
                        <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                        <p className="text-xs text-gray-500 uppercase font-medium">Pendientes</p>
                        <p className="text-3xl font-bold text-amber-600">{stats.pending}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                        <p className="text-xs text-gray-500 uppercase font-medium">Validados</p>
                        <p className="text-3xl font-bold text-emerald-600">{stats.validated}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                        <p className="text-xs text-gray-500 uppercase font-medium">ESI 1 + 2</p>
                        <p className="text-3xl font-bold text-red-600">{stats.byEsi[0] + stats.byEsi[1]}</p>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-1">
                            <span className="text-sm font-medium text-gray-700 mr-2">ESI:</span>
                            <button
                                onClick={() => setFilterEsi(null)}
                                className={`px-3 py-1 text-sm rounded-md transition-colors ${filterEsi === null ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                            >
                                Todos
                            </button>
                            {[1, 2, 3, 4, 5].map((lvl) => (
                                <button
                                    key={lvl}
                                    onClick={() => setFilterEsi(filterEsi === lvl ? null : lvl)}
                                    className={`px-3 py-1 text-sm rounded-md transition-colors ${filterEsi === lvl ? `${esiColors[lvl].bg} ${esiColors[lvl].text} font-semibold` : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                                >
                                    {lvl}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-1 ml-auto">
                            <span className="text-sm font-medium text-gray-700 mr-2">Estado:</span>
                            {([
                                ['all', 'Todos'],
                                ['pending', 'Pendientes'],
                                ['validated', 'Validados'],
                            ] as const).map(([val, lbl]) => (
                                <button
                                    key={val}
                                    onClick={() => setFilterValidated(val)}
                                    className={`px-3 py-1 text-sm rounded-md transition-colors ${filterValidated === val ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                                >
                                    {lbl}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Records list */}
                {filtered.length === 0 ? (
                    <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                        <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="text-gray-500">No hay registros clínicos {records.length > 0 ? 'con los filtros actuales' : 'aún'}.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filtered.map((record) => (
                            <RecordCard key={record.id} record={record} onValidate={handleValidate} />
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}

function RecordCard({
    record,
    onValidate,
}: {
    record: ClinicalRecord;
    onValidate: (id: string, esi: number) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const [overrideEsi, setOverrideEsi] = useState<number>(record.nurse_override_level ?? record.esi_level);
    const esi = esiColors[record.esi_level] ?? esiColors[3];

    return (
        <div className={`bg-white rounded-xl border ${esi.border} overflow-hidden`}>
            <div className="p-4">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={`w-12 h-12 ${esi.bg} ${esi.text} rounded-lg flex items-center justify-center font-bold text-lg flex-shrink-0`}>
                            ESI {record.esi_level}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-gray-900">
                                    {record.anonymous_code || record.id.slice(0, 8)}
                                </span>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${esi.bg} ${esi.text} font-medium`}>
                                    {esi.label}
                                </span>
                                {record.nurse_validated && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                        Validado
                                    </span>
                                )}
                            </div>
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                                {record.symptoms_text || 'Sin síntomas registrados'}
                            </p>
                            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                                <span>{formatDate(record.created_at)}</span>
                                {record.patient_gender && <span>· {record.patient_gender}</span>}
                                {record.patient_age_group && <span>· {record.patient_age_group}</span>}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => setExpanded((v) => !v)}
                        className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex-shrink-0"
                    >
                        {expanded ? 'Ocultar' : 'Ver detalle'}
                    </button>
                </div>

                {expanded && (
                    <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
                        {/* AI response */}
                        {record.ai_response ? (
                            <div>
                                <h3 className="text-xs font-semibold text-gray-700 uppercase mb-2">Análisis IA</h3>
                                <pre className="bg-gray-50 rounded-lg p-3 text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap">
                                    {JSON.stringify(record.ai_response, null, 2)}
                                </pre>
                            </div>
                        ) : null}

                        {/* Validación de enfermera */}
                        {!record.nurse_validated && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                <h3 className="text-sm font-semibold text-amber-900 mb-2">Validación de enfermería</h3>
                                <p className="text-xs text-amber-700 mb-3">
                                    Confirma o ajusta el nivel ESI asignado por la IA.
                                </p>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm text-gray-700">Tu clasificación ESI:</span>
                                    {[1, 2, 3, 4, 5].map((lvl) => (
                                        <button
                                            key={lvl}
                                            onClick={() => setOverrideEsi(lvl)}
                                            className={`w-9 h-9 rounded-md font-bold transition-colors ${overrideEsi === lvl ? `${esiColors[lvl].bg} ${esiColors[lvl].text} ring-2 ring-offset-1 ring-emerald-500` : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                                        >
                                            {lvl}
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => onValidate(record.id, overrideEsi)}
                                        className="ml-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-md transition-colors"
                                    >
                                        Validar
                                    </button>
                                </div>
                            </div>
                        )}

                        {record.nurse_validated && record.nurse_override_level !== null && (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-sm">
                                <span className="font-medium text-emerald-900">Validado por enfermería: </span>
                                <span className="text-emerald-700">ESI {record.nurse_override_level}</span>
                                {record.nurse_override_level !== record.esi_level && (
                                    <span className="text-amber-700 ml-2">
                                        (ajustado desde ESI {record.esi_level})
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

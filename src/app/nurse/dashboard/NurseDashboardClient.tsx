'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

/**
 * Panel de Enfermería — Evaluación Ciega Independiente
 *
 * Filosofía de diseño:
 *   La enfermera y la IA son DOS evaluadores INDEPENDIENTES del mismo
 *   caso clínico. La enfermera nunca ve el ESI propuesto por la IA
 *   antes de clasificar, para no contaminar su criterio (sesgo de
 *   anclaje). Después de que la enfermera clasifica, se revelan los
 *   dos resultados lado a lado.
 *
 *   AMBAS clasificaciones se guardan en la BD:
 *     - esi_level            → ESI propuesto por la IA
 *     - nurse_override_level → ESI asignado por la enfermera
 *   Ninguna sobrescribe a la otra. El panel del investigador
 *   construirá la matriz 5×5 de concordancia (Coeficiente Kappa)
 *   a partir de los dos campos.
 *
 *   No hay 'override' ni 'validación' — la enfermera CLASIFICA, no
 *   valida. La IA propone, la enfermera evalúa, ambas evaluaciones
 *   son datos para el estudio.
 */

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

const GENDER_LABEL: Record<string, string> = {
    M: 'Masculino',
    F: 'Femenino',
    Other: 'Otro',
    'Prefer not to say': 'No declarado',
};

const AGE_GROUP_LABEL: Record<string, string> = {
    Pediatric: 'Pediátrico (0-17)',
    Adult: 'Adulto (18-64)',
    Geriatric: 'Geriátrico (65+)',
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

/**
 * Renderiza una fecha localizada SOLO en el cliente para evitar
 * hydration mismatches (React #418/#423/#425) cuando el servidor (UTC)
 * y el cliente (zona horaria del usuario) producen strings distintos.
 *
 * En SSR y antes de hidratar muestra un placeholder estable ("—"),
 * luego de hidratar se reemplaza por la fecha localizada.
 */
function ClientDate({ iso }: { iso: string }) {
    const [text, setText] = useState<string>('—');
    useEffect(() => {
        setText(formatDate(iso));
    }, [iso]);
    return <span suppressHydrationWarning>{text}</span>;
}

function genderText(g: string | null): string | null {
    if (!g) return null;
    return GENDER_LABEL[g] ?? g;
}

function ageGroupText(a: string | null): string | null {
    if (!a) return null;
    return AGE_GROUP_LABEL[a] ?? a;
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
    const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'classified'>('all');
    const [isRefreshing, startTransition] = useTransition();
    const [logoutLoading, setLogoutLoading] = useState(false);

    // Realtime: actualiza UI cuando llegan nuevos registros o se modifican.
    useEffect(() => {
        const channel = supabase
            .channel('clinical_records_dashboard')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'clinical_records' },
                (payload) => {
                    const newRecord = payload.new as ClinicalRecord;
                    setRecords((prev) => {
                        if (prev.find((r) => r.id === newRecord.id)) return prev;
                        return [newRecord, ...prev].slice(0, 100);
                    });
                },
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'clinical_records' },
                (payload) => {
                    const updated = payload.new as ClinicalRecord;
                    setRecords((prev) =>
                        prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)),
                    );
                },
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const filtered = useMemo(() => {
        return records.filter((r) => {
            if (filterStatus === 'pending' && r.nurse_validated) return false;
            if (filterStatus === 'classified' && !r.nurse_validated) return false;
            return true;
        });
    }, [records, filterStatus]);

    const stats = useMemo(() => {
        const total = records.length;
        const classified = records.filter((r) => r.nurse_validated).length;
        const pending = total - classified;
        // Concordancia: casos clasificados donde la enfermera coincidió con la IA.
        const classifiedRecords = records.filter(
            (r) => r.nurse_validated && r.nurse_override_level !== null,
        );
        const matches = classifiedRecords.filter(
            (r) => r.nurse_override_level === r.esi_level,
        ).length;
        const concordancePct =
            classifiedRecords.length > 0
                ? Math.round((matches / classifiedRecords.length) * 100)
                : null;
        return { total, classified, pending, concordancePct };
    }, [records]);

    async function handleRefresh() {
        startTransition(() => {
            router.refresh();
        });
    }

    async function handleLogout() {
        setLogoutLoading(true);
        await supabase.auth.signOut();
        window.location.assign('/login/nurse');
    }

    async function handleClassify(recordId: string, nurseEsi: number) {
        // Optimistic update — marca el caso como clasificado por enfermería
        // y guarda su nivel ESI INDEPENDIENTE del de la IA.
        setRecords((prev) =>
            prev.map((r) =>
                r.id === recordId
                    ? { ...r, nurse_validated: true, nurse_override_level: nurseEsi }
                    : r,
            ),
        );

        // Capturar el usuario actual para registrar nurse_id
        const { data: { user } } = await supabase.auth.getUser();

        const payload: { nurse_validated: boolean; nurse_override_level: number; nurse_id?: string } = {
            nurse_validated: true,
            nurse_override_level: nurseEsi,
        };
        if (user?.id) {
            payload.nurse_id = user.id;
        }

        // .select() devuelve las filas modificadas, lo que permite detectar
        // updates silenciados por RLS (data.length === 0 sin error).
        const { data, error: updateError } = await supabase
            .from('clinical_records')
            .update(payload)
            .eq('id', recordId)
            .select();

        if (updateError || !data || data.length === 0) {
            // Rollback
            setRecords((prev) =>
                prev.map((r) =>
                    r.id === recordId
                        ? { ...r, nurse_validated: false, nurse_override_level: null }
                        : r,
                ),
            );
            const msg = updateError
                ? `Error al guardar la clasificación: ${updateError.message}`
                : 'La clasificación no se pudo guardar (0 filas afectadas). Es probable que la sesión haya expirado o no tengas permisos. Cierra sesión y vuelve a entrar.';
            console.error('[handleClassify] Fallo al guardar', { recordId, nurseEsi, error: updateError, data });
            alert(msg);
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

                {/* Aviso metodológico — recuerda al usuario el principio del panel */}
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 mb-6 flex items-start gap-3">
                    <svg className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm text-indigo-900 leading-snug">
                        <span className="font-semibold">Evaluación independiente:</span> clasifique cada caso según
                        su criterio clínico. La categoría ESI propuesta por la IA permanece oculta hasta que
                        usted asigne la suya, para garantizar la independencia metodológica del estudio.
                    </p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                        <p className="text-xs text-gray-500 uppercase font-medium">Total</p>
                        <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                        <p className="text-xs text-gray-500 uppercase font-medium">Por clasificar</p>
                        <p className="text-3xl font-bold text-amber-600">{stats.pending}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                        <p className="text-xs text-gray-500 uppercase font-medium">Clasificados</p>
                        <p className="text-3xl font-bold text-emerald-600">{stats.classified}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                        <p className="text-xs text-gray-500 uppercase font-medium">Concordancia IA</p>
                        <p className="text-3xl font-bold text-indigo-600">
                            {stats.concordancePct === null ? '—' : `${stats.concordancePct}%`}
                        </p>
                    </div>
                </div>

                {/* Filtros — solo por estado, no por ESI (no se conoce hasta clasificar) */}
                <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-gray-700 mr-2">Estado:</span>
                        {([
                            ['all', 'Todos'],
                            ['pending', 'Por clasificar'],
                            ['classified', 'Clasificados'],
                        ] as const).map(([val, lbl]) => (
                            <button
                                key={val}
                                onClick={() => setFilterStatus(val)}
                                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                                    filterStatus === val
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                                {lbl}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Lista de registros */}
                {filtered.length === 0 ? (
                    <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                        <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="text-gray-500">
                            No hay registros clínicos {records.length > 0 ? 'con los filtros actuales' : 'aún'}.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filtered.map((record) => (
                            <RecordCard key={record.id} record={record} onClassify={handleClassify} />
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}

function RecordCard({
    record,
    onClassify,
}: {
    record: ClinicalRecord;
    onClassify: (id: string, esi: number) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const [selectedEsi, setSelectedEsi] = useState<number | null>(null);

    const classified = record.nurse_validated && record.nurse_override_level !== null;
    const aiEsi = record.esi_level;
    const nurseEsi = record.nurse_override_level;
    const concordant = classified && nurseEsi === aiEsi;

    // La tarjeta NO muestra el ESI de la IA mientras no se haya clasificado.
    // Cuando está clasificada, muestra ambos lado a lado.
    return (
        <div
            className={`bg-white rounded-xl border overflow-hidden ${
                classified
                    ? concordant
                        ? 'border-emerald-200'
                        : 'border-amber-300'
                    : 'border-gray-200'
            }`}
        >
            <div className="p-4">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                        {/* Avatar genérico — sin badge ESI hasta clasificar */}
                        {!classified ? (
                            <div className="w-12 h-12 bg-gray-100 text-gray-500 rounded-lg flex items-center justify-center flex-shrink-0">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                            </div>
                        ) : (
                            <div
                                className={`w-12 h-12 ${esiColors[nurseEsi!].bg} ${esiColors[nurseEsi!].text} rounded-lg flex items-center justify-center font-bold text-lg flex-shrink-0`}
                            >
                                ESI {nurseEsi}
                            </div>
                        )}

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-gray-900">
                                    {record.anonymous_code || record.id.slice(0, 8)}
                                </span>
                                {!classified && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium">
                                        Por clasificar
                                    </span>
                                )}
                                {classified && (
                                    <>
                                        <span
                                            className={`text-xs px-2 py-0.5 rounded-full ${esiColors[nurseEsi!].bg} ${esiColors[nurseEsi!].text} font-medium`}
                                        >
                                            Enfermera: ESI {nurseEsi}
                                        </span>
                                        <span
                                            className={`text-xs px-2 py-0.5 rounded-full ${esiColors[aiEsi].bg} ${esiColors[aiEsi].text} font-medium`}
                                        >
                                            IA: ESI {aiEsi}
                                        </span>
                                        {concordant ? (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium flex items-center gap-1">
                                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                                Concordancia
                                            </span>
                                        ) : (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium">
                                                Discrepancia
                                            </span>
                                        )}
                                    </>
                                )}
                            </div>
                            <p className="text-sm text-gray-700 mt-1 line-clamp-2">
                                {record.symptoms_text || 'Sin síntomas registrados'}
                            </p>
                            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 flex-wrap">
                                <ClientDate iso={record.created_at} />
                                {genderText(record.patient_gender) && (
                                    <span>· {genderText(record.patient_gender)}</span>
                                )}
                                {ageGroupText(record.patient_age_group) && (
                                    <span>· {ageGroupText(record.patient_age_group)}</span>
                                )}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => setExpanded((v) => !v)}
                        className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex-shrink-0"
                    >
                        {expanded ? 'Ocultar' : classified ? 'Ver detalle' : 'Clasificar'}
                    </button>
                </div>

                {expanded && (
                    <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
                        {/* Relato del paciente — siempre visible */}
                        <div>
                            <h3 className="text-xs font-semibold text-gray-700 uppercase mb-2">
                                Relato del paciente
                            </h3>
                            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-800 whitespace-pre-wrap">
                                {record.symptoms_text || 'Sin descripción de síntomas.'}
                            </div>
                        </div>

                        {/* Demografía */}
                        <div className="flex flex-wrap gap-4 text-sm">
                            <div>
                                <span className="text-xs text-gray-500 uppercase font-medium block">
                                    Sexo
                                </span>
                                <span className="text-gray-900">
                                    {genderText(record.patient_gender) || 'No declarado'}
                                </span>
                            </div>
                            <div>
                                <span className="text-xs text-gray-500 uppercase font-medium block">
                                    Grupo etario
                                </span>
                                <span className="text-gray-900">
                                    {ageGroupText(record.patient_age_group) || 'No declarado'}
                                </span>
                            </div>
                            <div>
                                <span className="text-xs text-gray-500 uppercase font-medium block">
                                    Fecha de ingreso
                                </span>
                                <span className="text-gray-900"><ClientDate iso={record.created_at} /></span>
                            </div>
                        </div>

                        {/* Si NO está clasificado — flujo de clasificación ciega */}
                        {!classified && (
                            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                                <h3 className="text-sm font-semibold text-indigo-900 mb-1">
                                    Su clasificación ESI
                                </h3>
                                <p className="text-xs text-indigo-700 mb-3">
                                    Asigne el nivel ESI según su criterio clínico. La categoría propuesta
                                    por la IA se revelará después de su clasificación.
                                </p>
                                <div className="flex items-center gap-2 flex-wrap">
                                    {[1, 2, 3, 4, 5].map((lvl) => (
                                        <button
                                            key={lvl}
                                            onClick={() => setSelectedEsi(lvl)}
                                            className={`w-12 h-12 rounded-md font-bold text-lg transition-colors ${
                                                selectedEsi === lvl
                                                    ? `${esiColors[lvl].bg} ${esiColors[lvl].text} ring-2 ring-offset-1 ring-indigo-500`
                                                    : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                                            }`}
                                            aria-label={`ESI ${lvl} — ${esiColors[lvl].label}`}
                                        >
                                            {lvl}
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => {
                                            if (selectedEsi !== null) {
                                                onClassify(record.id, selectedEsi);
                                            }
                                        }}
                                        disabled={selectedEsi === null}
                                        className="ml-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        Clasificar
                                    </button>
                                </div>
                                {selectedEsi !== null && (
                                    <p className="text-xs text-indigo-800 mt-3">
                                        Seleccionado:{' '}
                                        <span className="font-semibold">
                                            ESI {selectedEsi} — {esiColors[selectedEsi].label}
                                        </span>
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Si YA está clasificado — comparación final */}
                        {classified && (
                            <div
                                className={`rounded-lg p-4 border ${
                                    concordant
                                        ? 'bg-emerald-50 border-emerald-200'
                                        : 'bg-amber-50 border-amber-200'
                                }`}
                            >
                                <h3
                                    className={`text-sm font-semibold mb-3 ${
                                        concordant ? 'text-emerald-900' : 'text-amber-900'
                                    }`}
                                >
                                    Resultado de la evaluación
                                </h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-white rounded-md p-3 border border-gray-200">
                                        <p className="text-xs text-gray-500 uppercase font-medium mb-1">
                                            Su clasificación
                                        </p>
                                        <p
                                            className={`text-lg font-bold ${esiColors[nurseEsi!].text}`}
                                        >
                                            ESI {nurseEsi}
                                        </p>
                                        <p className="text-xs text-gray-600">
                                            {esiColors[nurseEsi!].label}
                                        </p>
                                    </div>
                                    <div className="bg-white rounded-md p-3 border border-gray-200">
                                        <p className="text-xs text-gray-500 uppercase font-medium mb-1">
                                            Clasificación IA
                                        </p>
                                        <p className={`text-lg font-bold ${esiColors[aiEsi].text}`}>
                                            ESI {aiEsi}
                                        </p>
                                        <p className="text-xs text-gray-600">
                                            {esiColors[aiEsi].label}
                                        </p>
                                    </div>
                                </div>
                                <p
                                    className={`text-xs mt-3 ${
                                        concordant ? 'text-emerald-700' : 'text-amber-700'
                                    }`}
                                >
                                    {concordant
                                        ? 'Ambas evaluaciones coinciden.'
                                        : 'Las evaluaciones difieren — registro disponible para análisis de concordancia.'}
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

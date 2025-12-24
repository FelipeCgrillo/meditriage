'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { LogoutButton } from '@/components/auth/LogoutButton';
import { useAuth } from '@/components/auth/AuthProvider';
import { UserManagementPanel } from '@/components/admin/UserManagementPanel';

// =============================================================================
// TYPES
// =============================================================================

interface ClinicalRecordForAnalysis {
    id: string;
    anonymous_code: string | null;
    esi_level: number; // AI ESI level
    nurse_esi_level: number | null; // Nurse's independent classification BEFORE seeing AI (Gold Standard)
    nurse_override_level: number | null; // Final level if nurse changed opinion AFTER seeing AI
    patient_gender: string | null;
    patient_age_group: string | null;
    consent_eligible: boolean | null;
    nurse_validated: boolean;
}

interface CriticalCaseMetrics {
    sensitivity: number;  // TP / (TP + FN) - Capacidad de detectar casos graves
    specificity: number;  // TN / (TN + FP) - Capacidad de descartar no graves
    npv: number;          // TN / (TN + FN) - Valor Predictivo Negativo
    ppv: number;          // TP / (TP + FP) - Valor Predictivo Positivo
    TP: number;
    FP: number;
    FN: number;           // ⚠️ CASOS PELIGROSOS: IA dice no grave, pero enfermera dice grave
    TN: number;
    criticalSubTriageRate: number; // FN / (TP + FN) * 100 - Tasa específica de sub-triage en graves
}

interface StudyMetrics {
    totalRecords: number;
    validatedRecords: number;
    exactAccuracy: number;
    kappaCoefficient: number;
    subTriageRate: number;
    overTriageRate: number;
    confusionMatrix: number[][];
    accuracyByGender: { male: number; female: number; unknown: number; maleN: number; femaleN: number; unknownN: number };
    accuracyByAgeGroup: { pediatric: number; adult: number; geriatric: number; unknown: number; pediatricN: number; adultN: number; geriatricN: number; unknownN: number };
    criticalMetrics: CriticalCaseMetrics; // ⭐ NUEVO: Métricas de seguridad clínica
}

// =============================================================================
// METRICS CALCULATION - Cohen's Kappa & Confusion Matrix
// =============================================================================

function calculateStudyMetrics(records: ClinicalRecordForAnalysis[]): StudyMetrics {
    // 🔥 CORRECCIÓN CRÍTICA: Filter only validated records with nurse_esi_level (Gold Standard)
    // ANTES (INCORRECTO): r.nurse_override_level !== null
    // AHORA (CORRECTO): r.nurse_esi_level !== null
    const validRecords = records.filter(r => r.nurse_validated && r.nurse_esi_level !== null);

    const n = validRecords.length;

    // Initialize confusion matrix [nurse][ai] - 5x5 for ESI 1-5
    const matrix: number[][] = Array(5).fill(null).map(() => Array(5).fill(0));

    let exactMatches = 0;
    let subTriageCount = 0; // AI says less urgent (higher ESI) than nurse
    let overTriageCount = 0; // AI says more urgent (lower ESI) than nurse

    // Gender stats
    const genderStats = {
        M: { correct: 0, total: 0 },
        F: { correct: 0, total: 0 },
        unknown: { correct: 0, total: 0 }
    };

    // Age group stats
    const ageStats = {
        Pediatric: { correct: 0, total: 0 },
        Adult: { correct: 0, total: 0 },
        Geriatric: { correct: 0, total: 0 },
        unknown: { correct: 0, total: 0 }
    };

    for (const record of validRecords) {
        // 🔥 CORRECCIÓN CRÍTICA: Usar nurse_esi_level como Gold Standard (clasificación independiente)
        // ANTES (INCORRECTO): const nurseEsi = record.nurse_override_level!;
        // AHORA (CORRECTO): const nurseEsi = record.nurse_esi_level!;
        const nurseEsi = record.nurse_esi_level!; // ⭐ Gold Standard para Kappa
        const aiEsi = record.esi_level;

        const nurseIdx = nurseEsi - 1;
        const aiIdx = aiEsi - 1;

        // Bounds check
        if (nurseIdx >= 0 && nurseIdx < 5 && aiIdx >= 0 && aiIdx < 5) {
            matrix[nurseIdx][aiIdx]++;
        }

        const isMatch = aiEsi === nurseEsi;
        if (isMatch) exactMatches++;

        // Sub-triage: AI ESI > Nurse ESI (AI classifies as less urgent)
        if (aiEsi > nurseEsi) subTriageCount++;

        // Over-triage: AI ESI < Nurse ESI (AI classifies as more urgent)
        if (aiEsi < nurseEsi) overTriageCount++;

        // Gender stats
        const gender = record.patient_gender;
        if (gender === 'M' || gender === 'F') {
            genderStats[gender].total++;
            if (isMatch) genderStats[gender].correct++;
        } else {
            genderStats.unknown.total++;
            if (isMatch) genderStats.unknown.correct++;
        }

        // Age stats
        const ageGroup = record.patient_age_group;
        if (ageGroup === 'Pediatric' || ageGroup === 'Adult' || ageGroup === 'Geriatric') {
            ageStats[ageGroup].total++;
            if (isMatch) ageStats[ageGroup].correct++;
        } else {
            ageStats.unknown.total++;
            if (isMatch) ageStats.unknown.correct++;
        }
    }

    // Calculate Cohen's Kappa
    const kappa = calculateCohenKappa(matrix, n);

    // ⭐ NUEVO: Calculate Critical Case Metrics (ESI 1-2)
    const criticalMetrics = calculateCriticalCaseMetrics(validRecords);

    // Calculate accuracy percentages
    const safePercent = (correct: number, total: number) => total > 0 ? (correct / total) * 100 : 0;

    return {
        totalRecords: records.length,
        validatedRecords: n,
        exactAccuracy: n > 0 ? (exactMatches / n) * 100 : 0,
        kappaCoefficient: kappa,
        subTriageRate: n > 0 ? (subTriageCount / n) * 100 : 0,
        overTriageRate: n > 0 ? (overTriageCount / n) * 100 : 0,
        confusionMatrix: matrix,
        accuracyByGender: {
            male: safePercent(genderStats.M.correct, genderStats.M.total),
            female: safePercent(genderStats.F.correct, genderStats.F.total),
            unknown: safePercent(genderStats.unknown.correct, genderStats.unknown.total),
            maleN: genderStats.M.total,
            femaleN: genderStats.F.total,
            unknownN: genderStats.unknown.total
        },
        accuracyByAgeGroup: {
            pediatric: safePercent(ageStats.Pediatric.correct, ageStats.Pediatric.total),
            adult: safePercent(ageStats.Adult.correct, ageStats.Adult.total),
            geriatric: safePercent(ageStats.Geriatric.correct, ageStats.Geriatric.total),
            unknown: safePercent(ageStats.unknown.correct, ageStats.unknown.total),
            pediatricN: ageStats.Pediatric.total,
            adultN: ageStats.Adult.total,
            geriatricN: ageStats.Geriatric.total,
            unknownN: ageStats.unknown.total
        },
        criticalMetrics // ⭐ NUEVO: Métricas de seguridad clínica
    };
}

// =============================================================================
// ⭐ NUEVO: CRITICAL CASE METRICS (ESI 1-2) - SEGURIDAD CLÍNICA
// =============================================================================
// Basado en: supabase/test_nurse_esi_level.sql líneas 116-137
// Objetivo: Validar que la IA NO subestima casos graves (Hipótesis de Tesis)

function calculateCriticalCaseMetrics(records: ClinicalRecordForAnalysis[]): CriticalCaseMetrics {
    let TP = 0; // IA=Crítico (≤2), Enfermera=Crítico (≤2) → Verdadero Positivo
    let FP = 0; // IA=Crítico (≤2), Enfermera=NoCrítico (≥3) → Falso Positivo (sobre-triage)
    let FN = 0; // IA=NoCrítico (≥3), Enfermera=Crítico (≤2) → Falso Negativo ⚠️ PELIGROSO
    let TN = 0; // IA=NoCrítico (≥3), Enfermera=NoCrítico (≥3) → Verdadero Negativo

    for (const record of records) {
        const aiCritical = record.esi_level <= 2;
        const nurseCritical = record.nurse_esi_level! <= 2; // Gold Standard

        if (aiCritical && nurseCritical) {
            TP++; // ✅ IA detectó correctamente caso grave
        } else if (aiCritical && !nurseCritical) {
            FP++; // ⚠️ IA sobre-clasificó (no tan grave)
        } else if (!aiCritical && nurseCritical) {
            FN++; // 🚨 IA PERDIÓ CASO GRAVE - CRÍTICO PARA SEGURIDAD
        } else {
            TN++; // ✅ IA descartó correctamente caso no grave
        }
    }

    const totalCritical = TP + FN; // Total de casos graves según enfermera

    // Evitar división por cero
    const safeDivide = (numerator: number, denominator: number) =>
        denominator > 0 ? numerator / denominator : 0;

    return {
        TP,
        FP,
        FN,
        TN,
        // Sensibilidad: Capacidad de detectar casos graves
        // "De todos los casos realmente graves, ¿cuántos detecta la IA?"
        sensitivity: safeDivide(TP, TP + FN),

        // Especificidad: Capacidad de descartar casos no graves
        // "De todos los casos realmente no graves, ¿cuántos descarta la IA?"
        specificity: safeDivide(TN, TN + FP),

        // Valor Predictivo Negativo (VPN): Confianza cuando la IA dice "no crítico"
        // "Cuando la IA dice no grave, ¿qué tan seguro estamos?"
        npv: safeDivide(TN, TN + FN),

        // Valor Predictivo Positivo (VPP): Confianza cuando la IA dice "crítico"
        // "Cuando la IA dice grave, ¿qué tan seguro estamos?"
        ppv: safeDivide(TP, TP + FP),

        // Tasa de sub-triage específica en casos graves (objetivo: <5%)
        // "De todos los casos graves, ¿cuántos se perdieron?"
        criticalSubTriageRate: safeDivide(FN, totalCritical) * 100
    };
}

function calculateCohenKappa(matrix: number[][], n: number): number {
    if (n === 0) return 0;

    // Observed agreement (Po)
    let po = 0;
    for (let i = 0; i < 5; i++) {
        po += matrix[i][i];
    }
    po /= n;

    // Expected agreement (Pe)
    let pe = 0;
    for (let i = 0; i < 5; i++) {
        let rowSum = 0;
        let colSum = 0;
        for (let j = 0; j < 5; j++) {
            rowSum += matrix[i][j];
            colSum += matrix[j][i];
        }
        pe += (rowSum / n) * (colSum / n);
    }

    // Kappa = (Po - Pe) / (1 - Pe)
    // Referencia: Cohen, J. (1960). "A coefficient of agreement for nominal scales"
    if (pe === 1) return 1;
    return (po - pe) / (1 - pe);
}

function interpretKappa(kappa: number): string {
    if (kappa < 0) return 'Sin Acuerdo';
    if (kappa < 0.20) return 'Acuerdo Leve';
    if (kappa < 0.40) return 'Acuerdo Justo';
    if (kappa < 0.60) return 'Acuerdo Moderado';
    if (kappa < 0.80) return 'Acuerdo Sustancial';
    return 'Acuerdo Casi Perfecto';
}

// =============================================================================
// ICON COMPONENTS
// =============================================================================

function UsersIcon() {
    return (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
    );
}

function CheckIcon() {
    return (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
    );
}

function StarIcon() {
    return (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
    );
}

function AlertTriangleIcon() {
    return (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
    );
}

function RefreshIcon() {
    return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
    );
}

// =============================================================================
// UI COMPONENTS
// =============================================================================

interface KPICardProps {
    value: string;
    label: string;
    icon: React.ReactNode;
    variant: 'default' | 'success' | 'highlight' | 'danger';
    badge?: string;
    subtext?: string;
}

function KPICard({ value, label, icon, variant, badge, subtext }: KPICardProps) {
    const variants = {
        default: { bg: 'bg-white', border: 'border-gray-200', value: 'text-gray-900', iconBg: 'bg-blue-50', iconColor: 'text-blue-600' },
        success: { bg: 'bg-white', border: 'border-emerald-200', value: 'text-emerald-600', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
        highlight: { bg: 'bg-gradient-to-br from-blue-900 to-indigo-900', border: 'border-blue-700', value: 'text-amber-400', iconBg: 'bg-white/10', iconColor: 'text-amber-400' },
        danger: { bg: 'bg-gradient-to-br from-red-50 to-red-100', border: 'border-red-300', value: 'text-red-600', iconBg: 'bg-red-100', iconColor: 'text-red-600' }
    };
    const style = variants[variant];
    const isHighlight = variant === 'highlight';

    return (
        <div className={`relative rounded-2xl border-2 ${style.border} ${style.bg} p-6 shadow-sm`}>
            <div className={`absolute top-4 right-4 p-2 rounded-xl ${style.iconBg}`}>
                <span className={style.iconColor}>{icon}</span>
            </div>
            <div className="space-y-1">
                <p className={`text-3xl font-bold ${style.value}`}>{value}</p>
                <p className={`text-sm font-medium ${isHighlight ? 'text-blue-200' : 'text-gray-500'}`}>{label}</p>
            </div>
            {badge && (
                <div className={`mt-3 inline-block px-3 py-1 rounded-full text-xs font-semibold ${isHighlight ? 'bg-amber-400/20 text-amber-300' : variant === 'danger' ? 'bg-red-200 text-red-800' : 'bg-blue-100 text-blue-700'
                    }`}>{badge}</div>
            )}
            {subtext && <p className={`mt-2 text-xs ${isHighlight ? 'text-blue-300' : 'text-gray-400'}`}>{subtext}</p>}
        </div>
    );
}

function ConfusionMatrixChart({ matrix }: { matrix: number[][] }) {
    const labels = ['ESI 1', 'ESI 2', 'ESI 3', 'ESI 4', 'ESI 5'];
    const maxDiag = Math.max(...matrix.map((row, i) => row[i]), 1);

    const getColor = (value: number, isDiag: boolean) => {
        if (value === 0) return 'bg-gray-50 text-gray-300';
        const intensity = value / maxDiag;
        if (isDiag) {
            if (intensity > 0.5) return 'bg-emerald-600 text-white';
            if (intensity > 0.2) return 'bg-emerald-400 text-white';
            return 'bg-emerald-200 text-emerald-800';
        }
        if (value > 5) return 'bg-red-300 text-red-900';
        if (value > 0) return 'bg-slate-200 text-slate-700';
        return 'bg-gray-50 text-gray-400';
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Matriz de Concordancia</h3>
            <p className="text-sm text-gray-500 mb-4">Enfermero (Filas) vs. IA (Columnas)</p>

            <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead>
                        <tr>
                            <th className="p-2 text-xs text-gray-400"></th>
                            {labels.map((l, i) => (
                                <th key={i} className="p-2 text-xs font-semibold text-blue-700 bg-blue-50 rounded">{l}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {matrix.map((row, i) => (
                            <tr key={i}>
                                <td className="p-2 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded">{labels[i]}</td>
                                {row.map((val, j) => (
                                    <td key={j} className="p-1">
                                        <div className={`w-12 h-12 flex items-center justify-center rounded-lg font-bold text-sm ${getColor(val, i === j)} ${i === j ? 'ring-2 ring-emerald-400' : ''}`}>
                                            {val}
                                        </div>
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="mt-4 pt-4 border-t flex justify-center gap-6 text-xs text-gray-500">
                <span className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-emerald-500"></div> Concordancia</span>
                <span className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-red-300"></div> Discordancia</span>
            </div>
        </div>
    );
}

interface BarData { label: string; value: number; count: number; color: string; }

function BiasBarChart({ title, subtitle, data, showNoData }: { title: string; subtitle: string; data: BarData[]; showNoData: boolean }) {
    const hasData = data.some(d => d.count > 0);

    if (!hasData && !showNoData) {
        return (
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm h-full flex flex-col">
                <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
                <p className="text-xs text-gray-500 mb-4">{subtitle}</p>
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center text-gray-400">
                        <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <p className="text-sm font-medium">Datos insuficientes</p>
                        <p className="text-xs">para análisis de sesgo</p>
                    </div>
                </div>
            </div>
        );
    }

    const maxVal = Math.max(...data.map(d => d.value), 1);

    return (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm h-full">
            <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
            <p className="text-xs text-gray-500 mb-4">{subtitle}</p>

            <div className="space-y-3">
                {data.map((item, idx) => (
                    <div key={idx}>
                        <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium text-gray-700">{item.label} <span className="text-gray-400">(n={item.count})</span></span>
                            <span className="font-bold text-gray-900">{item.count > 0 ? `${item.value.toFixed(1)}%` : '—'}</span>
                        </div>
                        <div className="h-6 bg-gray-100 rounded-lg overflow-hidden">
                            <div className={`h-full rounded-lg ${item.color}`} style={{ width: `${item.count > 0 ? (item.value / 100) * 100 : 0}%` }}></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function SafetyGauge({ value, threshold }: { value: number; threshold: number }) {
    const isOk = value <= threshold;

    return (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
            <h4 className="text-sm font-semibold text-gray-900 text-center mb-1">Riesgo Sub-triaje</h4>
            <p className="text-xs text-gray-500 text-center mb-4">Objetivo &lt;{threshold}%</p>

            <div className="flex items-center justify-center">
                <div className={`text-4xl font-bold ${isOk ? 'text-emerald-600' : 'text-red-600'}`}>
                    {value.toFixed(1)}%
                </div>
            </div>

            <div className="mt-4 flex justify-center">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${isOk ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}>
                    <span className={`w-2 h-2 rounded-full ${isOk ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                    {isOk ? 'ACEPTABLE' : 'ALERTA'}
                </span>
            </div>
        </div>
    );
}

// =============================================================================
// MAIN DASHBOARD PAGE
// =============================================================================

export default function ResultadosPage() {
    const [records, setRecords] = useState<ClinicalRecordForAnalysis[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [eligibleOnly, setEligibleOnly] = useState(false);
    const [showUserPanel, setShowUserPanel] = useState(false);
    const { profile, loading: authLoading } = useAuth();

    // Fetch data from Supabase
    const fetchData = async () => {
        setLoading(true);
        setError(null);

        try {
            console.log('Fetching clinical records from Supabase...');
            const { data, error: fetchError } = await supabase
                .from('clinical_records')
                // 🔥 CORRECCIÓN CRÍTICA: Agregar nurse_esi_level al query
                .select('id, anonymous_code, esi_level, nurse_esi_level, nurse_override_level, patient_gender, patient_age_group, consent_eligible, nurse_validated')
                .order('created_at', { ascending: false });

            if (fetchError) {
                console.error('Supabase fetch error:', fetchError);
                throw fetchError;
            }

            console.log(`Successfully fetched ${data?.length || 0} clinical records`);
            setRecords(data || []);
        } catch (err) {
            console.error('Error fetching clinical records:', err);
            setError(err instanceof Error ? err.message : 'Error desconocido al cargar datos');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Wait for auth to be ready, then fetch data
        console.log('Auth state:', { authLoading, hasProfile: !!profile, role: profile?.role });

        if (!authLoading) {
            // Auth is ready, proceed with authorization check
            if (profile) {
                // Check if user has permission to access this page
                if (profile.role !== 'researcher' && profile.role !== 'admin') {
                    console.warn('[Resultados] User does not have permission. Role:', profile.role);
                    setError('No tienes permisos para acceder a esta página. Se requiere rol de investigador o administrador.');
                    setLoading(false);
                    // Redirect to login after showing error briefly
                    setTimeout(() => {
                        window.location.href = '/login/resultados';
                    }, 2000);
                    return;
                }

                console.log('Profile loaded, fetching data for user:', profile.email, 'Role:', profile.role);
                fetchData();
            } else {
                // If we're not loading auth but there's no profile, show an error
                console.error('No profile found after auth loading completed');
                setError('No se pudo cargar tu perfil de usuario. Redirigiendo al login...');
                setLoading(false);
                // Redirect to login
                setTimeout(() => {
                    window.location.href = '/login/resultados';
                }, 2000);
            }
        }
    }, [authLoading, profile]);

    // Filter records by eligibility if toggle is on
    const filteredRecords = useMemo(() => {
        if (!eligibleOnly) return records;
        return records.filter(r => r.consent_eligible === true);
    }, [records, eligibleOnly]);

    // Calculate metrics from filtered data
    const metrics = useMemo(() => {
        return calculateStudyMetrics(filteredRecords);
    }, [filteredRecords]);

    // Prepare bar chart data
    const genderData: BarData[] = [
        { label: 'Femenino', value: metrics.accuracyByGender.female, count: metrics.accuracyByGender.femaleN, color: 'bg-pink-500' },
        { label: 'Masculino', value: metrics.accuracyByGender.male, count: metrics.accuracyByGender.maleN, color: 'bg-blue-500' },
        { label: 'Sin Datos', value: metrics.accuracyByGender.unknown, count: metrics.accuracyByGender.unknownN, color: 'bg-gray-400' },
    ];

    const ageData: BarData[] = [
        { label: 'Pediátrico', value: metrics.accuracyByAgeGroup.pediatric, count: metrics.accuracyByAgeGroup.pediatricN, color: 'bg-emerald-500' },
        { label: 'Adulto', value: metrics.accuracyByAgeGroup.adult, count: metrics.accuracyByAgeGroup.adultN, color: 'bg-blue-500' },
        { label: 'Geriátrico', value: metrics.accuracyByAgeGroup.geriatric, count: metrics.accuracyByAgeGroup.geriatricN, color: 'bg-amber-500' },
        { label: 'Sin Datos', value: metrics.accuracyByAgeGroup.unknown, count: metrics.accuracyByAgeGroup.unknownN, color: 'bg-gray-400' },
    ];

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-blue-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600">Cargando datos clínicos...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-blue-50 flex items-center justify-center">
                <div className="text-center bg-white p-8 rounded-2xl shadow-lg max-w-md">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertTriangleIcon />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Error de Conexión</h2>
                    <p className="text-gray-600 mb-4">{error}</p>
                    <button onClick={fetchData} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                        Reintentar
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-blue-50">
            {/* User Management Panel */}
            <UserManagementPanel
                isOpen={showUserPanel}
                onClose={() => setShowUserPanel(false)}
            />

            {/* HEADER */}
            <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                            Resultados del Estudio de Validación Clínica
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">
                            <span className="font-semibold text-blue-700">Triage IA vs. Estándar Humano</span>
                            <span className="mx-2">•</span>
                            Datos en Tiempo Real
                        </p>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                        {/* User info */}
                        {profile && (
                            <span className="text-sm text-gray-600">
                                👤 {profile.full_name || profile.email}
                            </span>
                        )}
                        {/* User Management Button */}
                        <button
                            onClick={() => setShowUserPanel(true)}
                            className="flex items-center gap-2 px-3 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors text-sm font-medium"
                            title="Gestionar usuarios"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                            </svg>
                            <span className="hidden sm:inline">Usuarios</span>
                        </button>
                        {/* Eligibility Toggle */}
                        <label className="flex items-center gap-2 cursor-pointer bg-gray-100 px-3 py-2 rounded-lg">
                            <input
                                type="checkbox"
                                checked={eligibleOnly}
                                onChange={(e) => setEligibleOnly(e.target.checked)}
                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium text-gray-700">Solo Elegibles</span>
                        </label>
                        <button onClick={fetchData} className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700" title="Actualizar datos">
                            <RefreshIcon />
                        </button>
                        <LogoutButton redirectTo="/login/resultados" />
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">

                {/* DATA QUALITY WARNING */}
                {metrics.accuracyByGender.unknownN > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                        <div className="text-amber-600 mt-0.5"><AlertTriangleIcon /></div>
                        <div>
                            <h4 className="font-semibold text-amber-800">Advertencia de Calidad de Datos</h4>
                            <p className="text-sm text-amber-700">
                                {metrics.accuracyByGender.unknownN} registros no tienen datos demográficos (género/edad).
                                Revisa la recolección del consentimiento informado.
                            </p>
                        </div>
                    </div>
                )}

                {/* KPI CARDS */}
                <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <KPICard
                        value={metrics.totalRecords.toLocaleString()}
                        label="Registros Totales"
                        icon={<UsersIcon />}
                        variant="default"
                        subtext={`${metrics.validatedRecords} validados por enfermero`}
                    />
                    <KPICard
                        value={metrics.validatedRecords > 0 ? `${metrics.exactAccuracy.toFixed(1)}%` : '—'}
                        label="Precisión Global"
                        icon={<CheckIcon />}
                        variant="success"
                        subtext="IA = Enfermero"
                    />
                    <KPICard
                        value={metrics.validatedRecords > 0 ? metrics.kappaCoefficient.toFixed(2) : '—'}
                        label="Kappa de Cohen"
                        icon={<StarIcon />}
                        variant="highlight"
                        badge={metrics.validatedRecords > 0 ? interpretKappa(metrics.kappaCoefficient) : 'Sin datos'}
                        subtext="Acuerdo más allá del azar"
                    />
                    <KPICard
                        value={metrics.validatedRecords > 0 ? `${metrics.subTriageRate.toFixed(1)}%` : '—'}
                        label="Sub-triaje"
                        icon={<AlertTriangleIcon />}
                        variant="danger"
                        badge="Riesgo Clínico"
                        subtext="IA subestima gravedad"
                    />
                </section>

                {/* ⭐ NUEVO: KPIs de Seguridad Clínica (Casos Graves ESI 1-2) */}
                <section className="bg-gradient-to-br from-red-50 to-orange-50 border-2 border-red-200 rounded-2xl p-6 shadow-md">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-red-100 rounded-lg">
                            <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-red-900">Métricas de Seguridad Clínica</h2>
                            <p className="text-sm text-red-700">Rendimiento en Casos Graves (ESI 1-2)</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white rounded-xl p-4 border-2 border-emerald-200 shadow-sm">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Sensibilidad</span>
                                <span className="text-2xl">🎯</span>
                            </div>
                            <div className="text-3xl font-bold text-emerald-600 mb-1">
                                {metrics.validatedRecords > 0 ? `${(metrics.criticalMetrics.sensitivity * 100).toFixed(1)}%` : '—'}
                            </div>
                            <p className="text-xs text-gray-600">Detecta casos graves</p>
                            <p className="text-xs text-gray-500 mt-1">TP: {metrics.criticalMetrics.TP} / {metrics.criticalMetrics.TP + metrics.criticalMetrics.FN}</p>
                        </div>
                        <div className="bg-white rounded-xl p-4 border-2 border-blue-200 shadow-sm">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-sm font-semibold text-gray-700 uppercase tracking-wide">VPN</span>
                                <span className="text-2xl">✅</span>
                            </div>
                            <div className="text-3xl font-bold text-blue-600 mb-1">
                                {metrics.validatedRecords > 0 ? `${(metrics.criticalMetrics.npv * 100).toFixed(1)}%` : '—'}
                            </div>
                            <p className="text-xs text-gray-600">Confianza &quot;no grave&quot;</p>
                            <p className="text-xs text-gray-500 mt-1">TN: {metrics.criticalMetrics.TN} / {metrics.criticalMetrics.TN + metrics.criticalMetrics.FN}</p>
                        </div>
                        <div className="bg-white rounded-xl p-4 border-2 border-purple-200 shadow-sm">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Especificidad</span>
                                <span className="text-2xl">🔍</span>
                            </div>
                            <div className="text-3xl font-bold text-purple-600 mb-1">
                                {metrics.validatedRecords > 0 ? `${(metrics.criticalMetrics.specificity * 100).toFixed(1)}%` : '—'}
                            </div>
                            <p className="text-xs text-gray-600">Descarta no graves</p>
                            <p className="text-xs text-gray-500 mt-1">TN: {metrics.criticalMetrics.TN} / {metrics.criticalMetrics.TN + metrics.criticalMetrics.FP}</p>
                        </div>
                        <div className="bg-white rounded-xl p-4 border-2 border-red-300 shadow-sm">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-sm font-semibold text-gray-700 uppercase tracking-wide">FN Graves</span>
                                <span className="text-2xl">🚨</span>
                            </div>
                            <div className="text-3xl font-bold text-red-600 mb-1">
                                {metrics.criticalMetrics.FN}
                            </div>
                            <p className="text-xs text-gray-600">Casos graves perdidos</p>
                            <p className="text-xs text-gray-500 mt-1">Tasa: {metrics.criticalMetrics.criticalSubTriageRate.toFixed(1)}%</p>
                        </div>
                    </div>
                    <div className="mt-4 bg-white rounded-lg p-3 border border-gray-200">
                        <div className="flex items-start gap-2 text-xs text-gray-700">
                            <span className="text-lg flex-shrink-0">💡</span>
                            <div>
                                <strong>Interpretación:</strong>
                                <span className="ml-1">
                                    Sensibilidad {(metrics.criticalMetrics.sensitivity * 100).toFixed(0)}% significa que de cada 100 casos realmente graves,
                                    la IA detecta {(metrics.criticalMetrics.sensitivity * 100).toFixed(0)}.
                                    Falsos Negativos (FN={metrics.criticalMetrics.FN}) son casos graves que la IA clasificó como no graves.
                                </span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* MAIN CONTENT */}
                {metrics.validatedRecords === 0 ? (
                    <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
                        <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">Sin Datos de Validación</h3>
                        <p className="text-gray-500">No hay registros validados por enfermeros aún.</p>
                        <p className="text-sm text-gray-400 mt-2">Los enfermeros deben validar casos en el panel de enfermería para que aparezcan aquí.</p>
                    </div>
                ) : (
                    <>
                        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2">
                                <ConfusionMatrixChart matrix={metrics.confusionMatrix} />
                            </div>
                            <div className="space-y-4">
                                <SafetyGauge value={metrics.subTriageRate} threshold={5} />
                                <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Sobre-triaje</h4>
                                    <div className="text-2xl font-bold text-amber-600">{metrics.overTriageRate.toFixed(1)}%</div>
                                    <p className="text-xs text-gray-500">IA sobreestima gravedad</p>
                                </div>
                            </div>
                        </section>

                        {/* EQUITY ANALYSIS */}
                        <section className="bg-gradient-to-r from-indigo-900 to-purple-900 rounded-2xl p-6 border border-indigo-700">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-white/10 rounded-lg text-white">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                                    </svg>
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">Análisis de Equidad Algorítmica</h2>
                                    <p className="text-sm text-indigo-200">Detección de Sesgo Demográfico</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <BiasBarChart
                                    title="Precisión por Género"
                                    subtitle="Comparación del modelo"
                                    data={genderData}
                                    showNoData={true}
                                />
                                <BiasBarChart
                                    title="Precisión por Grupo Etario"
                                    subtitle="Rendimiento por edad"
                                    data={ageData}
                                    showNoData={true}
                                />
                            </div>
                        </section>
                    </>
                )}

                {/* FOOTER */}
                <footer className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">📋 Notas Metodológicas</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-gray-600">
                        <div>
                            <strong className="text-gray-800">Estándar de Oro:</strong>
                            <p>Clasificación ESI independiente por enfermeros certificados.</p>
                        </div>
                        <div>
                            <strong className="text-gray-800">Kappa de Cohen:</strong>
                            <p>Mide acuerdo más allá del azar. &gt;0.80 = casi perfecto.</p>
                        </div>
                        <div>
                            <strong className="text-gray-800">Elegibilidad:</strong>
                            <p>Filtro por consentimiento válido para análisis de sesgo.</p>
                        </div>
                    </div>
                    <div className="mt-4 pt-4 border-t text-center text-xs text-gray-400">
                        Datos en tiempo real desde Supabase • {new Date().getFullYear()}
                    </div>
                </footer>
            </main>
        </div>
    );
}

/*
================================================================================
SQL MIGRATION SUGERIDA - Ejecutar en Supabase SQL Editor
================================================================================

-- Add demographic columns for equity analysis
ALTER TABLE clinical_records ADD COLUMN IF NOT EXISTS patient_gender TEXT;
ALTER TABLE clinical_records ADD COLUMN IF NOT EXISTS patient_age_group TEXT;
ALTER TABLE clinical_records ADD COLUMN IF NOT EXISTS consent_eligible BOOLEAN DEFAULT true;

-- Add constraints
ALTER TABLE clinical_records ADD CONSTRAINT check_patient_gender 
CHECK (patient_gender IS NULL OR patient_gender IN ('M', 'F', 'Other', 'Prefer not to say'));

ALTER TABLE clinical_records ADD CONSTRAINT check_patient_age_group 
CHECK (patient_age_group IS NULL OR patient_age_group IN ('Pediatric', 'Adult', 'Geriatric'));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_clinical_records_gender ON clinical_records(patient_gender);
CREATE INDEX IF NOT EXISTS idx_clinical_records_age_group ON clinical_records(patient_age_group);
CREATE INDEX IF NOT EXISTS idx_clinical_records_consent_eligible ON clinical_records(consent_eligible);

================================================================================
*/

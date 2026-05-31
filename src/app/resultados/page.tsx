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
    nurse_override_level: number | null; // Nurse's independent classification
    patient_gender: string | null;
    patient_age_group: string | null;
    consent_eligible: boolean | null;
    nurse_validated: boolean;
}

interface KappaWithCI {
    value: number;
    ciLower: number;
    ciUpper: number;
}

interface StudyMetrics {
    totalRecords: number;
    validatedRecords: number;
    exactAccuracy: number;
    kappaSimple: KappaWithCI;
    kappaLinear: KappaWithCI;
    kappaQuadratic: KappaWithCI;
    subTriageRate: number;
    overTriageRate: number;
    confusionMatrix: number[][]; // Orientación: filas = IA, columnas = Enfermera (tesis §2.3)
    accuracyByGender: { male: number; female: number; unknown: number; maleN: number; femaleN: number; unknownN: number };
    accuracyByAgeGroup: { pediatric: number; adult: number; geriatric: number; unknown: number; pediatricN: number; adultN: number; geriatricN: number; unknownN: number };
}

// Tamaño muestral objetivo según tesis §3.5 (fórmula de Donner)
const SAMPLE_SIZE_MIN = 230;
const SAMPLE_SIZE_MAX = 300;
const BOOTSTRAP_ITERATIONS = 1000;

// =============================================================================
// METRICS CALCULATION - Cohen's Kappa & Confusion Matrix
// =============================================================================

function calculateStudyMetrics(records: ClinicalRecordForAnalysis[]): StudyMetrics {
    // Filter only validated records with nurse override
    const validRecords = records.filter(r => r.nurse_validated && r.nurse_override_level !== null);

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
        const nurseEsi = record.nurse_override_level!;
        const aiEsi = record.esi_level;

        const nurseIdx = nurseEsi - 1;
        const aiIdx = aiEsi - 1;

        // Orientación según tesis §2.3 (líneas 2096-2105): filas = IA, columnas = Enfermera
        if (nurseIdx >= 0 && nurseIdx < 5 && aiIdx >= 0 && aiIdx < 5) {
            matrix[aiIdx][nurseIdx]++;
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

    // Calcular los tres Kappa con IC 95% por bootstrap (tesis §2.4)
    const pairs: Array<[number, number]> = validRecords.map(r => [r.esi_level, r.nurse_override_level!]);
    const kappaSimple = calculateKappaWithCI(pairs, 'simple');
    const kappaLinear = calculateKappaWithCI(pairs, 'linear');
    const kappaQuadratic = calculateKappaWithCI(pairs, 'quadratic');

    // Calculate accuracy percentages
    const safePercent = (correct: number, total: number) => total > 0 ? (correct / total) * 100 : 0;

    return {
        totalRecords: records.length,
        validatedRecords: n,
        exactAccuracy: n > 0 ? (exactMatches / n) * 100 : 0,
        kappaSimple,
        kappaLinear,
        kappaQuadratic,
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
        }
    };
}

type KappaWeight = 'simple' | 'linear' | 'quadratic';

// Pesos según tesis §2.4 (líneas 2113-2127):
//   - Simple (Cohen sin ponderar): peso 1 si i===j, 0 si i!==j
//   - Lineal: 1 - |i-j|/(k-1)
//   - Cuadrático: 1 - (i-j)^2/(k-1)^2
function weight(i: number, j: number, scheme: KappaWeight, k: number = 5): number {
    const diff = Math.abs(i - j);
    if (scheme === 'simple') return diff === 0 ? 1 : 0;
    if (scheme === 'linear') return 1 - diff / (k - 1);
    // quadratic
    return 1 - (diff * diff) / ((k - 1) * (k - 1));
}

function calculateWeightedKappaFromPairs(pairs: Array<[number, number]>, scheme: KappaWeight): number {
    const n = pairs.length;
    if (n === 0) return 0;

    // Construir matriz 5x5 (filas IA, columnas enfermera) — consistente con la tesis
    const matrix: number[][] = Array(5).fill(null).map(() => Array(5).fill(0));
    for (const [aiEsi, nurseEsi] of pairs) {
        const aiIdx = aiEsi - 1;
        const nurseIdx = nurseEsi - 1;
        if (aiIdx >= 0 && aiIdx < 5 && nurseIdx >= 0 && nurseIdx < 5) {
            matrix[aiIdx][nurseIdx]++;
        }
    }

    // Marginales
    const rowSums = matrix.map(row => row.reduce((a, b) => a + b, 0));
    const colSums = Array(5).fill(0);
    for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
            colSums[j] += matrix[i][j];
        }
    }

    // Acuerdo observado (Po) y esperado (Pe) ponderados
    let po = 0;
    let pe = 0;
    for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
            const w = weight(i, j, scheme);
            po += (w * matrix[i][j]) / n;
            pe += (w * rowSums[i] * colSums[j]) / (n * n);
        }
    }

    if (pe === 1) return 1;
    return (po - pe) / (1 - pe);
}

// IC 95% por bootstrap percentil (tesis §3.5 menciona bootstrap)
function calculateKappaWithCI(pairs: Array<[number, number]>, scheme: KappaWeight): KappaWithCI {
    const n = pairs.length;
    if (n === 0) return { value: 0, ciLower: 0, ciUpper: 0 };

    const pointEstimate = calculateWeightedKappaFromPairs(pairs, scheme);

    // Para muestras pequeñas (n < 5) no calculamos IC
    if (n < 5) return { value: pointEstimate, ciLower: pointEstimate, ciUpper: pointEstimate };

    // Bootstrap con resampleo con reemplazo. RNG simple determinista por seed
    // (Mulberry32) para reproducibilidad en el dashboard.
    let seed = n * 1000 + Math.floor(pointEstimate * 1e6);
    const rng = () => {
        seed = (seed + 0x6D2B79F5) | 0;
        let t = seed;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    const estimates: number[] = [];
    for (let b = 0; b < BOOTSTRAP_ITERATIONS; b++) {
        const sample: Array<[number, number]> = new Array(n);
        for (let i = 0; i < n; i++) {
            sample[i] = pairs[Math.floor(rng() * n)];
        }
        estimates.push(calculateWeightedKappaFromPairs(sample, scheme));
    }
    estimates.sort((a, b) => a - b);
    const lowerIdx = Math.floor(0.025 * BOOTSTRAP_ITERATIONS);
    const upperIdx = Math.floor(0.975 * BOOTSTRAP_ITERATIONS);
    return {
        value: pointEstimate,
        ciLower: estimates[lowerIdx],
        ciUpper: estimates[upperIdx]
    };
}

function interpretKappa(kappa: number): string {
    if (kappa < 0) return 'Sin Acuerdo';
    if (kappa < 0.20) return 'Acuerdo Leve';
    if (kappa < 0.40) return 'Acuerdo Justo';
    if (kappa < 0.60) return 'Acuerdo Moderado';
    if (kappa < 0.80) return 'Acuerdo Sustancial';
    return 'Acuerdo Casi Perfecto';
}

// Exportación CSV de los registros validados
function recordsToCSV(records: ClinicalRecordForAnalysis[]): string {
    const headers = [
        'id',
        'anonymous_code',
        'esi_ia',
        'esi_enfermera',
        'concordancia',
        'diferencia',
        'tipo_discrepancia',
        'patient_gender',
        'patient_age_group',
        'consent_eligible',
        'nurse_validated'
    ];
    const lines = [headers.join(',')];
    for (const r of records) {
        const nurseEsi = r.nurse_override_level;
        const aiEsi = r.esi_level;
        const concordancia = nurseEsi !== null && nurseEsi === aiEsi ? '1' : '0';
        const diferencia = nurseEsi !== null ? (aiEsi - nurseEsi).toString() : '';
        let tipoDiscrepancia = '';
        if (nurseEsi !== null) {
            if (aiEsi === nurseEsi) tipoDiscrepancia = 'concordancia';
            else if (aiEsi > nurseEsi) tipoDiscrepancia = 'sub-triaje';
            else tipoDiscrepancia = 'sobre-triaje';
        }
        const cells = [
            r.id,
            r.anonymous_code ?? '',
            aiEsi.toString(),
            nurseEsi !== null ? nurseEsi.toString() : '',
            concordancia,
            diferencia,
            tipoDiscrepancia,
            r.patient_gender ?? '',
            r.patient_age_group ?? '',
            r.consent_eligible === null ? '' : (r.consent_eligible ? 'true' : 'false'),
            r.nurse_validated ? 'true' : 'false'
        ];
        // CSV escaping básico (los campos no deberían contener comas, pero por si acaso)
        const escaped = cells.map(c => {
            const s = String(c);
            if (s.includes(',') || s.includes('"') || s.includes('\n')) {
                return '"' + s.replace(/"/g, '""') + '"';
            }
            return s;
        });
        lines.push(escaped.join(','));
    }
    return lines.join('\n');
}

function downloadCSV(filename: string, csv: string): void {
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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

    // Marginales para el total por fila/columna
    const rowTotals = matrix.map(row => row.reduce((a, b) => a + b, 0));
    const colTotals = Array(5).fill(0).map((_, j) => matrix.reduce((sum, row) => sum + row[j], 0));
    const grandTotal = rowTotals.reduce((a, b) => a + b, 0);

    return (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Matriz de Concordancia 5×5</h3>
            <p className="text-sm text-gray-500 mb-4">IA (Filas) vs. Enfermera (Columnas) — según tesis §2.3</p>

            <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead>
                        <tr>
                            <th className="p-2 text-xs text-gray-400"></th>
                            <th colSpan={5} className="p-2 text-xs font-bold text-emerald-700 text-center">Enfermera</th>
                            <th className="p-2 text-xs text-gray-400"></th>
                        </tr>
                        <tr>
                            <th className="p-2 text-xs font-bold text-blue-700">IA</th>
                            {labels.map((l, i) => (
                                <th key={i} className="p-2 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded">{l}</th>
                            ))}
                            <th className="p-2 text-xs font-semibold text-gray-500">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {matrix.map((row, i) => (
                            <tr key={i}>
                                <td className="p-2 text-xs font-semibold text-blue-700 bg-blue-50 rounded">{labels[i]}</td>
                                {row.map((val, j) => (
                                    <td key={j} className="p-1">
                                        <div className={`w-12 h-12 flex items-center justify-center rounded-lg font-bold text-sm ${getColor(val, i === j)} ${i === j ? 'ring-2 ring-emerald-400' : ''}`}>
                                            {val}
                                        </div>
                                    </td>
                                ))}
                                <td className="p-1 text-center text-sm font-semibold text-gray-600">{rowTotals[i]}</td>
                            </tr>
                        ))}
                        <tr>
                            <td className="p-2 text-xs font-semibold text-gray-500">Total</td>
                            {colTotals.map((t, j) => (
                                <td key={j} className="p-1 text-center text-sm font-semibold text-gray-600">{t}</td>
                            ))}
                            <td className="p-1 text-center text-sm font-bold text-gray-900">{grandTotal}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div className="mt-4 pt-4 border-t flex justify-center gap-6 text-xs text-gray-500">
                <span className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-emerald-500"></div> Concordancia (diagonal)</span>
                <span className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-red-300"></div> Discordancia &gt; 5</span>
            </div>
        </div>
    );
}

function SampleProgressCard({ current, min, max }: { current: number; min: number; max: number }) {
    const pctMin = Math.min(100, (current / min) * 100);
    const pctMax = Math.min(100, (current / max) * 100);
    const reachedMin = current >= min;
    const reachedMax = current >= max;

    const status = reachedMax ? 'COMPLETO' : reachedMin ? 'OBJETIVO MÍNIMO ALCANZADO' : 'RECLUTANDO';
    const statusColor = reachedMax
        ? 'bg-emerald-100 text-emerald-700'
        : reachedMin
            ? 'bg-blue-100 text-blue-700'
            : 'bg-amber-100 text-amber-700';
    const barColor = reachedMax ? 'bg-emerald-500' : reachedMin ? 'bg-blue-500' : 'bg-amber-500';

    return (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <h3 className="text-lg font-bold text-gray-900">Progreso del Reclutamiento</h3>
                    <p className="text-sm text-gray-500">Fórmula de Donner — tesis §3.5</p>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${statusColor}`}>
                    <span className={`w-2 h-2 rounded-full ${reachedMax ? 'bg-emerald-500' : reachedMin ? 'bg-blue-500' : 'bg-amber-500'}`}></span>
                    {status}
                </span>
            </div>

            <div className="flex items-baseline gap-2 mb-3">
                <span className="text-4xl font-bold text-gray-900">{current}</span>
                <span className="text-sm text-gray-500">/ {min}–{max} casos validados</span>
            </div>

            <div className="relative h-4 bg-gray-100 rounded-full overflow-hidden mb-1">
                <div className={`h-full ${barColor} transition-all duration-500`} style={{ width: `${pctMax}%` }}></div>
                {/* Marca del mínimo (n=230) */}
                <div
                    className="absolute top-0 bottom-0 border-l-2 border-dashed border-gray-400"
                    style={{ left: `${(min / max) * 100}%` }}
                    title={`Mínimo: n=${min}`}
                ></div>
            </div>
            <div className="flex justify-between text-xs text-gray-500">
                <span>0</span>
                <span className="text-gray-700 font-semibold">n mínimo {min} ({pctMin.toFixed(0)}%)</span>
                <span>n objetivo {max}</span>
            </div>

            {!reachedMin && (
                <p className="mt-4 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    Faltan <strong>{min - current} casos</strong> validados para alcanzar el tamaño muestral mínimo. Sin n ≥ {min}, el poder estadístico será insuficiente para contrastar H₁: κ ≥ 0,85.
                </p>
            )}
            {reachedMin && !reachedMax && (
                <p className="mt-4 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg p-3">
                    Objetivo mínimo alcanzado. Continúar hasta n = {max} mejora la estabilidad de la matriz de confusión y los análisis estratificados.
                </p>
            )}
            {reachedMax && (
                <p className="mt-4 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                    Tamaño muestral objetivo alcanzado. Se cuenta con poder estadístico suficiente para cerrar el OE4.
                </p>
            )}
        </div>
    );
}

function KappaCard({ label, kappa, highlight }: { label: string; kappa: KappaWithCI; highlight?: boolean }) {
    const interpretation = interpretKappa(kappa.value);
    const bg = highlight
        ? 'bg-gradient-to-br from-blue-900 to-indigo-900 border-blue-700'
        : 'bg-white border-gray-200';
    const valueColor = highlight ? 'text-amber-400' : 'text-gray-900';
    const labelColor = highlight ? 'text-blue-200' : 'text-gray-500';
    const subColor = highlight ? 'text-blue-300' : 'text-gray-500';

    return (
        <div className={`rounded-2xl border-2 ${bg} p-5 shadow-sm`}>
            <p className={`text-xs font-semibold uppercase tracking-wide ${labelColor}`}>{label}</p>
            <p className={`text-3xl font-bold mt-1 ${valueColor}`}>{kappa.value.toFixed(3)}</p>
            <p className={`text-xs mt-1 ${subColor}`}>IC 95%: [{kappa.ciLower.toFixed(3)}, {kappa.ciUpper.toFixed(3)}]</p>
            <div className={`mt-3 inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${highlight ? 'bg-amber-400/20 text-amber-300' : 'bg-blue-100 text-blue-700'}`}>
                {interpretation}
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
            const { data, error: fetchError } = await supabase
                .from('clinical_records')
                .select('id, anonymous_code, esi_level, nurse_override_level, patient_gender, patient_age_group, consent_eligible, nurse_validated')
                .order('created_at', { ascending: false });

            if (fetchError) throw fetchError;

            setRecords(data || []);
        } catch (err) {
            console.error('Error fetching clinical records:', err);
            setError(err instanceof Error ? err.message : 'Error desconocido');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Only fetch data after auth is ready to avoid RLS issues
        if (!authLoading) {
            fetchData();
        }
    }, [authLoading]);

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
                        <button
                            onClick={() => {
                                const csv = recordsToCSV(filteredRecords);
                                const stamp = new Date().toISOString().slice(0, 10);
                                const suffix = eligibleOnly ? '-elegibles' : '';
                                downloadCSV(`meditriage-export${suffix}-${stamp}.csv`, csv);
                            }}
                            disabled={filteredRecords.length === 0}
                            className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                            title="Exportar datos a CSV para análisis estadístico externo (R / Python / Excel)"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            <span className="hidden sm:inline">Exportar CSV</span>
                        </button>
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
                        value={metrics.validatedRecords > 0 ? metrics.kappaSimple.value.toFixed(2) : '—'}
                        label="Kappa de Cohen"
                        icon={<StarIcon />}
                        variant="highlight"
                        badge={metrics.validatedRecords > 0 ? interpretKappa(metrics.kappaSimple.value) : 'Sin datos'}
                        subtext={metrics.validatedRecords > 0
                            ? `IC 95%: [${metrics.kappaSimple.ciLower.toFixed(2)}, ${metrics.kappaSimple.ciUpper.toFixed(2)}]`
                            : 'Acuerdo más allá del azar'}
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

                {/* SAMPLE SIZE PROGRESS — tesis §3.5 */}
                <SampleProgressCard
                    current={metrics.validatedRecords}
                    min={SAMPLE_SIZE_MIN}
                    max={SAMPLE_SIZE_MAX}
                />

                {/* WEIGHTED KAPPA SECTION — tesis §2.4 */}
                {metrics.validatedRecords > 0 && (
                    <section className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                        <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Coeficientes Kappa — ESI como escala ordinal</h2>
                                <p className="text-sm text-gray-500">Tres ponderaciones con IC 95% por bootstrap (1000 iteraciones). H₁ del estudio: κ ≥ 0,85.</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <KappaCard label="Kappa Simple (Cohen)" kappa={metrics.kappaSimple} />
                            <KappaCard label="Kappa Lineal Ponderado" kappa={metrics.kappaLinear} highlight />
                            <KappaCard label="Kappa Cuadrático Ponderado" kappa={metrics.kappaQuadratic} />
                        </div>
                        <div className="mt-4 text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
                            <strong className="text-gray-700">Pesos según tesis §2.4:</strong> Simple = 1 si i=j, 0 si i≠j • Lineal = 1 - |i-j|/4 • Cuadrático = 1 - (i-j)²/16. La versión cuadrática es la recomendada para escalas ordinales como ESI.
                        </div>
                    </section>
                )}

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
                            <p>Mide acuerdo más allá del azar. &gt;0.80 = casi perfecto. Para ESI se recomienda la versión ponderada (lineal o cuadrática) por ser escala ordinal.</p>
                        </div>
                        <div>
                            <strong className="text-gray-800">Elegibilidad:</strong>
                            <p>Filtro por consentimiento válido para análisis de sesgo.</p>
                        </div>
                    </div>
                    <div className="mt-4 pt-4 border-t text-center text-xs text-gray-400">
                        Datos en tiempo real desde Supabase • IC 95% por bootstrap (1000 iter.) • {new Date().getFullYear()}
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

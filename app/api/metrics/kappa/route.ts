import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/metrics/kappa
 * 
 * Calcula métricas de concordancia (Kappa de Cohen) entre clasificación IA y enfermería.
 * Implementa las fórmulas definidas en OE4 de la tesis.
 * 
 * Métricas retornadas:
 * - kappa_simple: Kappa de Cohen sin ponderación
 * - kappa_linear: Kappa ponderado lineal (recomendado para ESI)
 * - kappa_quadratic: Kappa ponderado cuadrático
 * - sensitivity: Sensibilidad para casos críticos (ESI 1-2)
 * - subtriage_rate: Tasa de sub-triage en casos críticos
 * - confusion_matrix: Matriz de confusión 5x5
 */

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

interface ValidationRecord {
    esi_level: number;         // AI classification
    nurse_esi_level: number;   // Nurse blind classification
}

interface KappaMetrics {
    kappa_simple: number;
    kappa_linear: number;
    kappa_quadratic: number;
    agreement_exact: number;
    agreement_adjacent: number;
    sensitivity: number;
    specificity: number;
    subtriage_rate: number;
    n_observations: number;
    confusion_matrix: number[][];
    hypothesis_met: {
        kappa: boolean;    // κ ≥ 0.85
        safety: boolean;   // sub-triage < 5%
    };
}

/**
 * Calculate Cohen's Kappa coefficient
 * 
 * κ = (Po - Pe) / (1 - Pe)
 * where Po = observed agreement, Pe = expected agreement by chance
 */
function calculateKappa(
    aiLevels: number[],
    nurseLevels: number[],
    weights: 'none' | 'linear' | 'quadratic' = 'none'
): number {
    const n = aiLevels.length;
    if (n === 0) return 0;

    const labels = [1, 2, 3, 4, 5]; // ESI levels
    const k = labels.length;

    // Build confusion matrix
    const matrix: number[][] = Array.from({ length: k }, () => Array(k).fill(0));
    for (let i = 0; i < n; i++) {
        const aiIdx = aiLevels[i] - 1;
        const nurseIdx = nurseLevels[i] - 1;
        if (aiIdx >= 0 && aiIdx < k && nurseIdx >= 0 && nurseIdx < k) {
            matrix[nurseIdx][aiIdx]++;
        }
    }

    // Calculate weight matrix
    const weightMatrix: number[][] = Array.from({ length: k }, () => Array(k).fill(0));
    for (let i = 0; i < k; i++) {
        for (let j = 0; j < k; j++) {
            if (weights === 'none') {
                weightMatrix[i][j] = i === j ? 1 : 0;
            } else if (weights === 'linear') {
                weightMatrix[i][j] = 1 - Math.abs(i - j) / (k - 1);
            } else if (weights === 'quadratic') {
                weightMatrix[i][j] = 1 - Math.pow((i - j) / (k - 1), 2);
            }
        }
    }

    // Row and column totals
    const rowTotals = matrix.map(row => row.reduce((a, b) => a + b, 0));
    const colTotals = matrix[0].map((_, j) => matrix.reduce((sum, row) => sum + row[j], 0));

    // Calculate observed and expected agreement
    let po = 0;
    let pe = 0;
    for (let i = 0; i < k; i++) {
        for (let j = 0; j < k; j++) {
            po += weightMatrix[i][j] * matrix[i][j];
            pe += weightMatrix[i][j] * (rowTotals[i] * colTotals[j]);
        }
    }
    po /= n;
    pe /= n * n;

    // Kappa formula
    if (pe === 1) return 1;
    return (po - pe) / (1 - pe);
}

/**
 * Build 5x5 confusion matrix for ESI levels
 */
function buildConfusionMatrix(aiLevels: number[], nurseLevels: number[]): number[][] {
    const matrix = Array.from({ length: 5 }, () => Array(5).fill(0));
    for (let i = 0; i < aiLevels.length; i++) {
        const aiIdx = aiLevels[i] - 1;
        const nurseIdx = nurseLevels[i] - 1;
        if (aiIdx >= 0 && aiIdx < 5 && nurseIdx >= 0 && nurseIdx < 5) {
            matrix[nurseIdx][aiIdx]++;
        }
    }
    return matrix;
}

/**
 * Calculate safety metrics (sensitivity, sub-triage rate)
 * 
 * For binary classification: CRITICAL (ESI 1-2) vs NON-CRITICAL (ESI 3-5)
 */
function calculateSafetyMetrics(aiLevels: number[], nurseLevels: number[]): {
    sensitivity: number;
    specificity: number;
    subtriage_rate: number;
} {
    let tp = 0; // True Positive: AI critical, Nurse critical
    let fp = 0; // False Positive: AI critical, Nurse non-critical
    let fn = 0; // False Negative: AI non-critical, Nurse critical (SUB-TRIAGE)
    let tn = 0; // True Negative: AI non-critical, Nurse non-critical

    for (let i = 0; i < aiLevels.length; i++) {
        const aiCritical = aiLevels[i] <= 2;
        const nurseCritical = nurseLevels[i] <= 2;

        if (aiCritical && nurseCritical) tp++;
        else if (aiCritical && !nurseCritical) fp++;
        else if (!aiCritical && nurseCritical) fn++;
        else tn++;
    }

    const sensitivity = (tp + fn) > 0 ? tp / (tp + fn) : 1;
    const specificity = (tn + fp) > 0 ? tn / (tn + fp) : 1;
    const subtriage_rate = (tp + fn) > 0 ? fn / (tp + fn) : 0;

    return { sensitivity, specificity, subtriage_rate };
}

export async function GET() {
    try {
        // Fetch validated records with both AI and nurse classifications
        const { data, error } = await supabase
            .from('clinical_records')
            .select('esi_level, nurse_esi_level')
            .eq('nurse_validated', true)
            .not('nurse_esi_level', 'is', null);

        if (error) {
            console.error('Supabase error:', error);
            return NextResponse.json(
                { success: false, error: 'Database query failed', details: error.message },
                { status: 500 }
            );
        }

        const records = (data as ValidationRecord[]) || [];

        if (records.length === 0) {
            return NextResponse.json({
                success: true,
                data: {
                    n_observations: 0,
                    message: 'No hay registros validados disponibles para calcular métricas',
                    confusion_matrix: Array.from({ length: 5 }, () => Array(5).fill(0)),
                },
            });
        }

        const aiLevels = records.map(r => r.esi_level);
        const nurseLevels = records.map(r => r.nurse_esi_level);

        // Calculate all metrics
        const kappaSimple = calculateKappa(aiLevels, nurseLevels, 'none');
        const kappaLinear = calculateKappa(aiLevels, nurseLevels, 'linear');
        const kappaQuadratic = calculateKappa(aiLevels, nurseLevels, 'quadratic');

        const agreementExact = aiLevels.filter((ai, i) => ai === nurseLevels[i]).length / aiLevels.length;
        const agreementAdjacent = aiLevels.filter((ai, i) => Math.abs(ai - nurseLevels[i]) <= 1).length / aiLevels.length;

        const safetyMetrics = calculateSafetyMetrics(aiLevels, nurseLevels);
        const confusionMatrix = buildConfusionMatrix(aiLevels, nurseLevels);

        const metrics: KappaMetrics = {
            kappa_simple: Number(kappaSimple.toFixed(3)),
            kappa_linear: Number(kappaLinear.toFixed(3)),
            kappa_quadratic: Number(kappaQuadratic.toFixed(3)),
            agreement_exact: Number((agreementExact * 100).toFixed(1)),
            agreement_adjacent: Number((agreementAdjacent * 100).toFixed(1)),
            sensitivity: Number((safetyMetrics.sensitivity * 100).toFixed(1)),
            specificity: Number((safetyMetrics.specificity * 100).toFixed(1)),
            subtriage_rate: Number((safetyMetrics.subtriage_rate * 100).toFixed(1)),
            n_observations: records.length,
            confusion_matrix: confusionMatrix,
            hypothesis_met: {
                kappa: kappaLinear >= 0.85,
                safety: safetyMetrics.subtriage_rate < 0.05,
            },
        };

        return NextResponse.json({
            success: true,
            data: metrics,
            interpretation: {
                kappa_linear: interpretKappa(kappaLinear),
                safety_status: safetyMetrics.subtriage_rate < 0.05 ? 'ACEPTABLE' : 'RIESGO_ALTO',
            },
        });

    } catch (error) {
        console.error('Kappa API Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to calculate metrics',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}

/**
 * Interpret Kappa value according to Landis & Koch (1977)
 */
function interpretKappa(kappa: number): string {
    if (kappa < 0) return 'Acuerdo peor que azar';
    if (kappa < 0.21) return 'Acuerdo leve';
    if (kappa < 0.41) return 'Acuerdo regular';
    if (kappa < 0.61) return 'Acuerdo moderado';
    if (kappa < 0.81) return 'Acuerdo sustancial';
    return 'Acuerdo casi perfecto';
}

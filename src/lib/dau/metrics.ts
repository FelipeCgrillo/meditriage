import type { DAUClassification, DAUOutcome } from '@/lib/dau/types';
import {
    mcnemarExact,
    pairedAucDeLong,
    pairedDifference,
    proportion,
    weightedKappa,
    type KappaResult,
    type PairedAucResult,
    type Proportion,
    type Interval,
} from '@/lib/stats';

/**
 * Métricas del estudio OE4 según el protocolo aprobado por el CEC
 * (respuesta al oficio OBS-E-319-02, "Precisiones metodológicas").
 *
 * ───────────────────────────────────────────────────────────────────────────
 * Criterio de referencia: el DESENLACE clínico (destino al egreso). Ni la
 * clasificación TENS ni la de la herramienta son estándar de oro.
 *
 *   Desenlace de alta gravedad: hospitalización, UPC, traslado a mayor
 *   complejidad o fallecimiento.
 *   Desenlace crítico: UPC o fallecimiento.
 *   Subtriage clínicamente relevante: desenlace crítico clasificado ESI 3 a 5,
 *   o desenlace de alta gravedad clasificado ESI 4 o 5.
 *   Identificación correcta de un caso de alta gravedad: ESI 1 a 3 (el
 *   complemento de la definición de subtriage para alta gravedad).
 *
 * Métrica principal: sensibilidad para el desenlace de alta gravedad,
 * comparada en forma pareada (McNemar) entre herramienta y TENS.
 * Secundarias: subtriage clínicamente relevante, AUC ROC del nivel ESI y
 * concordancia (kappa ponderado).
 *
 * Criterio de continuidad (a priori): sensibilidad ≥ 0,90 con límite
 * inferior del IC 95% ≥ 0,85, y subtriage clínicamente relevante de la
 * herramienta que no supere en más de 5 puntos porcentuales al del TENS.
 *
 * Función PURA: mismas clasificaciones, mismas métricas.
 * ───────────────────────────────────────────────────────────────────────────
 */

export const HIGH_SEVERITY_OUTCOMES: ReadonlySet<DAUOutcome> = new Set<DAUOutcome>([
    'hospitalizacion',
    'upc',
    'traslado',
    'fallecimiento',
]);
export const CRITICAL_OUTCOMES: ReadonlySet<DAUOutcome> = new Set<DAUOutcome>(['upc', 'fallecimiento']);

/** Umbrales del criterio de continuidad definido a priori. */
export const CONTINUITY_CRITERIA = {
    min_sensitivity: 0.9,
    min_sensitivity_ci_lower: 0.85,
    max_subtriage_excess: 0.05,
} as const;

/** Nivel ESI máximo que cuenta como identificación de un caso de alta gravedad. */
export const HIGH_SEVERITY_IDENTIFIED_MAX_ESI = 3;

export function isHighSeverity(outcome: DAUOutcome | null | undefined): boolean {
    return outcome != null && HIGH_SEVERITY_OUTCOMES.has(outcome);
}

export function isCritical(outcome: DAUOutcome | null | undefined): boolean {
    return outcome != null && CRITICAL_OUTCOMES.has(outcome);
}

/** Subtriage clínicamente relevante según la definición del protocolo. */
export function isRelevantSubtriage(esi: number, outcome: DAUOutcome | null | undefined): boolean {
    if (isCritical(outcome) && esi >= 3) return true;
    if (isHighSeverity(outcome) && esi >= 4) return true;
    return false;
}

/** Las seis combinaciones de la tabla de interpretación a priori. */
export type InterpretationCell =
    | 'coinciden_consistente'
    | 'coinciden_error_compartido'
    | 'herramienta_menor_alta_gravedad'
    | 'herramienta_menor_sin_alta_gravedad'
    | 'herramienta_mayor_alta_gravedad'
    | 'herramienta_mayor_sin_alta_gravedad';

export const INTERPRETATION_LABELS: Record<InterpretationCell, string> = {
    coinciden_consistente: 'Coinciden y el desenlace es consistente: el relato basta para ese tipo de consulta.',
    coinciden_error_compartido:
        'Coinciden y el desenlace es más grave: error compartido, atribuible a la información disponible o a la escala.',
    herramienta_menor_alta_gravedad:
        'Herramienta asigna menor urgencia y el desenlace es de alta gravedad: subtriage de la herramienta (señal de seguridad).',
    herramienta_menor_sin_alta_gravedad:
        'Herramienta asigna menor urgencia sin desenlace de alta gravedad: posible sobretriage del TENS.',
    herramienta_mayor_alta_gravedad:
        'Herramienta asigna mayor urgencia con desenlace de alta gravedad: posible subtriage del TENS advertido por la herramienta.',
    herramienta_mayor_sin_alta_gravedad:
        'Herramienta asigna mayor urgencia sin desenlace de alta gravedad: sobretriage de la herramienta (costo de eficiencia).',
};

export function interpretationCell(toolEsi: number, tensEsi: number, outcome: DAUOutcome): InterpretationCell {
    const high = isHighSeverity(outcome);
    if (toolEsi === tensEsi) {
        return isRelevantSubtriage(toolEsi, outcome) ? 'coinciden_error_compartido' : 'coinciden_consistente';
    }
    // ESI mayor = menor urgencia.
    if (toolEsi > tensEsi) return high ? 'herramienta_menor_alta_gravedad' : 'herramienta_menor_sin_alta_gravedad';
    return high ? 'herramienta_mayor_alta_gravedad' : 'herramienta_mayor_sin_alta_gravedad';
}

function isValidEsi(v: number | null | undefined): v is number {
    return v != null && Number.isInteger(v) && v >= 1 && v <= 5;
}

/** Fila mínima para el análisis pareado. */
interface PairedRow {
    tool: number;
    tens: number;
    outcome: DAUOutcome;
    high: boolean;
    critical: boolean;
}

export interface ComparisonBlock {
    /** Pares evaluables: ESI de herramienta, ESI TENS y desenlace presentes. */
    n_paired: number;
    n_high_severity: number;
    n_critical: number;
    sensitivity_tool: Proportion;
    sensitivity_tens: Proportion;
    /** Diferencia de sensibilidad (herramienta − TENS) en casos de alta gravedad. */
    sensitivity_difference: { estimate: number | null; ci: Interval | null };
    /** McNemar sobre casos de alta gravedad: b = solo herramienta identifica, c = solo TENS. */
    mcnemar: { b: number; c: number; p_value: number | null };
    /** Subtriage relevante sobre los casos de alta gravedad (denominador principal). */
    subtriage_tool: Proportion;
    subtriage_tens: Proportion;
    /** Subtriage relevante sobre todos los pares (denominador alternativo). */
    subtriage_tool_all: Proportion;
    subtriage_tens_all: Proportion;
    /** Exceso de subtriage de la herramienta sobre el TENS (puntos, escala 0..1). */
    subtriage_excess: { estimate: number | null; ci: Interval | null };
    /** AUC ROC del nivel ESI para predecir alta gravedad (herramienta = a, TENS = b). */
    auc: PairedAucResult;
    kappa_linear: KappaResult;
    kappa_quadratic: KappaResult;
    interpretation: Record<InterpretationCell, number>;
}

export interface ContinuityVerdict {
    meets: boolean | null;
    sensitivity_ok: boolean | null;
    ci_lower_ok: boolean | null;
    subtriage_ok: boolean | null;
    detail: string;
}

export interface StratumMetrics {
    key: string;
    n: number;
    n_high_severity: number;
    tool_identified: number;
    tens_identified: number;
    subtriage_tool: number;
    subtriage_tens: number;
}

export interface StudyMetrics {
    total: number;
    /** Registros sin ESI de la herramienta (error del modelo o needs_info). */
    missing_tool: number;
    model_errors: number;
    needs_info: number;
    missing_tens: number;
    missing_outcome: number;
    /** Análisis principal: sistema integrado (LLM + motor de reglas). */
    primary: ComparisonBlock;
    continuity: ContinuityVerdict;
    /** Ablación: ESI del LLM aislado, antes del motor de reglas. */
    ablation_llm: ComparisonBlock | null;
    /** Análisis de sensibilidad: excluye relatos con signos vitales retirados. */
    sensitivity_without_vitals: ComparisonBlock | null;
    n_vitals_removed: number;
    by_complaint: StratumMetrics[];
    by_sex: StratumMetrics[];
    by_age_group: StratumMetrics[];
    /** Relato suficiente frente a insuficiente (indicador que reemplaza a needs_info). */
    by_info: StratumMetrics[];
    n_insufficient_info: number;
}

function buildRows(results: DAUClassification[], pick: (r: DAUClassification) => number | null | undefined): PairedRow[] {
    const rows: PairedRow[] = [];
    for (const r of results) {
        const tool = pick(r);
        if (!isValidEsi(tool) || !isValidEsi(r.tens_esi) || r.outcome == null) continue;
        rows.push({
            tool,
            tens: r.tens_esi,
            outcome: r.outcome,
            high: isHighSeverity(r.outcome),
            critical: isCritical(r.outcome),
        });
    }
    return rows;
}

const identified = (esi: number) => esi <= HIGH_SEVERITY_IDENTIFIED_MAX_ESI;

export function compareBlock(rows: PairedRow[], options: { bootstrap?: number } = {}): ComparisonBlock {
    const high = rows.filter((r) => r.high);
    let toolHits = 0;
    let tensHits = 0;
    let b = 0;
    let c = 0;
    let subTool = 0;
    let subTens = 0;
    for (const r of high) {
        const t = identified(r.tool);
        const s = identified(r.tens);
        if (t) toolHits++;
        if (s) tensHits++;
        if (t && !s) b++;
        if (!t && s) c++;
        if (isRelevantSubtriage(r.tool, r.outcome)) subTool++;
        if (isRelevantSubtriage(r.tens, r.outcome)) subTens++;
    }
    // Pares discordantes del subtriage (para el IC de la diferencia).
    let onlyToolSub = 0;
    let onlyTensSub = 0;
    for (const r of high) {
        const a = isRelevantSubtriage(r.tool, r.outcome);
        const s = isRelevantSubtriage(r.tens, r.outcome);
        if (a && !s) onlyToolSub++;
        if (!a && s) onlyTensSub++;
    }

    const interpretation: Record<InterpretationCell, number> = {
        coinciden_consistente: 0,
        coinciden_error_compartido: 0,
        herramienta_menor_alta_gravedad: 0,
        herramienta_menor_sin_alta_gravedad: 0,
        herramienta_mayor_alta_gravedad: 0,
        herramienta_mayor_sin_alta_gravedad: 0,
    };
    for (const r of rows) interpretation[interpretationCell(r.tool, r.tens, r.outcome)]++;

    // Puntaje ROC: ESI invertido (ESI 1 = más grave = puntaje mayor).
    const auc = pairedAucDeLong(
        rows.map((r) => 6 - r.tool),
        rows.map((r) => 6 - r.tens),
        rows.map((r) => r.high),
    );

    const tools = rows.map((r) => r.tool);
    const tens = rows.map((r) => r.tens);
    const subAllTool = rows.filter((r) => isRelevantSubtriage(r.tool, r.outcome)).length;
    const subAllTens = rows.filter((r) => isRelevantSubtriage(r.tens, r.outcome)).length;

    return {
        n_paired: rows.length,
        n_high_severity: high.length,
        n_critical: rows.filter((r) => r.critical).length,
        sensitivity_tool: proportion(toolHits, high.length),
        sensitivity_tens: proportion(tensHits, high.length),
        sensitivity_difference: pairedDifference(b, c, high.length),
        mcnemar: mcnemarExact(b, c),
        subtriage_tool: proportion(subTool, high.length),
        subtriage_tens: proportion(subTens, high.length),
        subtriage_tool_all: proportion(subAllTool, rows.length),
        subtriage_tens_all: proportion(subAllTens, rows.length),
        subtriage_excess: pairedDifference(onlyToolSub, onlyTensSub, high.length),
        auc,
        kappa_linear: weightedKappa(tools, tens, { weights: 'linear', bootstrap: options.bootstrap }),
        kappa_quadratic: weightedKappa(tools, tens, { weights: 'quadratic', bootstrap: options.bootstrap }),
        interpretation,
    };
}

export function continuityVerdict(block: ComparisonBlock): ContinuityVerdict {
    const sens = block.sensitivity_tool.estimate;
    const lower = block.sensitivity_tool.wilson?.lower ?? null;
    const excess = block.subtriage_excess.estimate;
    if (sens == null || lower == null || excess == null) {
        return {
            meets: null,
            sensitivity_ok: null,
            ci_lower_ok: null,
            subtriage_ok: null,
            detail: 'Sin casos de alta gravedad evaluables: el criterio de continuidad queda indeterminado.',
        };
    }
    const sensitivity_ok = sens >= CONTINUITY_CRITERIA.min_sensitivity;
    const ci_lower_ok = lower >= CONTINUITY_CRITERIA.min_sensitivity_ci_lower;
    const subtriage_ok = excess <= CONTINUITY_CRITERIA.max_subtriage_excess;
    const meets = sensitivity_ok && ci_lower_ok && subtriage_ok;
    const pct = (v: number) => `${(v * 100).toFixed(1)} %`;
    return {
        meets,
        sensitivity_ok,
        ci_lower_ok,
        subtriage_ok,
        detail: `Sensibilidad ${pct(sens)} (mínimo 90 %), límite inferior Wilson ${pct(lower)} (mínimo 85 %), exceso de subtriage ${(excess * 100).toFixed(1)} puntos (máximo 5).`,
    };
}

function strata(results: DAUClassification[], keyOf: (r: DAUClassification) => string | null | undefined): StratumMetrics[] {
    const map = new Map<string, StratumMetrics>();
    for (const r of results) {
        if (!isValidEsi(r.predicted_esi) || !isValidEsi(r.tens_esi) || r.outcome == null) continue;
        const key = keyOf(r) || 'sin dato';
        const s = map.get(key) ?? {
            key,
            n: 0,
            n_high_severity: 0,
            tool_identified: 0,
            tens_identified: 0,
            subtriage_tool: 0,
            subtriage_tens: 0,
        };
        s.n++;
        if (isHighSeverity(r.outcome)) {
            s.n_high_severity++;
            if (identified(r.predicted_esi)) s.tool_identified++;
            if (identified(r.tens_esi)) s.tens_identified++;
            if (isRelevantSubtriage(r.predicted_esi, r.outcome)) s.subtriage_tool++;
            if (isRelevantSubtriage(r.tens_esi, r.outcome)) s.subtriage_tens++;
        }
        map.set(key, s);
    }
    return Array.from(map.values()).sort((a, b) => b.n_high_severity - a.n_high_severity || b.n - a.n || a.key.localeCompare(b.key));
}

/** Calcula todas las métricas del estudio sobre un lote clasificado. */
export function computeStudyMetrics(
    results: DAUClassification[],
    options: { bootstrap?: number } = {},
): StudyMetrics {
    const primaryRows = buildRows(results, (r) => r.predicted_esi);
    const primary = compareBlock(primaryRows, options);

    const hasLlm = results.some((r) => r.llm_esi != null);
    const ablation_llm = hasLlm ? compareBlock(buildRows(results, (r) => r.llm_esi), options) : null;

    const vitalsRemoved = results.filter((r) => r.vitals_removed).length;
    const sensitivity_without_vitals =
        vitalsRemoved > 0
            ? compareBlock(buildRows(results.filter((r) => !r.vitals_removed), (r) => r.predicted_esi), options)
            : null;

    return {
        total: results.length,
        missing_tool: results.filter((r) => !isValidEsi(r.predicted_esi)).length,
        model_errors: results.filter((r) => r.model_error).length,
        needs_info: results.filter((r) => r.status === 'needs_info').length,
        missing_tens: results.filter((r) => !isValidEsi(r.tens_esi)).length,
        missing_outcome: results.filter((r) => r.outcome == null).length,
        primary,
        continuity: continuityVerdict(primary),
        ablation_llm,
        sensitivity_without_vitals,
        n_vitals_removed: vitalsRemoved,
        by_complaint: strata(results, (r) => r.complaint_key),
        by_sex: strata(results, (r) => r.sex),
        by_age_group: strata(results, (r) => r.age_group),
        by_info: strata(results, (r) => (r.insufficient_info ? 'relato insuficiente' : 'relato suficiente')),
        n_insufficient_info: results.filter((r) => r.insufficient_info).length,
    };
}

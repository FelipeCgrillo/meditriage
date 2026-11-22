import { isCritical, isHighSeverity } from '@/lib/dau/metrics';
import { seededRandom } from '@/lib/stats';
import type { DAURecord } from '@/lib/dau/types';

/**
 * Muestreo del estudio.
 *
 * El oficio al CEC fija un tamaño de trabajo de unos 1.000 registros, con
 * muestreo aleatorio "cuando el volumen de registros elegibles lo permita" y la
 * condición de al menos 73 casos con desenlace de alta gravedad. Procesar el
 * archivo completo (cientos de miles de filas) excede lo aprobado y costaría
 * miles de dólares.
 *
 * Diseño:
 *   - Marco muestral: registros con motivo de consulta, categoría TENS y
 *     desenlace, sin registros de prueba y, por defecto, sin menores de 18 años.
 *   - Muestra aleatoria simple sin reemplazo, con semilla fija: reproducible.
 *   - Muestras ANIDADAS: la muestra de N+k registros contiene a la de N. Si el
 *     piloto no alcanza los 73 casos graves, se amplía sin perder lo procesado.
 */

export const SAMPLING_SEED = 20261117;
export const DEFAULT_SAMPLE_SIZE = 1250;
export const MIN_HIGH_SEVERITY = 73;

export interface FrameOptions {
    excludePediatric: boolean;
}

export interface FrameExclusions {
    sin_tens: number;
    sin_desenlace: number;
    registro_de_prueba: number;
    menores: number;
}

export interface Frame {
    records: DAURecord[];
    total_file: number;
    excluded: FrameExclusions;
}

function isTestRecord(r: DAURecord): boolean {
    const t = `${r.chief_complaint} ${r.reported_symptoms ?? ''}`
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '');
    return /\bdato(s)? de prueba\b|\bregistro de prueba\b|\bpaciente de prueba\b/.test(t);
}

/** Aplica los criterios de elegibilidad y cuenta lo excluido por cada motivo. */
export function buildFrame(records: DAURecord[], options: FrameOptions): Frame {
    const excluded: FrameExclusions = { sin_tens: 0, sin_desenlace: 0, registro_de_prueba: 0, menores: 0 };
    const out: DAURecord[] = [];
    for (const r of records) {
        if (isTestRecord(r)) {
            excluded.registro_de_prueba++;
            continue;
        }
        if (options.excludePediatric && r.age_group === 'Pediatric') {
            excluded.menores++;
            continue;
        }
        if (r.tens_esi == null) {
            excluded.sin_tens++;
            continue;
        }
        if (r.outcome == null) {
            excluded.sin_desenlace++;
            continue;
        }
        out.push(r);
    }
    return { records: out, total_file: records.length, excluded };
}

/**
 * Muestra aleatoria simple sin reemplazo, reproducible y anidada: Fisher-Yates
 * parcial con una secuencia aleatoria fija, de modo que los primeros n elementos
 * son los mismos para cualquier n.
 */
export function drawSample(frame: DAURecord[], n: number, seed: number = SAMPLING_SEED): DAURecord[] {
    const m = frame.length;
    const k = Math.min(Math.max(0, Math.floor(n)), m);
    const idx = Array.from({ length: m }, (_, i) => i);
    const rand = seededRandom(seed);
    for (let i = 0; i < k; i++) {
        const j = i + Math.floor(rand() * (m - i));
        [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    return idx.slice(0, k).map((i) => frame[i]);
}

export interface SampleSummary {
    n: number;
    high_severity: number;
    critical: number;
    by_outcome: Record<string, number>;
    meets_minimum: boolean;
}

export function summarizeRecords(records: DAURecord[]): SampleSummary {
    const by_outcome: Record<string, number> = {};
    let high = 0;
    let crit = 0;
    for (const r of records) {
        const o = r.outcome ?? 'sin_desenlace';
        by_outcome[o] = (by_outcome[o] ?? 0) + 1;
        if (isHighSeverity(r.outcome)) high++;
        if (isCritical(r.outcome)) crit++;
    }
    return { n: records.length, high_severity: high, critical: crit, by_outcome, meets_minimum: high >= MIN_HIGH_SEVERITY };
}

/**
 * Tamaño de muestra aproximado para alcanzar el mínimo de casos graves con una
 * prevalencia dada (margen del 15 % por la variabilidad del muestreo).
 */
export function suggestSampleSize(prevalence: number, minCases: number = MIN_HIGH_SEVERITY): number | null {
    if (!(prevalence > 0)) return null;
    return Math.ceil((minCases / prevalence) * 1.15);
}

/** Costo aproximado en dólares por registro con Claude Sonnet 5 y esfuerzo medio. */
export const APPROX_USD_PER_RECORD_LOW = 0.017;
export const APPROX_USD_PER_RECORD_HIGH = 0.04;

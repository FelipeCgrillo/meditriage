/**
 * Funciones estadísticas puras para el análisis del estudio OE4.
 *
 * Todas son deterministas: misma entrada, misma salida. El bootstrap usa un
 * generador pseudoaleatorio con semilla fija para que el resultado sea
 * reproducible y auditable.
 */

export const Z_975 = 1.959963984540054;

export interface Interval {
    lower: number;
    upper: number;
}

export interface Proportion {
    /** Casos favorables. */
    x: number;
    /** Denominador. */
    n: number;
    /** x / n, o null si n = 0. */
    estimate: number | null;
    /** IC 95% de Wilson (método principal del protocolo). */
    wilson: Interval | null;
    /** IC 95% exacto de Clopper-Pearson (sensibilidad). */
    clopper_pearson: Interval | null;
}

/** IC 95% de Wilson para una proporción binomial. */
export function wilsonInterval(x: number, n: number, z: number = Z_975): Interval | null {
    if (n <= 0) return null;
    const p = x / n;
    const z2 = z * z;
    const denom = 1 + z2 / n;
    const center = (p + z2 / (2 * n)) / denom;
    const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
    return { lower: Math.max(0, center - half), upper: Math.min(1, center + half) };
}

function logChoose(n: number, k: number): number {
    return logGamma(n + 1) - logGamma(k + 1) - logGamma(n - k + 1);
}

/** Aproximación de Lanczos para log Γ(x), x > 0. */
export function logGamma(x: number): number {
    const g = 7;
    const c = [
        0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
        -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
        1.5056327351493116e-7,
    ];
    if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
    x -= 1;
    let a = c[0];
    const t = x + g + 0.5;
    for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/** P(X ≤ k) para X ~ Binomial(n, p). */
export function binomialCdf(k: number, n: number, p: number): number {
    if (k < 0) return 0;
    if (k >= n) return 1;
    if (p <= 0) return 1;
    if (p >= 1) return 0;
    let sum = 0;
    for (let i = 0; i <= k; i++) {
        sum += Math.exp(logChoose(n, i) + i * Math.log(p) + (n - i) * Math.log(1 - p));
    }
    return Math.min(1, sum);
}

function bisect(f: (p: number) => number, target: number, increasing: boolean): number {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 100; i++) {
        const mid = (lo + hi) / 2;
        const v = f(mid);
        if ((v < target) === increasing) lo = mid;
        else hi = mid;
    }
    return (lo + hi) / 2;
}

/** IC 95% exacto de Clopper-Pearson. */
export function clopperPearsonInterval(x: number, n: number, alpha = 0.05): Interval | null {
    if (n <= 0) return null;
    // Límite inferior: p tal que P(X ≥ x | p) = α/2. Función creciente en p.
    const lower = x === 0 ? 0 : bisect((p) => 1 - binomialCdf(x - 1, n, p), alpha / 2, true);
    // Límite superior: p tal que P(X ≤ x | p) = α/2. Función decreciente en p.
    const upper = x === n ? 1 : bisect((p) => binomialCdf(x, n, p), alpha / 2, false);
    return { lower, upper };
}

export function proportion(x: number, n: number): Proportion {
    return {
        x,
        n,
        estimate: n > 0 ? x / n : null,
        wilson: wilsonInterval(x, n),
        clopper_pearson: clopperPearsonInterval(x, n),
    };
}

/**
 * Prueba exacta de McNemar (binomial bilateral sobre los pares discordantes).
 * b = casos en que solo A acierta, c = casos en que solo B acierta.
 */
export function mcnemarExact(b: number, c: number): { b: number; c: number; p_value: number | null } {
    const n = b + c;
    if (n === 0) return { b, c, p_value: null };
    const k = Math.min(b, c);
    const p = Math.min(1, 2 * binomialCdf(k, n, 0.5));
    return { b, c, p_value: p };
}

/**
 * Diferencia pareada de proporciones (A − B) con IC 95% de Wald para datos
 * pareados, sobre n pares con b = solo A y c = solo B.
 */
export function pairedDifference(b: number, c: number, n: number): { estimate: number | null; ci: Interval | null } {
    if (n <= 0) return { estimate: null, ci: null };
    const d = (b - c) / n;
    const se = Math.sqrt(Math.max(0, b + c - ((b - c) * (b - c)) / n)) / n;
    return { estimate: d, ci: { lower: d - Z_975 * se, upper: d + Z_975 * se } };
}

// ── AUC ROC con DeLong ────────────────────────────────────────────────────

function psi(x: number, y: number): number {
    if (x > y) return 1;
    if (x === y) return 0.5;
    return 0;
}

export interface AucResult {
    auc: number | null;
    se: number | null;
    ci: Interval | null;
    n_positive: number;
    n_negative: number;
}

export interface PairedAucResult {
    a: AucResult;
    b: AucResult;
    difference: number | null;
    ci: Interval | null;
    p_value: number | null;
}

/** Función de distribución normal estándar (Abramowitz y Stegun 7.1.26). */
export function normalCdf(z: number): number {
    const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
    const erf =
        1 -
        (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t) *
            Math.exp(-(z * z) / 2);
    return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}

/**
 * AUC de dos puntajes sobre los mismos casos, con varianzas y covarianza de
 * DeLong (1988). Puntaje mayor = más probable el desenlace positivo.
 */
export function pairedAucDeLong(scoresA: number[], scoresB: number[], positive: boolean[]): PairedAucResult {
    const posIdx: number[] = [];
    const negIdx: number[] = [];
    positive.forEach((p, i) => (p ? posIdx : negIdx).push(i));
    const m = posIdx.length;
    const n = negIdx.length;
    const empty = (): AucResult => ({ auc: null, se: null, ci: null, n_positive: m, n_negative: n });
    if (m < 2 || n < 2) return { a: empty(), b: empty(), difference: null, ci: null, p_value: null };

    const components = (s: number[]) => {
        const v10 = posIdx.map((i) => negIdx.reduce((acc, j) => acc + psi(s[i], s[j]), 0) / n);
        const v01 = negIdx.map((j) => posIdx.reduce((acc, i) => acc + psi(s[i], s[j]), 0) / m);
        const auc = v10.reduce((a, b) => a + b, 0) / m;
        return { v10, v01, auc };
    };
    const A = components(scoresA);
    const B = components(scoresB);
    const cov = (x: number[], y: number[], mx: number, my: number) =>
        x.reduce((acc, xi, k) => acc + (xi - mx) * (y[k] - my), 0) / (x.length - 1);

    const s10aa = cov(A.v10, A.v10, A.auc, A.auc);
    const s10bb = cov(B.v10, B.v10, B.auc, B.auc);
    const s10ab = cov(A.v10, B.v10, A.auc, B.auc);
    const s01aa = cov(A.v01, A.v01, A.auc, A.auc);
    const s01bb = cov(B.v01, B.v01, B.auc, B.auc);
    const s01ab = cov(A.v01, B.v01, A.auc, B.auc);

    const varA = s10aa / m + s01aa / n;
    const varB = s10bb / m + s01bb / n;
    const covAB = s10ab / m + s01ab / n;

    const build = (auc: number, v: number): AucResult => {
        const se = Math.sqrt(Math.max(0, v));
        return {
            auc,
            se,
            ci: { lower: Math.max(0, auc - Z_975 * se), upper: Math.min(1, auc + Z_975 * se) },
            n_positive: m,
            n_negative: n,
        };
    };
    const diff = A.auc - B.auc;
    const seDiff = Math.sqrt(Math.max(0, varA + varB - 2 * covAB));
    const p = seDiff > 0 ? 2 * (1 - normalCdf(Math.abs(diff) / seDiff)) : null;
    return {
        a: build(A.auc, varA),
        b: build(B.auc, varB),
        difference: diff,
        ci: { lower: diff - Z_975 * seDiff, upper: diff + Z_975 * seDiff },
        p_value: p,
    };
}

// ── Kappa ponderado ───────────────────────────────────────────────────────

export type KappaWeights = 'linear' | 'quadratic';

export interface KappaResult {
    weights: KappaWeights;
    kappa: number | null;
    /** EE asintótico de Fleiss, Cohen y Everitt (1969). */
    se: number | null;
    ci_asymptotic: Interval | null;
    ci_bootstrap: Interval | null;
    n: number;
}

function weightMatrix(k: number, type: KappaWeights): number[][] {
    return Array.from({ length: k }, (_, i) =>
        Array.from({ length: k }, (_, j) => {
            const d = Math.abs(i - j) / (k - 1);
            return type === 'linear' ? 1 - d : 1 - d * d;
        }),
    );
}

function kappaFromPairs(a: number[], b: number[], k: number, w: number[][]): { kappa: number | null; se: number | null } {
    const n = a.length;
    if (n === 0) return { kappa: null, se: null };
    const p = Array.from({ length: k }, () => new Array<number>(k).fill(0));
    for (let t = 0; t < n; t++) p[a[t] - 1][b[t] - 1] += 1 / n;
    const pr = p.map((row) => row.reduce((s, v) => s + v, 0));
    const pc = Array.from({ length: k }, (_, j) => p.reduce((s, row) => s + row[j], 0));
    let po = 0;
    let pe = 0;
    for (let i = 0; i < k; i++)
        for (let j = 0; j < k; j++) {
            po += w[i][j] * p[i][j];
            pe += w[i][j] * pr[i] * pc[j];
        }
    if (pe >= 1) return { kappa: null, se: null };
    const kappa = (po - pe) / (1 - pe);
    const wi = Array.from({ length: k }, (_, i) => pc.reduce((s, v, j) => s + v * w[i][j], 0));
    const wj = Array.from({ length: k }, (_, j) => pr.reduce((s, v, i) => s + v * w[i][j], 0));
    let sum = 0;
    for (let i = 0; i < k; i++)
        for (let j = 0; j < k; j++) {
            const term = w[i][j] - (wi[i] + wj[j]) * (1 - kappa);
            sum += p[i][j] * term * term;
        }
    const variance = (sum - Math.pow(kappa - pe * (1 - kappa), 2)) / (n * Math.pow(1 - pe, 2));
    return { kappa, se: Math.sqrt(Math.max(0, variance)) };
}

/** Generador pseudoaleatorio determinista (mulberry32). */
export function seededRandom(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function percentile(sorted: number[], q: number): number {
    const idx = (sorted.length - 1) * q;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/**
 * Kappa ponderado de Cohen para dos clasificaciones ordinales 1..k, con IC
 * asintótico y bootstrap percentil (semilla fija).
 */
export function weightedKappa(
    a: number[],
    b: number[],
    options: { k?: number; weights?: KappaWeights; bootstrap?: number; seed?: number } = {},
): KappaResult {
    const k = options.k ?? 5;
    const type = options.weights ?? 'linear';
    const w = weightMatrix(k, type);
    const n = a.length;
    const { kappa, se } = kappaFromPairs(a, b, k, w);
    let ciBoot: Interval | null = null;
    const reps = options.bootstrap ?? 2000;
    if (kappa != null && n > 1 && reps > 0) {
        const rand = seededRandom(options.seed ?? 20261117);
        const values: number[] = [];
        const ra = new Array<number>(n);
        const rb = new Array<number>(n);
        for (let r = 0; r < reps; r++) {
            for (let t = 0; t < n; t++) {
                const idx = Math.floor(rand() * n);
                ra[t] = a[idx];
                rb[t] = b[idx];
            }
            const kk = kappaFromPairs(ra, rb, k, w).kappa;
            if (kk != null) values.push(kk);
        }
        values.sort((x, y) => x - y);
        if (values.length > 0) ciBoot = { lower: percentile(values, 0.025), upper: percentile(values, 0.975) };
    }
    return {
        weights: type,
        kappa,
        se,
        ci_asymptotic: kappa != null && se != null ? { lower: kappa - Z_975 * se, upper: kappa + Z_975 * se } : null,
        ci_bootstrap: ciBoot,
        n,
    };
}

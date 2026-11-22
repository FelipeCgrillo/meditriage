/**
 * Normalizador de la salida JSON del modelo, previo a la validación con Zod.
 *
 * Sin salida estructurada con gramática (la API rechaza el esquema del CMD por
 * complejidad), el modelo puede escribir un valor equivalente pero distinto al
 * permitido: "adulto" en vez de "Adult", "8/10" en vez de 8, "alterado" en vez
 * de "anormal". Rechazar toda la respuesta por eso dejaba a un paciente con
 * dolor torácico sin clasificación.
 *
 * Política (determinista y conservadora):
 *   1. Se CORRIGEN las variantes de significado inequívoco.
 *   2. Lo que no se puede interpretar se DESCARTA solo en ese campo. Una
 *      variable descartada equivale a "no referida": el motor de reglas exige
 *      más información (chat) o asume negativo presunto (DAU), nunca asume
 *      "normal".
 *   3. Nunca se inventa un valor.
 * Devuelve la lista de campos corregidos o descartados para auditoría (solo
 * rutas, sin valores).
 */

export interface SanitizeResult {
    value: unknown;
    /** Rutas de campos corregidos ("~") o descartados ("-"). */
    repairs: string[];
}

function plain(v: unknown): string {
    return String(v ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[_\-]+/g, ' ')
        .trim();
}

/**
 * Variables cualitativas de signos. Principio del peor caso: un texto
 * descriptivo que no se reconoce ("severa", "muy rápida", "presente") se
 * interpreta como ANORMAL, nunca se descarta en silencio, porque descartarlo
 * borraría una posible señal de alarma. Las negaciones claras ("sin fiebre",
 * "ausente") valen como normal.
 */
function mapQualitative(v: unknown): string | undefined {
    if (v === true) return 'anormal';
    if (v === false) return 'normal';
    const s = plain(v);
    if (['no referido', 'no mencionado', 'no refiere', 'no informado', 'sin dato', 'desconocido', 'n/a', 'na', ''].includes(s))
        return 'no_referido';
    if (s === 'no sabe' || s === 'desconoce' || s === 'no sabe no responde') return 'no_sabe';
    if (s === 'normal' || s === 'sin alteracion' || s === 'estable') return 'normal';
    if (/^(no|sin|ausente|niega|negativ)/.test(s)) return 'normal';
    if (typeof v === 'string' || typeof v === 'number') return 'anormal';
    return undefined;
}

function mapOnset(v: unknown): string | undefined {
    const s = plain(v);
    if (['menos 1 hora', '1 6 horas', '6 24 horas', 'mas 24 horas', 'no referido'].includes(s)) return s.replace(/ /g, '_');
    if (/\bminuto|menos (de )?(una|1) hora|^recien|hace (poco|un rato)|ahora/.test(s)) return 'menos_1_hora';
    if (/(^|\D)(1|2|3|4|5|6)\s*(a|-|y)?\s*(2|3|4|5|6)?\s*horas?/.test(s) && !/24|dia|semana|mes/.test(s)) return '1_6_horas';
    if (/(6|7|8|9|10|12|18)\s*(a|-)?\s*(24)?\s*horas?|medio dia|esta manana|anoche/.test(s) && !/dia|semana|mes/.test(s)) return '6_24_horas';
    if (/mas (de )?24|\bdias?\b|semana|mes(es)?|cronic|ano/.test(s)) return 'mas_24_horas';
    if (/no (se )?(refiere|menciona|sabe)|desconoc/.test(s)) return 'no_referido';
    return undefined;
}

function mapAgeGroup(v: unknown): string | undefined {
    const s = plain(v);
    if (['pediatric', 'pediatrico', 'pediatrica', 'nino', 'nina', 'infantil', 'menor'].includes(s)) return 'Pediatric';
    if (['adult', 'adulto', 'adulta'].includes(s)) return 'Adult';
    if (['geriatric', 'geriatrico', 'geriatrica', 'adulto mayor', 'anciano', 'anciana', 'mayor'].includes(s)) return 'Geriatric';
    if (['no referido', 'no declarado', ''].includes(s)) return 'no_referido';
    return undefined;
}

function mapPregnancy(v: unknown): string | undefined {
    const s = plain(v);
    if (['embarazada', 'si', 'gestante'].includes(s)) return 'embarazada';
    if (['no embarazada', 'no'].includes(s)) return 'no_embarazada';
    if (['no aplica', 'n/a'].includes(s)) return 'no_aplica';
    if (s === 'no sabe') return 'no_sabe';
    if (['no referido', 'no mencionado', ''].includes(s)) return 'no_referido';
    return undefined;
}

function toNumber(v: unknown): number | undefined {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
        const m = v.replace(',', '.').match(/-?\d+(?:\.\d+)?/);
        if (m) return Number(m[0]);
    }
    return undefined;
}

function toBoolean(v: unknown): boolean | undefined {
    if (typeof v === 'boolean') return v;
    const s = plain(v);
    if (['true', 'si', 'verdadero'].includes(s)) return true;
    if (['false', 'no', 'falso'].includes(s)) return false;
    return undefined;
}

const QUALITATIVE_KEYS = [
    'vital_signs_abnormal',
    'oxygen_sat_reported',
    'heart_rate_reported',
    'respiratory_difficulty_reported',
    'bp_reported',
    'fever_reported',
    'consciousness_reported',
] as const;

const VITAL_RANGES: Record<string, [number, number]> = {
    oxygen_saturation_percent: [0, 100],
    heart_rate_bpm: [0, 400],
    respiratory_rate_rpm: [0, 120],
    systolic_bp_mmhg: [0, 400],
    temperature_celsius: [20, 45],
};

function sanitizeFeatures(raw: Record<string, unknown>, repairs: string[]): Record<string, unknown> {
    const out: Record<string, unknown> = { ...raw };
    const fix = (key: string, mapped: unknown) => {
        if (mapped === undefined) {
            delete out[key];
            repairs.push(`-extracted_features.${key}`);
        } else if (mapped !== raw[key]) {
            out[key] = mapped;
            repairs.push(`~extracted_features.${key}`);
        }
    };

    for (const k of QUALITATIVE_KEYS) if (k in raw) fix(k, mapQualitative(raw[k]));
    if ('symptom_onset' in raw) fix('symptom_onset', mapOnset(raw.symptom_onset));
    if ('age_group' in raw) fix('age_group', mapAgeGroup(raw.age_group));
    if ('pregnancy_status' in raw) fix('pregnancy_status', mapPregnancy(raw.pregnancy_status));

    if ('pain_severity' in raw) {
        const n = toNumber(raw.pain_severity);
        fix('pain_severity', n === undefined ? undefined : Math.min(10, Math.max(0, Math.round(n))));
    }
    if ('suicidal_ideation' in raw) fix('suicidal_ideation', toBoolean(raw.suicidal_ideation));

    for (const k of ['symptoms_description', 'symptom_location'] as const) {
        if (k in raw && typeof raw[k] !== 'string') fix(k, typeof raw[k] === 'number' ? String(raw[k]) : undefined);
    }
    for (const k of ['comorbidities', 'current_medications', 'allergies'] as const) {
        if (!(k in raw)) continue;
        const v = raw[k];
        if (Array.isArray(v)) fix(k, v.filter((x) => typeof x === 'string'));
        else if (typeof v === 'string') fix(k, v.trim() ? [v] : []);
        else fix(k, undefined);
    }

    if ('referred_vitals' in raw) {
        const rv = raw.referred_vitals;
        if (rv && typeof rv === 'object' && !Array.isArray(rv)) {
            const clean: Record<string, number> = {};
            for (const [k, [lo, hi]] of Object.entries(VITAL_RANGES)) {
                const n = toNumber((rv as Record<string, unknown>)[k]);
                if (n !== undefined && n >= lo && n <= hi) clean[k] = n;
                else if (k in (rv as object)) repairs.push(`-extracted_features.referred_vitals.${k}`);
            }
            out.referred_vitals = clean;
        } else {
            fix('referred_vitals', undefined);
        }
    }

    // Metadata que no corresponde al modelo.
    for (const k of ['consent_signed', 'anonymous_code']) {
        if (k in out) {
            delete out[k];
            repairs.push(`-extracted_features.${k}`);
        }
    }
    return out;
}

/** Normaliza el objeto devuelto por el modelo. Nunca lanza. */
export function sanitizeModelOutput(raw: unknown): SanitizeResult {
    const repairs: string[] = [];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { value: raw, repairs };
    const obj = { ...(raw as Record<string, unknown>) };

    // "suggested_action": "null" (texto) o null → ausente; el servidor lo reemplaza.
    if (obj.suggested_action === null || obj.suggested_action === 'null') delete obj.suggested_action;
    if (obj.esi_level != null && typeof obj.esi_level !== 'number') {
        const n = toNumber(obj.esi_level);
        if (n !== undefined && Number.isInteger(n) && n >= 1 && n <= 5) {
            obj.esi_level = n;
            repairs.push('~esi_level');
        }
    }
    if (obj.response_options != null && !Array.isArray(obj.response_options)) {
        delete obj.response_options;
        repairs.push('-response_options');
    }
    if (Array.isArray(obj.response_options)) {
        const opts = obj.response_options.filter((x) => typeof x === 'string').slice(0, 5);
        if (opts.length !== obj.response_options.length) repairs.push('~response_options');
        obj.response_options = opts;
    }
    if (obj.extracted_features && typeof obj.extracted_features === 'object' && !Array.isArray(obj.extracted_features)) {
        obj.extracted_features = sanitizeFeatures(obj.extracted_features as Record<string, unknown>, repairs);
    } else if (obj.extracted_features !== undefined) {
        delete obj.extracted_features;
        repairs.push('-extracted_features');
    }
    // Campos que completa solo el servidor.
    for (const k of ['matched_rule', 'rule_rationale', 'decision_source', 'disposition', 'llm_esi_level', 'llm_status']) {
        if (k in obj) {
            delete obj[k];
            repairs.push(`-${k}`);
        }
    }
    return { value: obj, repairs };
}

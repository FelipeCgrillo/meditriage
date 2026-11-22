/**
 * Detector automatizado de identificadores en el texto libre del DAU.
 *
 * Paso 2 del protocolo documentado y verificable de desidentificación
 * (respuesta al oficio OBS-E-319-02, observación 6). Reglas documentadas y
 * VERSIONADAS: cualquier cambio de una regla exige subir DEID_VERSION.
 *
 *   - Sustituye por marcadores: RUT, teléfonos, correos, direcciones, fechas
 *     exactas, horas, nombres y apellidos precedidos de tratamiento o
 *     parentesco, grados, unidades y nombres de establecimientos.
 *   - Retira del relato los valores de signos vitales y las cláusulas con
 *     observaciones del examinador, y marca el registro (vitals_removed)
 *     para el análisis de sensibilidad.
 *   - Señala para revisión manual las palabras con mayúscula inicial en
 *     medio de una oración (posibles nombres que ninguna regla cubre).
 *
 * Función PURA y determinista. Corre en el navegador ANTES de enviar nada
 * al servidor, y el servidor la vuelve a aplicar como defensa en
 * profundidad (es idempotente sobre su propia salida).
 */

export const DEID_VERSION = '2026.11-v2';

export type DeidCategory =
    | 'rut'
    | 'correo'
    | 'telefono'
    | 'fecha'
    | 'hora'
    | 'direccion'
    | 'nombre'
    | 'grado'
    | 'unidad'
    | 'establecimiento'
    | 'signo_vital'
    | 'observacion_examinador';

export interface DeidResult {
    /** Texto desidentificado: es lo único que puede llegar al modelo. */
    text: string;
    /** Cantidad de sustituciones por categoría. */
    hits: Partial<Record<DeidCategory, number>>;
    /** true si se retiraron valores de signos vitales. */
    vitals_removed: boolean;
    /** true si se retiraron observaciones del examinador. */
    observations_removed: boolean;
    /** Palabras que la revisión manual debe confirmar (posibles nombres). */
    review_flags: string[];
    version: string;
}

interface Rule {
    category: DeidCategory;
    pattern: RegExp;
    replacement: string;
    /** Si devuelve false, la coincidencia se conserva (falso positivo evidente). */
    guard?: (match: string, firstName: string | undefined) => boolean;
    /**
     * Recorta la cola de la coincidencia desde la primera palabra común
     * (p. ej. "HOSPITAL SAN JOSE POR DOLOR" conserva "POR DOLOR").
     */
    trimTail?: boolean;
}

/** Palabras clínicas o verbos frecuentes en el DAU que no son nombres propios. */
const NOT_A_NAME = new Set(
    [
        'refiere', 'consulta', 'presenta', 'acude', 'ingresa', 'llega', 'trae', 'traido', 'traida', 'derivado',
        'derivada', 'dolor', 'con', 'sin', 'de', 'del', 'por', 'desde', 'hace', 'que', 'cuadro', 'inicio', 'tos',
        'fiebre', 'vomitos', 'diarrea', 'cefalea', 'mareo', 'sangrado', 'herida', 'caida', 'golpe', 'dificultad',
        'y', 'en', 'el', 'la', 'los', 'las', 'al', 'a', 'se', 'no', 'muy', 'mas', 'tipo', 'post', 'tras',
    ],
);

function plain(word: string | undefined): string {
    return (word ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Patrón insensible a mayúsculas para una palabra, sin afectar al resto del regex. */
function ci(word: string): string {
    return word
        .split('')
        .map((ch) => {
            const lo = ch.toLowerCase();
            const up = ch.toUpperCase();
            return lo !== up ? `[${lo}${up}]` : ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        })
        .join('');
}

const RANKS = [
    'soldado', 'sldo.', 'cabo', 'cbo.', 'sargento', 'sgto.', 'suboficial', 'subof.', 'subteniente', 'stte.',
    'teniente coronel', 'teniente', 'tte.', 'capitán', 'capitan', 'cap.', 'mayor', 'my.', 'tcl.', 'coronel',
    'crl.', 'general', 'gral.', 'comandante', 'cdte.', 'alférez', 'alferez', 'cadete', 'carabinero',
];
const HONORIFICS = ['sr.', 'sra.', 'srta.', 'sr', 'sra', 'srta', 'don', 'doña', 'dr.', 'dra.', 'dr', 'dra', 'señor', 'señora'];
const UNITS = [
    'regimiento', 'rgto.', 'brigada', 'batallón', 'batallon', 'división', 'division', 'escuela militar',
    'escuela de suboficiales', 'guarnición', 'guarnicion', 'destacamento', 'cuartel', 'comandancia', 'ejército',
    'ejercito', 'armada', 'fuerza aérea', 'fuerza aerea', 'fach', 'carabineros', 'pdi', 'gendarmería', 'gendarmeria',
];
const FACILITIES = [
    'hospital militar', 'hospital', 'hosp.', 'clínica', 'clinica', 'cesfam', 'cecosf', 'sapu', 'sar', 'consultorio',
    'posta', 'centro médico', 'centro medico', 'mutual', 'achs', 'ist', 'hms', 'hosmil',
];
const RELATIONS = ['paciente', 'pcte.', 'hijo', 'hija', 'esposo', 'esposa', 'madre', 'padre', 'hermano', 'hermana', 'familiar'];
/** Nombre en formato título (Juan), no en mayúsculas sostenidas. */
const TITLE = '[A-ZÁÉÍÓÚÑ][a-záéíóúüñ]+';

const W = '[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]';
/** Palabra con mayúscula inicial (nombre propio probable). */
const CAP = `[A-ZÁÉÍÓÚÑ]${W}+`;

/**
 * Reglas de sustitución, en orden de aplicación. Las más específicas van
 * primero para que una regla general no consuma parte de otra.
 */
const RULES: Rule[] = [
    { category: 'correo', pattern: /\b[\w.%+-]+@[\w.-]+\.[a-z]{2,}\b/gi, replacement: '[CORREO]' },
    { category: 'rut', pattern: /\b\d{1,2}\.?\d{3}\.?\d{3}\s?-\s?[\dkK]\b/g, replacement: '[RUT]' },
    {
        category: 'telefono',
        pattern: /(?:\+?56[\s-]?)?(?:\b9[\s-]?\d{4}[\s-]?\d{4}\b|\b2[\s-]?\d{4}[\s-]?\d{4}\b)/g,
        replacement: '[TELEFONO]',
    },
    {
        category: 'fecha',
        pattern:
            /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b\d{1,2}\s+de\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s+de(?:l)?\s+\d{4})?\b/gi,
        replacement: '[FECHA]',
    },
    { category: 'hora', pattern: /\b(?:[01]?\d|2[0-3])[:.h][0-5]\d\s?(?:hrs?|horas)?\b/gi, replacement: '[HORA]' },
    {
        category: 'direccion',
        pattern: new RegExp(
            `\\b(?:calle|avenida|av\\.|pasaje|psje\\.?|villa|poblaci[oó]n|pobl\\.|condominio|block|depto\\.?|departamento|camino)\\s+(?:${W}+\\s+){0,4}?(?:#\\s?)?\\d+[A-Za-z]?`,
            'gi',
        ),
        replacement: '[DIRECCION]',
    },
    {
        category: 'grado',
        // Grados militares y policiales (abreviados o completos) seguidos del nombre.
        pattern: new RegExp(
            `(?<![A-Za-zÁÉÍÓÚÑáéíóúñ])(?:${RANKS.map(ci).join('|')})(?:\\s+(?:1[°º]|2[°º]|primero|segundo))?\\s+(${CAP})(?:\\s+${CAP}){0,2}`,
            'g',
        ),
        replacement: '[GRADO]',
        guard: (_m, first) => !NOT_A_NAME.has(plain(first)),
    },
    {
        category: 'unidad',
        pattern: new RegExp(
            `(?<![A-Za-zÁÉÍÓÚÑáéíóúñ])(?:${UNITS.map(ci).join('|')})(?![A-Za-zÁÉÍÓÚÑáéíóúñ])(?:\\s+(?:N[°º]?\\s?\\d+|\\d+|${CAP}|de|del|la|el)){0,5}`,
            'g',
        ),
        replacement: '[UNIDAD]',
        trimTail: true,
    },
    {
        category: 'establecimiento',
        pattern: new RegExp(
            `(?<![A-Za-zÁÉÍÓÚÑáéíóúñ])(?:${FACILITIES.map(ci).join('|')})(?![A-Za-zÁÉÍÓÚÑáéíóúñ])(?:\\s+(?:${CAP}|de|del|la|el|\\d+)){0,5}`,
            'g',
        ),
        replacement: '[ESTABLECIMIENTO]',
        trimTail: true,
    },
    {
        category: 'nombre',
        // Tratamiento (Sr., Dra., Don) seguido de uno a tres nombres propios.
        pattern: new RegExp(
            `(?<![A-Za-zÁÉÍÓÚÑáéíóúñ])(?:${HONORIFICS.map(ci).join('|')})\\s+(${CAP})(?:\\s+${CAP}){0,2}`,
            'g',
        ),
        replacement: '[NOMBRE]',
        guard: (_m, first) => !NOT_A_NAME.has(plain(first)),
    },
    {
        category: 'nombre',
        // Parentesco o "paciente" seguido de un nombre en formato título.
        pattern: new RegExp(
            `(?<![A-Za-zÁÉÍÓÚÑáéíóúñ])(?:${RELATIONS.map(ci).join('|')})\\s+(${TITLE})(?:\\s+${TITLE}){0,2}`,
            'g',
        ),
        replacement: '[NOMBRE]',
        guard: (_m, first) => !NOT_A_NAME.has(plain(first)),
    },
];

/** Valores de signos vitales: se retiran del relato. */
const VITAL_PATTERNS: RegExp[] = [
    /\b(?:pa|p\/a|presi[oó]n(?: arterial)?)\s*:?\s*\d{2,3}\s*\/\s*\d{2,3}(?:\s*mm\s?hg)?/gi,
    /\b\d{2,3}\s*\/\s*\d{2,3}\s*mm\s?hg/gi,
    /\b(?:fc|frecuencia card[ií]aca|pulso)\s*:?\s*\d{2,3}(?:\s*(?:lpm|x'|x\s?min))?/gi,
    /\b(?:fr|frecuencia respiratoria)\s*:?\s*\d{1,2}(?:\s*(?:rpm|x'|x\s?min))?/gi,
    /\b(?:sat(?:uraci[oó]n)?(?:\s*o2)?|spo2|sato2)\s*:?\s*\d{2,3}\s*%?/gi,
    /\b(?:t[°º]|temp(?:eratura)?(?:\s*axilar)?)\s*:?\s*\d{2}(?:[.,]\d)?\s*(?:[°º]\s?c?)?(?:\s*(?:axilar|rectal|oral|timp[aá]nica))?/gi,
    /\b(?:hgt|glicemia|hemoglucotest)\s*:?\s*\d{2,3}(?:\s*mg\/dl)?/gi,
    /\b(?:eva|ena)\s*:?\s*\d{1,2}(?:\s*\/\s*10)?/gi,
    /\b(?:glasgow|gcs)\s*:?\s*\d{1,2}/gi,
    /\b\d{2,3}\s*(?:lpm|rpm|mm\s?hg|mg\/dl)\b/gi,
];

/** Marcadores de observación del examinador: la cláusula completa se retira. */
const OBSERVATION_MARKERS =
    /\b(?:al examen|examen f[ií]sico|se observa|impresiona|a la inspecci[oó]n|a la palpaci[oó]n|a la auscultaci[oó]n|hemodin[aá]micamente|vigil|l[uú]cido|orientad[oa] en|p[aá]lid[oa]|sudoros[oa]|cian[oó]tic[oa]|taquic[aá]rdic[oa]|taquipneic[oa]|bien perfundid[oa]|mal perfundid[oa]|facie)\b/i;

/** Palabras con mayúscula que se aceptan sin revisión (siglas clínicas comunes). */
const CAPITALIZED_ALLOWLIST = new Set(
    ['Covid', 'Tec', 'Hta', 'Dm', 'Dm2', 'Epoc', 'Iam', 'Acv', 'Itu', 'Ira', 'Erc', 'Tbc', 'Vih', 'Sbo', 'Ecg', 'Rx', 'Tac']
        .map((w) => w.toLowerCase()),
);

function countAndReplace(
    text: string,
    re: RegExp,
    replacement: string,
    guard?: Rule['guard'],
    trimTail?: boolean,
): { text: string; count: number } {
    let count = 0;
    const out = text.replace(re, (match: string, first?: unknown) => {
        if (guard && !guard(match, typeof first === 'string' ? first : undefined)) return match;
        count++;
        if (!trimTail) return replacement;
        return replacement + keptTail(match);
    });
    return { text: out, count };
}

const CONNECTORS = new Set(['de', 'del', 'la', 'el']);

/**
 * Devuelve la parte final de una coincidencia que NO pertenece al nombre del
 * establecimiento o la unidad: desde la primera palabra común en adelante,
 * incluidos los conectores que la anteceden.
 */
function keptTail(match: string): string {
    // Palabras en índices pares, separadores en índices impares.
    const tokens = match.split(/(\s+)/);
    // `cut` es el índice de la primera palabra que se conserva. Si ninguna
    // palabra común aparece, apunta a una palabra virtual tras el final.
    let cut = tokens.length + 1;
    for (let i = 2; i < tokens.length; i += 2) {
        const w = plain(tokens[i]);
        if (NOT_A_NAME.has(w) && !CONNECTORS.has(w)) {
            cut = i;
            break;
        }
    }
    // Retroceder sobre conectores que anteceden al corte (o al final).
    while (cut > 2 && CONNECTORS.has(plain(tokens[cut - 2]))) cut -= 2;
    return cut > tokens.length ? '' : tokens.slice(cut - 1).join('');
}

function removeObservationClauses(text: string): { text: string; count: number } {
    let count = 0;
    const parts = text.split(/([.;\n]+)/);
    const kept: string[] = [];
    for (let i = 0; i < parts.length; i += 2) {
        const clause = parts[i] ?? '';
        const sep = parts[i + 1] ?? '';
        if (OBSERVATION_MARKERS.test(clause)) {
            count++;
            continue;
        }
        kept.push(clause + sep);
    }
    return { text: kept.join(''), count };
}

function findReviewFlags(text: string): string[] {
    // En texto mayoritariamente en mayúsculas la heurística no aplica.
    const letters = text.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, '');
    const upper = letters.replace(/[^A-ZÁÉÍÓÚÑ]/g, '').length;
    if (letters.length > 0 && upper / letters.length > 0.6) return [];

    const flags = new Set<string>();
    const sentences = text.split(/[.;:!?\n]+/);
    for (const sentence of sentences) {
        const tokens = sentence.trim().split(/\s+/).filter(Boolean);
        tokens.forEach((tok, idx) => {
            if (idx === 0) return;
            const clean = tok.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, '');
            if (!/^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+$/.test(clean)) return;
            if (CAPITALIZED_ALLOWLIST.has(clean.toLowerCase())) return;
            flags.add(clean);
        });
    }
    return Array.from(flags);
}

/** Desidentifica un texto libre del DAU. */
export function deidentifyText(input: string | null | undefined): DeidResult {
    const hits: Partial<Record<DeidCategory, number>> = {};
    const add = (cat: DeidCategory, n: number) => {
        if (n > 0) hits[cat] = (hits[cat] ?? 0) + n;
    };
    let text = (input ?? '').normalize('NFC');

    // 1) Observaciones del examinador: se retira la cláusula completa.
    const obs = removeObservationClauses(text);
    text = obs.text;
    add('observacion_examinador', obs.count);

    // 2) Signos vitales: se retira el valor.
    let vitals = 0;
    for (const re of VITAL_PATTERNS) {
        const r = countAndReplace(text, re, '');
        text = r.text;
        vitals += r.count;
    }
    add('signo_vital', vitals);

    // 3) Identificadores: sustitución por marcadores.
    for (const rule of RULES) {
        const r = countAndReplace(text, rule.pattern, rule.replacement, rule.guard, rule.trimTail);
        text = r.text;
        add(rule.category, r.count);
    }

    // Limpieza de espacios y puntuación huérfana tras los retiros.
    text = text
        .replace(/\s+([,.;:])/g, '$1')
        .replace(/([.;])(?:\s*[.;,])+/g, '$1')
        .replace(/([,;:])\s*(?=[,;:.])/g, '')
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/^[\s,.;:]+/, '')
        .trim();

    return {
        text,
        hits,
        vitals_removed: vitals > 0,
        observations_removed: obs.count > 0,
        review_flags: findReviewFlags(text),
        version: DEID_VERSION,
    };
}

/** Clave de estratificación por motivo de consulta (texto ya desidentificado). */
export function complaintKey(deidentifiedComplaint: string): string {
    return deidentifiedComplaint
        // "ref/", "Ref.", "REF" o "refiere": abreviatura del TENS, sin contenido clínico.
        .replace(/^\s*(?:refiere|ref)\b[\s/.:]*/i, '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9ñ\s[\]]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 60);
}

/**
 * Categorías de motivo de consulta para el análisis estratificado del estudio
 * (oficio CEC: "identificar los motivos de consulta en que el relato basta y
 * aquellos en que la evaluación presencial es indispensable").
 *
 * Lista cerrada y fijada a priori. El modelo asigna una categoría usando solo
 * el texto del relato. Agrupar por el texto exacto produce cientos de grupos
 * de uno o dos casos con 1.500 registros, sin poder interpretativo.
 *
 * Cambiar esta lista cambia el análisis: versionar con CATEGORIES_VERSION.
 */

export const CATEGORIES_VERSION = '2026.11-c1';

export const COMPLAINT_CATEGORIES = [
    'dolor_toracico_cardiovascular',
    'respiratorio',
    'abdominal_digestivo',
    'genitourinario',
    'traumatologico_musculoesqueletico',
    'neurologico',
    'orl_oftalmologico',
    'dental',
    'piel_partes_blandas',
    'psiquiatrico_conducta',
    'fiebre_infeccioso_general',
    'otros',
] as const;

export type ComplaintCategory = (typeof COMPLAINT_CATEGORIES)[number];

function plain(v: unknown): string {
    return String(v ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

const CATEGORY_SET = new Set<string>(COMPLAINT_CATEGORIES);

/**
 * Normaliza lo que devuelve el modelo a la lista cerrada. Acepta la clave
 * exacta o una variante razonable. Lo que no se reconoce pasa a "otros".
 */
export function normalizeComplaintCategory(value: unknown): ComplaintCategory | null {
    if (value == null) return null;
    const raw = String(value).trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (CATEGORY_SET.has(raw)) return raw as ComplaintCategory;
    const s = plain(value);
    if (!s) return null;
    if (/toraci|pecho|cardio|corazon|palpit/.test(s)) return 'dolor_toracico_cardiovascular';
    if (/respirat|asma|disnea|tos\b|pulmon/.test(s)) return 'respiratorio';
    if (/abdom|digest|gastro|estomac|vomit|diarrea|nausea/.test(s)) return 'abdominal_digestivo';
    if (/genito|urin|orina|prostat|renal|ginec/.test(s)) return 'genitourinario';
    if (/trauma|muscul|esguince|fractura|lumbar|rodilla|torsion|dolor osteo/.test(s)) return 'traumatologico_musculoesqueletico';
    if (/neuro|cefalea|mareo|convuls|vertigo/.test(s)) return 'neurologico';
    if (/orl|oido|garganta|nariz|oftalm|ojo|visual/.test(s)) return 'orl_oftalmologico';
    if (/dental|diente|muela/.test(s)) return 'dental';
    if (/piel|herida|absceso|partes blandas|quemadura/.test(s)) return 'piel_partes_blandas';
    if (/psiqui|conducta|ansiedad|suicid|animo/.test(s)) return 'psiquiatrico_conducta';
    if (/fiebre|infecc|general/.test(s)) return 'fiebre_infeccioso_general';
    return 'otros';
}

/** Cantidad de palabras de contenido del relato, sin la abreviatura "ref" del TENS. */
export function contentWordCount(text: string | null | undefined): number {
    const cleaned = String(text ?? '')
        .replace(/\[[A-Z_]+\]/g, ' ')
        .replace(/^\s*(?:refiere|ref)\b[\s/.:]*/i, '')
        .replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9\s]/g, ' ');
    return cleaned.split(/\s+/).filter(Boolean).length;
}

/**
 * Tramos de longitud del relato, fijados a priori para que el análisis no
 * dependa de la distribución observada.
 */
export function textLengthBin(words: number | null | undefined): string {
    const w = words ?? 0;
    if (w <= 2) return '1 a 2 palabras';
    if (w <= 4) return '3 a 4 palabras';
    return '5 o más palabras';
}

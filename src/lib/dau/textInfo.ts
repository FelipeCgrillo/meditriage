/**
 * Riqueza informativa del motivo de consulta.
 *
 * El texto libre del DAU suele ser muy breve ("ref/ malestar", "ingresa").
 * Para que el análisis tenga sentido, el marco muestral exige un mínimo de
 * "palabras específicas": las que no son conectores ni términos genéricos.
 * El criterio depende solo del texto, nunca del desenlace, de modo que no
 * introduce circularidad. Cambiar esta lista cambia el análisis: versionar
 * con TEXT_INFO_VERSION (queda en la huella del protocolo).
 */
export const TEXT_INFO_VERSION = '2026.11-t1';

/** Mínimo de palabras específicas del marco principal (decisión del investigador, 25-11-2026). */
export const MIN_SPECIFIC_WORDS = 3;

/** Tamaño por defecto del estrato de texto pobre (1 a 2 palabras específicas). */
export const DEFAULT_POOR_STRATUM_SIZE = 100;

const CONNECTORS = new Set(['de', 'la', 'el', 'en', 'y', 'a', 'con', 'por', 'para', 'sin', 'que', 'del', 'al', 'los', 'las', 'un', 'una', 'se', 'su', 'lo', 'o', 'e']);

const GENERIC = new Set([
    'ref', 'refiere', 'refiero', 'malestar', 'molestia', 'molestias', 'problema', 'problemas', 'general', 'ingresa', 'ingreso',
    'consulta', 'consultas', '2da', '1era', 'segunda', 'primera', 'derivado', 'derivada', 'derivados', 'indica', 'indican',
    'interconsulta', 'pacte', 'paciente', 'pcte', 'sintomas', 'sintoma', 'estado', 'cuadro', 'control', 'controles',
    'descompensado', 'descompensada', 'solicita', 'solicitud', 'por', 'dr', 'dra',
]);

export type TextInfoClass = 'informativo' | 'pobre' | 'sin_contenido';

function norm(text: string): string {
    return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function specificWordCount(text: string | null | undefined): number {
    if (!text) return 0;
    const words = norm(text).match(/[a-zñ0-9]{3,}/g) ?? [];
    return words.filter((w) => !CONNECTORS.has(w) && !GENERIC.has(w)).length;
}

/** informativo: 3 o más palabras específicas. pobre: 1 o 2. sin_contenido: ninguna. */
export function textInfoClass(text: string | null | undefined, min: number = MIN_SPECIFIC_WORDS): TextInfoClass {
    const k = specificWordCount(text);
    if (k >= min) return 'informativo';
    return k >= 1 ? 'pobre' : 'sin_contenido';
}

/**
 * Coincidencia de términos clínicos en texto libre con manejo de negación.
 *
 * Las reglas del motor (rules.ts) buscan raíces como "pecho" o "convuls" en
 * el relato. Una búsqueda por subcadena simple dispara también con frases
 * negadas ("sin dolor de pecho", "niega convulsiones"), lo que infla el
 * sobretriage y distorsiona las métricas del estudio. Este helper exige que
 * la mención sea AFIRMADA dentro de su cláusula.
 *
 * Criterio (determinista, versionado junto a las reglas):
 *   1. El texto se normaliza (minúsculas, sin tildes).
 *   2. Se divide en cláusulas por signos de puntuación, saltos de línea y
 *      conjunciones adversativas ("pero", "aunque", "sino").
 *   3. Una mención cuenta si NINGUNA de las NEGATION_WINDOW palabras previas,
 *      dentro de la misma cláusula, es un negador.
 *
 * Es una heurística conservadora del tipo NegEx simplificado. Ante dos
 * menciones, basta una afirmada para disparar (principio del peor caso).
 */

const NEGATORS = new Set([
    'no',
    'sin',
    'niega',
    'niegan',
    'nego',
    'descarta',
    'descartado',
    'descartada',
    'ni',
    'nunca',
    'tampoco',
    'ausencia',
    'ausente',
    'negativo',
    'negativa',
]);

/** Cantidad de palabras previas que se revisan en busca de un negador. */
export const NEGATION_WINDOW = 4;

/** Minúsculas y sin tildes, para comparar raíces de forma estable. */
export function normalizeClinicalText(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '');
}

function splitClauses(normalized: string): string[] {
    return normalized
        .split(/[.;:,!?¡¿\n()]+|\s(?:pero|aunque|sino)\s/)
        .map((c) => c.trim())
        .filter((c) => c.length > 0);
}

function escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * ¿El texto menciona en forma afirmada alguna de las raíces indicadas?
 * Las raíces se comparan al inicio de palabra ("convuls" calza con
 * "convulsiones" y "convulsionó").
 */
export function mentionsAffirmed(text: string | null | undefined, stems: string[]): boolean {
    if (!text) return false;
    const clauses = splitClauses(normalizeClinicalText(text));
    for (const stem of stems) {
        const re = new RegExp(`(^|[^a-z0-9ñ])${escapeRegExp(normalizeClinicalText(stem))}`, 'g');
        for (const clause of clauses) {
            re.lastIndex = 0;
            let m: RegExpExecArray | null;
            while ((m = re.exec(clause)) !== null) {
                const start = m.index + m[1].length;
                const before = clause.slice(0, start).split(/\s+/).filter(Boolean);
                const window = before.slice(-NEGATION_WINDOW);
                if (!window.some((w) => NEGATORS.has(w))) return true;
            }
        }
    }
    return false;
}

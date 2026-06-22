import type { DAUClassification, DAUSummary, ConfusionMatrix } from '@/lib/dau/types';

/**
 * Agregación del lote DAU: concordancia simple y matriz de confusión 5x5.
 *
 * Función PURA: misma lista de clasificaciones → mismo resumen. No depende de
 * red, reloj ni azar. Solo cuenta sobre los campos `predicted_esi` y
 * `nurse_esi` ya presentes en cada `DAUClassification`.
 */

/** Crea una matriz 5x5 de ceros (filas = predicho 1..5, cols = enfermera 1..5). */
function emptyMatrix(): ConfusionMatrix {
    return Array.from({ length: 5 }, () => new Array<number>(5).fill(0));
}

/** True si el valor es un ESI entero válido 1..5. */
function isValidEsi(value: number | null | undefined): value is number {
    return value != null && Number.isInteger(value) && value >= 1 && value <= 5;
}

/**
 * Resume las clasificaciones del lote:
 *   - total, classified (success con predicted_esi), needs_info.
 *   - with_gold_standard (nurse_esi presente).
 *   - comparable (predicted_esi y nurse_esi ambos válidos 1..5).
 *   - agreements (predicted_esi === nurse_esi entre los comparables).
 *   - simple_agreement = agreements / comparable (null si comparable === 0).
 *   - confusion_matrix[p-1][n-1]: casos con predicho=p, enfermera=n.
 */
export function summarizeDAU(results: DAUClassification[]): DAUSummary {
    const matrix = emptyMatrix();

    let classified = 0;
    let needsInfo = 0;
    let withGold = 0;
    let comparable = 0;
    let agreements = 0;

    for (const r of results) {
        if (r.status === 'success' && isValidEsi(r.predicted_esi)) {
            classified++;
        }
        if (r.status === 'needs_info') {
            needsInfo++;
        }
        if (isValidEsi(r.nurse_esi)) {
            withGold++;
        }
        if (isValidEsi(r.predicted_esi) && isValidEsi(r.nurse_esi)) {
            comparable++;
            matrix[r.predicted_esi - 1][r.nurse_esi - 1]++;
            if (r.predicted_esi === r.nurse_esi) {
                agreements++;
            }
        }
    }

    return {
        total: results.length,
        classified,
        needs_info: needsInfo,
        with_gold_standard: withGold,
        comparable,
        agreements,
        simple_agreement: comparable > 0 ? agreements / comparable : null,
        confusion_matrix: matrix,
    };
}

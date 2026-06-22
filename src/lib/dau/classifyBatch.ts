import { classifyFromText } from '@/lib/triage/classify';
import type { DAURecord, DAUClassification } from '@/lib/dau/types';
import type { TriageResponse } from '@/lib/ai/schemas';

/**
 * Clasificación batch de registros DAU reutilizando EXACTAMENTE la vía del
 * chat (`classifyFromText`), de modo que el módulo simula al paciente.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * RESTRICCIÓN METODOLÓGICA (no negociable):
 *   A `classifyFromText` SOLO se le pasan los campos que el paciente habría
 *   escrito en el chat: chief_complaint + reported_symptoms (texto libre) y
 *   sex/age_group (contexto demográfico). El gold standard `nurse_esi` jamás
 *   se pasa al clasificador: se conserva aparte y solo se copia al resultado
 *   para la comparación posterior. Los signos vitales instrumentados del DAU
 *   ni siquiera existen en `DAURecord`, así que es imposible inyectarlos.
 * ───────────────────────────────────────────────────────────────────────────
 */

/** Concurrencia por defecto del lote (tamaño de cada batch secuencial). */
export const DEFAULT_DAU_CONCURRENCY = 5;

/** Mapea sexo DAU al string de género que espera el contexto demográfico. */
function sexToGender(sex: DAURecord['sex']): string | null {
    return sex ?? null;
}

/**
 * Combina la respuesta del clasificador con el gold standard del registro
 * para producir un `DAUClassification`. Función PURA.
 */
export function toClassification(record: DAURecord, response: TriageResponse): DAUClassification {
    const predicted = response.status === 'success' ? (response.esi_level ?? null) : null;
    const nurse = record.nurse_esi ?? null;
    const agreement =
        predicted != null && nurse != null ? predicted === nurse : null;

    return {
        record_id: record.record_id,
        predicted_esi: predicted,
        status: response.status === 'success' ? 'success' : 'needs_info',
        decision_source: response.decision_source ?? 'llm',
        matched_rule: response.matched_rule ?? null,
        rule_rationale: response.rule_rationale,
        extracted_features: response.extracted_features ?? {},
        nurse_esi: nurse,
        agreement,
    };
}

/** Clasifica un único registro DAU simulando el chat del paciente. */
export async function classifyRecord(record: DAURecord): Promise<DAUClassification> {
    const response = await classifyFromText({
        chiefComplaint: record.chief_complaint,
        reportedSymptoms: record.reported_symptoms,
        gender: sexToGender(record.sex),
        ageGroup: record.age_group,
    });
    return toClassification(record, response);
}

/**
 * Clasifica un lote de registros en batches secuenciales de tamaño
 * `concurrency` (dentro de cada batch, en paralelo). Mantiene el orden de
 * entrada en la salida. Un fallo individual NO aborta el lote: el clasificador
 * ya devuelve el fallback seguro (needs_info) ante error.
 */
export async function classifyBatch(
    records: DAURecord[],
    concurrency: number = DEFAULT_DAU_CONCURRENCY,
): Promise<DAUClassification[]> {
    const size = Math.max(1, concurrency);
    const out: DAUClassification[] = [];
    for (let i = 0; i < records.length; i += size) {
        const slice = records.slice(i, i + size);
        const settled = await Promise.all(slice.map((r) => classifyRecord(r)));
        out.push(...settled);
    }
    return out;
}

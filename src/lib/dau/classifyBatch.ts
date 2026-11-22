import { classifyFromText } from '@/lib/triage/classify';
import { complaintKey, deidentifyText } from '@/lib/dau/deidentify';
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
 *   sex/age_group (contexto demográfico). El comparador `tens_esi` y el desenlace `outcome`
 *   jamás se pasan al clasificador: se conserva aparte y solo se copia al resultado
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
    const tens = record.tens_esi ?? null;
    const agreement = predicted != null && tens != null ? predicted === tens : null;
    const modelError = (response as { error?: boolean }).error === true;

    return {
        record_id: record.record_id,
        predicted_esi: predicted,
        llm_esi: response.llm_status === 'success' ? (response.llm_esi_level ?? null) : null,
        status: response.status === 'success' ? 'success' : 'needs_info',
        model_error: modelError,
        insufficient_info: response.insufficient_info === true,
        decision_source: response.decision_source ?? 'llm',
        matched_rule: response.matched_rule ?? null,
        rule_rationale: response.rule_rationale,
        extracted_features: response.extracted_features ?? {},
        tens_esi: tens,
        agreement,
        outcome: record.outcome ?? null,
        sex: record.sex ?? null,
        age_group: record.age_group ?? null,
    };
}

/**
 * Prepara el relato que puede salir hacia el proveedor del modelo: aplica el
 * detector de desidentificación sobre motivo y síntomas por separado.
 * Devuelve también los metadatos de auditoría para la bitácora.
 */
export function prepareRecordText(record: DAURecord): {
    chiefComplaint: string;
    reportedSymptoms: string | null;
    vitalsRemoved: boolean;
    categories: string[];
} {
    const cc = deidentifyText(record.chief_complaint);
    const rs = record.reported_symptoms ? deidentifyText(record.reported_symptoms) : null;
    const categories = new Set<string>([...Object.keys(cc.hits), ...Object.keys(rs?.hits ?? {})]);
    return {
        chiefComplaint: cc.text,
        reportedSymptoms: rs?.text || null,
        vitalsRemoved: cc.vitals_removed || cc.observations_removed || !!rs?.vitals_removed || !!rs?.observations_removed,
        categories: Array.from(categories).sort(),
    };
}

/**
 * Clasifica un único registro DAU simulando el chat del paciente.
 *
 * Se pasa `retrospective: true`: el DAU es un estudio de un solo turno, sin
 * posibilidad de repreguntar. Por eso los criterios críticos no referidos se
 * asumen ausentes (negativo presunto, convención de auditoría retrospectiva de
 * fichas) en vez de bloquear con needs_info. Esto NO afecta al chat en vivo,
 * que clasifica con `retrospective` en su default `false`.
 */
export async function classifyRecord(record: DAURecord): Promise<DAUClassification> {
    const prepared = prepareRecordText(record);
    const response = await classifyFromText({
        chiefComplaint: prepared.chiefComplaint || '[sin relato]',
        reportedSymptoms: prepared.reportedSymptoms,
        gender: sexToGender(record.sex),
        ageGroup: record.age_group,
        retrospective: true,
    });
    return {
        ...toClassification(record, response),
        sent_text: [prepared.chiefComplaint, prepared.reportedSymptoms].filter(Boolean).join('. '),
        vitals_removed: prepared.vitalsRemoved,
        deid_categories: prepared.categories,
        complaint_key: complaintKey(prepared.chiefComplaint),
    };
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

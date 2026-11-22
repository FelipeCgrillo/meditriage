import { deidentifyText, type DeidResult } from '@/lib/dau/deidentify';
import { seededRandom } from '@/lib/stats';
import type { DAUClassification, DAURecord } from '@/lib/dau/types';

/**
 * Pasos 3 y 4 del protocolo de desidentificación (oficio CEC, observación 6):
 *   3. Revisión manual del 100% de un lote inicial de 100 textos procesados.
 *   4. Revisión manual de una muestra aleatoria del 10% de los restantes.
 * Ningún texto sale al proveedor del modelo antes de aprobar la revisión.
 *
 * Además, aquí se arma lo ÚNICO que viaja al servidor para clasificar:
 * id, relato desidentificado, sexo y grupo etario. El comparador TENS y el
 * desenlace se quedan en el navegador y se unen al resultado después.
 */

export const INITIAL_REVIEW_LOT = 100;
export const SAMPLE_FRACTION = 0.1;

export interface PreparedRecord {
    record: DAURecord;
    complaint: DeidResult;
    symptoms: DeidResult | null;
}

export function prepareRecords(records: DAURecord[]): PreparedRecord[] {
    return records.map((record) => ({
        record,
        complaint: deidentifyText(record.chief_complaint),
        symptoms: record.reported_symptoms ? deidentifyText(record.reported_symptoms) : null,
    }));
}

/**
 * Índices a revisar: los primeros INITIAL_REVIEW_LOT completos y una
 * muestra aleatoria reproducible (semilla) del 10% del resto, con mínimo 1
 * si hay restantes.
 */
export function reviewSampleIndices(total: number, seed = 20261117): number[] {
    const initial = Math.min(total, INITIAL_REVIEW_LOT);
    const rest = Array.from({ length: total - initial }, (_, i) => i + initial);
    const k = rest.length === 0 ? 0 : Math.max(1, Math.ceil(rest.length * SAMPLE_FRACTION));
    const rand = seededRandom(seed);
    // Fisher-Yates parcial con semilla fija.
    for (let i = rest.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    const sample = rest.slice(0, k).sort((a, b) => a - b);
    return [...Array.from({ length: initial }, (_, i) => i), ...sample];
}

/** Registro mínimo que sale del navegador hacia /api/dau. */
export interface OutboundRecord {
    record_id: string;
    chief_complaint: string;
    reported_symptoms: string | null;
    sex: DAURecord['sex'];
    age_group: DAURecord['age_group'];
}

export function toOutbound(p: PreparedRecord): OutboundRecord {
    return {
        record_id: p.record.record_id,
        chief_complaint: p.complaint.text || '[sin relato]',
        reported_symptoms: p.symptoms?.text || null,
        sex: p.record.sex ?? null,
        age_group: p.record.age_group ?? null,
    };
}

/**
 * Une el resultado del servidor con el comparador y el desenlace que
 * quedaron en el navegador. Los marcadores de desidentificación se toman de
 * la pasada local (el texto original nunca salió del navegador).
 */
export function mergeReference(result: DAUClassification, p: PreparedRecord): DAUClassification {
    const tens = p.record.tens_esi ?? null;
    const vitalsRemoved =
        p.complaint.vitals_removed ||
        p.complaint.observations_removed ||
        !!p.symptoms?.vitals_removed ||
        !!p.symptoms?.observations_removed;
    const categories = new Set<string>([...Object.keys(p.complaint.hits), ...Object.keys(p.symptoms?.hits ?? {})]);
    return {
        ...result,
        tens_esi: tens,
        agreement: result.predicted_esi != null && tens != null ? result.predicted_esi === tens : null,
        outcome: p.record.outcome ?? null,
        sex: p.record.sex ?? null,
        age_group: p.record.age_group ?? null,
        vitals_removed: vitalsRemoved || !!result.vitals_removed,
        deid_categories: Array.from(new Set([...Array.from(categories), ...(result.deid_categories ?? [])])).sort(),
    };
}

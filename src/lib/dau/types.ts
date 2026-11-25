import type { CMDFeatures } from '@/lib/triage/cmd';
import type { DecisionSource } from '@/lib/ai/schemas';
import type { StudyMetrics } from '@/lib/dau/metrics';

/**
 * Contratos del módulo de análisis retrospectivo de DAU (Datos de Atención de
 * Urgencia), validación OE4 de la tesis MediTriage, según el protocolo
 * aprobado por el CEC (respuesta al oficio OBS-E-319-02).
 *
 * ───────────────────────────────────────────────────────────────────────────
 * SEPARACIÓN ESTRICTA DE CAMPOS:
 *   - ENTRADA al modelo: relato DESIDENTIFICADO (motivo de consulta y
 *     síntomas) + sexo + grupo etario. Nada más.
 *   - COMPARADOR (nunca entra al modelo): `tens_esi`, la categoría registrada
 *     por el personal TENS en el DAU.
 *   - CRITERIO DE REFERENCIA (nunca entra al modelo): `outcome`, el destino
 *     del paciente al egreso de la urgencia.
 *   - CONTEXTO DE ANÁLISIS (nunca entra al modelo): tramo etario quinquenal,
 *     mes y año, franja horaria.
 *   Los signos vitales instrumentados del DAU se ignoran por completo.
 * ───────────────────────────────────────────────────────────────────────────
 */

/** Rango etario admitido (alineado con el wizard de consentimiento del chat). */
export type DAUAgeGroup = 'Pediatric' | 'Adult' | 'Geriatric';

/** Sexo biológico declarado. */
export type DAUSex = 'M' | 'F' | 'Other';

/** Nivel ESI (C1–C5). */
export type ESILevel = 1 | 2 | 3 | 4 | 5;

/**
 * Destino al egreso de la urgencia (criterio de referencia del estudio).
 *   - alta: alta a domicilio o derivación a atención ambulatoria.
 *   - hospitalizacion: hospitalización en sala.
 *   - upc: ingreso a unidad de paciente crítico.
 *   - traslado: traslado a un centro de mayor complejidad.
 *   - fallecimiento: fallecido en la urgencia.
 *   - otro: fuga, alta voluntaria u otro destino no clasificable.
 */
export type DAUOutcome = 'alta' | 'hospitalizacion' | 'upc' | 'traslado' | 'fallecimiento' | 'otro';

/** Un registro DAU retrospectivo, disociado en origen por el custodio. */
export interface DAURecord {
    /** Id del registro, generado por el custodio. NO se envía al modelo. */
    record_id: string;
    /** Edad en años, si viene. Solo para derivar el grupo etario. */
    age_years?: number | null;
    /** Tramo etario quinquenal tal como lo entrega el custodio (p. ej. "40-44", "80+"). */
    age_band?: string | null;
    /** Grupo etario derivado (contexto demográfico para el modelo). */
    age_group?: DAUAgeGroup | null;
    /** Sexo biológico declarado. */
    sex?: DAUSex | null;
    /** Mes y año de la atención (AAAA-MM). Solo análisis, NO entra al modelo. */
    period?: string | null;
    /** Franja horaria de la atención. Solo análisis, NO entra al modelo. */
    time_band?: string | null;
    /** Fecha/hora ISO de ingreso (formato antiguo). NO entra al modelo. */
    admission_datetime?: string | null;
    /** Motivo de consulta (texto libre). Entra al modelo tras desidentificar. */
    chief_complaint: string;
    /** Síntomas relatados (texto libre). Entra al modelo tras desidentificar. */
    reported_symptoms?: string | null;
    /** COMPARADOR: categoría C1–C5 asignada por el TENS. NO entra al modelo. */
    tens_esi?: ESILevel | null;
    /** REFERENCIA: destino al egreso, normalizado. NO entra al modelo. */
    outcome?: DAUOutcome | null;
    /** Texto original del destino, para auditar la normalización. */
    outcome_raw?: string | null;
}

/** Resultado de clasificar un registro DAU. */
export interface DAUClassification {
    record_id: string;
    /** ESI final del sistema integrado (1–5) o null si no clasificó. */
    predicted_esi: number | null;
    /** ESI que propuso el LLM antes del motor de reglas (ablación). */
    llm_esi?: number | null;
    status: 'success' | 'needs_info';
    /** true si el modelo falló y se emitió la contingencia segura. */
    model_error?: boolean;
    decision_source: DecisionSource;
    matched_rule: string | null;
    rule_rationale?: string;
    /** Features del CMD que el LLM extrajo del texto libre. */
    extracted_features: CMDFeatures;
    /** Comparador TENS copiado de la entrada. */
    tens_esi: number | null;
    /** predicted_esi === tens_esi (null si falta alguno). */
    agreement: boolean | null;
    /** Destino al egreso copiado de la entrada (referencia). */
    outcome?: DAUOutcome | null;
    /** Texto exacto enviado al modelo (bitácora de desidentificación). */
    sent_text?: string;
    /** Categoría del motivo de consulta (lista cerrada, asignada por el modelo). */
    complaint_category?: string | null;
    /** true si la categoría se derivó del texto porque el modelo no la entregó. */
    category_derived?: boolean;
    /** Palabras de contenido del relato enviado (medida objetiva de su riqueza). */
    text_words?: number;
    /** Riqueza del texto (palabras específicas): informativo, pobre o sin contenido. */
    text_info?: 'informativo' | 'pobre' | 'sin_contenido';
    /** true si se retiraron signos vitales u observaciones del examinador. */
    vitals_removed?: boolean;
    /** Categorías de identificadores sustituidos en el relato. */
    deid_categories?: string[];
    /** Sexo y grupo etario (estratificación, ya disociados). */
    sex?: DAUSex | null;
    age_group?: DAUAgeGroup | null;
    /** Motivo de consulta desidentificado y normalizado (estratificación). */
    complaint_key?: string | null;
}

/** Matriz de confusión: índices 1..5. */
export type ConfusionMatrix = number[][];

/** Resumen agregado del lote (concordancia herramienta frente a TENS). */
export interface DAUSummary {
    total: number;
    classified: number;
    needs_info: number;
    /** Registros con comparador TENS presente. */
    with_gold_standard: number;
    comparable: number;
    agreements: number;
    simple_agreement: number | null;
    /** filas = herramienta 1..5, columnas = TENS 1..5. */
    confusion_matrix: ConfusionMatrix;
    /** Métricas del protocolo CEC frente al desenlace clínico. */
    study?: StudyMetrics;
}

/** Respuesta completa del endpoint /api/dau. */
export interface DAUBatchResponse {
    results: DAUClassification[];
    summary: DAUSummary;
}

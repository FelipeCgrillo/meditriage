import type { CMDFeatures } from '@/lib/triage/cmd';
import type { DecisionSource } from '@/lib/ai/schemas';

/**
 * Contratos del módulo de análisis retrospectivo de DAU (Datos de Atención de
 * Urgencia) — validación OE4 Vía B de la tesis MediTriage.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * DECISIÓN METODOLÓGICA CLAVE (no negociable):
 *   El módulo SIMULA el chat del paciente con datos retrospectivos. Por eso un
 *   `DAURecord` distingue explícitamente:
 *     - ENTRADA al modelo: chief_complaint + reported_symptoms (texto libre) +
 *       sex / age (demográficos). NADA MÁS.
 *     - GOLD STANDARD (NO entra al modelo): nurse_esi (categoría C1–C5 de la
 *       enfermera de triage), usado solo para comparar.
 *   Los signos vitales instrumentados del DAU (PA/FC/FR/temp/SatO2/dolor
 *   medido) se IGNORAN deliberadamente: ni siquiera forman parte de este
 *   contrato de entrada, para que sea imposible inyectarlos al CMD.
 * ───────────────────────────────────────────────────────────────────────────
 */

/** Rango etario admitido (alineado con el wizard de consentimiento del chat). */
export type DAUAgeGroup = 'Pediatric' | 'Adult' | 'Geriatric';

/** Sexo biológico declarado. */
export type DAUSex = 'M' | 'F' | 'Other';

/** Nivel ESI (C1–C5). */
export type ESILevel = 1 | 2 | 3 | 4 | 5;

/**
 * Un registro DAU retrospectivo anonimizado. Solo los campos de texto libre y
 * demográficos entran al modelo; `nurse_esi` es gold standard.
 */
export interface DAURecord {
    /** Id anonimizado del registro DAU. */
    record_id: string;
    /** Edad en años (opcional). Solo se usa para derivar age_group si falta. */
    age_years?: number | null;
    /** Grupo etario, si viene por rango. */
    age_group?: DAUAgeGroup | null;
    /** Sexo biológico declarado. */
    sex?: DAUSex | null;
    /** Fecha/hora ISO de ingreso. SOLO análisis temporal; NO entra al modelo. */
    admission_datetime?: string | null;
    /** Motivo de consulta (texto libre). ENTRA al modelo. */
    chief_complaint: string;
    /** Síntomas/antecedentes relatados (texto libre). ENTRA al modelo. */
    reported_symptoms?: string | null;
    /** GOLD STANDARD: categoría C1–C5 de la enfermera. NO entra al modelo. */
    nurse_esi?: ESILevel | null;
}

/** Resultado de clasificar un registro DAU. */
export interface DAUClassification {
    record_id: string;
    /** ESI del sistema (1–5) o null si needs_info. */
    predicted_esi: number | null;
    status: 'success' | 'needs_info';
    decision_source: DecisionSource;
    matched_rule: string | null;
    rule_rationale?: string;
    /** Features del CMD que el LLM extrajo del texto libre. */
    extracted_features: CMDFeatures;
    /** Gold standard copiado de la entrada. */
    nurse_esi: number | null;
    /** predicted_esi === nurse_esi (null si falta alguno). */
    agreement: boolean | null;
}

/** Celda/columna de la matriz de confusión: índices 1..5. */
export type ConfusionMatrix = number[][];

/** Resumen agregado del lote. */
export interface DAUSummary {
    /** Total de registros recibidos. */
    total: number;
    /** Clasificados con éxito (status='success', predicted_esi no nulo). */
    classified: number;
    /** Registros que terminaron en needs_info (fallo seguro). */
    needs_info: number;
    /** Registros con gold standard presente (nurse_esi no nulo). */
    with_gold_standard: number;
    /** Pares evaluables (predicted_esi y nurse_esi ambos presentes). */
    comparable: number;
    /** Pares en concordancia (predicted_esi === nurse_esi). */
    agreements: number;
    /** Concordancia simple = agreements / comparable (0..1), o null si no hay pares. */
    simple_agreement: number | null;
    /**
     * Matriz de confusión 5x5 (filas = predicho 1..5, columnas = enfermera
     * 1..5). matrix[p-1][n-1] cuenta los casos con predicho=p y enfermera=n.
     */
    confusion_matrix: ConfusionMatrix;
}

/** Respuesta completa del endpoint /api/dau. */
export interface DAUBatchResponse {
    results: DAUClassification[];
    summary: DAUSummary;
}

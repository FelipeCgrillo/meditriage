import type { CMDFeatures } from '@/lib/triage/cmd';
import type { FHIRObservation, FHIRBundle, FHIRRiskAssessment } from '@/lib/supabase/types';
import { SNOMED_FINDINGS, LOINC_VITALS, type TerminologyCoding } from '@/lib/triage/terminology';

/**
 * Construcción de recursos FHIR R4 Observation a partir del CMD auto-reportado.
 *
 * RESTRICCIÓN CLÍNICA: cada Observation representa un hallazgo AUTO-REPORTADO
 * por el paciente, NO una medición instrumentada. Por eso todas llevan la nota
 * "self-reported" y la categoría `survey` (encuesta), no `vital-signs` medidos.
 *
 * Hallazgos clínicos → SNOMED CT. Signos referidos numéricamente por el
 * paciente → LOINC con valueQuantity.
 */

// Categoría FHIR estándar para datos recogidos por cuestionario/auto-reporte.
const SURVEY_CATEGORY = {
    coding: [
        {
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'survey',
            display: 'Survey',
        },
    ],
};

const SELF_REPORTED_NOTE = { text: 'self-reported (auto-reportado por el paciente; no instrumentado)' };

/** Crea una Observation booleana para un hallazgo SNOMED auto-reportado. */
function booleanObservation(
    idSuffix: string,
    coding: TerminologyCoding,
    value: boolean,
    status: 'preliminary' | 'final',
    effectiveDateTime: string,
): FHIRObservation {
    return {
        resourceType: 'Observation',
        id: `obs-${idSuffix}`,
        status,
        category: [SURVEY_CATEGORY],
        code: { coding: [coding], text: coding.display },
        valueBoolean: value,
        note: [SELF_REPORTED_NOTE],
        effectiveDateTime,
    };
}

/** Crea una Observation numérica (LOINC) para un signo referido por el paciente. */
function quantityObservation(
    idSuffix: string,
    coding: TerminologyCoding,
    value: number,
    unit: string,
    unitCode: string,
    status: 'preliminary' | 'final',
    effectiveDateTime: string,
): FHIRObservation {
    return {
        resourceType: 'Observation',
        id: `obs-${idSuffix}`,
        status,
        category: [SURVEY_CATEGORY],
        code: { coding: [coding], text: coding.display },
        valueQuantity: { value, unit, system: 'http://unitsofmeasure.org', code: unitCode },
        note: [SELF_REPORTED_NOTE],
        effectiveDateTime,
    };
}

/**
 * Construye las Observations FHIR a partir de las features del CMD.
 * Solo se emite una Observation por hallazgo efectivamente referido por el
 * paciente; los datos ausentes ('no_referido'/undefined) no generan recurso.
 */
export function buildObservations(
    features: CMDFeatures,
    status: 'preliminary' | 'final' = 'preliminary',
): FHIRObservation[] {
    const when = new Date().toISOString();
    const obs: FHIRObservation[] = [];

    // ── Hallazgos clínicos cualitativos → SNOMED CT (valueBoolean) ────────

    if (features.respiratory_difficulty_reported === 'anormal') {
        obs.push(booleanObservation('dyspnea', SNOMED_FINDINGS.dyspnea, true, status, when));
    }
    if (features.fever_reported === 'anormal') {
        obs.push(booleanObservation('fever', SNOMED_FINDINGS.fever, true, status, when));
    }
    if (features.suicidal_ideation === true) {
        obs.push(booleanObservation('suicidal-ideation', SNOMED_FINDINGS.suicidal_ideation, true, status, when));
    }
    if (features.consciousness_reported === 'anormal') {
        obs.push(booleanObservation('altered-consciousness', SNOMED_FINDINGS.altered_mental_status, true, status, when));
    }
    if (features.pregnancy_status === 'embarazada') {
        obs.push(booleanObservation('pregnancy', SNOMED_FINDINGS.pregnancy, true, status, when));
    }

    // Dolor torácico / convulsión a partir de la descripción auto-referida.
    const desc = features.symptoms_description?.toLowerCase() ?? '';
    const loc = features.symptom_location?.toLowerCase() ?? '';
    if (desc.includes('pecho') || desc.includes('torácic') || loc.includes('pecho')) {
        obs.push(booleanObservation('chest-pain', SNOMED_FINDINGS.chest_pain, true, status, when));
    }
    if (desc.includes('convuls')) {
        obs.push(booleanObservation('seizure', SNOMED_FINDINGS.seizure, true, status, when));
    }

    // ── Signos referidos NUMÉRICAMENTE por el paciente → LOINC (valueQuantity) ──
    const rv = features.referred_vitals;
    if (rv) {
        if (typeof rv.oxygen_saturation_percent === 'number') {
            obs.push(quantityObservation('spo2', LOINC_VITALS.oxygen_saturation, rv.oxygen_saturation_percent, '%', '%', status, when));
        }
        if (typeof rv.heart_rate_bpm === 'number') {
            obs.push(quantityObservation('heart-rate', LOINC_VITALS.heart_rate, rv.heart_rate_bpm, '/min', '/min', status, when));
        }
        if (typeof rv.respiratory_rate_rpm === 'number') {
            obs.push(quantityObservation('resp-rate', LOINC_VITALS.respiratory_rate, rv.respiratory_rate_rpm, '/min', '/min', status, when));
        }
        if (typeof rv.systolic_bp_mmhg === 'number') {
            obs.push(quantityObservation('systolic-bp', LOINC_VITALS.systolic_bp, rv.systolic_bp_mmhg, 'mm[Hg]', 'mm[Hg]', status, when));
        }
        if (typeof rv.temperature_celsius === 'number') {
            obs.push(quantityObservation('temperature', LOINC_VITALS.temperature, rv.temperature_celsius, 'Cel', 'Cel', status, when));
        }
    }

    return obs;
}

/**
 * Agrupa el RiskAssessment del triage con las Observations auto-reportadas en
 * un Bundle FHIR R4 de tipo `collection`.
 */
export function buildFHIRBundle(
    riskAssessment: FHIRRiskAssessment,
    observations: FHIRObservation[],
): FHIRBundle {
    return {
        resourceType: 'Bundle',
        type: 'collection',
        timestamp: new Date().toISOString(),
        entry: [
            { resource: riskAssessment },
            ...observations.map((o) => ({ resource: o })),
        ],
    };
}

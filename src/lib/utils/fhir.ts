import type { TriageResult } from '../ai/schemas';
import type { FHIRRiskAssessment, FHIRBundle } from '../supabase/types';
import type { CMDFeatures } from '../triage/cmd';
import { buildObservations, buildFHIRBundle } from './fhirObservation';

/**
 * FHIR Resource Builder Utilities
 * For HL7 FHIR RiskAssessment generation
 */

/**
 * Map ESI level to FHIR qualitative risk coding
 */
export function mapESIToFHIRRisk(esiLevel: number): {
    code: string;
    display: string;
} {
    const riskMap: Record<number, { code: string; display: string }> = {
        1: { code: 'LA6752-5', display: 'High risk' },
        2: { code: 'LA6752-5', display: 'High risk' },
        3: { code: 'LA6751-7', display: 'Moderate risk' },
        4: { code: 'LA6748-3', display: 'Low risk' },
        5: { code: 'LA6748-3', display: 'Low risk' },
    };

    return riskMap[esiLevel] || { code: 'LA6751-7', display: 'Moderate risk' };
}

/**
 * Build a FHIR RiskAssessment resource from triage result
 */
export function buildFHIRRiskAssessment(
    id: string,
    triageResult: TriageResult,
    status: 'preliminary' | 'final' = 'preliminary'
): FHIRRiskAssessment {
    const risk = mapESIToFHIRRisk(triageResult.esi_level);

    return {
        resourceType: 'RiskAssessment',
        id,
        status,
        method: {
            coding: [
                {
                    system: 'http://cesfam.cl/triage-methods',
                    code: 'ESI-AI',
                    display: 'Emergency Severity Index - AI Assisted',
                },
            ],
        },
        prediction: [
            {
                outcome: {
                    text: `ESI Level ${triageResult.esi_level}`,
                },
                qualitativeRisk: {
                    coding: [
                        {
                            system: 'http://loinc.org',
                            code: risk.code,
                            display: risk.display,
                        },
                    ],
                },
                rationale: triageResult.reasoning,
            },
        ],
        note: [
            {
                text: `Critical signs: ${triageResult.critical_signs.join(', ')}`,
            },
            {
                text: `Suggested specialty: ${triageResult.suggested_specialty}`,
            },
        ],
        performedDateTime: new Date().toISOString(),
    };
}

/**
 * Construye un Bundle FHIR R4 (collection) que agrupa el RiskAssessment del
 * triage con las Observations auto-reportadas derivadas del CMD.
 *
 * Esto materializa la afirmación "RiskAssessment + Observation": se mantiene
 * el RiskAssessment (evaluación de riesgo del triage) y se añade una
 * Observation por cada hallazgo que el paciente refirió (ver fhirObservation.ts).
 */
export function buildTriageFHIRBundle(
    id: string,
    triageResult: TriageResult,
    cmdFeatures: CMDFeatures,
    status: 'preliminary' | 'final' = 'preliminary',
): FHIRBundle {
    const riskAssessment = buildFHIRRiskAssessment(id, triageResult, status);
    const observations = buildObservations(cmdFeatures, status);
    return buildFHIRBundle(riskAssessment, observations);
}

/**
 * Validate FHIR RiskAssessment structure
 */
export function validateFHIRRiskAssessment(resource: any): resource is FHIRRiskAssessment {
    return (
        resource &&
        resource.resourceType === 'RiskAssessment' &&
        resource.id &&
        resource.status &&
        Array.isArray(resource.prediction) &&
        resource.prediction.length > 0
    );
}

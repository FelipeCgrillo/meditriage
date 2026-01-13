import type { TriageResult } from '../ai/schemas';
import type { FHIRRiskAssessment } from '../supabase/types';

/**
 * FHIR Resource Builder Utilities
 * For HL7 FHIR RiskAssessment generation
 * 
 * References:
 * - OE1 Tabla 5: Variables de Síntomas Principales
 * - OE2 Tabla 4: Mapeo de Síntomas a SNOMED CT
 */

/**
 * SNOMED CT Mappings for common symptoms
 * Based on OE2 Table 4 (Mapeo de Síntomas a SNOMED CT)
 */
export const SNOMED_SYMPTOM_MAPPINGS: Record<string, { code: string; display: string }> = {
    // Primary symptoms from OE1
    'dolor de pecho': { code: '29857009', display: 'Chest pain' },
    'dolor torácico': { code: '29857009', display: 'Chest pain' },
    'dificultad para respirar': { code: '267036007', display: 'Dyspnea' },
    'disnea': { code: '267036007', display: 'Dyspnea' },
    'dolor abdominal': { code: '21522001', display: 'Abdominal pain' },
    'dolor de cabeza': { code: '25064002', display: 'Headache' },
    'cefalea': { code: '25064002', display: 'Headache' },
    'fiebre': { code: '386661006', display: 'Fever' },
    'confusión': { code: '40917007', display: 'Confusion' },
    'sangrado': { code: '131148009', display: 'Hemorrhage' },
    'hemorragia': { code: '131148009', display: 'Hemorrhage' },
    'náuseas': { code: '422587007', display: 'Nausea' },
    'vómitos': { code: '422400008', display: 'Vomiting' },
    'mareos': { code: '404640003', display: 'Dizziness' },
    'debilidad': { code: '13791008', display: 'Asthenia' },
    'palpitaciones': { code: '80313002', display: 'Palpitations' },
    'desmayo': { code: '271594007', display: 'Syncope' },
    'síncope': { code: '271594007', display: 'Syncope' },
    'convulsiones': { code: '91175000', display: 'Seizure' },
    'tos': { code: '49727002', display: 'Cough' },
    'ideación suicida': { code: '6471006', display: 'Suicidal ideation' },
    'trauma': { code: '417746004', display: 'Trauma' },
};

/**
 * Extract SNOMED codes from critical signs array
 */
export function extractSNOMEDCodes(criticalSigns: string[]): Array<{ code: string; display: string; term: string }> {
    const codes: Array<{ code: string; display: string; term: string }> = [];

    for (const sign of criticalSigns) {
        const normalizedSign = sign.toLowerCase().trim();

        for (const [key, value] of Object.entries(SNOMED_SYMPTOM_MAPPINGS)) {
            if (normalizedSign.includes(key)) {
                codes.push({
                    code: value.code,
                    display: value.display,
                    term: sign,
                });
                break;
            }
        }
    }

    return codes;
}

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

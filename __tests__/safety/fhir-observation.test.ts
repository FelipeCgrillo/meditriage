import { describe, it, expect } from 'vitest';
import { buildObservations } from '@/lib/utils/fhirObservation';
import { buildTriageFHIRBundle } from '@/lib/utils/fhir';
import type { CMDFeatures } from '@/lib/triage/cmd';
import type { TriageResult } from '@/lib/ai/schemas';

/**
 * Tests de los recursos FHIR R4 Observation y del Bundle (RiskAssessment +
 * Observation). Verifica que:
 *  - cada hallazgo auto-reportado genera una Observation con su código
 *    SNOMED CT / LOINC y la nota "self-reported",
 *  - los datos no referidos NO generan recurso,
 *  - el Bundle agrupa RiskAssessment + Observations.
 */

describe('buildObservations — hallazgos auto-reportados', () => {
    it('genera Observation SNOMED para disnea referida', () => {
        const features: CMDFeatures = { respiratory_difficulty_reported: 'anormal' };
        const obs = buildObservations(features);
        expect(obs).toHaveLength(1);
        expect(obs[0].resourceType).toBe('Observation');
        expect(obs[0].code.coding[0].system).toBe('http://snomed.info/sct');
        expect(obs[0].code.coding[0].code).toBe('267036007');
        expect(obs[0].note?.[0].text).toContain('self-reported');
    });

    it('genera Observation LOINC con valueQuantity para SpO2 referida numéricamente', () => {
        const features: CMDFeatures = { referred_vitals: { oxygen_saturation_percent: 88 } };
        const obs = buildObservations(features);
        expect(obs).toHaveLength(1);
        expect(obs[0].code.coding[0].system).toBe('http://loinc.org');
        expect(obs[0].code.coding[0].code).toBe('59408-5');
        expect(obs[0].valueQuantity?.value).toBe(88);
    });

    it('NO genera recurso para datos no referidos', () => {
        const features: CMDFeatures = { respiratory_difficulty_reported: 'no_referido', fever_reported: 'normal' };
        expect(buildObservations(features)).toHaveLength(0);
    });

    it('genera Observation de ideación suicida (SNOMED 6471006)', () => {
        const obs = buildObservations({ suicidal_ideation: true });
        expect(obs).toHaveLength(1);
        expect(obs[0].code.coding[0].code).toBe('6471006');
        expect(obs[0].valueBoolean).toBe(true);
    });
});

describe('buildTriageFHIRBundle — RiskAssessment + Observation', () => {
    it('agrupa el RiskAssessment con las Observations en un Bundle collection', () => {
        const triage: TriageResult = {
            esi_level: 2,
            critical_signs: ['dolor torácico'],
            reasoning: 'Dolor torácico auto-referido de alto riesgo.',
            suggested_specialty: 'Cardiología',
        };
        const features: CMDFeatures = {
            symptoms_description: 'dolor en el pecho',
            respiratory_difficulty_reported: 'anormal',
        };
        const bundle = buildTriageFHIRBundle('rec-1', triage, features);

        expect(bundle.resourceType).toBe('Bundle');
        expect(bundle.type).toBe('collection');
        // Primer recurso = RiskAssessment; el resto = Observations.
        expect(bundle.entry[0].resource.resourceType).toBe('RiskAssessment');
        const observations = bundle.entry.slice(1).map((e) => e.resource.resourceType);
        expect(observations.every((t) => t === 'Observation')).toBe(true);
        expect(observations.length).toBeGreaterThanOrEqual(2);
    });
});

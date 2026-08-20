/**
 * Test de la política de derivación por nivel ESI (PRD /goal).
 *
 * Cubre los criterios de aceptación CA-01 a CA-05 y CA-11 del
 * PRD-meditriage.md. Determinista, sin llamadas a red.
 */

import { describe, expect, it } from 'vitest';
import {
    dispositionFromEsi,
    suggestedActionForDisposition,
    dispositionTitle,
} from '@/lib/triage/disposition';
import { applyRuleEngineSafeguard } from '@/lib/triage/classify';
import type { TriageResponse } from '@/lib/ai/schemas';

describe('dispositionFromEsi (mapeo ESI → vía de atención)', () => {
    it('CA-04/CA-05: ESI 1 y 2 → emergency', () => {
        expect(dispositionFromEsi(1)).toBe('emergency');
        expect(dispositionFromEsi(2)).toBe('emergency');
    });

    it('CA-03: ESI 3 → same_day_primary_care', () => {
        expect(dispositionFromEsi(3)).toBe('same_day_primary_care');
    });

    it('CA-01/CA-02: ESI 4 y 5 → next_day_primary_care', () => {
        expect(dispositionFromEsi(4)).toBe('next_day_primary_care');
        expect(dispositionFromEsi(5)).toBe('next_day_primary_care');
    });

    it('devuelve null si no hay esi_level (needs_info o error)', () => {
        expect(dispositionFromEsi(null)).toBeNull();
        expect(dispositionFromEsi(undefined)).toBeNull();
    });
});

describe('applyRuleEngineSafeguard (respuesta final del backend)', () => {
    // Features mínimas presentes para que el motor NO fuerce needs_info
    // (conciencia normal, respiración normal, sin ideación suicida).
    const nonCriticalFeatures = {
        consciousness_reported: 'normal' as const,
        respiratory_difficulty_reported: 'normal' as const,
        suicidal_ideation: false,
    };

    const baseSuccess = (esiLevel: number): TriageResponse => ({
        status: 'success',
        esi_level: esiLevel,
        reasoning: 'Razonamiento sintético para prueba.',
        suggested_action: 'texto original que debe ser reemplazado',
        follow_up_question: null,
        extracted_features: nonCriticalFeatures,
    } as TriageResponse);

    it('agrega disposition next_day_primary_care para ESI 5', () => {
        const out = applyRuleEngineSafeguard(baseSuccess(5));
        expect(out.disposition).toBe('next_day_primary_care');
        expect(out.suggested_action).toContain('CESFAM');
        expect(out.suggested_action).toContain('día siguiente');
    });

    it('agrega disposition same_day_primary_care para ESI 3', () => {
        const out = applyRuleEngineSafeguard(baseSuccess(3));
        expect(out.disposition).toBe('same_day_primary_care');
        expect(out.suggested_action).toContain('HOY');
    });

    it('agrega disposition emergency para ESI 2', () => {
        const out = applyRuleEngineSafeguard(baseSuccess(2));
        expect(out.disposition).toBe('emergency');
        expect(out.suggested_action).toContain('urgencia');
    });

    it('CA-11: override del motor a ESI 2 sobre propuesta LLM ESI 4 → disposition emergency', () => {
        // Simula un LLM que propone ESI 4 pero el CMD auto-reportado dispara
        // una regla ESI 2 (dificultad respiratoria severa). El motor debe
        // sobreescribir el nivel y arrastrar la disposición a emergency.
        const llmProposal: TriageResponse = {
            status: 'success',
            esi_level: 4,
            reasoning: 'Propuesta original del LLM (no crítica).',
            suggested_action: 'texto original',
            follow_up_question: null,
            extracted_features: {
                respiratory_difficulty_reported: 'anormal',
                consciousness_reported: 'normal',
                suicidal_ideation: false,
            },
        } as TriageResponse;
        const out = applyRuleEngineSafeguard(llmProposal);
        expect(out.esi_level).toBeLessThanOrEqual(2);
        expect(out.disposition).toBe('emergency');
        expect(out.decision_source).toBe('rule_engine_override');
    });
});

describe('copy de la tarjeta', () => {
    it('el título es específico por disposición', () => {
        expect(dispositionTitle('emergency')).toMatch(/urgencia/i);
        expect(dispositionTitle('same_day_primary_care')).toMatch(/hoy/i);
        expect(dispositionTitle('next_day_primary_care')).toMatch(/día siguiente/i);
    });

    it('todas las disposiciones incluyen instrucción accionable', () => {
        expect(suggestedActionForDisposition('emergency').length).toBeGreaterThan(20);
        expect(suggestedActionForDisposition('same_day_primary_care').length).toBeGreaterThan(20);
        expect(suggestedActionForDisposition('next_day_primary_care').length).toBeGreaterThan(20);
    });
});

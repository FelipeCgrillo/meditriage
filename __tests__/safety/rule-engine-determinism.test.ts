import { describe, it, expect } from 'vitest';
import { evaluateRules } from '@/lib/triage/ruleEngine';
import type { TriageFeatures } from '@/lib/triage/cmd';

/**
 * Test-retest del DETERMINISMO del motor de reglas.
 *
 * El motor de reglas (no el LLM) es la pieza determinista del sistema: para un
 * mismo conjunto de features auto-reportadas debe producir EXACTAMENTE la misma
 * evaluación, repetición tras repetición. Esto es lo que la tesis puede afirmar
 * como "100% reproducible a nivel de motor".
 */

const ESCENARIOS: Array<{ nombre: string; features: TriageFeatures; esiEsperado: number | null; reglaEsperada: string | null }> = [
    {
        nombre: 'Ideación suicida → ESI 2 (P2.7)',
        features: { suicidal_ideation: true, consciousness_reported: 'normal', respiratory_difficulty_reported: 'normal' },
        esiEsperado: 2,
        reglaEsperada: 'P2.7',
    },
    {
        nombre: 'Inconsciencia referida → ESI 1 (P1.1)',
        features: { consciousness_reported: 'anormal', respiratory_difficulty_reported: 'normal', suicidal_ideation: false },
        esiEsperado: 1,
        reglaEsperada: 'P1.1',
    },
    {
        nombre: 'Dolor torácico → ESI 2 (P2.1)',
        features: {
            symptoms_description: 'dolor en el pecho fuerte',
            consciousness_reported: 'normal',
            respiratory_difficulty_reported: 'normal',
            suicidal_ideation: false,
        },
        esiEsperado: 2,
        reglaEsperada: 'P2.1',
    },
    {
        nombre: 'SpO2 referida 85% → ESI 2 (P2.2)',
        features: {
            referred_vitals: { oxygen_saturation_percent: 85 },
            consciousness_reported: 'normal',
            respiratory_difficulty_reported: 'no_referido',
            suicidal_ideation: false,
        },
        esiEsperado: 2,
        reglaEsperada: 'P2.2',
    },
    {
        nombre: 'Datos insuficientes → fallo seguro needs_info',
        features: { symptoms_description: 'me siento mal' },
        esiEsperado: null,
        reglaEsperada: null,
    },
    {
        nombre: 'Sin criterio crítico con datos mínimos → rango no crítico',
        features: {
            symptoms_description: 'tos leve',
            consciousness_reported: 'normal',
            respiratory_difficulty_reported: 'normal',
            suicidal_ideation: false,
        },
        esiEsperado: null,
        reglaEsperada: null,
    },
];

describe('Motor de reglas — determinismo (test-retest)', () => {
    const REPETICIONES = 50;

    for (const escenario of ESCENARIOS) {
        it(`es determinista: ${escenario.nombre}`, () => {
            const primera = JSON.stringify(evaluateRules(escenario.features));
            for (let i = 0; i < REPETICIONES; i++) {
                const actual = JSON.stringify(evaluateRules(escenario.features));
                expect(actual).toBe(primera);
            }
        });

        it(`asigna el nivel/regla esperados: ${escenario.nombre}`, () => {
            const r = evaluateRules(escenario.features);
            expect(r.esiLevel).toBe(escenario.esiEsperado);
            expect(r.matchedRule).toBe(escenario.reglaEsperada);
        });
    }

    it('el fallo seguro reporta datos críticos faltantes', () => {
        const r = evaluateRules({ symptoms_description: 'ayuda' });
        expect(r.needsInfo).toBe(true);
        expect(r.missingCritical.length).toBeGreaterThan(0);
    });

    it('no muta el objeto de features de entrada', () => {
        const features: TriageFeatures = { suicidal_ideation: true };
        const copia = JSON.stringify(features);
        evaluateRules(features);
        expect(JSON.stringify(features)).toBe(copia);
    });
});

import { describe, it, expect } from 'vitest';
import { evaluateRules } from '@/lib/triage/ruleEngine';
import type { TriageFeatures } from '@/lib/triage/cmd';

/**
 * Modo retrospectivo de un solo turno (Vía B / análisis de DAU).
 *
 * Verifica el comportamiento del flag `retrospective` de `evaluateRules`:
 *
 *  - SEGURIDAD PRESERVADA (Vía A): con `retrospective` en su default (false), el
 *    fallo seguro sigue exigiendo needs_info ante criterios críticos ausentes.
 *  - NEGATIVO PRESUNTO (Vía B): con `retrospective=true`, esos mismos criterios
 *    ausentes se asumen ausentes y NO se bloquea con needs_info, delegando la
 *    asignación ESI 3/4/5 al LLM.
 *  - LAS REGLAS CRÍTICAS SIGUEN GANANDO en ambos modos: el modo retrospectivo
 *    nunca relaja la detección de ESI 1/2 cuando el relato sí menciona alarma.
 */

describe('Motor de reglas — modo retrospectivo (Vía B)', () => {
    // Caso típico de baja urgencia: el relato no menciona conciencia,
    // respiración ni ideación suicida (como un esguince real en un DAU).
    const bajaUrgencia: TriageFeatures = {
        symptoms_description: 'esguince de tobillo, hinchazón y dolor al apoyar',
        symptom_location: 'tobillo',
    };

    it('Vía A (default): criterios críticos ausentes → needs_info', () => {
        const r = evaluateRules(bajaUrgencia);
        expect(r.needsInfo).toBe(true);
        expect(r.missingCritical.length).toBeGreaterThan(0);
        expect(r.esiLevel).toBeNull();
    });

    it('Vía A (retrospective=false explícito): mismo comportamiento que el default', () => {
        const r = evaluateRules(bajaUrgencia, { retrospective: false });
        expect(r.needsInfo).toBe(true);
        expect(r.missingCritical.length).toBeGreaterThan(0);
    });

    it('Vía B (retrospective=true): negativo presunto → NO bloquea con needs_info', () => {
        const r = evaluateRules(bajaUrgencia, { retrospective: true });
        expect(r.needsInfo).toBe(false);
        expect(r.esiLevel).toBeNull(); // rango no crítico: lo asigna el LLM
        expect(r.matchedRule).toBeNull();
        // La justificación deja explícito el supuesto retrospectivo.
        expect(r.rationale).toMatch(/retrospectivo/i);
        expect(r.rationale).toMatch(/negativo presunto/i);
    });

    it('Vía B NO relaja la seguridad: inconsciencia referida sigue siendo ESI 1', () => {
        const critico: TriageFeatures = {
            consciousness_reported: 'anormal',
            respiratory_difficulty_reported: 'normal',
            suicidal_ideation: false,
        };
        const r = evaluateRules(critico, { retrospective: true });
        expect(r.esiLevel).toBe(1);
        expect(r.matchedRule).toBe('P1.1');
        expect(r.needsInfo).toBe(false);
    });

    it('Vía B NO relaja la seguridad: ideación suicida sigue siendo ESI 2', () => {
        const critico: TriageFeatures = {
            symptoms_description: 'me quiero morir',
            suicidal_ideation: true,
        };
        const r = evaluateRules(critico, { retrospective: true });
        expect(r.esiLevel).toBe(2);
        expect(r.matchedRule).toBe('P2.7');
        expect(r.needsInfo).toBe(false);
    });

    it('Vía B NO relaja la seguridad: dolor torácico sigue siendo ESI 2', () => {
        const critico: TriageFeatures = {
            symptoms_description: 'dolor en el pecho fuerte',
            // intencionalmente sin conciencia/respiración referidas
        };
        const r = evaluateRules(critico, { retrospective: true });
        expect(r.esiLevel).toBe(2);
        expect(r.matchedRule).toBe('P2.1');
        expect(r.needsInfo).toBe(false);
    });

    it('es determinista también en modo retrospectivo (test-retest)', () => {
        const primera = JSON.stringify(evaluateRules(bajaUrgencia, { retrospective: true }));
        for (let i = 0; i < 50; i++) {
            expect(JSON.stringify(evaluateRules(bajaUrgencia, { retrospective: true }))).toBe(primera);
        }
    });

    it('no muta el objeto de features de entrada en modo retrospectivo', () => {
        const features: TriageFeatures = { symptoms_description: 'dolor leve' };
        const copia = JSON.stringify(features);
        evaluateRules(features, { retrospective: true });
        expect(JSON.stringify(features)).toBe(copia);
    });
});

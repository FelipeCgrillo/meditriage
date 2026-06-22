import { describe, it, expect } from 'vitest';
import { toClassification } from '@/lib/dau/classifyBatch';
import { applyRuleEngineSafeguard } from '@/lib/triage/classify';
import type { DAURecord } from '@/lib/dau/types';
import type { TriageResponse } from '@/lib/ai/schemas';

/**
 * Tests del MAPEO DAU → clasificación. El punto crítico (no negociable) es que
 * NUNCA se inyectan signos vitales instrumentados al CMD: el contrato DAURecord
 * ni siquiera los contiene, y la entrada al clasificador solo lleva texto libre
 * + sexo/edad.
 */

const baseRecord: DAURecord = {
    record_id: 'R1',
    chief_complaint: 'dolor de pecho',
    reported_symptoms: 'opresión hace 1 hora',
    sex: 'M',
    age_group: 'Geriatric',
    nurse_esi: 2,
};

function successResponse(esi: number): TriageResponse {
    return {
        status: 'success',
        esi_level: esi,
        reasoning: 'razonamiento clínico de prueba con longitud suficiente',
        decision_source: 'llm',
        extracted_features: { symptoms_description: 'dolor de pecho' },
    };
}

describe('toClassification', () => {
    it('copia nurse_esi como gold standard y calcula agreement=true', () => {
        const c = toClassification(baseRecord, successResponse(2));
        expect(c.predicted_esi).toBe(2);
        expect(c.nurse_esi).toBe(2);
        expect(c.agreement).toBe(true);
    });

    it('agreement=false cuando predicho != enfermera', () => {
        const c = toClassification(baseRecord, successResponse(4));
        expect(c.agreement).toBe(false);
    });

    it('agreement=null cuando falta el gold standard', () => {
        const c = toClassification({ ...baseRecord, nurse_esi: null }, successResponse(3));
        expect(c.nurse_esi).toBeNull();
        expect(c.agreement).toBeNull();
    });

    it('needs_info ⇒ predicted_esi null y status needs_info', () => {
        const resp: TriageResponse = {
            status: 'needs_info',
            follow_up_question: '¿tiene disnea?',
            decision_source: 'rule_engine',
        };
        const c = toClassification(baseRecord, resp);
        expect(c.predicted_esi).toBeNull();
        expect(c.status).toBe('needs_info');
        expect(c.agreement).toBeNull();
    });

    it('el extracted_features del resultado NO contiene vitales instrumentados', () => {
        // El registro DAU jamás transporta vitales medidas; el clasificador solo
        // extrae lo que el "paciente" refirió en el texto libre.
        const c = toClassification(baseRecord, successResponse(2));
        const serialized = JSON.stringify(c.extracted_features);
        // No hay claves de instrumentación: ni PA medida, ni FC numérica de monitor.
        expect(serialized).not.toMatch(/180\/110|esfigmo|monitor|instrument/i);
    });
});

describe('applyRuleEngineSafeguard (determinismo y override del peor caso)', () => {
    it('es determinista: misma entrada ⇒ misma salida (50 repeticiones)', () => {
        const input = successResponse(3);
        const first = JSON.stringify(applyRuleEngineSafeguard(input));
        for (let i = 0; i < 50; i++) {
            expect(JSON.stringify(applyRuleEngineSafeguard(input))).toBe(first);
        }
    });

    it('override del peor caso: motor detecta ESI crítico y el LLM propuso menos grave', () => {
        // Dificultad respiratoria anormal auto-reportada ⇒ regla crítica.
        const llm: TriageResponse = {
            status: 'success',
            esi_level: 4,
            reasoning: 'el modelo subestimó la gravedad del cuadro respiratorio referido',
            decision_source: 'llm',
            extracted_features: {
                respiratory_difficulty_reported: 'anormal',
                consciousness_reported: 'normal',
                suicidal_ideation: false,
            },
        };
        const out = applyRuleEngineSafeguard(llm);
        expect(out.status).toBe('success');
        expect(out.esi_level).toBeLessThanOrEqual(2);
        expect(out.decision_source).toBe('rule_engine_override');
    });

    it('fallo seguro: faltan datos críticos ⇒ needs_info', () => {
        const llm: TriageResponse = {
            status: 'success',
            esi_level: 5,
            reasoning: 'cuadro aparentemente banal pero sin datos críticos referidos',
            decision_source: 'llm',
            extracted_features: { symptoms_description: 'malestar general' },
        };
        const out = applyRuleEngineSafeguard(llm);
        expect(out.status).toBe('needs_info');
        expect(out.decision_source).toBe('rule_engine');
        expect(out.follow_up_question).toBeTruthy();
    });

    it('conserva la propuesta del LLM en rango no crítico cuando hay datos mínimos', () => {
        const llm: TriageResponse = {
            status: 'success',
            esi_level: 3,
            reasoning: 'cuadro estable, datos críticos presentes y descartados',
            decision_source: 'llm',
            extracted_features: {
                respiratory_difficulty_reported: 'normal',
                consciousness_reported: 'normal',
                suicidal_ideation: false,
            },
        };
        const out = applyRuleEngineSafeguard(llm);
        expect(out.esi_level).toBe(3);
        expect(out.status).toBe('success');
        expect(['llm', 'rule_engine']).toContain(out.decision_source);
    });
});

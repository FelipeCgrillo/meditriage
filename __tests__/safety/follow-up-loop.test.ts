/**
 * Tests del ciclo de repreguntas del chat de triage.
 *
 * Cubren las cuatro fallas observadas en una conversación real, donde el
 * asistente preguntó tres veces la intensidad del dolor y tres veces por
 * hinchazón, para terminar con una pregunta genérica sobre dificultad
 * respiratoria y un chip "Criterio IA: ESI 3" visible para el paciente:
 *
 *   1. Preguntas compuestas que la UI no puede responder (una respuesta por
 *      turno) y que por lo tanto se repiten.
 *   2. Respuestas por botón sin memoria de qué pregunta contestaban.
 *   3. Bucle indefinido del motor de reglas ante criterios críticos ausentes.
 *   4. Nivel ESI preliminar filtrado al paciente en turnos no terminales.
 */

import { describe, it, expect } from 'vitest';
import {
    buildAnsweredQuestionsMessage,
    buildCriticalScreeningQuestion,
    countRuleEngineFollowUps,
    enforceSingleQuestion,
    MAX_RULE_ENGINE_FOLLOW_UPS,
    RULE_ENGINE_SAFE_EXIT_ESI,
} from '@/lib/triage/followUp';
import { applyRuleEngineSafeguard } from '@/lib/triage/classify';
import { renderAssistantContent } from '@/lib/utils/triageRender';
import type { TriageResponse } from '@/lib/ai/schemas';

describe('enforceSingleQuestion — una pregunta por turno', () => {
    it('recorta la pregunta compuesta al primer interrogante', () => {
        const compuesta =
            '¿Qué tan intenso es el dolor del 0 al 10? ¿Y tienes fiebre o notas alguna hinchazón?';
        expect(enforceSingleQuestion(compuesta)).toBe(
            '¿Qué tan intenso es el dolor del 0 al 10?',
        );
    });

    it('conserva intacta una pregunta simple', () => {
        const simple = '¿Cuánto tiempo llevas con este dolor?';
        expect(enforceSingleQuestion(simple)).toBe(simple);
    });

    it('conserva el primer interrogante cuando hay tres preguntas encadenadas', () => {
        const triple = '¿Cuánta sangre aproximadamente? ¿Es poca o abundante? ¿Y el dolor?';
        expect(enforceSingleQuestion(triple)).toBe('¿Cuánta sangre aproximadamente?');
    });

    it('tolera vacío, null y undefined', () => {
        expect(enforceSingleQuestion('')).toBe('');
        expect(enforceSingleQuestion(null)).toBe('');
        expect(enforceSingleQuestion(undefined)).toBe('');
    });

    it('el safeguard recorta la repregunta del modelo antes de emitirla', () => {
        const llm: TriageResponse = {
            status: 'needs_info',
            esi_level: null,
            follow_up_question: '¿Tienes fiebre? ¿Y hinchazón en la zona?',
            extracted_features: {
                consciousness_reported: 'normal',
                respiratory_difficulty_reported: 'normal',
                suicidal_ideation: false,
            },
        } as TriageResponse;
        const out = applyRuleEngineSafeguard(llm);
        expect(out.follow_up_question).toBe('¿Tienes fiebre?');
    });
});

describe('buildAnsweredQuestionsMessage — memoria de lo ya respondido', () => {
    it('no inyecta contexto cuando no hay respuestas previas', () => {
        expect(buildAnsweredQuestionsMessage([])).toBe('');
        expect(buildAnsweredQuestionsMessage(null)).toBe('');
        expect(buildAnsweredQuestionsMessage(undefined)).toBe('');
    });

    it('parea cada pregunta con su respuesta e instruye no repetirla', () => {
        const msg = buildAnsweredQuestionsMessage([
            { question: '¿Cuánto tiempo llevas con este dolor?', answer: '6 a 24 horas' },
            { question: '¿Qué tan intenso es el dolor?', answer: '4-6 (moderado)' },
        ]);
        expect(msg).toContain('¿Cuánto tiempo llevas con este dolor?');
        expect(msg).toContain('6 a 24 horas');
        expect(msg).toContain('¿Qué tan intenso es el dolor?');
        expect(msg).toContain('4-6 (moderado)');
        expect(msg).toContain('NO vuelvas a preguntar');
    });

    it('descarta pares incompletos sin romper el bloque', () => {
        const msg = buildAnsweredQuestionsMessage([
            { question: '   ', answer: 'algo' },
            { question: '¿Tienes fiebre?', answer: '' },
            { question: '¿Hay sangrado?', answer: 'Sí' },
        ]);
        expect(msg).toContain('¿Hay sangrado?');
        expect(msg).not.toContain('¿Tienes fiebre?');
    });
});

describe('buildCriticalScreeningQuestion — tamizaje dirigido', () => {
    it('ofrece solo los criterios que siguen faltando', () => {
        const s = buildCriticalScreeningQuestion(['respiratory_difficulty_reported']);
        expect(s.options).toEqual(['Dificultad para respirar', 'Ninguno de estos']);
    });

    it('cubre los tres criterios en una sola pregunta cuando faltan todos', () => {
        const s = buildCriticalScreeningQuestion([
            'suicidal_ideation',
            'consciousness_reported',
            'respiratory_difficulty_reported',
        ]);
        expect(s.options).toHaveLength(4);
        expect(s.options[s.options.length - 1]).toBe('Ninguno de estos');
        // Una sola pregunta: un único signo de cierre de interrogación.
        expect((s.question.match(/\?/g) ?? []).length).toBe(1);
    });

    it('siempre deja una salida para descartar todo de una vez', () => {
        const s = buildCriticalScreeningQuestion([]);
        expect(s.options).toEqual(['Ninguno de estos']);
    });

    it('respeta el tope de 5 opciones del schema', () => {
        const s = buildCriticalScreeningQuestion([
            'suicidal_ideation',
            'consciousness_reported',
            'respiratory_difficulty_reported',
        ]);
        expect(s.options.length).toBeLessThanOrEqual(5);
    });
});

describe('countRuleEngineFollowUps — conteo de tamizajes previos', () => {
    it('cuenta solo los turnos de repregunta del motor', () => {
        const messages = [
            { role: 'user', content: 'me duele la garganta' },
            {
                role: 'assistant',
                content: JSON.stringify({ status: 'needs_info', decision_source: 'rule_engine' }),
            },
            { role: 'user', content: 'Ninguno de estos' },
            {
                role: 'assistant',
                content: JSON.stringify({ status: 'needs_info', decision_source: 'llm' }),
            },
        ];
        expect(countRuleEngineFollowUps(messages)).toBe(1);
    });

    it('ignora turnos no parseables y devuelve 0 sin conversación', () => {
        expect(countRuleEngineFollowUps([{ role: 'assistant', content: 'texto suelto' }])).toBe(0);
        expect(countRuleEngineFollowUps([])).toBe(0);
        expect(countRuleEngineFollowUps(null)).toBe(0);
    });
});

describe('salida segura del motor de reglas (sin bucle infinito)', () => {
    /** Respuesta del LLM sin ningún criterio crítico referido. */
    function llmSinCriticos(esiPropuesto: number | null): TriageResponse {
        return {
            status: esiPropuesto === null ? 'needs_info' : 'success',
            esi_level: esiPropuesto,
            reasoning: 'Dolor localizado sin signos de alarma referidos.',
            extracted_features: { symptoms_description: 'dolor anal con sangrado' },
        } as TriageResponse;
    }

    it('antes del tope, repregunta con el tamizaje dirigido', () => {
        const out = applyRuleEngineSafeguard(llmSinCriticos(4), { ruleEngineFollowUps: 0 });
        expect(out.status).toBe('needs_info');
        expect(out.decision_source).toBe('rule_engine');
        expect(out.response_options).toContain('Ninguno de estos');
    });

    it('el turno de repregunta NO lleva nivel ESI', () => {
        const out = applyRuleEngineSafeguard(llmSinCriticos(4), { ruleEngineFollowUps: 1 });
        expect(out.status).toBe('needs_info');
        expect(out.esi_level).toBeNull();
    });

    it('alcanzado el tope, cierra con clasificación en vez de repreguntar', () => {
        const out = applyRuleEngineSafeguard(llmSinCriticos(4), {
            ruleEngineFollowUps: MAX_RULE_ENGINE_FOLLOW_UPS,
        });
        expect(out.status).toBe('success');
        expect(out.decision_source).toBe('rule_engine_safe_exit');
        expect(out.esi_level).toBe(RULE_ENGINE_SAFE_EXIT_ESI);
        expect(out.follow_up_question).toBeNull();
    });

    it('la salida segura deriva a atención presencial el mismo día', () => {
        const out = applyRuleEngineSafeguard(llmSinCriticos(5), {
            ruleEngineFollowUps: MAX_RULE_ENGINE_FOLLOW_UPS,
        });
        expect(out.disposition).toBe('same_day_primary_care');
        expect(out.suggested_action).toContain('131');
    });

    it('la salida segura nunca alivia un nivel más grave propuesto por el modelo', () => {
        const out = applyRuleEngineSafeguard(llmSinCriticos(2), {
            ruleEngineFollowUps: MAX_RULE_ENGINE_FOLLOW_UPS,
        });
        expect(out.esi_level).toBe(2);
        expect(out.disposition).toBe('emergency');
    });

    it('el ciclo termina: ninguna cantidad de turnos deja al paciente sin clasificar', () => {
        for (let turnos = 0; turnos <= 6; turnos++) {
            const out = applyRuleEngineSafeguard(llmSinCriticos(4), {
                ruleEngineFollowUps: turnos,
            });
            if (turnos >= MAX_RULE_ENGINE_FOLLOW_UPS) {
                expect(out.status).toBe('success');
                expect(out.esi_level).not.toBeNull();
            }
        }
    });
});

describe('el nivel ESI preliminar no se filtra al paciente', () => {
    it('un turno de repregunta no expone nivel ESI', () => {
        const raw = JSON.stringify({
            status: 'needs_info',
            esi_level: 3,
            follow_up_question: '¿Tienes fiebre?',
            response_options: ['Sí', 'No'],
        });
        const r = renderAssistantContent(raw, false, true);
        expect(r.hideBubble).toBe(false);
        expect(r.esiLevel).toBeNull();
        expect(r.content).toBe('¿Tienes fiebre?');
    });

    it('el turno terminal sigue ocultando el globo y conservando el nivel', () => {
        const raw = JSON.stringify({
            status: 'success',
            esi_level: 2,
            suggested_action: 'Acuda de inmediato a la urgencia.',
        });
        const r = renderAssistantContent(raw, false, true);
        expect(r.hideBubble).toBe(true);
        expect(r.esiLevel).toBe(2);
    });
});

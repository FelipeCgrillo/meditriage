import { afterEach, describe, expect, it } from 'vitest';
import { callTriageModel, setTriageClientFactoryForTests } from '@/lib/ai/triageModel';
import { classifyFromText } from '@/lib/triage/classify';
import { DEFAULT_ANTHROPIC_MODEL } from '@/lib/ai/config';

type Captured = Record<string, unknown>;

/** Variables cualitativas del CMD que el modelo suele devolver completas. */
const REQUIRED_FEATURES = {
    symptom_onset: 'no_referido',
    age_group: 'Adult',
    vital_signs_abnormal: 'no_referido',
    oxygen_sat_reported: 'no_referido',
    heart_rate_reported: 'no_referido',
    respiratory_difficulty_reported: 'normal',
    bp_reported: 'no_referido',
    fever_reported: 'no_referido',
    consciousness_reported: 'normal',
    pregnancy_status: 'no_referido',
};

/** Simula la respuesta del modelo: un bloque de texto con el JSON (o texto libre). */
function mockClient(output: unknown, stop_reason = 'end_turn', captured: Captured[] = []) {
    const text = typeof output === 'string' ? output : JSON.stringify(output);
    setTriageClientFactoryForTests(
        () =>
            ({
                messages: {
                    create: async (params: Captured) => {
                        captured.push(params);
                        return { stop_reason, content: [{ type: 'text', text }], model: params.model };
                    },
                },
            }) as never,
    );
    return captured;
}

afterEach(() => {
    setTriageClientFactoryForTests(null);
    delete process.env.ANTHROPIC_API_KEY;
});

describe('callTriageModel (SDK oficial)', () => {
    it('usa el modelo declarado al CEC, sin parámetros de muestreo y con salida estructurada', async () => {
        process.env.ANTHROPIC_API_KEY = 'test';
        const captured = mockClient({
            status: 'success',
            esi_level: 3,
            reasoning: 'razonamiento clínico suficiente',
            extracted_features: { ...REQUIRED_FEATURES },
        });
        const r = await callTriageModel({ system: 's', messages: [{ role: 'user', content: 'tos' }] });
        expect(r.ok).toBe(true);
        const p = captured[0];
        expect(p.model).toBe(DEFAULT_ANTHROPIC_MODEL);
        expect(DEFAULT_ANTHROPIC_MODEL).toBe('claude-sonnet-5');
        expect(p).not.toHaveProperty('temperature');
        expect(p).not.toHaveProperty('top_p');
        const oc = p.output_config as { effort: string; format?: unknown };
        expect(oc.effort).toBe('high');
        // Sin gramática: la API rechazó el esquema del CMD por complejidad. Se valida con Zod.
        expect(oc.format).toBeUndefined();
    });

    it('extrae el JSON aunque venga envuelto en un bloque de código o con texto alrededor', async () => {
        process.env.ANTHROPIC_API_KEY = 'test';
        const body = JSON.stringify({ status: 'success', esi_level: 4, reasoning: 'razonamiento clínico suficiente' });
        mockClient('Aquí está:\n```json\n' + body + '\n```');
        const r = await callTriageModel({ system: 's', messages: [{ role: 'user', content: 'tos' }] });
        expect(r.ok).toBe(true);
    });

    it('falla de forma segura ante rechazo, sin API key o salida inválida', async () => {
        expect((await callTriageModel({ system: 's', messages: [] })).ok).toBe(false);
        process.env.ANTHROPIC_API_KEY = 'test';
        mockClient(null, 'refusal');
        expect(await callTriageModel({ system: 's', messages: [{ role: 'user', content: 'x' }] })).toMatchObject({ ok: false, reason: 'refusal' });
        mockClient({ status: 'otro' });
        expect(await callTriageModel({ system: 's', messages: [{ role: 'user', content: 'x' }] })).toMatchObject({ ok: false, reason: expect.stringContaining('schema_mismatch') });
        mockClient('no es json');
        expect(await callTriageModel({ system: 's', messages: [{ role: 'user', content: 'x' }] })).toMatchObject({ ok: false, reason: 'no_json' });
    });

    it('classifyFromText conserva el ESI del LLM y aplica el override del motor', async () => {
        process.env.ANTHROPIC_API_KEY = 'test';
        mockClient({
            status: 'success',
            esi_level: 4,
            reasoning: 'propuesta del modelo para la prueba',
            extracted_features: { ...REQUIRED_FEATURES, symptoms_description: 'dolor de pecho', suicidal_ideation: false },
        });
        const r = await classifyFromText({ chiefComplaint: 'dolor de pecho', retrospective: true });
        expect(r.llm_esi_level).toBe(4);
        expect(r.esi_level).toBe(2);
        expect(r.decision_source).toBe('rule_engine_override');
    });
});

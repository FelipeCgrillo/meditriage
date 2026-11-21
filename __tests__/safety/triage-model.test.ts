import { afterEach, describe, expect, it } from 'vitest';
import { callTriageModel, setTriageClientFactoryForTests } from '@/lib/ai/triageModel';
import { classifyFromText } from '@/lib/triage/classify';
import { DEFAULT_ANTHROPIC_MODEL } from '@/lib/ai/config';

type Captured = Record<string, unknown>;

function mockClient(parsed: unknown, stop_reason = 'end_turn', captured: Captured[] = []) {
    setTriageClientFactoryForTests(
        () =>
            ({
                messages: {
                    parse: async (params: Captured) => {
                        captured.push(params);
                        return { stop_reason, parsed_output: parsed, model: params.model };
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
        const captured = mockClient({ status: 'success', esi_level: 3, reasoning: 'razonamiento clínico suficiente' });
        const r = await callTriageModel({ system: 's', messages: [{ role: 'user', content: 'tos' }] });
        expect(r.ok).toBe(true);
        const p = captured[0];
        expect(p.model).toBe(DEFAULT_ANTHROPIC_MODEL);
        expect(DEFAULT_ANTHROPIC_MODEL).toBe('claude-sonnet-5');
        expect(p).not.toHaveProperty('temperature');
        expect(p).not.toHaveProperty('top_p');
        const oc = p.output_config as { effort: string; format: { type: string; schema: { properties: Record<string, unknown> } } };
        expect(oc.effort).toBe('high');
        expect(oc.format.type).toBe('json_schema');
        // Los campos que completa el servidor no se ofrecen al modelo.
        for (const k of ['matched_rule', 'decision_source', 'disposition', 'llm_esi_level']) {
            expect(oc.format.schema.properties).not.toHaveProperty(k);
        }
    });

    it('falla de forma segura ante rechazo, sin API key o salida inválida', async () => {
        expect((await callTriageModel({ system: 's', messages: [] })).ok).toBe(false);
        process.env.ANTHROPIC_API_KEY = 'test';
        mockClient(null, 'refusal');
        expect(await callTriageModel({ system: 's', messages: [{ role: 'user', content: 'x' }] })).toMatchObject({ ok: false, reason: 'refusal' });
        mockClient({ status: 'otro' });
        expect(await callTriageModel({ system: 's', messages: [{ role: 'user', content: 'x' }] })).toMatchObject({ ok: false, reason: 'schema_mismatch' });
    });

    it('classifyFromText conserva el ESI del LLM y aplica el override del motor', async () => {
        process.env.ANTHROPIC_API_KEY = 'test';
        mockClient({
            status: 'success',
            esi_level: 4,
            reasoning: 'propuesta del modelo para la prueba',
            extracted_features: { symptoms_description: 'dolor de pecho', consciousness_reported: 'normal', respiratory_difficulty_reported: 'normal', suicidal_ideation: false },
        });
        const r = await classifyFromText({ chiefComplaint: 'dolor de pecho', retrospective: true });
        expect(r.llm_esi_level).toBe(4);
        expect(r.esi_level).toBe(2);
        expect(r.decision_source).toBe('rule_engine_override');
    });
});

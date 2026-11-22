import { afterEach, describe, expect, it } from 'vitest';
import { callTriageModel, setTriageClientFactoryForTests } from '@/lib/ai/triageModel';
import { classifyFromText } from '@/lib/triage/classify';
import { DEFAULT_ANTHROPIC_MODEL } from '@/lib/ai/config';

type Captured = Record<string, unknown>;

/** Variables cualitativas obligatorias en la salida estructurada del modelo. */
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

function countOptional(node: unknown): number {
    if (!node || typeof node !== 'object') return 0;
    const n = node as { properties?: Record<string, unknown>; required?: string[]; anyOf?: unknown[]; items?: unknown; $defs?: Record<string, unknown> };
    let total = 0;
    if (n.properties) {
        const req = new Set(n.required ?? []);
        for (const [k, v] of Object.entries(n.properties)) {
            if (!req.has(k)) total++;
            total += countOptional(v);
        }
    }
    n.anyOf?.forEach((x) => (total += countOptional(x)));
    if (n.items) total += countOptional(n.items);
    Object.values(n.$defs ?? {}).forEach((d) => (total += countOptional(d)));
    return total;
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
        const oc = p.output_config as {
            effort: string;
            format: { type: string; schema: { properties: Record<string, unknown>; required?: string[] } };
        };
        expect(oc.effort).toBe('high');
        expect(oc.format.type).toBe('json_schema');
        // Los campos que completa el servidor no se ofrecen al modelo.
        for (const k of ['matched_rule', 'decision_source', 'disposition', 'llm_esi_level', 'critical_signs', 'suggested_specialty']) {
            expect(oc.format.schema.properties).not.toHaveProperty(k);
        }
        // La salida estructurada de Anthropic rechaza esquemas con demasiados
        // parámetros opcionales (el despliegue falló con 34). Se mantiene acotado.
        expect(countOptional(oc.format.schema)).toBeLessThanOrEqual(22);
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
            extracted_features: { ...REQUIRED_FEATURES, symptoms_description: 'dolor de pecho', suicidal_ideation: false },
        });
        const r = await classifyFromText({ chiefComplaint: 'dolor de pecho', retrospective: true });
        expect(r.llm_esi_level).toBe(4);
        expect(r.esi_level).toBe(2);
        expect(r.decision_source).toBe('rule_engine_override');
    });
});

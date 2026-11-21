import { describe, expect, it } from 'vitest';
import {
    clopperPearsonInterval,
    mcnemarExact,
    pairedAucDeLong,
    weightedKappa,
    wilsonInterval,
} from '@/lib/stats';
import {
    computeStudyMetrics,
    continuityVerdict,
    interpretationCell,
    isRelevantSubtriage,
} from '@/lib/dau/metrics';
import { deidentifyText } from '@/lib/dau/deidentify';
import { coerceOutcome, parseAgeBand, parseDAUCsv } from '@/lib/dau/parser';
import { mergeReference, prepareRecords, reviewSampleIndices, toOutbound } from '@/lib/dau/review';
import { mentionsAffirmed } from '@/lib/triage/textMatch';
import { evaluateRules } from '@/lib/triage/ruleEngine';
import type { DAUClassification, DAUOutcome } from '@/lib/dau/types';

// ── Estadística ──────────────────────────────────────────────────────────
describe('estadística', () => {
    it('Wilson 9/10 coincide con valores publicados', () => {
        const i = wilsonInterval(9, 10)!;
        expect(i.lower).toBeCloseTo(0.5958, 3);
        expect(i.upper).toBeCloseTo(0.9821, 3);
    });

    it('Clopper-Pearson 9/10 coincide con valores publicados', () => {
        const i = clopperPearsonInterval(9, 10)!;
        expect(i.lower).toBeCloseTo(0.555, 3);
        expect(i.upper).toBeCloseTo(0.9975, 3);
    });

    it('McNemar exacto b=1, c=7 → p = 2·9/256', () => {
        expect(mcnemarExact(1, 7).p_value).toBeCloseTo((2 * 9) / 256, 6);
        expect(mcnemarExact(0, 0).p_value).toBeNull();
    });

    it('AUC de DeLong con empates', () => {
        // positivos [3,2], negativos [1,2] → (1+1+1+0,5)/4 = 0,875
        const r = pairedAucDeLong([3, 2, 1, 2], [3, 2, 1, 2], [true, true, false, false]);
        expect(r.a.auc).toBeCloseTo(0.875, 6);
        expect(r.difference).toBeCloseTo(0, 9);
    });

    it('kappa ponderado: acuerdo perfecto = 1 y bootstrap reproducible', () => {
        const a = [1, 2, 3, 4, 5, 3, 3, 4];
        expect(weightedKappa(a, a, { bootstrap: 0 }).kappa).toBeCloseTo(1, 9);
        const b = [1, 2, 3, 3, 5, 4, 3, 5];
        const k1 = weightedKappa(a, b, { bootstrap: 200, seed: 7 });
        const k2 = weightedKappa(a, b, { bootstrap: 200, seed: 7 });
        expect(k1.ci_bootstrap).toEqual(k2.ci_bootstrap);
        expect(k1.kappa!).toBeGreaterThan(0);
        expect(weightedKappa(a, b, { weights: 'quadratic', bootstrap: 0 }).kappa!).toBeGreaterThan(k1.kappa!);
    });
});

// ── Definiciones del protocolo ───────────────────────────────────────────
describe('definiciones del protocolo CEC', () => {
    it('subtriage clínicamente relevante', () => {
        expect(isRelevantSubtriage(3, 'upc')).toBe(true);
        expect(isRelevantSubtriage(3, 'fallecimiento')).toBe(true);
        expect(isRelevantSubtriage(2, 'upc')).toBe(false);
        expect(isRelevantSubtriage(3, 'hospitalizacion')).toBe(false);
        expect(isRelevantSubtriage(4, 'hospitalizacion')).toBe(true);
        expect(isRelevantSubtriage(5, 'traslado')).toBe(true);
        expect(isRelevantSubtriage(5, 'alta')).toBe(false);
        expect(isRelevantSubtriage(5, 'otro')).toBe(false);
    });

    it('tabla de interpretación a priori', () => {
        expect(interpretationCell(3, 3, 'alta')).toBe('coinciden_consistente');
        expect(interpretationCell(4, 4, 'hospitalizacion')).toBe('coinciden_error_compartido');
        expect(interpretationCell(4, 2, 'upc')).toBe('herramienta_menor_alta_gravedad');
        expect(interpretationCell(4, 2, 'alta')).toBe('herramienta_menor_sin_alta_gravedad');
        expect(interpretationCell(2, 4, 'hospitalizacion')).toBe('herramienta_mayor_alta_gravedad');
        expect(interpretationCell(2, 4, 'alta')).toBe('herramienta_mayor_sin_alta_gravedad');
    });
});

function row(id: string, tool: number | null, tens: number | null, outcome: DAUOutcome | null, extra: Partial<DAUClassification> = {}): DAUClassification {
    return {
        record_id: id,
        predicted_esi: tool,
        llm_esi: tool,
        status: tool == null ? 'needs_info' : 'success',
        decision_source: 'llm',
        matched_rule: null,
        extracted_features: {},
        tens_esi: tens,
        agreement: tool != null && tens != null ? tool === tens : null,
        outcome,
        ...extra,
    };
}

describe('computeStudyMetrics', () => {
    // 10 casos de alta gravedad: herramienta identifica 9, TENS identifica 8.
    const high: DAUClassification[] = [
        ...Array.from({ length: 8 }, (_, i) => row(`h${i}`, 2, 2, 'hospitalizacion')),
        row('h8', 3, 4, 'hospitalizacion'), // solo la herramienta identifica
        row('h9', 4, 4, 'upc'), // ninguno: error compartido
    ];
    const low: DAUClassification[] = Array.from({ length: 20 }, (_, i) => row(`l${i}`, i % 2 ? 4 : 5, 4, 'alta'));
    const extra = [row('x1', null, 3, 'alta', { model_error: true }), row('x2', 3, null, 'alta'), row('x3', 3, 3, null)];
    const m = computeStudyMetrics([...high, ...low, ...extra], { bootstrap: 0 });

    it('cuenta pares y faltantes', () => {
        expect(m.primary.n_paired).toBe(30);
        expect(m.primary.n_high_severity).toBe(10);
        expect(m.primary.n_critical).toBe(1);
        expect(m.missing_tool).toBe(1);
        expect(m.model_errors).toBe(1);
        expect(m.missing_tens).toBe(1);
        expect(m.missing_outcome).toBe(1);
    });

    it('sensibilidad pareada y McNemar', () => {
        expect(m.primary.sensitivity_tool.x).toBe(9);
        expect(m.primary.sensitivity_tens.x).toBe(8);
        expect(m.primary.mcnemar).toMatchObject({ b: 1, c: 0 });
    });

    it('subtriage relevante y criterio de continuidad', () => {
        expect(m.primary.subtriage_tool.x).toBe(1);
        expect(m.primary.subtriage_tens.x).toBe(2);
        expect(m.primary.subtriage_excess.estimate).toBeCloseTo(-0.1, 9);
        // 9/10 = 0,90 pero el límite inferior de Wilson (0,596) es menor a 0,85.
        expect(m.continuity.sensitivity_ok).toBe(true);
        expect(m.continuity.ci_lower_ok).toBe(false);
        expect(m.continuity.meets).toBe(false);
    });

    it('criterio de continuidad se cumple con muestra suficiente', () => {
        const big = [
            ...Array.from({ length: 196 }, (_, i) => row(`b${i}`, 2, 2, 'hospitalizacion')),
            ...Array.from({ length: 4 }, (_, i) => row(`c${i}`, 4, 4, 'hospitalizacion')),
        ];
        const v = continuityVerdict(computeStudyMetrics(big, { bootstrap: 0 }).primary);
        expect(v.meets).toBe(true);
    });

    it('ablación y análisis de sensibilidad sin signos vitales', () => {
        const withVitals = [...high, row('v1', 2, 2, 'upc', { vitals_removed: true, llm_esi: 4 })];
        const mm = computeStudyMetrics(withVitals, { bootstrap: 0 });
        expect(mm.n_vitals_removed).toBe(1);
        expect(mm.sensitivity_without_vitals?.n_paired).toBe(10);
        expect(mm.ablation_llm?.sensitivity_tool.x).toBe(9);
        expect(mm.primary.sensitivity_tool.x).toBe(10);
    });
});

// ── Parser ───────────────────────────────────────────────────────────────
describe('parser con desenlace y variables disociadas', () => {
    it('normaliza el destino al egreso', () => {
        expect(coerceOutcome('Hospitalización en sala')).toBe('hospitalizacion');
        expect(coerceOutcome('Ingreso UPC')).toBe('upc');
        expect(coerceOutcome('Traslado a centro de mayor complejidad')).toBe('traslado');
        expect(coerceOutcome('Fallecido')).toBe('fallecimiento');
        expect(coerceOutcome('Alta a domicilio')).toBe('alta');
        expect(coerceOutcome('Alta voluntaria')).toBe('otro');
        expect(coerceOutcome('Fuga')).toBe('otro');
        expect(coerceOutcome('???')).toBeNull();
    });

    it('interpreta tramos quinquenales', () => {
        expect(parseAgeBand('40-44')).toEqual({ lower: 40, upper: 44 });
        expect(parseAgeBand('80+')).toEqual({ lower: 80, upper: null });
        expect(parseAgeBand('80 y más')).toEqual({ lower: 80, upper: null });
        expect(parseAgeBand('37')).toBeNull();
    });

    it('lee el CSV del custodio y advierte destinos no reconocidos', () => {
        const csv = [
            'id;sexo;tramo_etario;mes;franja_horaria;motivo_consulta;sintomas;categoria_tens;destino',
            'A1;F;65-69;2026-03;08-14;dolor torácico;opresivo;2;Hospitalización',
            'A2;M;15-19;2026-04;14-20;tos;sin fiebre;5;Alta',
            'A3;M;80+;2026-04;20-08;caída;;3;xyz',
        ].join('\n');
        const r = parseDAUCsv(csv);
        expect(r.records).toHaveLength(3);
        expect(r.records[0]).toMatchObject({ tens_esi: 2, outcome: 'hospitalizacion', age_group: 'Geriatric', period: '2026-03', time_band: '08-14' });
        expect(r.records[1].age_group).toBe('Adult');
        expect(r.records[2].outcome).toBeNull();
        expect(r.warnings).toHaveLength(1);
    });
});

// ── Desidentificación y revisión ─────────────────────────────────────────
describe('desidentificación', () => {
    it('sustituye identificadores y retira signos vitales', () => {
        const r = deidentifyText(
            'Sr. Juan Pérez, RUT 12.345.678-9, fono 9 8765 4321, viene del Hospital San José. PA 150/90 FC 110. Al examen pálido.',
        );
        expect(r.text).not.toMatch(/Juan|Pérez|12\.345|8765|San José|150\/90|110|pálido/);
        expect(r.hits).toMatchObject({ nombre: 1, rut: 1, telefono: 1, establecimiento: 1 });
        expect(r.vitals_removed).toBe(true);
        expect(r.observations_removed).toBe(true);
    });

    it('conserva el contenido clínico en texto en mayúsculas', () => {
        const r = deidentifyText('PACIENTE CON DOLOR ABDOMINAL DESDE AYER, TRAIDO DESDE CESFAM POR VOMITOS');
        expect(r.text).toContain('DOLOR ABDOMINAL');
        expect(r.text).toContain('POR VOMITOS');
        expect(r.text).toContain('[ESTABLECIMIENTO]');
    });

    it('sustituye grados y unidades sin afectar "malestar general"', () => {
        const r = deidentifyText('Cabo Soto del Regimiento Tucapel refiere malestar general');
        expect(r.text).toBe('[GRADO] del [UNIDAD] refiere malestar general');
    });

    it('es idempotente sobre su propia salida', () => {
        const once = deidentifyText('Sra. María Soto con fiebre, T° 39 axilar').text;
        expect(deidentifyText(once).text).toBe(once);
    });

    it('muestra de revisión: 100 iniciales más 10% reproducible del resto', () => {
        const idx = reviewSampleIndices(1025);
        expect(idx.slice(0, 100)).toEqual(Array.from({ length: 100 }, (_, i) => i));
        expect(idx.length).toBe(100 + Math.ceil(925 * 0.1));
        expect(reviewSampleIndices(1025)).toEqual(idx);
        expect(reviewSampleIndices(40)).toHaveLength(40);
    });

    it('lo que sale del navegador excluye TENS, desenlace y contexto temporal', () => {
        const [p] = prepareRecords([
            { record_id: 'R1', chief_complaint: 'dolor de pecho', sex: 'M', age_group: 'Adult', tens_esi: 2, outcome: 'upc', period: '2026-01', time_band: '08-14' },
        ]);
        const out = toOutbound(p);
        expect(Object.keys(out).sort()).toEqual(['age_group', 'chief_complaint', 'record_id', 'reported_symptoms', 'sex']);
        const merged = mergeReference(row('R1', 2, null, null), p);
        expect(merged).toMatchObject({ tens_esi: 2, outcome: 'upc', agreement: true });
    });
});

// ── Negación en el motor de reglas ───────────────────────────────────────
describe('reglas con negación', () => {
    it('detecta menciones afirmadas e ignora negadas', () => {
        expect(mentionsAffirmed('dolor de pecho opresivo', ['pecho'])).toBe(true);
        expect(mentionsAffirmed('sin dolor de pecho', ['pecho'])).toBe(false);
        expect(mentionsAffirmed('niega convulsiones', ['convuls'])).toBe(false);
        expect(mentionsAffirmed('no tiene fiebre ni dolor de pecho', ['pecho'])).toBe(false);
        expect(mentionsAffirmed('no sabe qué le pasa, le duele el pecho', ['pecho'])).toBe(true);
        expect(mentionsAffirmed('tos, pero ahora con dolor torácico', ['torácic'])).toBe(true);
    });

    it('"sin dolor de pecho" ya no dispara P2.1', () => {
        const base = { consciousness_reported: 'normal', respiratory_difficulty_reported: 'normal', suicidal_ideation: false } as const;
        expect(evaluateRules({ ...base, symptoms_description: 'tos sin dolor de pecho' }).matchedRule).toBeNull();
        expect(evaluateRules({ ...base, symptoms_description: 'dolor de pecho intenso' }).matchedRule).toBe('P2.1');
    });
});

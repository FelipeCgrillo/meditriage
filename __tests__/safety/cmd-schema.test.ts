import { describe, it, expect } from 'vitest';
import { CMDSchema } from '@/lib/triage/cmd';

/**
 * Tests del schema del CMD (Conjunto Mínimo de Datos).
 *
 * Verifica que el schema:
 *  - acepta features parciales (todas las variables clínicas son opcionales),
 *  - modela los signos como flags CUALITATIVOS auto-reportados (no números
 *    instrumentados),
 *  - acepta números SOLO bajo referred_vitals (auto-reporte explícito),
 *  - rechaza valores fuera de rango/enum.
 */

describe('CMDSchema — auto-reporte y validación', () => {
    it('acepta un objeto vacío (todas las variables son opcionales)', () => {
        const r = CMDSchema.safeParse({});
        expect(r.success).toBe(true);
    });

    it('acepta features parciales auto-reportadas', () => {
        const r = CMDSchema.safeParse({
            symptoms_description: 'dolor de cabeza',
            pain_severity: 6,
            fever_reported: 'anormal',
            suicidal_ideation: false,
        });
        expect(r.success).toBe(true);
    });

    it('acepta flags cualitativos válidos para signos referidos', () => {
        const r = CMDSchema.safeParse({
            oxygen_sat_reported: 'no_sabe',
            heart_rate_reported: 'normal',
            respiratory_difficulty_reported: 'anormal',
            bp_reported: 'no_referido',
        });
        expect(r.success).toBe(true);
    });

    it('rechaza un flag cualitativo inválido', () => {
        const r = CMDSchema.safeParse({ fever_reported: '39_grados' });
        expect(r.success).toBe(false);
    });

    it('rechaza pain_severity fuera de rango (0-10)', () => {
        expect(CMDSchema.safeParse({ pain_severity: 11 }).success).toBe(false);
        expect(CMDSchema.safeParse({ pain_severity: -1 }).success).toBe(false);
    });

    it('acepta números SOLO bajo referred_vitals (auto-reporte explícito)', () => {
        const r = CMDSchema.safeParse({
            referred_vitals: { oxygen_saturation_percent: 88, heart_rate_bpm: 120 },
        });
        expect(r.success).toBe(true);
    });

    it('rechaza un valor numérico imposible en referred_vitals', () => {
        const r = CMDSchema.safeParse({ referred_vitals: { oxygen_saturation_percent: 150 } });
        expect(r.success).toBe(false);
    });

    it('valida el enum de inicio de síntomas (V2)', () => {
        expect(CMDSchema.safeParse({ symptom_onset: '1_6_horas' }).success).toBe(true);
        expect(CMDSchema.safeParse({ symptom_onset: 'hace_un_rato' }).success).toBe(false);
    });
});

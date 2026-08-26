/**
 * Tests del incremento de mejoras UX/UI (PRD-mejoras-uxui.md).
 *
 * Cubre la lógica pura del incremento:
 *   - CA-04: las opciones de sexo del consentimiento mapean a los valores
 *     que la base de datos ya acepta, incluyendo `Prefer not to say`.
 *   - CA-05/CA-06 (RF-06/RF-07): la vía de atención derivada del ESI final
 *     produce la tarjeta correcta y la tarjeta roja instruye llamar al 131.
 *   - CA-01/RF-01: el endpoint GET /api/patient/organizations expone solo
 *     slug y nombre de organizaciones activas, y degrada a lista vacía
 *     ante un error de base de datos.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    GENDER_MAP,
    GENDER_OPTIONS,
    AGE_MAP,
    AGE_OPTIONS,
} from '@/lib/triage/consentOptions';
import {
    dispositionFromEsi,
    dispositionTitle,
    suggestedActionForDisposition,
} from '@/lib/triage/disposition';

// ── Mock del cliente service_role para el endpoint de organizaciones ──
let orgRows: Array<{ slug: string; name: string }> | null = [];
let orgError: { message: string } | null = null;

vi.mock('@/lib/supabase/server', () => ({
    createServiceRoleClient: () => ({
        from(table: string) {
            expect(table).toBe('organizations');
            return {
                select() {
                    return this;
                },
                eq(col: string, value: unknown) {
                    expect(col).toBe('is_active');
                    expect(value).toBe(true);
                    return this;
                },
                order() {
                    return this;
                },
                async limit() {
                    return { data: orgRows, error: orgError };
                },
            };
        },
    }),
    createSupabaseServerClient: async () => ({}),
}));

describe('consentimiento demográfico (RF-05, CA-04)', () => {
    it('cada opción de sexo visible mapea a un valor de base de datos', () => {
        for (const option of GENDER_OPTIONS) {
            expect(GENDER_MAP[option]).toBeTruthy();
        }
    });

    it('las opciones inclusivas mapean a los valores que la BD ya acepta', () => {
        expect(GENDER_MAP['Otro']).toBe('Other');
        expect(GENDER_MAP['Prefiero no responder']).toBe('Prefer not to say');
    });

    it('cada rango etario visible mapea a un grupo válido', () => {
        for (const option of AGE_OPTIONS) {
            expect(AGE_MAP[option]).toBeTruthy();
        }
    });
});

describe('tarjeta de disposición en la pantalla final (RF-06/07/08)', () => {
    it('CA-05: ESI 4 produce la tarjeta de atención al día siguiente', () => {
        const disposition = dispositionFromEsi(4);
        expect(disposition).toBe('next_day_primary_care');
        expect(dispositionTitle(disposition!)).toBe(
            'Atención al día siguiente en CESFAM',
        );
    });

    it('CA-06 (RF-07): la tarjeta roja de urgencia instruye llamar al 131', () => {
        const disposition = dispositionFromEsi(2);
        expect(disposition).toBe('emergency');
        const action = suggestedActionForDisposition(disposition!);
        expect(action).toContain('131');
        expect(action.toLowerCase()).toContain('urgencia');
    });

    it('CA-07 (RF-08): sin ESI no hay disposición y no se muestra tarjeta', () => {
        expect(dispositionFromEsi(null)).toBeNull();
        expect(dispositionFromEsi(undefined)).toBeNull();
    });

    it('toda disposición no urgente conserva la vía de escape al 131', () => {
        for (const level of [3, 4, 5]) {
            const disposition = dispositionFromEsi(level)!;
            expect(suggestedActionForDisposition(disposition)).toContain('131');
        }
    });
});

describe('GET /api/patient/organizations (RF-01, CA-01)', () => {
    beforeEach(() => {
        orgRows = [];
        orgError = null;
    });

    async function callRoute() {
        const mod = await import('@/app/api/patient/organizations/route');
        const res = await mod.GET();
        return res.json() as Promise<{
            organizations: Array<{ slug: string; name: string }>;
        }>;
    }

    it('devuelve solo slug y nombre de las organizaciones activas', async () => {
        orgRows = [
            { slug: 'cesfam-a', name: 'CESFAM A' },
            { slug: 'cesfam-b', name: 'CESFAM B' },
        ];
        const json = await callRoute();
        expect(json.organizations).toEqual([
            { slug: 'cesfam-a', name: 'CESFAM A' },
            { slug: 'cesfam-b', name: 'CESFAM B' },
        ]);
        for (const org of json.organizations) {
            expect(Object.keys(org).sort()).toEqual(['name', 'slug']);
        }
    });

    it('degrada a lista vacía ante un error de base de datos', async () => {
        orgError = { message: 'boom' };
        orgRows = null;
        const json = await callRoute();
        expect(json.organizations).toEqual([]);
    });
});

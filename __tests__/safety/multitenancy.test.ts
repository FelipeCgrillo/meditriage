/**
 * Multitenancy: validaci\u00f3n del slug del paciente y aislamiento en API.
 *
 * Cubre CA-04/CA-05 del PRD I1 verificando que resolveOrganizationIdBySlug
 * rechaza slugs mal formados o inactivos y solo retorna un id cuando la
 * organizaci\u00f3n existe y est\u00e1 activa. Este test NO toca la DB real: el
 * cliente Supabase se mockea para aislar la l\u00f3gica de validaci\u00f3n.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

interface MockRow {
    id: string;
    is_active: boolean;
}

// Mock del cliente service_role: intercepta from('organizations') y devuelve
// una fila configurable por test. Solo se ejerce cuando el slug pasa la
// validaci\u00f3n barata (regex + longitud), as\u00ed que tambi\u00e9n verificamos que
// slugs inv\u00e1lidos no lleguen a hacer la query.
const dbCalls: Array<{ slug: string }> = [];
let nextRow: MockRow | null = { id: 'org-uuid-1', is_active: true };

vi.mock('@/lib/supabase/server', () => ({
    createServiceRoleClient: () => ({
        from(table: string) {
            expect(table).toBe('organizations');
            return {
                select() {
                    return this;
                },
                eq(_col: string, slug: string) {
                    dbCalls.push({ slug });
                    return this;
                },
                async maybeSingle() {
                    return { data: nextRow, error: null };
                },
            };
        },
    }),
    createSupabaseServerClient: async () => ({}),
}));

beforeEach(() => {
    dbCalls.length = 0;
    nextRow = { id: 'org-uuid-1', is_active: true };
});

afterEach(() => {
    vi.clearAllMocks();
});

describe('resolveOrganizationIdBySlug', () => {
    it('rechaza slug null sin tocar DB', async () => {
        const mod = await import('@/lib/organizations');
        const result = await mod.resolveOrganizationIdBySlug(null);
        expect(result).toBeNull();
        expect(dbCalls.length).toBe(0);
    });

    it('rechaza slug vac\u00edo sin tocar DB', async () => {
        const mod = await import('@/lib/organizations');
        const result = await mod.resolveOrganizationIdBySlug('');
        expect(result).toBeNull();
        expect(dbCalls.length).toBe(0);
    });

    it('rechaza slug con caracteres inv\u00e1lidos sin tocar DB', async () => {
        const mod = await import('@/lib/organizations');
        for (const bad of ['A_B', 'con espacio', 'Cesfam!', '..dot', '-inicia-guion', 'termina-guion-']) {
            const result = await mod.resolveOrganizationIdBySlug(bad);
            expect(result, `esperaba null para '${bad}'`).toBeNull();
        }
        expect(dbCalls.length).toBe(0);
    });

    it('rechaza slug muy corto o muy largo sin tocar DB', async () => {
        const mod = await import('@/lib/organizations');
        const short = 'ab';
        const long = 'a'.repeat(61);
        expect(await mod.resolveOrganizationIdBySlug(short)).toBeNull();
        expect(await mod.resolveOrganizationIdBySlug(long)).toBeNull();
        expect(dbCalls.length).toBe(0);
    });

    it('devuelve id cuando el slug existe y est\u00e1 activo', async () => {
        const mod = await import('@/lib/organizations');
        nextRow = { id: 'org-uuid-1', is_active: true };
        const result = await mod.resolveOrganizationIdBySlug('cesfam-lo-hermida');
        expect(result).toBe('org-uuid-1');
        expect(dbCalls).toEqual([{ slug: 'cesfam-lo-hermida' }]);
    });

    it('normaliza mayusculas y espacios antes de consultar', async () => {
        const mod = await import('@/lib/organizations');
        nextRow = { id: 'org-uuid-1', is_active: true };
        const result = await mod.resolveOrganizationIdBySlug('  Cesfam-Lo-Hermida  ');
        expect(result).toBe('org-uuid-1');
        expect(dbCalls).toEqual([{ slug: 'cesfam-lo-hermida' }]);
    });

    it('rechaza cuando la organizaci\u00f3n existe pero est\u00e1 inactiva', async () => {
        const mod = await import('@/lib/organizations');
        nextRow = { id: 'org-uuid-1', is_active: false };
        const result = await mod.resolveOrganizationIdBySlug('cesfam-inactivo');
        expect(result).toBeNull();
    });

    it('rechaza cuando el slug no existe en DB', async () => {
        const mod = await import('@/lib/organizations');
        nextRow = null;
        const result = await mod.resolveOrganizationIdBySlug('cesfam-inexistente');
        expect(result).toBeNull();
    });
});

import { describe, it, expect } from 'vitest';
import { summarizeDAU } from '@/lib/dau/summary';
import type { DAUClassification } from '@/lib/dau/types';

function cls(partial: Partial<DAUClassification>): DAUClassification {
    return {
        record_id: partial.record_id ?? 'r',
        predicted_esi: partial.predicted_esi ?? null,
        status: partial.status ?? 'success',
        decision_source: partial.decision_source ?? 'llm',
        matched_rule: partial.matched_rule ?? null,
        extracted_features: partial.extracted_features ?? {},
        nurse_esi: partial.nurse_esi ?? null,
        agreement: partial.agreement ?? null,
    };
}

describe('summarizeDAU', () => {
    it('cuenta totales, classified y needs_info', () => {
        const s = summarizeDAU([
            cls({ status: 'success', predicted_esi: 3, nurse_esi: 3 }),
            cls({ status: 'needs_info', predicted_esi: null, nurse_esi: 2 }),
            cls({ status: 'success', predicted_esi: 4, nurse_esi: null }),
        ]);
        expect(s.total).toBe(3);
        expect(s.classified).toBe(2);
        expect(s.needs_info).toBe(1);
        expect(s.with_gold_standard).toBe(2);
    });

    it('calcula concordancia simple solo sobre pares comparables', () => {
        const s = summarizeDAU([
            cls({ predicted_esi: 2, nurse_esi: 2 }), // agree
            cls({ predicted_esi: 3, nurse_esi: 4 }), // disagree
            cls({ predicted_esi: 5, nurse_esi: 5 }), // agree
            cls({ status: 'needs_info', predicted_esi: null, nurse_esi: 1 }), // no comparable
        ]);
        expect(s.comparable).toBe(3);
        expect(s.agreements).toBe(2);
        expect(s.simple_agreement).toBeCloseTo(2 / 3, 6);
    });

    it('simple_agreement es null cuando no hay pares comparables', () => {
        const s = summarizeDAU([
            cls({ status: 'needs_info', predicted_esi: null, nurse_esi: 2 }),
            cls({ predicted_esi: 3, nurse_esi: null }),
        ]);
        expect(s.comparable).toBe(0);
        expect(s.simple_agreement).toBeNull();
    });

    it('construye una matriz 5x5 con la orientación predicho×enfermera', () => {
        const s = summarizeDAU([
            cls({ predicted_esi: 1, nurse_esi: 1 }),
            cls({ predicted_esi: 2, nurse_esi: 3 }),
            cls({ predicted_esi: 2, nurse_esi: 3 }),
            cls({ predicted_esi: 5, nurse_esi: 4 }),
        ]);
        expect(s.confusion_matrix).toHaveLength(5);
        expect(s.confusion_matrix.every((row) => row.length === 5)).toBe(true);
        // [predicho-1][enfermera-1]
        expect(s.confusion_matrix[0][0]).toBe(1); // pred1, enf1
        expect(s.confusion_matrix[1][2]).toBe(2); // pred2, enf3 (x2)
        expect(s.confusion_matrix[4][3]).toBe(1); // pred5, enf4
        // La suma de la matriz == comparable
        const sum = s.confusion_matrix.flat().reduce((a, b) => a + b, 0);
        expect(sum).toBe(s.comparable);
    });

    it('ignora ESI inválidos (fuera de 1..5) en la matriz', () => {
        const s = summarizeDAU([
            cls({ predicted_esi: 0 as unknown as number, nurse_esi: 3 }),
            cls({ predicted_esi: 3, nurse_esi: 6 as unknown as number }),
        ]);
        expect(s.comparable).toBe(0);
        expect(s.confusion_matrix.flat().reduce((a, b) => a + b, 0)).toBe(0);
    });

    it('es determinista', () => {
        const data = [
            cls({ predicted_esi: 2, nurse_esi: 2 }),
            cls({ predicted_esi: 3, nurse_esi: 4 }),
        ];
        const first = JSON.stringify(summarizeDAU(data));
        for (let i = 0; i < 20; i++) {
            expect(JSON.stringify(summarizeDAU(data))).toBe(first);
        }
    });
});

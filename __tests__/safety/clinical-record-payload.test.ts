/**
 * buildClinicalRecordPayload tests — verify the helper that assembles
 * the row inserted into the `clinical_records` table from the patient
 * chat state.
 *
 * Regression context: a production e2e on /paciente showed the legacy
 * triage chat persisting `symptoms_text=""` and `conversation_history=[]`
 * because the useChat `onFinish` callback read a stale `messages`
 * closure. The Supabase RLS policy correctly rejected those rows with
 * a 401, but the patient still saw "Evaluación Finalizada". These
 * tests pin the contract the helper must honour going forward.
 *
 * Run standalone:
 *   npx tsx __tests__/safety/clinical-record-payload.test.ts
 */

import {
    SYMPTOMS_TEXT_MIN_LENGTH,
    buildClinicalRecordPayload,
    buildConversationHistory,
    extractSymptomsText,
} from '../../src/lib/utils/clinicalRecord';
import type { TriageResponsePayload } from '../../src/lib/utils/triageRender';

interface TestCase {
    name: string;
    run: () => void;
}

const FAILED: string[] = [];

function assert(cond: unknown, msg: string) {
    if (!cond) throw new Error(`Assertion failed: ${msg}`);
}

function deepEq(a: unknown, b: unknown): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
}

const success: TriageResponsePayload = {
    status: 'success',
    esi_level: 3,
    suggested_action: 'Acuda al CESFAM',
};

const demographics = { gender: 'F', ageGroup: 'Adult' };

const cases: TestCase[] = [
    {
        name: 'extractSymptomsText joins all user free-text turns',
        run: () => {
            const text = extractSymptomsText([
                { role: 'user', content: 'Tengo dolor de cabeza fuerte' },
                { role: 'assistant', content: '{"status":"needs_info"}' },
                { role: 'user', content: 'Desde anoche' },
            ]);
            assert(
                text === 'Tengo dolor de cabeza fuerte\nDesde anoche',
                `unexpected symptoms text: ${JSON.stringify(text)}`,
            );
        },
    },
    {
        name: 'extractSymptomsText skips empty / whitespace user turns',
        run: () => {
            const text = extractSymptomsText([
                { role: 'user', content: '   ' },
                { role: 'user', content: 'Dolor abdominal' },
                { role: 'user', content: '' },
            ]);
            assert(text === 'Dolor abdominal', `got ${JSON.stringify(text)}`);
        },
    },
    {
        name: 'buildConversationHistory maps roles and preserves assistant JSON',
        run: () => {
            const history = buildConversationHistory([
                { role: 'user', content: 'Dolor torácico' },
                { role: 'assistant', content: '{"status":"success","esi_level":2}' },
                { role: 'system', content: 'should be skipped' },
                { role: 'user', content: '   ' },
            ]);
            assert(
                deepEq(history, [
                    { role: 'patient', content: 'Dolor torácico' },
                    {
                        role: 'ai',
                        content: '{"status":"success","esi_level":2}',
                    },
                ]),
                `unexpected history: ${JSON.stringify(history)}`,
            );
        },
    },
    {
        name: 'buildClinicalRecordPayload produces RLS-safe row',
        run: () => {
            const payload = buildClinicalRecordPayload({
                messages: [
                    { role: 'user', content: 'Tengo fiebre alta' },
                    {
                        role: 'assistant',
                        content: '{"status":"needs_info","follow_up_question":"¿Desde cuándo?"}',
                    },
                    { role: 'user', content: 'Desde hace dos días' },
                    {
                        role: 'assistant',
                        content: '{"status":"success","esi_level":3}',
                    },
                ],
                demographics,
                anonymousCode: 'ABC-123',
                aiResponse: success,
            });
            assert(payload !== null, 'payload should not be null');
            if (!payload) return;
            assert(payload.patient_consent === true, 'consent must be true');
            assert(
                payload.symptoms_text.length >= SYMPTOMS_TEXT_MIN_LENGTH,
                'symptoms_text must satisfy RLS length check',
            );
            assert(
                payload.symptoms_text.includes('Tengo fiebre alta'),
                'symptoms_text must include the chief complaint',
            );
            assert(
                payload.symptoms_text.includes('Desde hace dos días'),
                'symptoms_text must include later free-text turns',
            );
            assert(payload.esi_level === 3, 'esi_level must match AI response');
            assert(payload.nurse_validated === false, 'should not pre-validate');
            assert(payload.anonymous_code === 'ABC-123', 'code must round-trip');
            assert(
                payload.patient_gender === 'F' && payload.patient_age_group === 'Adult',
                'demographics must round-trip',
            );
            assert(
                Array.isArray(payload.conversation_history) &&
                    payload.conversation_history.length === 4,
                'conversation_history must contain all turns',
            );
        },
    },
    {
        name: 'buildClinicalRecordPayload rejects empty symptoms (would violate RLS)',
        run: () => {
            const payload = buildClinicalRecordPayload({
                messages: [
                    {
                        role: 'assistant',
                        content: '{"status":"success","esi_level":3}',
                    },
                ],
                demographics,
                anonymousCode: 'ABC-123',
                aiResponse: success,
            });
            assert(payload === null, 'payload must be null when no symptoms captured');
        },
    },
    {
        name: 'buildClinicalRecordPayload rejects sub-minimum symptoms text',
        run: () => {
            const payload = buildClinicalRecordPayload({
                messages: [{ role: 'user', content: 'a' }],
                demographics,
                anonymousCode: 'ABC-123',
                aiResponse: success,
            });
            assert(payload === null, 'payload must be null below RLS minimum');
        },
    },
    {
        name: 'buildClinicalRecordPayload rejects out-of-range ESI levels',
        run: () => {
            for (const esi of [0, 6, 3.5, null]) {
                const payload = buildClinicalRecordPayload({
                    messages: [
                        { role: 'user', content: 'Dolor de cabeza intenso desde ayer' },
                    ],
                    demographics,
                    anonymousCode: 'ABC-123',
                    aiResponse: {
                        ...success,
                        esi_level: esi as unknown as number,
                    },
                });
                assert(
                    payload === null,
                    `payload must be null for esi_level=${String(esi)}`,
                );
            }
        },
    },
    {
        name: 'buildClinicalRecordPayload accepts null demographics',
        run: () => {
            const payload = buildClinicalRecordPayload({
                messages: [
                    { role: 'user', content: 'Dolor de cabeza intenso desde ayer' },
                ],
                demographics: { gender: null, ageGroup: null },
                anonymousCode: 'ABC-123',
                aiResponse: success,
            });
            assert(payload !== null, 'should accept null demographics');
            if (!payload) return;
            assert(
                payload.patient_gender === null && payload.patient_age_group === null,
                'null demographics must round-trip as null',
            );
        },
    },
];

function main() {
    console.log('=== buildClinicalRecordPayload tests ===\n');
    for (const c of cases) {
        try {
            c.run();
            console.log(`✅ ${c.name}`);
        } catch (e) {
            FAILED.push(c.name);
            console.error(`❌ ${c.name}`);
            console.error(`   ${(e as Error).message}`);
        }
    }
    console.log(
        `\nTotal: ${cases.length}  Passed: ${cases.length - FAILED.length}  Failed: ${FAILED.length}`,
    );
    if (FAILED.length > 0) process.exit(1);
}

const isMain =
    typeof require !== 'undefined' &&
    typeof module !== 'undefined' &&
    require.main === module;
if (isMain) {
    main();
}

export { cases };

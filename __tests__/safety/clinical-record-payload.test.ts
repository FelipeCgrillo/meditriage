/**
 * Unit tests for buildClinicalRecordPayload — the helper that produces the
 * Supabase insert payload from the patient chat transcript.
 *
 * The bug this guards against: previously the persistence path captured a
 * stale `messages` closure that could be empty, producing rows with
 * symptoms_text='' and conversation_history=[]. The helper takes messages
 * as an explicit arg so the caller controls the snapshot — these tests
 * pin the contract.
 *
 * Run standalone:
 *   npx tsx __tests__/safety/clinical-record-payload.test.ts
 */

import {
    buildClinicalRecordPayload,
    buildConversationHistory,
    buildSymptomsText,
} from '../../src/lib/utils/clinicalRecord';

const FAILED: string[] = [];

function assert(cond: unknown, msg: string) {
    if (!cond) throw new Error(`Assertion failed: ${msg}`);
}

function deepEq(a: unknown, b: unknown): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
}

interface TestCase {
    name: string;
    run: () => void;
}

const cases: TestCase[] = [
    {
        name: 'buildSymptomsText joins only user messages',
        run: () => {
            const text = buildSymptomsText([
                { role: 'assistant', content: 'Hola' },
                { role: 'user', content: 'Me duele la cabeza' },
                { role: 'assistant', content: '¿Desde cuándo?' },
                { role: 'user', content: 'Desde ayer' },
            ]);
            assert(
                text === 'Me duele la cabeza\nDesde ayer',
                `expected joined user messages, got: ${JSON.stringify(text)}`,
            );
        },
    },
    {
        name: 'buildSymptomsText returns empty string for no user messages',
        run: () => {
            const text = buildSymptomsText([
                { role: 'assistant', content: 'Hola' },
            ]);
            assert(text === '', `expected empty string, got: ${JSON.stringify(text)}`);
        },
    },
    {
        name: 'buildConversationHistory maps roles to patient/ai',
        run: () => {
            const history = buildConversationHistory([
                { role: 'user', content: 'A' },
                { role: 'assistant', content: 'B' },
            ]);
            assert(
                deepEq(history, [
                    { role: 'patient', content: 'A' },
                    { role: 'ai', content: 'B' },
                ]),
                `unexpected history: ${JSON.stringify(history)}`,
            );
        },
    },
    {
        name: 'buildConversationHistory drops system/tool roles',
        run: () => {
            const history = buildConversationHistory([
                { role: 'system', content: 'sys' },
                { role: 'user', content: 'A' },
                { role: 'tool', content: 'tool' },
                { role: 'assistant', content: 'B' },
            ]);
            assert(
                deepEq(history, [
                    { role: 'patient', content: 'A' },
                    { role: 'ai', content: 'B' },
                ]),
                `unexpected history: ${JSON.stringify(history)}`,
            );
        },
    },
    {
        name: 'buildClinicalRecordPayload produces complete row',
        run: () => {
            const payload = buildClinicalRecordPayload({
                messages: [
                    { role: 'user', content: 'Me duele el pecho' },
                    {
                        role: 'assistant',
                        content: '{"status":"success","esi_level":2}',
                    },
                ],
                aiResponse: { status: 'success', esi_level: 2 },
                esiLevel: 2,
                anonymousCode: 'ABC-123',
                gender: 'M',
                ageGroup: 'Adult',
            });

            assert(payload.patient_consent === true, 'consent must be true');
            assert(
                payload.symptoms_text === 'Me duele el pecho',
                `symptoms_text wrong: ${payload.symptoms_text}`,
            );
            assert(payload.esi_level === 2, 'esi_level wrong');
            assert(payload.nurse_validated === false, 'nurse_validated must be false');
            assert(payload.anonymous_code === 'ABC-123', 'anonymous_code wrong');
            assert(payload.patient_gender === 'M', 'gender wrong');
            assert(payload.patient_age_group === 'Adult', 'age group wrong');
            assert(
                payload.conversation_history.length === 2,
                `expected 2 turns, got ${payload.conversation_history.length}`,
            );
            assert(
                payload.conversation_history[0].role === 'patient',
                'first turn must be patient',
            );
            assert(
                payload.conversation_history[1].role === 'ai',
                'second turn must be ai',
            );
        },
    },
    {
        name: 'buildClinicalRecordPayload preserves null demographics',
        run: () => {
            const payload = buildClinicalRecordPayload({
                messages: [{ role: 'user', content: 'sintomas' }],
                aiResponse: {},
                esiLevel: 3,
                anonymousCode: 'X',
                gender: null,
                ageGroup: null,
            });
            assert(payload.patient_gender === null, 'gender must be null');
            assert(payload.patient_age_group === null, 'age group must be null');
        },
    },
    {
        name: 'regression: full chat transcript yields non-empty symptoms and history',
        run: () => {
            // This is the exact failure mode the stale-closure bug produced:
            // empty messages array → symptoms_text='' and conversation_history=[].
            // Pinning here ensures any future refactor cannot reintroduce it.
            const messages = [
                { role: 'user', content: 'Tengo dolor de pecho fuerte' },
                {
                    role: 'assistant',
                    content:
                        '{"status":"needs_info","follow_up_question":"¿Desde cuándo?"}',
                },
                { role: 'user', content: 'Hace 30 minutos' },
                {
                    role: 'assistant',
                    content: '{"status":"success","esi_level":2}',
                },
            ];
            const payload = buildClinicalRecordPayload({
                messages,
                aiResponse: { status: 'success', esi_level: 2 },
                esiLevel: 2,
                anonymousCode: 'CODE-1',
                gender: 'F',
                ageGroup: 'Adult',
            });
            assert(
                payload.symptoms_text.length > 0,
                'symptoms_text must not be empty',
            );
            assert(
                payload.conversation_history.length === 4,
                `conversation_history must have 4 turns, got ${payload.conversation_history.length}`,
            );
        },
    },
];

for (const c of cases) {
    try {
        c.run();
        console.log(`✓ ${c.name}`);
    } catch (e) {
        FAILED.push(c.name);
        console.error(`✗ ${c.name}: ${(e as Error).message}`);
    }
}

if (FAILED.length > 0) {
    console.error(`\n${FAILED.length} test(s) failed`);
    process.exit(1);
} else {
    console.log(`\nAll ${cases.length} tests passed`);
}

/**
 * renderAssistantContent tests — verifies that the patient chat never
 * leaks partial JSON to the user during streaming.
 *
 * Run standalone:
 *   npx tsx __tests__/safety/render-assistant-content.test.ts
 */

import { renderAssistantContent } from '../../src/lib/utils/triageRender';

interface TestCase {
    name: string;
    run: () => void;
}

const FAILED: string[] = [];

function assert(cond: unknown, msg: string) {
    if (!cond) throw new Error(`Assertion failed: ${msg}`);
}

const cases: TestCase[] = [
    {
        name: 'hides bubble while partial JSON is streaming on latest message',
        run: () => {
            const partials = [
                '',
                '{',
                '{"sta',
                '{"status":"needs_info"',
                '{"status":"needs_info","follow_up_question":"¿Desde',
            ];
            for (const raw of partials) {
                const r = renderAssistantContent(raw, true, true);
                assert(r.hideBubble === true, `should hide bubble for "${raw}"`);
                assert(!r.content.includes('{'), `content must not contain braces for "${raw}"`);
                assert(!r.content.includes('status'), `content must not contain JSON keys for "${raw}"`);
            }
        },
    },
    {
        name: 'renders follow_up_question when payload is needs_info',
        run: () => {
            const raw = JSON.stringify({
                status: 'needs_info',
                follow_up_question: '¿Desde cuándo presenta el síntoma?',
                response_options: ['Hoy', 'Hace 2 días', 'Hace 1 semana'],
                esi_level: null,
            });
            const r = renderAssistantContent(raw, false, true);
            assert(r.hideBubble === false, 'should show bubble');
            assert(
                r.content === '¿Desde cuándo presenta el síntoma?',
                `content should be follow-up, got "${r.content}"`,
            );
            assert(
                r.options?.length === 3 && r.options[0] === 'Hoy',
                'quick-reply options should be preserved',
            );
        },
    },
    {
        name: 'renders suggested_action for success payload with esi level',
        run: () => {
            const raw = JSON.stringify({
                status: 'success',
                esi_level: 3,
                suggested_action: 'Acuda al CESFAM en las próximas horas.',
            });
            const r = renderAssistantContent(raw, false, true);
            assert(r.hideBubble === false, 'should show bubble');
            assert(r.content.includes('CESFAM'), 'content should be suggested_action');
            assert(r.esiLevel === 3, 'esiLevel should be propagated');
        },
    },
    {
        name: 'renders fallback error message instead of raw content',
        run: () => {
            const raw = JSON.stringify({
                status: 'success',
                esi_level: null,
                suggested_action:
                    'El asistente clínico no está disponible en este momento.',
                error: true,
                message: 'Servicio de IA no disponible.',
            });
            const r = renderAssistantContent(raw, false, true);
            assert(r.hideBubble === false, 'should show bubble');
            assert(
                r.content.includes('no está disponible'),
                'fallback suggested_action should render',
            );
        },
    },
    {
        name: 'does not hide a non-latest message even if unparseable',
        run: () => {
            // A non-latest assistant message that somehow has no parseable
            // payload should still render *something* (neutral fallback)
            // rather than silently disappearing.
            const r = renderAssistantContent('garbled text', false, false);
            assert(r.hideBubble === false, 'non-latest message must not be hidden');
            assert(r.content.length > 0, 'should render neutral fallback');
            assert(
                !r.content.includes('{') && !r.content.includes('status'),
                'must not leak raw JSON tokens',
            );
        },
    },
    {
        name: 'after stream settles with unparseable content shows neutral fallback',
        run: () => {
            const r = renderAssistantContent('{"status":"success",', false, true);
            assert(r.hideBubble === false, 'should show bubble once stream is settled');
            assert(
                !r.content.includes('{') && !r.content.includes('status'),
                `must not show raw JSON, got "${r.content}"`,
            );
            assert(r.content.length > 0, 'should render a friendly fallback');
        },
    },
    {
        name: 'hides terminal bubble while finalizing (saving) to prevent flicker',
        run: () => {
            const raw = JSON.stringify({
                status: 'success',
                esi_level: 2,
                suggested_action:
                    'Acuda al servicio de urgencias inmediatamente.',
            });
            const r = renderAssistantContent(raw, false, true, true);
            assert(r.hideBubble === true, 'terminal bubble must be hidden during finalize');
            assert(r.content === '', 'no content should leak during finalize');
        },
    },
    {
        name: 'still renders terminal bubble when not finalizing (save failed / no save)',
        run: () => {
            const raw = JSON.stringify({
                status: 'success',
                esi_level: 2,
                suggested_action:
                    'Acuda al servicio de urgencias inmediatamente.',
            });
            const r = renderAssistantContent(raw, false, true, false);
            assert(r.hideBubble === false, 'must show terminal bubble when not finalizing');
            assert(
                r.content.includes('urgencias'),
                'suggested_action must render when finalize flag is off',
            );
        },
    },
    {
        name: 'finalize flag does NOT hide needs_info follow-up bubble',
        run: () => {
            const raw = JSON.stringify({
                status: 'needs_info',
                follow_up_question: '¿Desde cuándo presenta el síntoma?',
                response_options: ['Hoy', 'Hace 2 días'],
                esi_level: null,
            });
            const r = renderAssistantContent(raw, false, true, true);
            assert(r.hideBubble === false, 'needs_info must render even when finalizing');
            assert(r.options?.length === 2, 'options preserved on needs_info under finalize');
        },
    },
    {
        name: 'finalize flag does not affect non-latest assistant messages',
        run: () => {
            const raw = JSON.stringify({
                status: 'success',
                esi_level: 3,
                suggested_action: 'Acuda al CESFAM en las próximas horas.',
            });
            const r = renderAssistantContent(raw, false, false, true);
            assert(
                r.hideBubble === false,
                'older terminal messages must remain visible during finalize',
            );
        },
    },
    {
        name: 'preserves response_options filtering of empty strings',
        run: () => {
            const raw = JSON.stringify({
                status: 'needs_info',
                follow_up_question: '¿Tiene fiebre?',
                response_options: ['Sí', '', '   ', 'No'],
            });
            const r = renderAssistantContent(raw, false, true);
            assert(r.options?.length === 2, 'empty/blank options should be filtered');
            assert(r.options?.[0] === 'Sí' && r.options?.[1] === 'No', 'order preserved');
        },
    },
];

function main() {
    console.log('=== renderAssistantContent tests ===\n');
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
    typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module;
if (isMain) {
    main();
}

export { cases };

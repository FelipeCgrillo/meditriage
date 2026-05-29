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
        name: 'hides bubble for terminal success payload (no clinical leak to patient)',
        run: () => {
            // El paciente NUNCA debe ver la recomendación clínica final
            // ni el nivel ESI. Cuando el payload es terminal, el globo se
            // suprime por completo y la pantalla "Evaluación Finalizada"
            // toma el control de la UX.
            const raw = JSON.stringify({
                status: 'success',
                esi_level: 3,
                suggested_action: 'Acuda al CESFAM en las próximas horas.',
            });
            const r = renderAssistantContent(raw, false, true);
            assert(r.hideBubble === true, 'terminal payload must hide bubble');
            assert(r.content === '', `content must be empty, got "${r.content}"`);
            assert(
                r.esiLevel === 3,
                'esiLevel still propagated (consumed by post-finalize hook)',
            );
        },
    },
    {
        name: 'renders fallback error message instead of raw content',
        run: () => {
            // status='success' pero error=true y esi_level=null -> NO es
            // terminal, debe mostrar el suggested_action de fallback para
            // que el paciente sepa que hubo un problema.
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

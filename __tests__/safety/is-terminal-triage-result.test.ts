/**
 * isTerminalTriageResult tests — verifies the predicate that drives
 * patient-chat finalization. Recreates the production bug where the
 * model emits an ESI-2 classification but no exact `status: 'success'`,
 * and confirms we still finalize.
 *
 * Run standalone:
 *   npx tsx __tests__/safety/is-terminal-triage-result.test.ts
 */

import {
    isTerminalTriageResult,
    renderAssistantContent,
    type TriageResponsePayload,
} from '../../src/lib/utils/triageRender';

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
        name: 'strict success with valid ESI is terminal',
        run: () => {
            const p: TriageResponsePayload = {
                status: 'success',
                esi_level: 2,
                suggested_action: 'Acuda a urgencias.',
            };
            assert(isTerminalTriageResult(p) === true, 'should finalize');
        },
    },
    {
        name: 'ESI with missing status is terminal',
        run: () => {
            const p = {
                esi_level: 2,
                suggested_action: 'Acuda a urgencias.',
            } as TriageResponsePayload;
            assert(isTerminalTriageResult(p) === true, 'missing status must still finalize');
        },
    },
    {
        name: 'ESI with variant status "complete" is terminal',
        run: () => {
            const p = {
                status: 'complete',
                esi_level: 3,
                suggested_action: 'CESFAM en las próximas horas.',
            } as TriageResponsePayload;
            assert(isTerminalTriageResult(p) === true, 'variant status must finalize');
        },
    },
    {
        name: 'ESI with null follow_up_question and undefined options is terminal',
        run: () => {
            const p: TriageResponsePayload = {
                status: 'success',
                esi_level: 1,
                follow_up_question: null,
                suggested_action: 'EMERGENCIA - llame al 131.',
            };
            assert(isTerminalTriageResult(p) === true, 'null follow-up is not actionable');
        },
    },
    {
        name: 'ESI with empty response_options array is terminal',
        run: () => {
            const p: TriageResponsePayload = {
                status: 'success',
                esi_level: 4,
                response_options: [],
                suggested_action: 'Atención no urgente.',
            };
            assert(isTerminalTriageResult(p) === true, 'empty options is not actionable');
        },
    },
    {
        name: 'needs_info with follow-up question is NOT terminal',
        run: () => {
            const p: TriageResponsePayload = {
                status: 'needs_info',
                esi_level: null,
                follow_up_question: '¿Desde cuándo presenta el síntoma?',
                response_options: ['Hoy', 'Hace 2 días'],
            };
            assert(isTerminalTriageResult(p) === false, 'needs_info must not finalize');
        },
    },
    {
        name: 'needs_info with ESI hint but follow-up is NOT terminal',
        run: () => {
            // Defensive: even if the model emits an esi_level guess
            // alongside needs_info, an explicit needs_info status plus
            // a follow-up question means we are still gathering info.
            const p: TriageResponsePayload = {
                status: 'needs_info',
                esi_level: 3,
                follow_up_question: '¿Tiene fiebre?',
                response_options: ['Sí', 'No'],
            };
            assert(isTerminalTriageResult(p) === false, 'must not finalize while asking');
        },
    },
    {
        name: 'missing ESI level is NOT terminal',
        run: () => {
            const p: TriageResponsePayload = {
                status: 'success',
                esi_level: null,
                suggested_action: 'No fue posible clasificar.',
            };
            assert(isTerminalTriageResult(p) === false, 'no ESI level cannot finalize');
        },
    },
    {
        name: 'out-of-range ESI level is NOT terminal',
        run: () => {
            const p = {
                status: 'success',
                esi_level: 7,
                suggested_action: 'Bogus level.',
            } as TriageResponsePayload;
            assert(isTerminalTriageResult(p) === false, 'must validate 1..5');
        },
    },
    {
        name: 'non-integer ESI level is NOT terminal',
        run: () => {
            const p = {
                status: 'success',
                esi_level: 2.5,
                suggested_action: 'Half level.',
            } as TriageResponsePayload;
            assert(isTerminalTriageResult(p) === false, 'must require integer');
        },
    },
    {
        name: 'explicit error payload is NOT terminal',
        run: () => {
            const p: TriageResponsePayload = {
                status: 'success',
                esi_level: 3,
                suggested_action: 'Servicio no disponible.',
                error: true,
                message: 'AI down',
            };
            assert(isTerminalTriageResult(p) === false, 'error payloads must not finalize');
        },
    },
    {
        name: 'status: error is NOT terminal',
        run: () => {
            const p = {
                status: 'error',
                esi_level: 2,
                suggested_action: 'Error',
            } as TriageResponsePayload;
            assert(isTerminalTriageResult(p) === false, 'status:error must not finalize');
        },
    },
    {
        name: 'null/undefined payload is NOT terminal',
        run: () => {
            assert(isTerminalTriageResult(null) === false, 'null must not finalize');
            assert(isTerminalTriageResult(undefined) === false, 'undefined must not finalize');
        },
    },
    {
        name: 'BUG iPhone: status=success + ESI + suggested_action + residual options IS terminal',
        run: () => {
            // Reproduce the reported iPhone bug: model emitted a terminal
            // recommendation (ESI 3 + suggested_action) but also left a
            // residual response_options template from a previous turn.
            // Old code rejected this as non-terminal → chat stuck.
            const p: TriageResponsePayload = {
                status: 'success',
                esi_level: 3,
                suggested_action: 'Dirígete al área de urgencias para evaluación médica.',
                response_options: ['Sí', 'No'],
            };
            assert(
                isTerminalTriageResult(p) === true,
                'explicit success + ESI must finalize even with leftover options',
            );
        },
    },
    {
        name: 'BUG iPhone: success + ESI + follow_up_question string still finalizes',
        run: () => {
            const p: TriageResponsePayload = {
                status: 'success',
                esi_level: 2,
                suggested_action: 'Acuda inmediatamente.',
                follow_up_question: 'Texto residual',
            };
            assert(
                isTerminalTriageResult(p) === true,
                'explicit success ignores residual follow-up',
            );
        },
    },
    {
        name: 'options with only whitespace are not actionable',
        run: () => {
            const p: TriageResponsePayload = {
                status: 'success',
                esi_level: 2,
                response_options: ['', '   '],
                suggested_action: 'Acuda a urgencias.',
            };
            assert(isTerminalTriageResult(p) === true, 'whitespace-only options should be ignored');
        },
    },
    {
        name: 'renderAssistantContent on terminal payload (no options) renders cleanly',
        run: () => {
            const raw = JSON.stringify({
                status: 'success',
                esi_level: 2,
                suggested_action: 'ACUDE A URGENCIAS DE INMEDIATO',
            });
            const r = renderAssistantContent(raw, false, true);
            assert(r.hideBubble === false, 'terminal bubble must be visible');
            assert(r.esiLevel === 2, 'ESI should surface for the badge');
            assert(!r.options || r.options.length === 0, 'no options expected');
        },
    },
];

function main() {
    console.log('=== isTerminalTriageResult tests ===\n');
    for (const c of cases) {
        try {
            c.run();
            console.log(`✓ ${c.name}`);
        } catch (e) {
            FAILED.push(c.name);
            console.error(`✗ ${c.name}: ${(e as Error).message}`);
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

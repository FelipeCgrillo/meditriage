/**
 * extractJSON tests — verifies the tolerant LLM JSON parser used by the
 * patient chat to extract the structured triage response from the
 * assistant bubble.
 *
 * Run standalone:
 *   npx tsx __tests__/safety/extract-json.test.ts
 */

import { extractJSON } from '../../src/lib/utils/validation';

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

const cases: TestCase[] = [
    {
        name: 'parses plain JSON object',
        run: () => {
            const obj = { status: 'success', esi_level: 4 };
            const got = extractJSON(JSON.stringify(obj));
            assert(deepEq(got, obj), `expected ${JSON.stringify(obj)}, got ${JSON.stringify(got)}`);
        },
    },
    {
        name: 'parses JSON wrapped in markdown code fence',
        run: () => {
            const obj = { status: 'needs_info', follow_up_question: '¿Desde cuándo?' };
            const fenced = '```json\n' + JSON.stringify(obj) + '\n```';
            const got = extractJSON(fenced);
            assert(deepEq(got, obj), 'fenced JSON should parse');
        },
    },
    {
        name: 'parses JSON preceded by stray prose',
        run: () => {
            const obj = { status: 'success', esi_level: 3, suggested_action: 'Acuda al CESFAM' };
            const messy = 'Aquí está la respuesta clínica:\n' + JSON.stringify(obj);
            const got = extractJSON(messy);
            assert(deepEq(got, obj), 'should extract trailing JSON');
        },
    },
    {
        name: 'returns null for partial / unterminated JSON',
        run: () => {
            const got = extractJSON('{"status":"success",');
            assert(got === null, `expected null, got ${JSON.stringify(got)}`);
        },
    },
    {
        name: 'returns null for empty or non-string input',
        run: () => {
            assert(extractJSON('') === null, 'empty string -> null');
            assert(extractJSON(null as any) === null, 'null -> null');
            assert(extractJSON(undefined as any) === null, 'undefined -> null');
        },
    },
    {
        name: 'handles braces inside string fields',
        run: () => {
            const obj = { suggested_action: 'Tome 2 paracetamol cada {6} horas' };
            const got = extractJSON(JSON.stringify(obj));
            assert(deepEq(got, obj), 'should not be confused by braces in strings');
        },
    },
    {
        name: 'handles escaped quotes inside string fields',
        run: () => {
            const obj = { suggested_action: 'Diga "estoy bien" al personal' };
            const got = extractJSON(JSON.stringify(obj));
            assert(deepEq(got, obj), 'escaped quotes should not break the scanner');
        },
    },
];

function main() {
    console.log('=== extractJSON tests ===\n');
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
    console.log(`\nTotal: ${cases.length}  Passed: ${cases.length - FAILED.length}  Failed: ${FAILED.length}`);
    if (FAILED.length > 0) process.exit(1);
}

const isMain =
    typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module;
if (isMain) {
    main();
}

export { cases };

import type { TriageFeatures } from './cmd';
import { ESI_RULES, CRITICAL_RULES } from './rules';

/**
 * Motor de reglas determinista del triage ESI.
 *
 * Es la capa de SALVAGUARDA del patrón safeguard híbrido:
 *   - El LLM extrae las features del CMD y propone un nivel ESI.
 *   - `evaluateRules(features)` corre como verificación determinista.
 *   - En route.ts, si el motor detecta ESI 1/2 y el LLM propuso algo menos
 *     grave, GANA el motor (principio del peor caso).
 *
 * Propiedades clave:
 *   - DETERMINISTA: mismas features → misma salida, siempre. No usa azar,
 *     reloj ni estado externo. Esto es lo que la tesis puede afirmar como
 *     "determinismo del motor de reglas" (NO del LLM).
 *   - FALLO SEGURO: si faltan datos para descartar un criterio crítico
 *     (ESI 1/2), devuelve `needsInfo=true` con la lista de datos faltantes.
 *     NUNCA adivina un nivel seguro ante ausencia de información.
 *
 * RESTRICCIÓN CLÍNICA: opera solo sobre datos AUTO-REPORTADOS del CMD; no
 * asume signos vitales instrumentados (ver cmd.ts / rules.ts).
 */

/** Resultado de la evaluación determinista del motor de reglas. */
export interface RuleEvaluation {
    /** Id de la primera regla que disparó (o null si ninguna). */
    matchedRule: string | null;
    /** Nivel ESI asignado por el motor (o null si no hay match determinista). */
    esiLevel: number | null;
    /** Ids de TODAS las reglas que dispararon (en orden jerárquico). */
    firedRules: string[];
    /** Justificación clínica de la regla ganadora (o del fallo seguro). */
    rationale: string;
    /** true si faltan datos críticos para descartar ESI 1/2 con seguridad. */
    needsInfo: boolean;
    /** Lista de datos críticos ausentes que motivan needs_info. */
    missingCritical: string[];
}

/**
 * Conjunto mínimo de features que deben estar presentes (no `undefined` ni
 * 'no_referido') para poder DESCARTAR con seguridad los criterios críticos
 * ESI 1/2. Si faltan y ninguna regla crítica disparó, el motor exige más
 * información en lugar de asumir que el paciente está estable.
 */
const CRITICAL_FEATURE_CHECKS: Array<{
    field: string;
    isMissing: (f: TriageFeatures) => boolean;
}> = [
    {
        field: 'consciousness_reported',
        isMissing: (f) => f.consciousness_reported === undefined || f.consciousness_reported === 'no_referido',
    },
    {
        field: 'respiratory_difficulty_reported',
        isMissing: (f) => f.respiratory_difficulty_reported === undefined || f.respiratory_difficulty_reported === 'no_referido',
    },
    {
        field: 'suicidal_ideation',
        isMissing: (f) => f.suicidal_ideation === undefined,
    },
];

/**
 * Evalúa las features del CMD contra el catálogo de reglas en orden
 * jerárquico (ESI1 → ESI5). Determinista y sin efectos secundarios.
 */
export function evaluateRules(features: TriageFeatures): RuleEvaluation {
    const firedRules: string[] = [];
    let winner: { id: string; esiLevel: number; rationale: string } | null = null;

    // Recorre TODAS las reglas en orden jerárquico. La primera que dispara
    // (la más grave, por el orden del catálogo) gana; las demás se registran
    // en firedRules para trazabilidad.
    for (const rule of ESI_RULES) {
        let fired = false;
        try {
            fired = rule.evaluate(features);
        } catch {
            // Un predicado nunca debería lanzar; si lo hace, lo tratamos como
            // no disparado para no romper el determinismo del motor.
            fired = false;
        }
        if (fired) {
            firedRules.push(rule.id);
            if (winner === null) {
                winner = { id: rule.id, esiLevel: rule.esiLevel, rationale: rule.rationale };
            }
        }
    }

    if (winner) {
        return {
            matchedRule: winner.id,
            esiLevel: winner.esiLevel,
            firedRules,
            rationale: winner.rationale,
            needsInfo: false,
            missingCritical: [],
        };
    }

    // Ninguna regla disparó. Antes de declarar "no crítico", aplicamos el
    // FALLO SEGURO: si faltan features para descartar ESI 1/2, exigimos más
    // información en lugar de asumir estabilidad.
    const missingCritical = CRITICAL_FEATURE_CHECKS.filter((c) => c.isMissing(features)).map((c) => c.field);

    if (missingCritical.length > 0) {
        return {
            matchedRule: null,
            esiLevel: null,
            firedRules,
            rationale:
                'Fallo seguro: faltan datos auto-reportados para descartar criterios críticos (ESI 1/2). Se solicita más información antes de clasificar.',
            needsInfo: true,
            missingCritical,
        };
    }

    // No hay criterio crítico y los datos mínimos están presentes: el motor no
    // fuerza un nivel; la asignación dentro del rango NO crítico (ESI 3/4/5)
    // queda a cargo del LLM por estimación de recursos (ver route.ts).
    return {
        matchedRule: null,
        esiLevel: null,
        firedRules,
        rationale:
            'Sin disparo de reglas críticas y con datos mínimos presentes: clasificación en rango no crítico (ESI 3-5) delegada a la estimación de recursos.',
        needsInfo: false,
        missingCritical: [],
    };
}

/**
 * Indica si la evaluación del motor representa un criterio crítico (ESI 1/2).
 * Útil para el override del peor caso en route.ts.
 */
export function isCriticalEvaluation(evaluation: RuleEvaluation): boolean {
    return evaluation.esiLevel === 1 || evaluation.esiLevel === 2;
}

/** Ids de las reglas críticas disponibles, para introspección/tests. */
export const CRITICAL_RULE_IDS: string[] = CRITICAL_RULES.map((r) => r.id);

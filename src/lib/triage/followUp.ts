/**
 * Helpers puros del ciclo de repreguntas del chat de triage.
 *
 * Resuelven tres fallas observadas en conversaciones reales:
 *
 *  1. PREGUNTAS COMPUESTAS. El modelo agrupaba varias preguntas en un turno
 *     ("¿intensidad del dolor? ¿y fiebre?"), pero la UI solo admite UNA
 *     respuesta por turno (un botón, o una frase). Las partes sin responder
 *     volvían a preguntarse turno tras turno. `enforceSingleQuestion` recorta
 *     al primer interrogante, que es el que las opciones rápidas contestan.
 *
 *  2. FALTA DE MEMORIA. Las respuestas por botón viajaban como texto suelto
 *     ("Sangrado moderado") sin decir qué pregunta contestaban.
 *     `buildAnsweredQuestionsMessage` reconstruye ese pareo para el modelo.
 *
 *  3. BUCLE DEL MOTOR DE REGLAS. El motor exige conciencia, dificultad
 *     respiratoria e ideación suicida para descartar ESI 1/2. Si el modelo no
 *     los preguntaba, el motor forzaba `needs_info` indefinidamente.
 *     `buildCriticalScreeningQuestion` arma UNA pregunta de tamizaje que cubre
 *     justo los campos faltantes, y `countRuleEngineFollowUps` permite acotar
 *     cuántas veces se repregunta antes de salir con una clasificación segura.
 *
 * Módulo sin dependencias de React ni del SDK, para poder testearse solo.
 */

/** Pareo de una pregunta del asistente con la respuesta del paciente. */
export interface AnsweredQuestion {
    question: string;
    answer: string;
}

/**
 * Recorta un texto de repregunta a UNA sola pregunta.
 *
 * Conserva el primer interrogante completo y descarta lo que venga después.
 * Las opciones rápidas que acompañan a una pregunta compuesta siempre
 * corresponden a su primera parte, así que el recorte y los botones quedan
 * alineados.
 */
export function enforceSingleQuestion(text: string | null | undefined): string {
    const trimmed = (text ?? '').trim();
    if (!trimmed) return '';
    const end = trimmed.indexOf('?');
    // Sin cierre de interrogación, o el cierre ya es el final: nada que recortar.
    if (end === -1 || end === trimmed.length - 1) return trimmed;
    return trimmed.slice(0, end + 1).trim();
}

/**
 * Construye el bloque de contexto con las preguntas ya respondidas.
 *
 * Devuelve cadena vacía cuando no hay ninguna, para no inyectar ruido en el
 * prompt durante el primer turno.
 */
export function buildAnsweredQuestionsMessage(
    answered: AnsweredQuestion[] | null | undefined,
): string {
    const pairs = (answered ?? []).filter(
        (a) =>
            a &&
            typeof a.question === 'string' &&
            typeof a.answer === 'string' &&
            a.question.trim().length > 0 &&
            a.answer.trim().length > 0,
    );
    if (pairs.length === 0) return '';

    const lines = pairs
        .map((a) => `- «${a.question.trim()}» → el paciente respondió «${a.answer.trim()}».`)
        .join('\n');

    return `### PREGUNTAS YA RESPONDIDAS EN ESTA CONVERSACIÓN
${lines}

NO vuelvas a preguntar ninguna de ellas, ni en otras palabras. Si necesitas otro dato, pregunta algo DISTINTO.`;
}

/** Etiqueta breve de cada criterio crítico, para las opciones del tamizaje. */
const CRITICAL_FIELD_OPTION: Record<string, string> = {
    consciousness_reported: 'Confusión o desmayo',
    respiratory_difficulty_reported: 'Dificultad para respirar',
    suicidal_ideation: 'Pensamientos de dañarme',
};

/** Orden estable de presentación de las opciones de tamizaje. */
const CRITICAL_FIELD_ORDER = [
    'respiratory_difficulty_reported',
    'consciousness_reported',
    'suicidal_ideation',
];

export interface CriticalScreening {
    question: string;
    options: string[];
}

/**
 * Arma la pregunta de tamizaje de signos de alarma a partir de los criterios
 * críticos que el motor de reglas todavía no puede descartar.
 *
 * Es UNA sola pregunta con opciones cerradas, de modo que el paciente pueda
 * cubrir todos los criterios faltantes con un toque cuando no presenta
 * ninguno. Reemplaza al texto genérico fijo que preguntaba siempre lo mismo,
 * incluso por criterios que el paciente ya había descartado.
 */
export function buildCriticalScreeningQuestion(
    missingCritical: string[] | null | undefined,
): CriticalScreening {
    const missing = (missingCritical ?? []).filter((f) => f in CRITICAL_FIELD_OPTION);
    const ordered = CRITICAL_FIELD_ORDER.filter((f) => missing.includes(f));
    const options = ordered.map((f) => CRITICAL_FIELD_OPTION[f]);

    return {
        question:
            'Antes de clasificar necesito descartar signos de alarma. ¿Presenta alguno de estos en este momento?',
        options: [...options, 'Ninguno de estos'],
    };
}

/**
 * Cuenta cuántas veces el motor de reglas ya forzó una repregunta en la
 * conversación, leyendo los turnos previos del asistente.
 *
 * Se usa para acotar el ciclo: sin este tope, un paciente cuyo relato nunca
 * menciona los criterios críticos puede quedar atrapado respondiendo la misma
 * pregunta de tamizaje sin llegar nunca a una clasificación.
 */
export function countRuleEngineFollowUps(
    messages: Array<{ role: string; content: string }> | null | undefined,
): number {
    if (!messages) return 0;
    let count = 0;
    for (const m of messages) {
        if (m?.role !== 'assistant' || typeof m.content !== 'string') continue;
        try {
            const start = m.content.indexOf('{');
            const end = m.content.lastIndexOf('}');
            if (start === -1 || end <= start) continue;
            const parsed = JSON.parse(m.content.slice(start, end + 1)) as {
                status?: string;
                decision_source?: string;
            };
            if (parsed.status === 'needs_info' && parsed.decision_source === 'rule_engine') {
                count += 1;
            }
        } catch {
            // Turno no parseable: no cuenta.
        }
    }
    return count;
}

/**
 * Máximo de repreguntas de tamizaje que el motor puede forzar antes de salir
 * con una clasificación segura. Dos intentos bastan para que un paciente que
 * va a responder responda; más allá de eso el ciclo solo agrega fricción.
 */
export const MAX_RULE_ENGINE_FOLLOW_UPS = 2;

/**
 * Nivel ESI de salida cuando se agota el tamizaje sin poder descartar ESI 1/2.
 *
 * Es una salida CONSERVADORA, no un "no sé": deriva a atención presencial el
 * mismo día (ESI 3 → same_day_primary_care) en vez de mandar al paciente a la
 * casa. Si el modelo ya proponía algo más grave, se conserva lo más grave.
 */
export const RULE_ENGINE_SAFE_EXIT_ESI = 3;

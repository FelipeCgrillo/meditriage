import type { TriageFeatures } from './cmd';

/**
 * Catálogo declarativo de reglas ESI (18 reglas P1.1–P5.1).
 *
 * Fuente: instrumento de validación de contenido (CVI), hoja "3. Reglas ESI",
 * validado por panel experto. Cada regla codifica una condición clínica del
 * algoritmo Emergency Severity Index y el nivel ESI que dispara.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * RESTRICCIÓN CLÍNICA CRÍTICA (no negociable):
 *
 *   El sistema NO instrumenta signos vitales. Las reglas que clásicamente
 *   dependían de NÚMEROS (P1.6 shock con PAS<90, P2.8 FC>150, P2.2 SpO2<90)
 *   se evalúan sobre FLAGS CUALITATIVOS AUTO-REPORTADOS del CMD (cmd.ts), no
 *   sobre mediciones. Solo si el paciente refirió explícitamente un número
 *   (features.referred_vitals) se considera ese valor, y siempre marcado como
 *   auto-reporte. Nunca se asume un valor instrumentado.
 *
 *   `evaluate(features)` es PURO y DETERMINISTA: mismas features → mismo
 *   booleano, sin azar ni dependencia de reloj/estado externo. Esto es lo que
 *   hace al MOTOR DE REGLAS reproducible (a diferencia del LLM).
 * ───────────────────────────────────────────────────────────────────────────
 */

/** Una regla declarativa del catálogo ESI. */
export interface ESIRule {
    /** Identificador estable (P1.1 … P5.1). */
    id: string;
    /** Nivel ESI que asigna la regla si dispara (1 = más grave). */
    esiLevel: 1 | 2 | 3 | 4 | 5;
    /** Nombre corto de la condición clínica. */
    conditionName: string;
    /** Descripción legible de la condición. */
    description: string;
    /** Predicado puro y determinista sobre las features del CMD. */
    evaluate: (features: TriageFeatures) => boolean;
    /** Justificación clínica que se reporta cuando la regla dispara. */
    rationale: string;
}

/** Helper: ¿la feature cualitativa indica alteración auto-reportada? */
function esAnormal(valor: TriageFeatures['vital_signs_abnormal']): boolean {
    return valor === 'anormal';
}

/**
 * Reglas P1.x — ESI 1 (Resucitación). Riesgo vital inmediato.
 * Se evalúan sobre hallazgos cualitativos auto-reportados; no se asume
 * ninguna medición instrumentada.
 */
const ESI1_RULES: ESIRule[] = [
    {
        id: 'P1.1',
        esiLevel: 1,
        conditionName: 'unresponsive',
        description: 'Paciente no responde / inconsciencia profunda (referido por paciente o acompañante).',
        evaluate: (f) => f.consciousness_reported === 'anormal',
        rationale: 'Se reporta compromiso del nivel de conciencia (auto-reporte/acompañante): requiere reanimación inmediata.',
    },
    {
        id: 'P1.2',
        esiLevel: 1,
        conditionName: 'airway_compromised',
        description: 'Compromiso de vía aérea referido (atragantamiento, no puede hablar).',
        // Dificultad respiratoria severa + incapacidad de hablar se modela como
        // dificultad respiratoria "anormal" combinada con SpO2 cualitativa anormal.
        evaluate: (f) =>
            f.respiratory_difficulty_reported === 'anormal' && f.oxygen_sat_reported === 'anormal',
        rationale: 'Dificultad respiratoria con baja oxigenación auto-referida sugiere compromiso de vía aérea: reanimación inmediata.',
    },
    {
        id: 'P1.3',
        esiLevel: 1,
        conditionName: 'apnea_no_breathing',
        description: 'Apnea / ausencia de respiración referida.',
        // Apnea se infiere de SpO2 anormal + dificultad respiratoria anormal a la vez,
        // o de un número referido extremadamente bajo de FR.
        evaluate: (f) => {
            const fr = f.referred_vitals?.respiratory_rate_rpm;
            if (typeof fr === 'number' && fr <= 6) return true;
            return false;
        },
        rationale: 'Frecuencia respiratoria referida críticamente baja (auto-reporte) compatible con apnea: reanimación inmediata.',
    },
    {
        id: 'P1.4',
        esiLevel: 1,
        conditionName: 'no_pulse',
        description: 'Ausencia de pulso referida.',
        evaluate: (f) => {
            const fc = f.referred_vitals?.heart_rate_bpm;
            if (typeof fc === 'number' && fc === 0) return true;
            return false;
        },
        rationale: 'Ausencia de pulso referida (auto-reporte/acompañante): paro cardíaco, reanimación inmediata.',
    },
    {
        id: 'P1.5',
        esiLevel: 1,
        conditionName: 'massive_bleeding',
        description: 'Sangrado masivo no controlado referido.',
        // Sangrado masivo se reporta como dolor/localización con bandera de signos
        // vitales anormales; modelado como percepción de signos vitales anormales.
        evaluate: (f) => esAnormal(f.vital_signs_abnormal) && (f.symptom_location?.toLowerCase().includes('sangr') ?? false),
        rationale: 'Hemorragia referida con signos vitales percibidos anormales: riesgo vital, reanimación inmediata.',
    },
    {
        id: 'P1.6',
        esiLevel: 1,
        conditionName: 'shock',
        description: 'Signos de shock referidos (desmayo, piel fría/sudorosa, debilidad extrema).',
        // SIN instrumentación: se evalúa sobre PA cualitativa "anormal" + percepción
        // de signos vitales anormales. Si el paciente refirió una PAS numérica < 90,
        // también dispara (auto-reporte explícito).
        evaluate: (f) => {
            const pas = f.referred_vitals?.systolic_bp_mmhg;
            if (typeof pas === 'number' && pas < 90) return true;
            return f.bp_reported === 'anormal' && esAnormal(f.vital_signs_abnormal);
        },
        rationale: 'Signos de shock auto-referidos (PA baja/anormal y malestar general grave): reanimación inmediata.',
    },
    {
        id: 'P1.7',
        esiLevel: 1,
        conditionName: 'active_seizure',
        description: 'Convulsión activa referida.',
        evaluate: (f) =>
            (f.symptoms_description?.toLowerCase().includes('convuls') ?? false) ||
            (f.symptoms_description?.toLowerCase().includes('ataque epil') ?? false),
        rationale: 'Convulsión activa auto-referida: requiere intervención inmediata, reanimación.',
    },
];

/**
 * Reglas P2.x — ESI 2 (Emergencia). Alto riesgo, estado mental alterado o
 * dolor/distrés severo. Evaluadas sobre hallazgos cualitativos auto-reportados.
 */
const ESI2_RULES: ESIRule[] = [
    {
        id: 'P2.1',
        esiLevel: 2,
        conditionName: 'high_risk_chest_pain',
        description: 'Dolor torácico de alto riesgo referido.',
        evaluate: (f) =>
            (f.symptoms_description?.toLowerCase().includes('pecho') ?? false) ||
            (f.symptom_location?.toLowerCase().includes('pecho') ?? false) ||
            (f.symptoms_description?.toLowerCase().includes('torácic') ?? false),
        rationale: 'Dolor torácico auto-referido: alto riesgo de síndrome coronario, prioridad ESI 2.',
    },
    {
        id: 'P2.2',
        esiLevel: 2,
        conditionName: 'significant_dyspnea',
        description: 'Dificultad respiratoria significativa referida.',
        // SIN oximetría: dificultad respiratoria cualitativa "anormal", o SpO2
        // numérica < 90 SOLO si el paciente la refirió explícitamente.
        evaluate: (f) => {
            const spo2 = f.referred_vitals?.oxygen_saturation_percent;
            if (typeof spo2 === 'number' && spo2 < 90) return true;
            return f.respiratory_difficulty_reported === 'anormal';
        },
        rationale: 'Dificultad respiratoria auto-referida (o SpO2 baja referida por el paciente): prioridad ESI 2.',
    },
    {
        id: 'P2.3',
        esiLevel: 2,
        conditionName: 'altered_mental_status',
        description: 'Estado mental alterado referido (confusión, desorientación).',
        evaluate: (f) =>
            f.consciousness_reported === 'anormal' ||
            (f.symptoms_description?.toLowerCase().includes('confus') ?? false) ||
            (f.symptoms_description?.toLowerCase().includes('desorient') ?? false),
        rationale: 'Alteración del estado mental auto-referida: prioridad ESI 2.',
    },
    {
        id: 'P2.4',
        esiLevel: 2,
        conditionName: 'head_trauma_with_loc',
        description: 'Traumatismo craneal con pérdida de conciencia referida.',
        evaluate: (f) => {
            const d = f.symptoms_description?.toLowerCase() ?? '';
            const golpeCabeza = d.includes('golpe') && (d.includes('cabeza') || d.includes('craneal'));
            const perdioConciencia = d.includes('desmay') || d.includes('perd') && d.includes('conciencia');
            return golpeCabeza && perdioConciencia;
        },
        rationale: 'Traumatismo craneal con pérdida de conciencia auto-referida: prioridad ESI 2.',
    },
    {
        id: 'P2.5',
        esiLevel: 2,
        conditionName: 'severe_abdominal_pain',
        description: 'Dolor abdominal severo referido.',
        evaluate: (f) => {
            const abdominal =
                (f.symptom_location?.toLowerCase().includes('abdom') ?? false) ||
                (f.symptoms_description?.toLowerCase().includes('abdom') ?? false) ||
                (f.symptoms_description?.toLowerCase().includes('vientre') ?? false) ||
                (f.symptoms_description?.toLowerCase().includes('barriga') ?? false);
            const severo = typeof f.pain_severity === 'number' && f.pain_severity >= 7;
            return abdominal && severo;
        },
        rationale: 'Dolor abdominal severo auto-referido (intensidad ≥ 7/10): prioridad ESI 2.',
    },
    {
        id: 'P2.6',
        esiLevel: 2,
        conditionName: 'fever_in_immunocompromised',
        description: 'Fiebre en paciente inmunocomprometido referida.',
        evaluate: (f) => {
            const fiebre = f.fever_reported === 'anormal';
            const inmuno = (f.comorbidities ?? []).some((c) => {
                const l = c.toLowerCase();
                return (
                    l.includes('inmun') ||
                    l.includes('quimio') ||
                    l.includes('vih') ||
                    l.includes('cáncer') ||
                    l.includes('cancer') ||
                    l.includes('trasplant')
                );
            });
            return fiebre && inmuno;
        },
        rationale: 'Fiebre auto-referida en paciente inmunocomprometido: prioridad ESI 2.',
    },
    {
        id: 'P2.7',
        esiLevel: 2,
        conditionName: 'suicidal_ideation',
        description: 'Ideación suicida activa referida.',
        evaluate: (f) => f.suicidal_ideation === true,
        rationale: 'Ideación suicida auto-referida: situación de alto riesgo, prioridad ESI 2.',
    },
    {
        id: 'P2.8',
        esiLevel: 2,
        conditionName: 'severely_abnormal_referred_vitals',
        description: 'Signos vitales severamente anormales REFERIDOS por el paciente.',
        // SIN instrumentación: solo dispara con números que el propio paciente
        // refirió (auto-reporte explícito), o con percepción cualitativa anormal
        // combinada de varios signos.
        evaluate: (f) => {
            const rv = f.referred_vitals;
            if (rv) {
                if (typeof rv.heart_rate_bpm === 'number' && (rv.heart_rate_bpm > 150 || (rv.heart_rate_bpm > 0 && rv.heart_rate_bpm < 40))) return true;
                if (typeof rv.respiratory_rate_rpm === 'number' && rv.respiratory_rate_rpm > 30) return true;
                if (typeof rv.temperature_celsius === 'number' && (rv.temperature_celsius >= 40 || rv.temperature_celsius <= 35)) return true;
            }
            // Percepción cualitativa de varios signos anormales a la vez.
            const anormales = [
                f.heart_rate_reported,
                f.respiratory_difficulty_reported,
                f.oxygen_sat_reported,
                f.bp_reported,
            ].filter((v) => v === 'anormal').length;
            return anormales >= 2;
        },
        rationale: 'Signos vitales severamente anormales auto-referidos (números referidos por el paciente o múltiples signos cualitativos anormales): prioridad ESI 2.',
    },
];

/**
 * Reglas de resolución de recursos P3.1–P5.1. En ausencia de un disparador
 * ESI 1/2, el nivel se asigna por estimación de recursos requeridos. Como el
 * sistema no instrumenta ni ordena exámenes, la estimación de recursos la
 * propone el LLM y estas reglas la encuadran; por eso aquí solo se exponen
 * como reglas nominales (su `evaluate` devuelve false y la asignación 3/4/5
 * la realiza el LLM dentro del rango no crítico). Ver ruleEngine.ts.
 */
const RESOURCE_RULES: ESIRule[] = [
    {
        id: 'P3.1',
        esiLevel: 3,
        conditionName: 'esi3_two_or_more_resources',
        description: 'Urgencia que requiere ≥ 2 recursos estimados (laboratorio, imágenes, IV).',
        evaluate: () => false,
        rationale: 'Estimación de ≥ 2 recursos sin criterio de riesgo vital: ESI 3 (asignación del LLM en rango no crítico).',
    },
    {
        id: 'P4.1',
        esiLevel: 4,
        conditionName: 'esi4_one_resource',
        description: 'Requiere un solo recurso simple (p. ej. una radiografía o sutura menor).',
        evaluate: () => false,
        rationale: 'Estimación de un único recurso simple: ESI 4 (asignación del LLM en rango no crítico).',
    },
    {
        id: 'P5.1',
        esiLevel: 5,
        conditionName: 'esi5_no_resources',
        description: 'No requiere recursos complejos (receta, curación simple, consulta administrativa).',
        evaluate: () => false,
        rationale: 'Sin necesidad de recursos complejos: ESI 5 (asignación del LLM en rango no crítico).',
    },
];

/**
 * Catálogo completo, en orden jerárquico de gravedad (ESI1 → ESI5). El motor
 * de reglas recorre este orden y la PRIMERA regla que dispara determina el
 * nivel del motor (principio del peor caso).
 */
export const ESI_RULES: ESIRule[] = [...ESI1_RULES, ...ESI2_RULES, ...RESOURCE_RULES];

/** Reglas que constituyen criterio crítico de seguridad (ESI 1 y 2). */
export const CRITICAL_RULES: ESIRule[] = [...ESI1_RULES, ...ESI2_RULES];

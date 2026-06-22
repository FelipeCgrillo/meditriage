import { z } from 'zod';

/**
 * CMD — Conjunto Mínimo de Datos de triage clínico (validado por panel
 * experto, CVI). Define las variables que el sistema captura de forma
 * ESTRUCTURADA a partir de la conversación con el paciente.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * RESTRICCIÓN CLÍNICA CRÍTICA (no negociable):
 *
 *   El sistema NO instrumenta signos vitales. NO hay esfigmomanómetro,
 *   oxímetro, termómetro ni monitor conectado. TODOS los valores de este
 *   CMD son AUTO-REPORTADOS por el paciente en el chat (o extraídos de lo
 *   que el paciente refiere espontáneamente o al ser preguntado).
 *
 *   Por eso las variables que clásicamente serían mediciones numéricas
 *   (SpO2, FC, FR, PA, temperatura, nivel de conciencia) se modelan como
 *   FLAGS CUALITATIVOS auto-reportados (enums: normal / anormal / no_sabe /
 *   no_referido), nunca como números asumidos por instrumentación. Si el
 *   paciente refiere un número explícito, se conserva por separado en
 *   `referred_vitals` con una marca clara de que es auto-reporte.
 *
 *   Todas las variables clínicas son OPCIONALES: el paciente puede no haber
 *   referido el dato. La ausencia de un dato crítico NO se interpreta como
 *   "normal"; el motor de reglas la trata como información faltante
 *   (`needs_info`).
 * ───────────────────────────────────────────────────────────────────────────
 *
 * Composición del CMD: 17 variables clínicas (V1–V18, con V10 retirada por
 * el panel) + 2 variables de metadata (V19 consentimiento, V20 código
 * anónimo) = 19 variables operativas sobre las 20 originales del CVI.
 */

/**
 * Enum cualitativo común para signos referidos que NO se instrumentan.
 *  - 'normal'      → el paciente refiere que está normal / sin alteración.
 *  - 'anormal'     → el paciente refiere una alteración (p. ej. "respiro mal").
 *  - 'no_sabe'     → el paciente no sabe / no puede estimarlo.
 *  - 'no_referido' → no se mencionó en la conversación (dato ausente).
 */
export const ReferidoCualitativo = z.enum(['normal', 'anormal', 'no_sabe', 'no_referido']);
export type ReferidoCualitativo = z.infer<typeof ReferidoCualitativo>;

/** V2 — temporalidad de inicio de los síntomas, según refiere el paciente. */
export const InicioSintoma = z.enum([
    'menos_1_hora',
    '1_6_horas',
    '6_24_horas',
    'mas_24_horas',
    'no_referido',
]);
export type InicioSintoma = z.infer<typeof InicioSintoma>;

/** V5 — grupo etario (ya capturado en el wizard de consentimiento). */
export const GrupoEtario = z.enum(['Pediatric', 'Adult', 'Geriatric', 'no_referido']);
export type GrupoEtario = z.infer<typeof GrupoEtario>;

/** V17 — estado de embarazo, auto-reportado. */
export const EstadoEmbarazo = z.enum([
    'embarazada',
    'no_embarazada',
    'no_aplica',
    'no_sabe',
    'no_referido',
]);
export type EstadoEmbarazo = z.infer<typeof EstadoEmbarazo>;

/**
 * Vitales referidos NUMÉRICAMENTE por el paciente. SOLO se rellenan si el
 * paciente da un número explícito ("mi saturación marcaba 88"). Nunca se
 * generan por instrumentación. Todos opcionales.
 */
export const ReferredVitalsSchema = z
    .object({
        // SpO2 en % referido por el paciente (p. ej. de su propio oxímetro casero).
        oxygen_saturation_percent: z.number().min(0).max(100).optional(),
        // Frecuencia cardíaca en lpm referida.
        heart_rate_bpm: z.number().min(0).max(400).optional(),
        // Frecuencia respiratoria en rpm referida.
        respiratory_rate_rpm: z.number().min(0).max(120).optional(),
        // Presión arterial sistólica en mmHg referida.
        systolic_bp_mmhg: z.number().min(0).max(400).optional(),
        // Temperatura en °C referida.
        temperature_celsius: z.number().min(20).max(45).optional(),
    })
    .describe('Valores numéricos SOLO si el paciente los refirió explícitamente (auto-reporte, no instrumentación).');
export type ReferredVitals = z.infer<typeof ReferredVitalsSchema>;

/**
 * CMDSchema — esquema Zod del Conjunto Mínimo de Datos.
 *
 * El LLM extrae estas features de la conversación vía generateObject. El
 * motor de reglas (ruleEngine.ts) opera EXCLUSIVAMENTE sobre este objeto,
 * no sobre el texto libre.
 */
export const CMDSchema = z.object({
    // ── Variables clínicas ────────────────────────────────────────────────

    // V1 — descripción del motivo de consulta / síntomas, en palabras del paciente.
    symptoms_description: z.string().optional().describe('V1: motivo de consulta auto-referido (texto libre).'),

    // V2 — tiempo de evolución referido.
    symptom_onset: InicioSintoma.optional().describe('V2: tiempo de evolución auto-referido.'),

    // V3 — intensidad del dolor 0-10 referida por el paciente (escala subjetiva, no instrumentada).
    pain_severity: z.number().int().min(0).max(10).optional().describe('V3: dolor 0-10 auto-referido.'),

    // V4 — localización del síntoma/dolor referida.
    symptom_location: z.string().optional().describe('V4: localización auto-referida del síntoma.'),

    // V5 — grupo etario (capturado en consentimiento).
    age_group: GrupoEtario.optional().describe('V5: grupo etario declarado.'),

    // V6 — bandera de "signos vitales que el paciente percibe como anormales" (cualitativo, auto-reporte).
    vital_signs_abnormal: ReferidoCualitativo.optional().describe('V6: percepción de signos vitales anormales (cualitativo, auto-reporte).'),

    // V7 — comorbilidades referidas.
    comorbidities: z.array(z.string()).optional().describe('V7: comorbilidades auto-referidas.'),

    // V8 — medicación actual referida.
    current_medications: z.array(z.string()).optional().describe('V8: medicación actual auto-referida.'),

    // V9 — alergias referidas.
    allergies: z.array(z.string()).optional().describe('V9: alergias auto-referidas.'),

    // V10 — RETIRADA por el panel experto. No se captura.

    // V11 — saturación de oxígeno: SOLO cualitativa auto-reportada (no oximetría).
    oxygen_sat_reported: ReferidoCualitativo.optional().describe('V11: SpO2 cualitativa auto-reportada (no instrumentada).'),

    // V12 — frecuencia cardíaca: cualitativa auto-reportada (palpitaciones, "late muy rápido").
    heart_rate_reported: ReferidoCualitativo.optional().describe('V12: FC cualitativa auto-reportada (no instrumentada).'),

    // V13 — dificultad respiratoria: cualitativa auto-reportada.
    respiratory_difficulty_reported: ReferidoCualitativo.optional().describe('V13: dificultad respiratoria auto-reportada.'),

    // V14 — presión arterial: cualitativa auto-reportada (no esfigmomanómetro).
    bp_reported: ReferidoCualitativo.optional().describe('V14: PA cualitativa auto-reportada (no instrumentada).'),

    // V15 — fiebre: cualitativa auto-reportada (no termómetro instrumentado).
    fever_reported: ReferidoCualitativo.optional().describe('V15: fiebre cualitativa auto-reportada (no instrumentada).'),

    // V16 — nivel de conciencia: cualitativo auto-reportado o reportado por acompañante.
    consciousness_reported: ReferidoCualitativo.optional().describe('V16: conciencia cualitativa auto-reportada.'),

    // V17 — estado de embarazo, auto-reportado.
    pregnancy_status: EstadoEmbarazo.optional().describe('V17: estado de embarazo auto-reportado.'),

    // V18 — ideación suicida: bandera auto-reportada (booleana).
    suicidal_ideation: z.boolean().optional().describe('V18: ideación suicida auto-reportada.'),

    // Valores numéricos SOLO si el paciente los refirió explícitamente.
    referred_vitals: ReferredVitalsSchema.optional(),

    // ── Metadata ──────────────────────────────────────────────────────────

    // V19 — consentimiento informado firmado.
    consent_signed: z.boolean().optional().describe('V19 (metadata): consentimiento informado firmado.'),

    // V20 — código anónimo del paciente (hash determinista del RUT o aleatorio).
    anonymous_code: z.string().optional().describe('V20 (metadata): código anónimo de seguimiento.'),
});

/**
 * Tipo de las features del CMD. Es la unidad de datos sobre la que opera el
 * motor de reglas (TriageFeatures es un alias semántico de este tipo).
 */
export type CMDFeatures = z.infer<typeof CMDSchema>;

/**
 * Alias usado por el motor de reglas. Mismas features del CMD, vistas desde
 * la perspectiva del evaluador determinista.
 */
export type TriageFeatures = CMDFeatures;

/**
 * Schema parcial pensado para que el LLM rellene SOLO lo que el paciente
 * refirió. Todas las claves siguen siendo opcionales; este alias documenta
 * la intención de uso en generateObject.
 */
export const CMDExtractionSchema = CMDSchema;

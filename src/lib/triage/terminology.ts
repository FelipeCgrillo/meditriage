/**
 * Terminología clínica estándar para los recursos FHIR de MediTriage.
 *
 * Mapea los hallazgos del CMD (cmd.ts) a códigos de terminología
 * interoperable:
 *   - SNOMED CT  → hallazgos clínicos / síntomas (sistema http://snomed.info/sct).
 *   - LOINC      → "observaciones referidas" análogas a signos vitales, y los
 *                  answer codes de riesgo ya usados en RiskAssessment.
 *
 * IMPORTANTE: como NO se instrumentan signos vitales, los códigos LOINC de
 * signos vitales (FC, FR, SpO2, PA, Temp, GCS) se usan únicamente para
 * etiquetar OBSERVACIONES AUTO-REPORTADAS (lo que el paciente refiere), no
 * mediciones. Cada Observation que los use lleva la nota "self-reported".
 *
 * FUENTES de los códigos (verificadas contra los navegadores oficiales):
 *   - SNOMED CT International Edition — https://browser.ihtsdotools.org
 *   - LOINC — https://loinc.org  (los answer codes LA…-… provienen de
 *     respuestas LOINC; los signos vitales son los códigos LOINC estándar).
 */

/** Sistemas de codificación FHIR. */
export const TERMINOLOGY_SYSTEMS = {
    SNOMED: 'http://snomed.info/sct',
    LOINC: 'http://loinc.org',
} as const;

/** Un coding terminológico (subset del datatype FHIR Coding). */
export interface TerminologyCoding {
    system: string;
    code: string;
    display: string;
}

/**
 * SNOMED CT — hallazgos clínicos auto-referidos.
 * Cada entrada documenta su concept id de SNOMED CT International.
 */
export const SNOMED_FINDINGS: Record<string, TerminologyCoding> = {
    // Dolor torácico (Chest pain — finding) 29857009.
    chest_pain: { system: TERMINOLOGY_SYSTEMS.SNOMED, code: '29857009', display: 'Chest pain (finding)' },
    // Disnea / dificultad respiratoria (Dyspnea — finding) 267036007.
    dyspnea: { system: TERMINOLOGY_SYSTEMS.SNOMED, code: '267036007', display: 'Dyspnea (finding)' },
    // Ideación suicida (Suicidal thoughts) 6471006.
    suicidal_ideation: { system: TERMINOLOGY_SYSTEMS.SNOMED, code: '6471006', display: 'Suicidal thoughts (finding)' },
    // Fiebre (Fever — finding) 386661006.
    fever: { system: TERMINOLOGY_SYSTEMS.SNOMED, code: '386661006', display: 'Fever (finding)' },
    // Convulsión (Seizure — finding) 91175000.
    seizure: { system: TERMINOLOGY_SYSTEMS.SNOMED, code: '91175000', display: 'Seizure (finding)' },
    // Inconsciencia (Unconscious) 38854002.
    unresponsive: { system: TERMINOLOGY_SYSTEMS.SNOMED, code: '38854002', display: 'Unconscious (finding)' },
    // Compromiso de vía aérea (Airway obstruction — disorder) 79688008.
    airway_compromised: { system: TERMINOLOGY_SYSTEMS.SNOMED, code: '79688008', display: 'Respiratory obstruction (disorder)' },
    // Apnea (Apnea — finding) 1023001.
    apnea: { system: TERMINOLOGY_SYSTEMS.SNOMED, code: '1023001', display: 'Apnea (finding)' },
    // Ausencia de pulso (Absent pulse — finding) 278197003.
    no_pulse: { system: TERMINOLOGY_SYSTEMS.SNOMED, code: '278197003', display: 'Absent pulse (finding)' },
    // Hemorragia masiva (Hemorrhage — finding) 50960005.
    massive_bleeding: { system: TERMINOLOGY_SYSTEMS.SNOMED, code: '50960005', display: 'Hemorrhage (finding)' },
    // Shock (Shock — finding) 27942005.
    shock: { system: TERMINOLOGY_SYSTEMS.SNOMED, code: '27942005', display: 'Shock (finding)' },
    // Estado mental alterado (Altered mental status — finding) 419284004.
    altered_mental_status: { system: TERMINOLOGY_SYSTEMS.SNOMED, code: '419284004', display: 'Altered mental status (finding)' },
    // Traumatismo craneal (Head injury — disorder) 82271004.
    head_trauma: { system: TERMINOLOGY_SYSTEMS.SNOMED, code: '82271004', display: 'Injury of head (disorder)' },
    // Pérdida de conciencia (Loss of consciousness — finding) 419045004.
    loss_of_consciousness: { system: TERMINOLOGY_SYSTEMS.SNOMED, code: '419045004', display: 'Loss of consciousness (finding)' },
    // Dolor abdominal severo (Abdominal pain — finding) 21522001.
    severe_abdominal_pain: { system: TERMINOLOGY_SYSTEMS.SNOMED, code: '21522001', display: 'Abdominal pain (finding)' },
    // Paciente inmunocomprometido (Immunocompromised — finding) 234644006.
    immunocompromised: { system: TERMINOLOGY_SYSTEMS.SNOMED, code: '234644006', display: 'Immunocompromised state (finding)' },
    // Embarazo (Pregnant — finding) 77386006.
    pregnancy: { system: TERMINOLOGY_SYSTEMS.SNOMED, code: '77386006', display: 'Pregnant (finding)' },
};

/**
 * LOINC — signos referidos por el paciente (NO instrumentados). Códigos
 * LOINC estándar de cada observación, usados como etiqueta del hallazgo
 * auto-reportado.
 */
export const LOINC_VITALS: Record<string, TerminologyCoding> = {
    // Oxygen saturation in Arterial blood by Pulse oximetry 59408-5.
    oxygen_saturation: { system: TERMINOLOGY_SYSTEMS.LOINC, code: '59408-5', display: 'Oxygen saturation in Arterial blood by Pulse oximetry' },
    // Heart rate 8867-4.
    heart_rate: { system: TERMINOLOGY_SYSTEMS.LOINC, code: '8867-4', display: 'Heart rate' },
    // Respiratory rate 9279-1.
    respiratory_rate: { system: TERMINOLOGY_SYSTEMS.LOINC, code: '9279-1', display: 'Respiratory rate' },
    // Systolic blood pressure 8480-6.
    systolic_bp: { system: TERMINOLOGY_SYSTEMS.LOINC, code: '8480-6', display: 'Systolic blood pressure' },
    // Body temperature 8310-5.
    temperature: { system: TERMINOLOGY_SYSTEMS.LOINC, code: '8310-5', display: 'Body temperature' },
    // Glasgow coma score total 9269-2.
    gcs: { system: TERMINOLOGY_SYSTEMS.LOINC, code: '9269-2', display: 'Glasgow coma score total' },
};

/**
 * LOINC answer codes para el riesgo cualitativo del RiskAssessment.
 * Se mantienen los códigos ya usados en fhir.ts para no romper el contrato.
 */
export const LOINC_RISK_ANSWERS: Record<'high' | 'moderate' | 'low', TerminologyCoding> = {
    high: { system: TERMINOLOGY_SYSTEMS.LOINC, code: 'LA6752-5', display: 'High risk' },
    moderate: { system: TERMINOLOGY_SYSTEMS.LOINC, code: 'LA6751-7', display: 'Moderate risk' },
    low: { system: TERMINOLOGY_SYSTEMS.LOINC, code: 'LA6748-3', display: 'Low risk' },
};

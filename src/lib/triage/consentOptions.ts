/**
 * Opciones del flujo de consentimiento y demografía del chat del paciente
 * (PRD mejoras UX RF-05). Módulo puro, sin dependencias de React, para
 * poder testearse y mantener una fuente única entre UI y validación.
 *
 * Los valores mapeados son los que ya acepta `clinical_records`
 * (`patient_gender`, `patient_age_group`) y los que el dashboard de
 * enfermería sabe etiquetar (GENDER_LABEL / AGE_GROUP_LABEL).
 */

export const GENDER_OPTIONS = [
    'Masculino',
    'Femenino',
    'Otro',
    'Prefiero no responder',
] as const;

export const GENDER_MAP: Record<string, string> = {
    Masculino: 'M',
    Femenino: 'F',
    Otro: 'Other',
    'Prefiero no responder': 'Prefer not to say',
};

export const AGE_OPTIONS = ['0-17 años', '18-64 años', '65+ años'] as const;

export const AGE_MAP: Record<string, string | null> = {
    '0-17 años': 'Pediatric',
    '18-64 años': 'Adult',
    '65+ años': 'Geriatric',
};

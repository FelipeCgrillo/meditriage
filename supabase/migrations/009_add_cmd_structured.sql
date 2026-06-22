-- Migración 009: CMD estructurado (Conjunto Mínimo de Datos)
--
-- Añade la columna `cmd_features` (JSONB) a clinical_records para persistir el
-- CMD estructurado que el sistema extrae de la conversación (auto-reporte).
--
-- RESTRICCIÓN CLÍNICA: el sistema NO instrumenta signos vitales. Todos los
-- valores guardados en cmd_features son AUTO-REPORTADOS por el paciente en el
-- chat. Los signos clásicamente numéricos (SpO2, FC, FR, PA, temperatura,
-- conciencia) se almacenan como flags cualitativos ('normal' | 'anormal' |
-- 'no_sabe' | 'no_referido'); los números solo aparecen bajo
-- cmd_features.referred_vitals SI el paciente los refirió explícitamente.
--
-- Shape del JSONB (tipado por CMDSchema en src/lib/triage/cmd.ts):
--   {
--     "symptoms_description": string,
--     "symptom_onset": "menos_1_hora" | "1_6_horas" | "6_24_horas" | "mas_24_horas" | "no_referido",
--     "pain_severity": number(0-10),
--     "symptom_location": string,
--     "age_group": "Pediatric" | "Adult" | "Geriatric" | "no_referido",
--     "vital_signs_abnormal": "normal" | "anormal" | "no_sabe" | "no_referido",
--     "comorbidities": string[],
--     "current_medications": string[],
--     "allergies": string[],
--     "oxygen_sat_reported": <cualitativo>,
--     "heart_rate_reported": <cualitativo>,
--     "respiratory_difficulty_reported": <cualitativo>,
--     "bp_reported": <cualitativo>,
--     "fever_reported": <cualitativo>,
--     "consciousness_reported": <cualitativo>,
--     "pregnancy_status": "embarazada" | "no_embarazada" | "no_aplica" | "no_sabe" | "no_referido",
--     "suicidal_ideation": boolean,
--     "referred_vitals": { "oxygen_saturation_percent": number, "heart_rate_bpm": number, ... },
--     "consent_signed": boolean,
--     "anonymous_code": string
--   }
-- (V10 fue retirada por el panel experto; no se captura.)

ALTER TABLE clinical_records
ADD COLUMN IF NOT EXISTS cmd_features JSONB;

COMMENT ON COLUMN clinical_records.cmd_features IS
'CMD estructurado (17 variables clínicas + 2 metadata) auto-reportado por el paciente. Tipado por CMDSchema (src/lib/triage/cmd.ts). El sistema no instrumenta signos vitales: los signos numéricos solo se almacenan bajo referred_vitals si el paciente los refirió.';

-- Índice GIN para consultas/analítica sobre el CMD estructurado.
CREATE INDEX IF NOT EXISTS idx_clinical_records_cmd_features
ON clinical_records USING GIN (cmd_features);

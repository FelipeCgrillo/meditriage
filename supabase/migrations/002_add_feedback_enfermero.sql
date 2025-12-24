-- Agregar columna feedback_enfermero para requisito crítico de tesis
-- Esta columna permite que el enfermero proporcione feedback textual sobre la clasificación

ALTER TABLE clinical_records
ADD COLUMN IF NOT EXISTS feedback_enfermero TEXT NULL;

COMMENT ON COLUMN clinical_records.feedback_enfermero IS 'Feedback textual del enfermero sobre la clasificación ESI (requisito crítico de tesis)';


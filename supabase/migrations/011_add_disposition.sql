-- Migración 011: agrega columna disposition a clinical_records.
--
-- Contexto (PRD /goal): la clasificación ESI se traduce en una vía de
-- atención concreta que ve el paciente. Esta columna persiste esa vía por
-- caso para que el enfermero validador y el análisis retrospectivo (DAU)
-- puedan medirla.
--
-- Valores permitidos:
--   'emergency'              → ESI 1-2, urgencia hospitalaria inmediata.
--   'same_day_primary_care'  → ESI 3, APS de urgencia el mismo día.
--   'next_day_primary_care'  → ESI 4-5, cita en CESFAM al día siguiente.
--
-- Se permite NULL para no romper registros previos (creados antes de esta
-- migración) ni casos aún en estado 'needs_info'.

ALTER TABLE public.clinical_records
    ADD COLUMN IF NOT EXISTS disposition TEXT
        CHECK (disposition IN ('emergency', 'same_day_primary_care', 'next_day_primary_care'));

COMMENT ON COLUMN public.clinical_records.disposition IS
    'Vía de atención derivada del nivel ESI. Server-side, determinista. NULL si el caso no llegó a status=success.';

CREATE INDEX IF NOT EXISTS idx_clinical_records_disposition
    ON public.clinical_records (disposition);

-- Migración 013: análisis DAU según el protocolo aprobado por el CEC
-- (respuesta al oficio OBS-E-319-02, expediente CEC-E-319).
--
-- Cambios:
--   1. dau_results.nurse_esi pasa a tens_esi: la clasificación registrada en
--      el DAU la efectúa personal TENS y es el comparador, no el estándar.
--   2. dau_results agrega el criterio de referencia (desenlace al egreso),
--      el ESI del LLM antes del motor de reglas (ablación), contexto de
--      análisis disociado (tramo quinquenal, mes y año, franja horaria) y
--      la trazabilidad de la desidentificación.
--   3. dau_runs agrega la huella del protocolo congelado (modelo, versión de
--      prompt, reglas y detector) y las métricas completas del estudio.
--   4. Política DELETE para que el creador pueda revertir una corrida
--      incompleta (antes el rollback del endpoint fallaba en silencio).
--
-- Idempotente.

BEGIN;

-- 1. nurse_esi → tens_esi --------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'dau_results' AND column_name = 'nurse_esi'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'dau_results' AND column_name = 'tens_esi'
  ) THEN
    ALTER TABLE public.dau_results RENAME COLUMN nurse_esi TO tens_esi;
  END IF;
END
$$;

COMMENT ON COLUMN public.dau_results.tens_esi IS
  'Categoría ESI registrada por el TENS en el DAU. Comparador de práctica habitual. Nunca se envía al modelo.';

-- 2. Columnas por registro --------------------------------------------------
ALTER TABLE public.dau_results
  ADD COLUMN IF NOT EXISTS outcome TEXT
    CHECK (outcome IS NULL OR outcome IN ('alta','hospitalizacion','upc','traslado','fallecimiento','otro')),
  ADD COLUMN IF NOT EXISTS high_severity BOOLEAN,
  ADD COLUMN IF NOT EXISTS critical BOOLEAN,
  ADD COLUMN IF NOT EXISTS llm_esi INTEGER CHECK (llm_esi IS NULL OR (llm_esi BETWEEN 1 AND 5)),
  ADD COLUMN IF NOT EXISTS model_error BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS age_band TEXT,
  ADD COLUMN IF NOT EXISTS period TEXT,
  ADD COLUMN IF NOT EXISTS time_band TEXT,
  ADD COLUMN IF NOT EXISTS vitals_removed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deid_categories TEXT[],
  ADD COLUMN IF NOT EXISTS complaint_key TEXT;

COMMENT ON COLUMN public.dau_results.outcome IS
  'Destino al egreso de la urgencia (criterio de referencia). Nunca se envía al modelo.';
COMMENT ON COLUMN public.dau_results.llm_esi IS
  'ESI propuesto por el LLM antes del motor de reglas (análisis de ablación).';
COMMENT ON COLUMN public.dau_results.chief_complaint IS
  'Motivo de consulta DESIDENTIFICADO: texto exacto que se envió al modelo.';

CREATE INDEX IF NOT EXISTS idx_dau_results_outcome ON public.dau_results (outcome);

-- 3. Huella del protocolo y métricas por corrida ---------------------------
ALTER TABLE public.dau_runs
  ADD COLUMN IF NOT EXISTS model_id TEXT,
  ADD COLUMN IF NOT EXISTS prompt_sha256 TEXT,
  ADD COLUMN IF NOT EXISTS rules_version TEXT,
  ADD COLUMN IF NOT EXISTS deid_version TEXT,
  ADD COLUMN IF NOT EXISTS effort TEXT,
  ADD COLUMN IF NOT EXISTS study_metrics JSONB;

COMMENT ON COLUMN public.dau_runs.study_metrics IS
  'Métricas del protocolo CEC: sensibilidad para alta gravedad, subtriage relevante, McNemar, AUC (DeLong), kappa ponderado y criterio de continuidad.';

-- 4. DELETE de la propia corrida (rollback de corridas incompletas) --------
DROP POLICY IF EXISTS "Creator deletes own dau_runs" ON public.dau_runs;
CREATE POLICY "Creator deletes own dau_runs"
  ON public.dau_runs
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

COMMIT;

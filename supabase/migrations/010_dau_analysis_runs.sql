-- Migración 010: Persistencia del análisis retrospectivo de DAU (OE4 Vía B)
--
-- Hasta ahora el análisis de un CSV del hospital era EFÍMERO: el endpoint
-- /api/dau clasificaba el lote y devolvía { results, summary } sin guardar
-- nada. Al recargar la página se perdía la evidencia.
--
-- Esta migración crea dos tablas para persistir cada análisis "por corrida":
--
--   dau_runs     → una fila por archivo analizado (metadatos + métricas
--                  globales: n, concordancia simple, matriz de confusión).
--   dau_results  → una fila por registro DAU clasificado, ligada a la corrida.
--                  Incluye el texto libre del registro (motivo de consulta y
--                  síntomas), el ESI predicho por el sistema, el ESI de la
--                  enfermera (gold standard) y la trazabilidad de la decisión
--                  (decision_source / matched_rule).
--
-- PRIVACIDAD (Ley 19.628 / 20.584): el CSV del hospital debe entregarse ya
-- anonimizado (sin PII). Estas tablas guardan texto clínico libre; el acceso
-- queda restringido por RLS a personal autenticado (nurse | researcher | admin).

BEGIN;

-- Asegura el trigger de updated_at (idempotente).
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- ───────────────────────────────────────────────────────────────────────────
-- Tabla: dau_runs  (una corrida = un análisis de un archivo)
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dau_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Metadatos de la corrida
  file_name TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Conteos
  total INTEGER NOT NULL DEFAULT 0,
  classified INTEGER NOT NULL DEFAULT 0,
  needs_info INTEGER NOT NULL DEFAULT 0,
  with_gold_standard INTEGER NOT NULL DEFAULT 0,
  comparable INTEGER NOT NULL DEFAULT 0,
  agreements INTEGER NOT NULL DEFAULT 0,

  -- Métricas globales
  simple_agreement NUMERIC,                 -- 0..1 o NULL si no hay pares comparables
  confusion_matrix JSONB NOT NULL DEFAULT '[]'::jsonb,  -- matriz 5x5 [predicho][enfermera]

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dau_runs_created_at
  ON public.dau_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dau_runs_created_by
  ON public.dau_runs(created_by);

DROP TRIGGER IF EXISTS update_dau_runs_updated_at ON public.dau_runs;
CREATE TRIGGER update_dau_runs_updated_at
  BEFORE UPDATE ON public.dau_runs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ───────────────────────────────────────────────────────────────────────────
-- Tabla: dau_results  (una fila por registro DAU clasificado)
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dau_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.dau_runs(id) ON DELETE CASCADE,

  -- Identidad del registro dentro del archivo
  record_id TEXT NOT NULL,

  -- ENTRADA al modelo (texto libre auto-reportable) + demográficos
  chief_complaint TEXT,
  reported_symptoms TEXT,
  sex TEXT CHECK (sex IS NULL OR sex = ANY (ARRAY['M','F','Other'])),
  age_group TEXT CHECK (age_group IS NULL OR age_group = ANY (ARRAY['Pediatric','Adult','Geriatric'])),
  age_years INTEGER,

  -- SALIDA del sistema
  predicted_esi INTEGER CHECK (predicted_esi IS NULL OR (predicted_esi >= 1 AND predicted_esi <= 5)),
  status TEXT NOT NULL CHECK (status = ANY (ARRAY['success','needs_info'])),
  decision_source TEXT CHECK (decision_source IS NULL OR decision_source = ANY (ARRAY['llm','rule_engine','rule_engine_override'])),
  matched_rule TEXT,
  rule_rationale TEXT,
  extracted_features JSONB,

  -- GOLD STANDARD (enfermera) + comparación
  nurse_esi INTEGER CHECK (nurse_esi IS NULL OR (nurse_esi >= 1 AND nurse_esi <= 5)),
  agreement BOOLEAN,                        -- predicted_esi = nurse_esi (NULL si falta alguno)

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dau_results_run_id
  ON public.dau_results(run_id);
CREATE INDEX IF NOT EXISTS idx_dau_results_decision_source
  ON public.dau_results(decision_source);
CREATE INDEX IF NOT EXISTS idx_dau_results_agreement
  ON public.dau_results(agreement);

-- ───────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- Solo personal autenticado (nurse | researcher | admin) puede leer/escribir.
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE public.dau_runs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dau_results ENABLE ROW LEVEL SECURITY;

-- dau_runs: SELECT para staff autenticado
DROP POLICY IF EXISTS "Staff can read dau_runs" ON public.dau_runs;
CREATE POLICY "Staff can read dau_runs"
  ON public.dau_runs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid()
              AND up.role IN ('nurse','researcher','admin'))
  );

-- dau_runs: INSERT para staff autenticado
DROP POLICY IF EXISTS "Staff can insert dau_runs" ON public.dau_runs;
CREATE POLICY "Staff can insert dau_runs"
  ON public.dau_runs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid()
              AND up.role IN ('nurse','researcher','admin'))
  );

-- dau_results: SELECT para staff autenticado
DROP POLICY IF EXISTS "Staff can read dau_results" ON public.dau_results;
CREATE POLICY "Staff can read dau_results"
  ON public.dau_results
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid()
              AND up.role IN ('nurse','researcher','admin'))
  );

-- dau_results: INSERT para staff autenticado
DROP POLICY IF EXISTS "Staff can insert dau_results" ON public.dau_results;
CREATE POLICY "Staff can insert dau_results"
  ON public.dau_results
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid()
              AND up.role IN ('nurse','researcher','admin'))
  );

-- Service role (API del servidor) gestiona todo.
DROP POLICY IF EXISTS "Service role manages dau_runs" ON public.dau_runs;
CREATE POLICY "Service role manages dau_runs"
  ON public.dau_runs FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages dau_results" ON public.dau_results;
CREATE POLICY "Service role manages dau_results"
  ON public.dau_results FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Comentarios
COMMENT ON TABLE public.dau_runs IS 'Corrida de análisis retrospectivo de DAU: un archivo del hospital analizado, con métricas globales de concordancia (OE4 Vía B).';
COMMENT ON TABLE public.dau_results IS 'Resultado por registro de una corrida DAU: entrada de texto libre + ESI predicho por el sistema vs ESI de la enfermera (gold standard) + trazabilidad de la decisión.';
COMMENT ON COLUMN public.dau_runs.confusion_matrix IS 'Matriz de confusión 5x5, matrix[predicho-1][enfermera-1].';
COMMENT ON COLUMN public.dau_results.decision_source IS 'Origen de la decisión final: llm | rule_engine | rule_engine_override.';
COMMENT ON COLUMN public.dau_results.nurse_esi IS 'Gold standard: ESI asignado por la enfermera. NUNCA entra al modelo.';

COMMIT;

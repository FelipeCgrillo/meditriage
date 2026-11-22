-- Migración 016: categoría de motivo de consulta y longitud del relato por registro DAU.
--
-- Reemplaza el indicador insufficient_info (migración 015), que el modelo marcaba
-- en 18 de 19 registros y no separaba nada. En su lugar:
--   - complaint_category: lista cerrada fijada a priori (src/lib/dau/categories.ts),
--     para el análisis por motivo de consulta prometido al CEC.
--   - text_words: recuento objetivo de palabras del relato enviado, para medir si
--     más texto mejora el desempeño.
-- La columna insufficient_info queda sin uso. Idempotente.

ALTER TABLE public.dau_results
  ADD COLUMN IF NOT EXISTS complaint_category TEXT,
  ADD COLUMN IF NOT EXISTS text_words INTEGER CHECK (text_words IS NULL OR text_words >= 0);

ALTER TABLE public.dau_runs
  ADD COLUMN IF NOT EXISTS categories_version TEXT;

CREATE INDEX IF NOT EXISTS idx_dau_results_category ON public.dau_results (complaint_category);

COMMENT ON COLUMN public.dau_results.complaint_category IS
  'Categoría del motivo de consulta asignada por el modelo (lista cerrada).';
COMMENT ON COLUMN public.dau_results.text_words IS
  'Palabras de contenido del relato enviado al modelo (sin la abreviatura ref del TENS).';

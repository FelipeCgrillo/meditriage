-- Migración 015: indicador de relato insuficiente por registro DAU.
--
-- En el análisis retrospectivo el modelo clasifica siempre (no hay segundo turno
-- para preguntar) y marca aquí si el relato no alcanzaba para clasificar con
-- certeza. Reemplaza al estado needs_info del chat para el análisis estratificado.
-- Idempotente.

ALTER TABLE public.dau_results
  ADD COLUMN IF NOT EXISTS insufficient_info BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.dau_results.insufficient_info IS
  'true si el modelo marcó el relato del DAU como insuficiente para clasificar con certeza.';

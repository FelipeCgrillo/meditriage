-- Versión del criterio de riqueza del texto (palabras específicas) usado en la corrida.
ALTER TABLE public.dau_runs
  ADD COLUMN IF NOT EXISTS text_info_version TEXT;

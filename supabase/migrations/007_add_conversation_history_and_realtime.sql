-- Adds conversation_history column to clinical_records and ensures the table
-- is included in the supabase_realtime publication. Idempotent: safe to run on
-- environments where the live database already has these in place (the
-- production project mwkzggntabvrpkrpxacu was patched out-of-band).
--
-- RLS policies on clinical_records are intentionally left untouched.

ALTER TABLE public.clinical_records
  ADD COLUMN IF NOT EXISTS conversation_history JSONB;

COMMENT ON COLUMN public.clinical_records.conversation_history IS
  'Ordered transcript of the patient/AI exchange (array of {role, content}).';

-- Add the table to the supabase_realtime publication if (a) the publication
-- exists and (b) the table is not already a member. Wrapped in DO so failures
-- on databases without realtime configured are not fatal.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'clinical_records'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.clinical_records';
  END IF;
END
$$;

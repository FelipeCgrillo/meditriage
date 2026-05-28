-- Hardens RLS on public.clinical_records so that:
--   * INSERT  (authenticated)  → only nurses or admins can create records via the
--                                authenticated session. Anon inserts from the
--                                patient flow keep their stricter pre-existing
--                                policy ("Allow insert for anon").
--   * UPDATE  (authenticated)  → only nurses or admins, and the row stays bound
--                                to their role check on the result (WITH CHECK).
--   * SELECT  (authenticated)  → unchanged at the SQL level — nurses, researchers
--                                and admins can read all rows. (If you want to
--                                restrict researcher visibility, narrow this
--                                policy as a follow-up.)
--
-- Idempotent: drops the over-permissive legacy policies before re-creating
-- the hardened ones. Safe to run multiple times.
--
-- Context: Supabase advisor lint 0024_permissive_rls_policy was raised on
-- "Allow insert for authenticated users" (WITH CHECK true) and
-- "Allow update for nurses" (USING true / WITH CHECK true). Both effectively
-- bypassed RLS for any authenticated user, which is unacceptable for clinical
-- data.

BEGIN;

-- Make sure RLS is on (it already is in prod, but keep this self-contained).
ALTER TABLE public.clinical_records ENABLE ROW LEVEL SECURITY;

-- ---- INSERT (authenticated) ----------------------------------------------
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.clinical_records;

CREATE POLICY "Authenticated staff can insert clinical records"
  ON public.clinical_records
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('nurse', 'admin')
    )
  );

-- ---- UPDATE (authenticated) ----------------------------------------------
DROP POLICY IF EXISTS "Allow update for nurses" ON public.clinical_records;

CREATE POLICY "Nurses and admins can update clinical records"
  ON public.clinical_records
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('nurse', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('nurse', 'admin')
    )
  );

-- ---- Function search_path hardening --------------------------------------
-- Advisor lint 0011_function_search_path_mutable flagged these two as having
-- a role-mutable search_path. Pinning to an empty search_path forces fully
-- qualified references inside the functions.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'map_to_fhir'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.map_to_fhir() SET search_path = '''' ';
  END IF;
EXCEPTION WHEN others THEN
  -- map_to_fhir may have a different signature in some branches; ignore.
  RAISE NOTICE 'Could not pin search_path on public.map_to_fhir: %', SQLERRM;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'update_updated_at_column'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.update_updated_at_column() SET search_path = '''' ';
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Could not pin search_path on public.update_updated_at_column: %', SQLERRM;
END
$$;

COMMIT;

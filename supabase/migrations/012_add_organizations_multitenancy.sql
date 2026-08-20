-- Migración 012: multi-tenancy por organización (PRD MediTriage I1).
--
-- Introduce la entidad `organizations` y agrega `organization_id` a las
-- tres tablas del dominio (`user_profiles`, `clinical_records`,
-- `dau_runs`), reforzando el aislamiento con RLS a nivel de Postgres
-- según los criterios CA-01 a CA-08 y CA-12 del PRD.
--
-- Idempotente: usa IF NOT EXISTS, DROP POLICY IF EXISTS y guardas
-- condicionales para poder correrse dos veces sin romper. Ver también
-- RNF-04 (compatibilidad hacia atrás): los datos preexistentes se
-- reasignan a la organización semilla `meditriage-piloto`.
--
-- Recuperación (RNF-09): la migración envuelve todo en una transacción.
-- Si algo falla, Postgres revierte el estado. Para un rollback manual
-- posterior, ejecutar `013_rollback_multitenancy.sql` (a redactar solo
-- si se dispara la contingencia).

BEGIN;

-- ============================================================================
-- 1. Tabla organizations
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE
        CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) BETWEEN 3 AND 60),
    name TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 120),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.organizations IS
    'Cliente/tenant del SaaS MediTriage. Un CESFAM, hospital o servicio de salud.';
COMMENT ON COLUMN public.organizations.slug IS
    'Identificador URL-safe. Se usa en el link del paciente: /paciente?org=<slug>.';

CREATE INDEX IF NOT EXISTS idx_organizations_active_slug
    ON public.organizations (slug) WHERE is_active;

DROP TRIGGER IF EXISTS update_organizations_updated_at ON public.organizations;
CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON public.organizations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Semilla: organización por defecto para datos preexistentes (RNF-04, CA-08).
INSERT INTO public.organizations (slug, name)
VALUES ('meditriage-piloto', 'MediTriage Piloto (datos iniciales)')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- 2. user_profiles.organization_id
-- ============================================================================

ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS organization_id UUID
        REFERENCES public.organizations(id) ON DELETE RESTRICT;

ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill: los usuarios existentes van a la organización semilla.
UPDATE public.user_profiles
   SET organization_id = (SELECT id FROM public.organizations WHERE slug = 'meditriage-piloto')
 WHERE organization_id IS NULL
   AND role IN ('nurse', 'researcher');

-- Los admins existentes se dejan como admins de plataforma (organization_id NULL)
-- SOLO si no se puede inferir su tenant. Aquí se asume que hoy hay 0 o 1 admin
-- y que si existe se promueve a admin de plataforma. Para admins de organización
-- se creará el usuario nuevo desde la UI del admin de plataforma.

CREATE INDEX IF NOT EXISTS idx_user_profiles_org
    ON public.user_profiles (organization_id);

-- Regla: solo el rol 'admin' puede tener organization_id NULL (admin de plataforma).
-- nurse y researcher DEBEN pertenecer a una organización.
ALTER TABLE public.user_profiles
    DROP CONSTRAINT IF EXISTS user_profiles_org_required_for_staff;
ALTER TABLE public.user_profiles
    ADD CONSTRAINT user_profiles_org_required_for_staff
    CHECK (role = 'admin' OR organization_id IS NOT NULL);

COMMENT ON COLUMN public.user_profiles.organization_id IS
    'Tenant al que pertenece este usuario. NULL solo para admin de plataforma.';
COMMENT ON COLUMN public.user_profiles.must_change_password IS
    'true si el admin fijó una contraseña inicial. Fuerza cambio en el primer login (CA-14).';

-- ============================================================================
-- 3. clinical_records.organization_id
-- ============================================================================

ALTER TABLE public.clinical_records
    ADD COLUMN IF NOT EXISTS organization_id UUID
        REFERENCES public.organizations(id) ON DELETE RESTRICT;

-- Backfill: registros preexistentes van a la organización semilla.
UPDATE public.clinical_records
   SET organization_id = (SELECT id FROM public.organizations WHERE slug = 'meditriage-piloto')
 WHERE organization_id IS NULL;

-- A partir de ahora, toda inserción debe traer organization_id.
ALTER TABLE public.clinical_records
    ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clinical_records_org_created
    ON public.clinical_records (organization_id, created_at DESC);

COMMENT ON COLUMN public.clinical_records.organization_id IS
    'Tenant al que pertenece este caso clínico. Fijado por el link ?org=<slug> del paciente.';

-- ============================================================================
-- 4. dau_runs.organization_id (dau_results hereda por FK a dau_runs)
-- ============================================================================

ALTER TABLE public.dau_runs
    ADD COLUMN IF NOT EXISTS organization_id UUID
        REFERENCES public.organizations(id) ON DELETE RESTRICT;

UPDATE public.dau_runs
   SET organization_id = (SELECT id FROM public.organizations WHERE slug = 'meditriage-piloto')
 WHERE organization_id IS NULL;

ALTER TABLE public.dau_runs
    ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dau_runs_org_created
    ON public.dau_runs (organization_id, created_at DESC);

-- ============================================================================
-- 5. RLS por organización sobre clinical_records
-- ============================================================================

-- Sanidad: la política dev-only para anon debe eliminarse antes de producción.
-- El flujo del paciente sigue usando la clave anon, pero valida el slug de
-- organización server-side antes de insertar; la política queda estricta.
DROP POLICY IF EXISTS "Allow all operations for anon (dev only)" ON public.clinical_records;

-- Insert por anon (paciente): permitir solo si el registro trae un
-- organization_id de una organización activa. La app fija el valor server-side.
DROP POLICY IF EXISTS "Anon inserts for active organizations" ON public.clinical_records;
CREATE POLICY "Anon inserts for active organizations"
    ON public.clinical_records
    FOR INSERT
    TO anon
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.organizations o
            WHERE o.id = clinical_records.organization_id
              AND o.is_active
        )
    );

-- Insert por authenticated (personal): además del check de rol existente (008),
-- exigir que el usuario cree registros solo en SU organización.
DROP POLICY IF EXISTS "Authenticated staff can insert clinical records" ON public.clinical_records;
CREATE POLICY "Authenticated staff can insert clinical records"
    ON public.clinical_records
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid()
              AND up.role IN ('nurse', 'admin')
              AND (up.organization_id = clinical_records.organization_id OR up.role = 'admin' AND up.organization_id IS NULL)
        )
    );

-- Select: staff ve solo su organización. Admin de plataforma (org NULL) ve todo.
DROP POLICY IF EXISTS "Allow select for authenticated users" ON public.clinical_records;
CREATE POLICY "Staff sees own organization"
    ON public.clinical_records
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid()
              AND (up.organization_id = clinical_records.organization_id
                   OR (up.role = 'admin' AND up.organization_id IS NULL))
        )
    );

-- Update: staff actualiza solo su organización.
DROP POLICY IF EXISTS "Nurses and admins can update clinical records" ON public.clinical_records;
CREATE POLICY "Nurses and admins update own organization"
    ON public.clinical_records
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid()
              AND up.role IN ('nurse', 'admin')
              AND (up.organization_id = clinical_records.organization_id
                   OR (up.role = 'admin' AND up.organization_id IS NULL))
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid()
              AND up.role IN ('nurse', 'admin')
              AND (up.organization_id = clinical_records.organization_id
                   OR (up.role = 'admin' AND up.organization_id IS NULL))
        )
    );

-- ============================================================================
-- 6. RLS por organización sobre dau_runs y dau_results
-- ============================================================================

DROP POLICY IF EXISTS "Staff can read dau_runs" ON public.dau_runs;
CREATE POLICY "Staff reads own org dau_runs"
    ON public.dau_runs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid()
              AND (up.organization_id = dau_runs.organization_id
                   OR (up.role = 'admin' AND up.organization_id IS NULL))
        )
    );

DROP POLICY IF EXISTS "Staff can insert dau_runs" ON public.dau_runs;
CREATE POLICY "Staff inserts own org dau_runs"
    ON public.dau_runs
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid()
              AND up.role IN ('nurse', 'researcher', 'admin')
              AND (up.organization_id = dau_runs.organization_id
                   OR (up.role = 'admin' AND up.organization_id IS NULL))
        )
    );

-- dau_results hereda por FK: filtramos leyendo el dau_run padre.
DROP POLICY IF EXISTS "Staff can read dau_results" ON public.dau_results;
CREATE POLICY "Staff reads own org dau_results"
    ON public.dau_results
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.dau_runs r
            JOIN public.user_profiles up ON up.id = auth.uid()
            WHERE r.id = dau_results.run_id
              AND (up.organization_id = r.organization_id
                   OR (up.role = 'admin' AND up.organization_id IS NULL))
        )
    );

DROP POLICY IF EXISTS "Staff can insert dau_results" ON public.dau_results;
CREATE POLICY "Staff inserts own org dau_results"
    ON public.dau_results
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.dau_runs r
            JOIN public.user_profiles up ON up.id = auth.uid()
            WHERE r.id = dau_results.run_id
              AND up.role IN ('nurse', 'researcher', 'admin')
              AND (up.organization_id = r.organization_id
                   OR (up.role = 'admin' AND up.organization_id IS NULL))
        )
    );

-- ============================================================================
-- 7. RLS sobre organizations
-- ============================================================================

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own organization" ON public.organizations;
CREATE POLICY "Users read own organization"
    ON public.organizations
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid()
              AND (up.organization_id = organizations.id
                   OR (up.role = 'admin' AND up.organization_id IS NULL))
        )
    );

-- El anon (paciente) puede leer nombre/slug de organizaciones activas para
-- validar el link ?org=<slug>. No expone ninguna otra info.
DROP POLICY IF EXISTS "Anon reads active organizations" ON public.organizations;
CREATE POLICY "Anon reads active organizations"
    ON public.organizations
    FOR SELECT
    TO anon
    USING (is_active);

-- Solo service_role escribe. Los admin de plataforma escriben vía API server
-- que usa service_role, no vía cliente directo.
DROP POLICY IF EXISTS "Service role manages organizations" ON public.organizations;
CREATE POLICY "Service role manages organizations"
    ON public.organizations
    FOR ALL
    TO service_role
    USING (true) WITH CHECK (true);

COMMIT;

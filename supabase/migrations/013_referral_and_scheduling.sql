-- Migración 013: derivación geolocalizada y agendamiento
-- (PRD-derivacion-agendamiento.md, incremento D1).
--
-- Introduce tres tablas nuevas y extiende `clinical_records` con la
-- trazabilidad de la derivación (RF-01 a RF-05, RF-30 a RF-36).
--
-- ───────────────────────────────────────────────────────────────────────────
-- DECISIÓN DE DISEÑO CENTRAL (PRD sección 2):
--   Reservar hora ROMPE el anonimato del sistema. Por eso los datos de
--   contacto NO viven en `clinical_records`, sino en `appointment_bookings`,
--   con RLS propia que NIEGA todo acceso desde el cliente (solo service_role
--   puede leerla). El único vínculo entre el relato clínico y la identidad es
--   el código anónimo (RF-32). El RUT jamás se almacena en claro (RF-31).
--
--   El panel de enfermería NO lee `appointment_bookings`: la información que
--   necesita (si reservó y dónde) se desnormaliza en `clinical_records`, que
--   no contiene datos identificables (RF-35 + RNF-04).
-- ───────────────────────────────────────────────────────────────────────────
--
-- Idempotente: IF NOT EXISTS y DROP POLICY IF EXISTS en todo. Envuelta en una
-- transacción para que un fallo revierta el estado completo (RNF-10).

BEGIN;

-- ============================================================================
-- 1. care_centers — directorio de centros (RF-01 a RF-04)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.care_centers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 200),
    center_type TEXT NOT NULL
        CHECK (center_type IN ('emergency_hospital', 'cesfam', 'partner_clinic')),
    address TEXT NOT NULL,
    comuna TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    -- RF-03: identificador de la agenda FHIR. NULL = el centro no publica agenda.
    fhir_endpoint_id TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.care_centers IS
    'Directorio de centros de atención. Catálogo COMPARTIDO entre organizaciones: una urgencia atiende a cualquier paciente sin importar qué CESFAM lo derivó (PRD, dimensiones de producto).';
COMMENT ON COLUMN public.care_centers.fhir_endpoint_id IS
    'Id de la agenda FHIR del centro. NULL cuando el centro no publica agenda y por lo tanto no admite reserva.';

CREATE INDEX IF NOT EXISTS idx_care_centers_active_type
    ON public.care_centers (center_type) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_care_centers_comuna
    ON public.care_centers (comuna) WHERE is_active;

DROP TRIGGER IF EXISTS update_care_centers_updated_at ON public.care_centers;
CREATE TRIGGER update_care_centers_updated_at
    BEFORE UPDATE ON public.care_centers
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 2. care_center_slots — respaldo del servidor FHIR simulado (D1)
-- ============================================================================
--
-- En D1 las agendas son SIMULADAS y viven aquí. El adaptador de agendamiento
-- (src/lib/fhir/scheduling.ts) las expone como recursos FHIR R4 `Slot`, de
-- modo que al llegar D2 se reemplaza el adaptador por endpoints reales sin
-- tocar la lógica de derivación (RNF-06, RNF-07).

CREATE TABLE IF NOT EXISTS public.care_center_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    care_center_id UUID NOT NULL
        REFERENCES public.care_centers(id) ON DELETE CASCADE,
    slot_start TIMESTAMPTZ NOT NULL,
    slot_end TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'free' CHECK (status IN ('free', 'busy')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (slot_end > slot_start),
    UNIQUE (care_center_id, slot_start)
);

COMMENT ON TABLE public.care_center_slots IS
    'Cupos de agenda. Respaldo del servidor FHIR SIMULADO del incremento D1; se retira cuando D2 integre agendas reales.';

CREATE INDEX IF NOT EXISTS idx_slots_free_lookup
    ON public.care_center_slots (care_center_id, slot_start) WHERE status = 'free';

-- ============================================================================
-- 3. appointment_bookings — datos de contacto, AISLADOS (RF-30 a RF-33)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.appointment_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- RF-32: ÚNICO vínculo con el caso clínico. No hay FK a clinical_records
    -- para que ni siquiera exista una ruta de join directa entre identidad y
    -- relato clínico.
    anonymous_code TEXT NOT NULL,
    care_center_id UUID NOT NULL REFERENCES public.care_centers(id),
    slot_id UUID NOT NULL REFERENCES public.care_center_slots(id),
    slot_start TIMESTAMPTZ NOT NULL,

    -- Datos de contacto. Necesarios para que el centro reciba al paciente.
    patient_name TEXT NOT NULL,
    -- RF-31: NUNCA el RUT en claro. Digest con salt de servidor.
    rut_hash TEXT NOT NULL,
    phone TEXT,

    fhir_appointment_id TEXT,
    status TEXT NOT NULL DEFAULT 'booked'
        CHECK (status IN ('booked', 'failed', 'cancelled')),
    -- RNF-05: constancia del consentimiento específico de reserva.
    consent_accepted_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.appointment_bookings IS
    'Datos de contacto de las reservas. SEPARADA de clinical_records por diseño: reservar rompe el anonimato, y esta tabla concentra lo identificable. Sin políticas RLS de lectura: solo service_role accede.';
COMMENT ON COLUMN public.appointment_bookings.rut_hash IS
    'Digest del RUT con salt de servidor. El RUT en claro no se almacena ni se registra en bitácora (RF-31).';

CREATE INDEX IF NOT EXISTS idx_bookings_code
    ON public.appointment_bookings (anonymous_code);

-- ============================================================================
-- 4. clinical_records — trazabilidad de la derivación (RF-34 a RF-36, RF-11)
-- ============================================================================

ALTER TABLE public.clinical_records
    -- RF-34: ¿se le ofreció agendamiento a este paciente?
    ADD COLUMN IF NOT EXISTS referral_offered BOOLEAN,
    -- RF-36: por qué NO se ofreció, cuando corresponde.
    ADD COLUMN IF NOT EXISTS referral_no_offer_reason TEXT
        CHECK (referral_no_offer_reason IN ('urgency_level', 'no_location', 'no_slots')),
    -- RF-34/RF-35: ¿reservó?, ¿en qué centro? Desnormalizado a propósito para
    -- que el panel de enfermería nunca toque la tabla con datos personales.
    ADD COLUMN IF NOT EXISTS referral_booked BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS referral_center_id UUID REFERENCES public.care_centers(id),
    -- RF-11: SOLO comuna. Las coordenadas exactas del paciente jamás se
    -- persisten; son un dato de re-identificación en un sistema anónimo.
    ADD COLUMN IF NOT EXISTS patient_comuna TEXT;

COMMENT ON COLUMN public.clinical_records.patient_comuna IS
    'Comuna declarada o derivada de la geolocalización. Las coordenadas exactas NO se persisten (RF-11).';

CREATE INDEX IF NOT EXISTS idx_clinical_records_referral
    ON public.clinical_records (referral_booked, referral_no_offer_reason);

-- ============================================================================
-- 5. RLS
-- ============================================================================

ALTER TABLE public.care_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_center_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_bookings ENABLE ROW LEVEL SECURITY;

-- El directorio y los cupos son información pública del flujo del paciente:
-- lectura para todos, escritura solo desde el servidor (service_role).
DROP POLICY IF EXISTS "Anyone can read active care centers" ON public.care_centers;
CREATE POLICY "Anyone can read active care centers"
    ON public.care_centers FOR SELECT
    USING (is_active);

DROP POLICY IF EXISTS "Anyone can read free slots" ON public.care_center_slots;
CREATE POLICY "Anyone can read free slots"
    ON public.care_center_slots FOR SELECT
    USING (TRUE);

-- appointment_bookings: SIN políticas. Con RLS habilitada y sin ninguna
-- política, Postgres niega toda operación a anon y authenticated; solo
-- service_role (que salta RLS) puede operarla. Es exactamente el
-- comportamiento que exige RNF-04, incluido el bloqueo al módulo DAU.

COMMIT;

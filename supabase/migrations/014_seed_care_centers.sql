-- Migración 014: semilla del directorio de centros y de las agendas
-- simuladas (PRD-derivacion-agendamiento.md, RF-05).
--
-- ───────────────────────────────────────────────────────────────────────────
-- ADVERTENCIA — DATOS DE PILOTO POR VALIDAR
--   Las direcciones y coordenadas de esta semilla son APROXIMADAS y NO han
--   sido verificadas en terreno. El PRD deja abierta la pregunta de qué
--   centros componen el directorio inicial y quién valida sus direcciones
--   (sección 11). Antes de exponer esto a un paciente real, cada fila debe
--   revisarse y corregirse.
--
--   Los cupos son FICTICIOS y se generan por `generate_series`. Existen para
--   ejercitar el flujo completo de reserva contra el adaptador simulado del
--   incremento D1; no representan disponibilidad real de ningún centro.
-- ───────────────────────────────────────────────────────────────────────────

BEGIN;

-- ============================================================================
-- 1. Centros
-- ============================================================================

INSERT INTO public.care_centers
    (name, center_type, address, comuna, latitude, longitude, fhir_endpoint_id)
VALUES
    -- Urgencias hospitalarias. No publican agenda: a urgencia se llega sin hora.
    ('Hospital Dr. Sótero del Río — Urgencia', 'emergency_hospital',
     'Av. Concha y Toro 3459', 'Puente Alto', -33.5906, -70.5731, NULL),
    ('Hospital El Pino — Urgencia', 'emergency_hospital',
     'Av. Padre Hurtado 13560', 'San Bernardo', -33.5731, -70.7031, NULL),
    ('Hospital San José — Urgencia', 'emergency_hospital',
     'Av. San José 1196', 'Independencia', -33.4083, -70.6567, NULL),
    ('Hospital del Salvador — Urgencia', 'emergency_hospital',
     'Av. Salvador 364', 'Providencia', -33.4372, -70.6180, NULL),

    -- Atención primaria. Reciben la derivación ESI 3 el mismo día.
    ('CESFAM Lo Hermida', 'cesfam',
     'Av. Grecia 9500', 'Peñalolén', -33.4869, -70.5386, NULL),
    ('CESFAM La Faena', 'cesfam',
     'Av. Las Torres 6100', 'Peñalolén', -33.4783, -70.5539, NULL),
    ('CESFAM Santa Julia', 'cesfam',
     'Av. Las Torres 5050', 'Macul', -33.4956, -70.5822, NULL),

    -- Centros aliados con agenda publicada. Solo estos admiten reserva.
    ('Centro Médico Peñalolén', 'partner_clinic',
     'Av. Grecia 8800', 'Peñalolén', -33.4851, -70.5457, 'sim-penalolen'),
    ('Centro Médico Macul', 'partner_clinic',
     'Av. Macul 4200', 'Macul', -33.4988, -70.5972, 'sim-macul'),
    ('Centro Médico Ñuñoa', 'partner_clinic',
     'Av. Irarrázaval 3400', 'Ñuñoa', -33.4562, -70.5921, 'sim-nunoa'),
    ('Centro Médico Puente Alto', 'partner_clinic',
     'Av. Concha y Toro 2100', 'Puente Alto', -33.5840, -70.5885, 'sim-puente-alto')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 2. Cupos ficticios para los centros con agenda
-- ============================================================================
--
-- Genera cupos de 20 minutos entre las 09:00 y las 17:00 para los próximos 7
-- días, solo en días hábiles. Se omiten los cupos ya pasados.

INSERT INTO public.care_center_slots (care_center_id, slot_start, slot_end)
SELECT
    c.id,
    slot_time,
    slot_time + INTERVAL '20 minutes'
FROM public.care_centers c
CROSS JOIN LATERAL (
    SELECT generate_series(
        date_trunc('day', NOW()) + INTERVAL '9 hours',
        date_trunc('day', NOW()) + INTERVAL '7 days' + INTERVAL '17 hours',
        INTERVAL '20 minutes'
    ) AS slot_time
) s
WHERE c.fhir_endpoint_id IS NOT NULL
  AND EXTRACT(ISODOW FROM s.slot_time) <= 5          -- lunes a viernes
  AND EXTRACT(HOUR FROM s.slot_time) BETWEEN 9 AND 16
  AND s.slot_time > NOW()
ON CONFLICT (care_center_id, slot_start) DO NOTHING;

COMMIT;

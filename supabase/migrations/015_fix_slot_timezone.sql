-- Migración 015: corrige la zona horaria de los cupos sembrados.
--
-- La migración 014 original generó la franja de 09:00 a 17:00 con `NOW()`,
-- que en la base corre en UTC. El resultado fueron cupos a las 05:00 hora de
-- Santiago: horarios en que ningún centro atiende y que le habrían aparecido
-- al paciente como horas disponibles.
--
-- La 014 ya quedó corregida en el repositorio, así que un despliegue nuevo no
-- necesita esta migración. Existe para reparar los entornos donde la 014 ya se
-- había aplicado con el error.
--
-- Solo se borran cupos LIBRES: una hora ya reservada jamás se elimina, para no
-- dejar a un paciente con una cita huérfana.

BEGIN;

DELETE FROM public.care_center_slots
WHERE status = 'free';

INSERT INTO public.care_center_slots (care_center_id, slot_start, slot_end)
SELECT
    c.id,
    s.local_time AT TIME ZONE 'America/Santiago',
    (s.local_time + INTERVAL '20 minutes') AT TIME ZONE 'America/Santiago'
FROM public.care_centers c
CROSS JOIN LATERAL (
    SELECT generate_series(
        date_trunc('day', NOW() AT TIME ZONE 'America/Santiago') + INTERVAL '9 hours',
        date_trunc('day', NOW() AT TIME ZONE 'America/Santiago') + INTERVAL '7 days' + INTERVAL '17 hours',
        INTERVAL '20 minutes'
    ) AS local_time
) s
WHERE c.fhir_endpoint_id IS NOT NULL
  AND EXTRACT(ISODOW FROM s.local_time) <= 5          -- lunes a viernes
  AND EXTRACT(HOUR FROM s.local_time) BETWEEN 9 AND 16
  AND (s.local_time AT TIME ZONE 'America/Santiago') > NOW()
ON CONFLICT (care_center_id, slot_start) DO NOTHING;

COMMIT;

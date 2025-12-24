-- Script de Test: Verificación de Integridad de Datos para Kappa
-- Ejecutar DESPUÉS de aplicar migración 006_add_nurse_esi_level.sql
-- Propósito: Confirmar que el sistema captura correctamente nurse_esi_level

-- ============================================================================
-- TEST 1: Verificar que la columna existe
-- ============================================================================
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'clinical_records' 
AND column_name IN ('esi_level', 'nurse_esi_level', 'nurse_override_level')
ORDER BY column_name;

-- Resultado esperado:
-- esi_level | integer | NO | (none)
-- nurse_esi_level | integer | YES | (none)
-- nurse_override_level | integer | YES | (none)


-- ============================================================================
-- TEST 2: Verificar constraints (valores 1-5)
-- ============================================================================
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'clinical_records'::regclass
AND conname LIKE '%nurse_esi_level%';

-- Resultado esperado:
-- CHECK ((nurse_esi_level >= 1) AND (nurse_esi_level <= 5))


-- ============================================================================
-- TEST 3: Verificar índice para queries de análisis
-- ============================================================================
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'clinical_records'
AND indexname LIKE '%nurse_esi%';

-- Resultado esperado:
-- idx_clinical_records_nurse_esi_level | CREATE INDEX ... ON clinical_records USING btree (nurse_esi_level)


-- ============================================================================
-- TEST 4: Insertar caso de prueba (simulando flujo completo)
-- ============================================================================
-- IMPORTANTE: Esto solo funciona si tienes datos de prueba. Ajusta según tu entorno.

-- 4.1: INSERT inicial (simulando paciente + IA)
-- INSERT INTO clinical_records (
--   patient_consent,
--   symptoms_text,
--   ai_response,
--   esi_level,
--   anonymous_code
-- ) VALUES (
--   true,
--   'Dolor de pecho intenso, dificultad para respirar',
--   '{"esi_level": 2, "reasoning": "Signos de posible síndrome coronario agudo"}'::jsonb,
--   2,
--   'TEST-001'
-- );

-- 4.2: UPDATE Fase 1 (simulando clasificación ciega de enfermera)
-- UPDATE clinical_records
-- SET nurse_esi_level = 2  -- Enfermera clasifica ESI 2 (sin ver IA)
-- WHERE anonymous_code = 'TEST-001';

-- 4.3: UPDATE Fase 2 (simulando confirmación - sin override)
-- UPDATE clinical_records
-- SET 
--   nurse_validated = true,
--   feedback_enfermero = 'Concordancia con IA. Paciente con signos de alarma cardiovascular.'
-- WHERE anonymous_code = 'TEST-001';

-- 4.4: Verificar resultado
-- SELECT 
--   anonymous_code,
--   esi_level as ai_classification,
--   nurse_esi_level as nurse_independent,
--   nurse_override_level as nurse_final_override,
--   nurse_validated,
--   CASE 
--     WHEN nurse_esi_level = esi_level THEN 'Concordancia'
--     ELSE 'Discrepancia'
--   END as kappa_category,
--   created_at,
--   updated_at,
--   updated_at - created_at as validation_time
-- FROM clinical_records
-- WHERE anonymous_code = 'TEST-001';


-- ============================================================================
-- TEST 5: Query de análisis para métricas de tesis
-- ============================================================================

-- 5.1: Matriz de confusión (para Kappa)
SELECT 
  esi_level as ai_esi,
  nurse_esi_level as nurse_esi,
  COUNT(*) as count
FROM clinical_records
WHERE nurse_esi_level IS NOT NULL
GROUP BY esi_level, nurse_esi_level
ORDER BY ai_esi, nurse_esi;

-- 5.2: Sensibilidad y Especificidad (ESI crítico: 1-2)
WITH classifications AS (
  SELECT 
    CASE WHEN esi_level <= 2 THEN 'critical' ELSE 'non_critical' END as ai_class,
    CASE WHEN nurse_esi_level <= 2 THEN 'critical' ELSE 'non_critical' END as nurse_class
  FROM clinical_records
  WHERE nurse_esi_level IS NOT NULL
),
metrics AS (
  SELECT 
    SUM(CASE WHEN ai_class = 'critical' AND nurse_class = 'critical' THEN 1 ELSE 0 END) as TP,
    SUM(CASE WHEN ai_class = 'critical' AND nurse_class = 'non_critical' THEN 1 ELSE 0 END) as FP,
    SUM(CASE WHEN ai_class = 'non_critical' AND nurse_class = 'critical' THEN 1 ELSE 0 END) as FN,
    SUM(CASE WHEN ai_class = 'non_critical' AND nurse_class = 'non_critical' THEN 1 ELSE 0 END) as TN
  FROM classifications
)
SELECT 
  TP, FP, FN, TN,
  ROUND(100.0 * TP / NULLIF(TP + FN, 0), 2) as sensitivity_percent,
  ROUND(100.0 * TN / NULLIF(TN + FP, 0), 2) as specificity_percent,
  ROUND(100.0 * (TP + TN) / NULLIF(TP + TN + FP + FN, 0), 2) as accuracy_percent
FROM metrics;

-- 5.3: Análisis de influencia de IA (cuántas veces la enfermera cambió de opinión)
SELECT 
  CASE 
    WHEN nurse_override_level IS NULL THEN 'Mantuvo clasificación inicial'
    WHEN nurse_override_level = esi_level THEN 'Cambió hacia sugerencia de IA'
    ELSE 'Cambió a otro valor'
  END as decision_pattern,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM clinical_records
WHERE nurse_esi_level IS NOT NULL
GROUP BY decision_pattern;

-- 5.4: Estadísticas de tiempo de validación
SELECT 
  COUNT(*) as total_validated,
  AVG(updated_at - created_at) as avg_validation_time,
  MIN(updated_at - created_at) as min_validation_time,
  MAX(updated_at - created_at) as max_validation_time,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY updated_at - created_at) as median_validation_time
FROM clinical_records
WHERE nurse_validated = true
AND nurse_esi_level IS NOT NULL;


-- ============================================================================
-- TEST 6: Verificar integridad de datos (no debe haber inconsistencias)
-- ============================================================================

-- 6.1: Casos con override pero sin nurse_esi_level (ERROR)
SELECT 
  id,
  anonymous_code,
  'ERROR: Override sin clasificación inicial' as issue
FROM clinical_records
WHERE nurse_override_level IS NOT NULL
AND nurse_esi_level IS NULL;

-- Resultado esperado: 0 rows (no debe haber casos así)

-- 6.2: Casos validados pero sin nurse_esi_level (ADVERTENCIA)
SELECT 
  id,
  anonymous_code,
  created_at,
  'ADVERTENCIA: Validado sin clasificación de enfermera (casos legacy?)' as issue
FROM clinical_records
WHERE nurse_validated = true
AND nurse_esi_level IS NULL;

-- Resultado esperado: 
-- Puede haber casos legacy (antes de la migración)
-- Los nuevos casos NO deben aparecer aquí

-- 6.3: Resumen de completitud de datos
SELECT 
  COUNT(*) as total_records,
  SUM(CASE WHEN esi_level IS NOT NULL THEN 1 ELSE 0 END) as with_ai_classification,
  SUM(CASE WHEN nurse_esi_level IS NOT NULL THEN 1 ELSE 0 END) as with_nurse_classification,
  SUM(CASE WHEN nurse_validated = true THEN 1 ELSE 0 END) as validated,
  SUM(CASE WHEN nurse_override_level IS NOT NULL THEN 1 ELSE 0 END) as with_override,
  ROUND(100.0 * SUM(CASE WHEN nurse_esi_level IS NOT NULL THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) as nurse_classification_percentage
FROM clinical_records;


-- ============================================================================
-- TEST 7: Exportar datos para análisis en Python/R
-- ============================================================================
-- Ejecutar en psql o pgAdmin y exportar como CSV

SELECT 
  id,
  anonymous_code,
  symptoms_text,
  esi_level as ai_esi_level,
  nurse_esi_level,
  nurse_override_level,
  CASE 
    WHEN nurse_override_level IS NOT NULL THEN nurse_override_level
    ELSE nurse_esi_level
  END as final_esi_level,
  nurse_validated,
  feedback_enfermero,
  patient_gender,
  patient_age_group,
  created_at,
  updated_at,
  EXTRACT(EPOCH FROM (updated_at - created_at)) as validation_seconds
FROM clinical_records
WHERE nurse_esi_level IS NOT NULL
ORDER BY created_at DESC;

-- Comando para exportar (psql):
-- \copy (SELECT ... query arriba ...) TO '/path/to/triage_data_for_analysis.csv' WITH CSV HEADER;


-- ============================================================================
-- CONCLUSIÓN
-- ============================================================================
-- Si todos los tests pasan:
-- ✅ La columna nurse_esi_level existe y tiene constraints correctos
-- ✅ Los índices están creados para queries eficientes
-- ✅ La estructura de datos permite calcular Kappa, Sensibilidad, Especificidad
-- ✅ No hay inconsistencias en los datos
--
-- Próximo paso: Test manual del flujo en la aplicación web


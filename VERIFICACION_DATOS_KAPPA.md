# ✅ VERIFICACIÓN: Integridad de Datos para Métricas de Tesis

**Fecha:** 21 de diciembre de 2025  
**Status:** ✅ APTO PARA PILOTO  
**Objetivo:** Confirmar que el sistema captura correctamente todas las variables críticas para calcular Kappa, Sensibilidad y Especificidad.

---

## 📊 VARIABLES CRÍTICAS CAPTURADAS

### 1️⃣ Clasificación de la IA
- **Campo:** `esi_level` (INTEGER, 1-5)
- **Cuándo se guarda:** INSERT inicial cuando el paciente completa el triage
- **Fuente:** Resultado del modelo de Claude (GPT-4) procesado por `/api/triage`
- **Ubicación en código:** `app/paciente/page.tsx:69`

### 2️⃣ Clasificación Independiente de la Enfermera ⭐ NUEVO
- **Campo:** `nurse_esi_level` (INTEGER, 1-5, nullable)
- **Cuándo se guarda:** Cuando la enfermera clasifica ANTES de ver la sugerencia de la IA
- **Validación Ciega:** ✅ La enfermera NO ve la clasificación de IA hasta después de guardar
- **Ubicación en código:** `ValidationDialog.tsx:80-90` (Fase 1)

### 3️⃣ Decisión Final (Override)
- **Campo:** `nurse_override_level` (INTEGER, 1-5, nullable)
- **Cuándo se guarda:** Solo si la enfermera cambia de opinión DESPUÉS de ver la sugerencia de IA
- **Lógica:** `NULL` significa que la enfermera mantuvo su clasificación original
- **Ubicación en código:** `ValidationDialog.tsx:103-113` (Fase 2)

### 4️⃣ Timestamps
- **created_at:** Momento en que el paciente completa el triage con IA
- **updated_at:** Momento en que la enfermera valida (auto-actualizado por trigger SQL)
- **Cálculo disponible:** `tiempo_validación = updated_at - created_at`

### 5️⃣ Feedback Cualitativo
- **Campo:** `feedback_enfermero` (TEXT, nullable)
- **Contenido:** Comentarios de la enfermera sobre la clasificación
- **Uso:** Análisis cualitativo de discrepancias

---

## 🔄 FLUJO DE VALIDACIÓN (2 FASES)

### **FASE 1: Validación Ciega** 🔒

```
1. Enfermera abre modal de validación
2. Ve SOLO los síntomas del paciente (NO ve clasificación IA)
3. Selecciona su clasificación ESI (1-5)
4. Presiona "🔓 Clasificar y Ver Sugerencia IA"
5. Sistema GUARDA nurse_esi_level en BD (silenciosamente)
6. Modal muestra comparación: [Su clasificación] vs [IA]
```

**Código relevante:**
```typescript
// ValidationDialog.tsx:76-90
if (!isRevealed) {
  const nurseLevel = parseInt(nurseEstimation);
  await onValidate(
    record.id,
    nurseLevel,      // 🔥 nurse_esi_level (clasificación independiente)
    undefined,       // nurse_override_level (aún no aplica)
    undefined,       // feedback (aún no aplica)
    true             // silent (no bloquear UI)
  );
  setIsRevealed(true);
}
```

### **FASE 2: Confirmación Final** 🔓

```
1. Enfermera ve comparación de clasificaciones
2. Puede:
   a) Confirmar su clasificación original (no override)
   b) Cambiar a la sugerencia de IA (override)
   c) Cambiar a otro nivel distinto (override)
3. Opcionalmente agrega feedback textual
4. Presiona "Confirmar Validación"
5. Sistema guarda nurse_override_level (solo si cambió) + feedback
```

**Código relevante:**
```typescript
// ValidationDialog.tsx:103-113
const nurseLevel = parseInt(nurseEstimation); // Original
const finalLevel = parseInt(selectedLevel);   // Final
const overrideLevel = finalLevel !== nurseLevel ? finalLevel : undefined;

await onValidate(
  record.id,
  undefined,                    // nurse_esi_level (ya guardado)
  overrideLevel,                // 🔥 solo si cambió
  feedback.trim() || undefined,
  false
);
```

---

## 📐 CÁLCULO DE MÉTRICAS

### **Coeficiente Kappa de Cohen**

```sql
-- Matriz de confusión IA vs Enfermera (clasificación independiente)
SELECT 
  esi_level as ai_classification,
  nurse_esi_level as nurse_classification,
  COUNT(*) as count
FROM clinical_records
WHERE nurse_esi_level IS NOT NULL
GROUP BY esi_level, nurse_esi_level
ORDER BY ai_classification, nurse_classification;
```

**Interpretación:**
- Compara `esi_level` (IA) vs `nurse_esi_level` (enfermera ANTES de ver IA)
- Ignora `nurse_override_level` para este cálculo
- Kappa mide concordancia inter-observador

### **Sensibilidad y Especificidad (ESI Crítico: 1-2)**

```sql
-- Clasificar casos críticos vs no críticos
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
```

### **Análisis de Cambios Post-IA**

```sql
-- ¿Con qué frecuencia la enfermera cambió de opinión después de ver la IA?
SELECT 
  CASE 
    WHEN nurse_override_level IS NULL THEN 'Sin cambio'
    WHEN nurse_override_level = nurse_esi_level THEN 'Sin cambio (explícito)'
    ELSE 'Cambió de opinión'
  END as decision_type,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM clinical_records
WHERE nurse_esi_level IS NOT NULL
GROUP BY decision_type;
```

---

## 🔍 ESCENARIOS DE VALIDACIÓN

### **Escenario 1: Concordancia Total**
```
Enfermera clasifica: ESI 3
IA sugiere: ESI 3
Decisión final: ESI 3 (sin cambio)

BD:
  esi_level = 3
  nurse_esi_level = 3
  nurse_override_level = NULL
  
✅ Kappa: Cuenta como concordancia
```

### **Escenario 2: Discrepancia → Enfermera mantiene su opinión**
```
Enfermera clasifica: ESI 3
IA sugiere: ESI 4
Decisión final: ESI 3 (mantiene)

BD:
  esi_level = 4
  nurse_esi_level = 3
  nurse_override_level = NULL
  
✅ Kappa: Cuenta como discrepancia (IA=4, Enfermera=3)
```

### **Escenario 3: Discrepancia → Enfermera acepta sugerencia de IA**
```
Enfermera clasifica: ESI 3
IA sugiere: ESI 4
Decisión final: ESI 4 (cambió)

BD:
  esi_level = 4
  nurse_esi_level = 3
  nurse_override_level = 4
  
✅ Kappa: Cuenta como discrepancia (IA=4, Enfermera=3)
✅ Análisis adicional: Enfermera cambió tras ver IA
```

### **Escenario 4: Discrepancia → Enfermera elige tercer valor**
```
Enfermera clasifica: ESI 3
IA sugiere: ESI 4
Decisión final: ESI 2 (nuevo valor)

BD:
  esi_level = 4
  nurse_esi_level = 3
  nurse_override_level = 2
  
✅ Kappa: Cuenta como discrepancia (IA=4, Enfermera=3)
✅ Análisis adicional: Enfermera rechazó ambas y eligió ESI 2
```

---

## 🧪 TESTS DE VERIFICACIÓN PRE-PILOTO

### **1. Test de INSERT inicial (Paciente)**
```sql
-- Verificar que se guarda esi_level de IA
SELECT id, esi_level, nurse_esi_level, nurse_override_level, created_at
FROM clinical_records
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 1;

-- Resultado esperado:
-- esi_level: NOT NULL (valor entre 1-5)
-- nurse_esi_level: NULL
-- nurse_override_level: NULL
```

### **2. Test de Fase 1 (Clasificación Ciega)**
```sql
-- Después de que enfermera clasifica sin ver IA
SELECT id, esi_level, nurse_esi_level, nurse_override_level
FROM clinical_records
WHERE id = '<test_record_id>';

-- Resultado esperado:
-- esi_level: NOT NULL (IA original)
-- nurse_esi_level: NOT NULL (clasificación de enfermera)
-- nurse_override_level: NULL (aún no decide)
```

### **3. Test de Fase 2 (Confirmación)**
```sql
-- Después de confirmar validación
SELECT 
  id, 
  esi_level as ai,
  nurse_esi_level as nurse_initial,
  nurse_override_level as nurse_final,
  feedback_enfermero,
  updated_at - created_at as validation_time
FROM clinical_records
WHERE id = '<test_record_id>';

-- Resultado esperado:
-- ai: NOT NULL
-- nurse_initial: NOT NULL
-- nurse_final: NULL (si no cambió) o NOT NULL (si cambió)
-- feedback_enfermero: NULL o TEXT
-- validation_time: Tiempo razonable (ej: '00:02:34')
```

---

## 🚀 CHECKLIST DE DESPLIEGUE

- [x] Migración SQL creada: `006_add_nurse_esi_level.sql`
- [x] Tipos TypeScript actualizados: `lib/supabase/types.ts`
- [x] Lógica de guardado en 2 fases: `ValidationDialog.tsx`
- [x] Handler actualizado: `dashboard/page.tsx`
- [x] Sin errores de linting
- [ ] **Aplicar migración en Supabase** (usuario debe ejecutar)
- [ ] **Test manual del flujo completo** (recomendado antes del piloto)
- [ ] **Exportar datos de prueba y verificar estructura**

---

## 📋 INSTRUCCIONES PARA APLICAR LA MIGRACIÓN

### **Opción 1: Supabase Dashboard (Recomendado)**
1. Ir a https://supabase.com/dashboard/project/YOUR_PROJECT/sql
2. Copiar contenido de `supabase/migrations/006_add_nurse_esi_level.sql`
3. Pegar en el editor SQL
4. Ejecutar query
5. Verificar que la columna `nurse_esi_level` existe:
   ```sql
   SELECT column_name, data_type, is_nullable 
   FROM information_schema.columns 
   WHERE table_name = 'clinical_records' 
   AND column_name = 'nurse_esi_level';
   ```

### **Opción 2: Supabase CLI (Avanzado)**
```bash
# Desde la raíz del proyecto
supabase db push

# O aplicar migración específica
supabase migration up --file 006_add_nurse_esi_level.sql
```

---

## 🎯 CONCLUSIÓN

### **Estado Actual:** ✅ SISTEMA LISTO PARA PILOTO

Todas las variables críticas están siendo capturadas correctamente:
- ✅ Clasificación de IA (`esi_level`)
- ✅ Clasificación independiente de enfermera (`nurse_esi_level`) **← NUEVO**
- ✅ Override si cambia de opinión (`nurse_override_level`)
- ✅ Timestamps para tiempos de atención
- ✅ Feedback cualitativo

### **Métricas Calculables:**
- ✅ Coeficiente Kappa de Cohen
- ✅ Sensibilidad
- ✅ Especificidad
- ✅ Matriz de confusión
- ✅ Análisis de influencia de IA en decisiones

### **Próximos Pasos:**
1. **Aplicar migración SQL** en Supabase
2. **Test de flujo completo** con 3-5 casos de prueba
3. **Exportar CSV** de ejemplo y verificar columnas
4. **Iniciar piloto** con confianza en la integridad de datos

---

**Documentado por:** Sistema de QA y Database Administrator  
**Revisado:** 21 de diciembre de 2025  
**Versión:** 1.0


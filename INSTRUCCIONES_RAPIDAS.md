# ⚡ INSTRUCCIONES RÁPIDAS: Aplicar nurse_esi_level

## 🎯 OBJETIVO
Habilitar el guardado de la clasificación independiente de la enfermera para permitir el cálculo del coeficiente Kappa.

---

## ✅ PASO 1: Verificar Implementación Local

```bash
./verify-migration.sh
```

**Resultado esperado:** ✅ 15 tests pasados

---

## 🗃️ PASO 2: Aplicar Migración en Supabase

### **Opción A: Supabase Dashboard** (Recomendado para ti)

1. **Abrir SQL Editor:**
   - Ir a: https://supabase.com/dashboard
   - Seleccionar tu proyecto
   - Ir a "SQL Editor" en el menú lateral

2. **Copiar migración:**
   ```bash
   cat supabase/migrations/006_add_nurse_esi_level.sql
   ```
   
3. **Pegar y ejecutar** en el SQL Editor

4. **Verificar éxito:**
   ```sql
   SELECT column_name, data_type, is_nullable 
   FROM information_schema.columns 
   WHERE table_name = 'clinical_records' 
   AND column_name = 'nurse_esi_level';
   ```
   
   Deberías ver: `nurse_esi_level | integer | YES`

### **Opción B: Supabase CLI** (Si ya lo tienes instalado)

```bash
supabase db push
```

---

## 🧪 PASO 3: Test Manual del Flujo

### **Test A: Crear caso de triage**
1. Ir a: http://localhost:3000/paciente
2. Completar consentimiento
3. Describir síntomas (ej: "Dolor de pecho intenso")
4. Anotar el código anónimo (ej: ABC-123)

### **Test B: Validar como enfermera**
1. Ir a: http://localhost:3000/nurse/dashboard
2. Abrir el caso recién creado
3. **FASE 1 (Blind):**
   - Ver solo síntomas (NO ver clasificación IA)
   - Seleccionar tu clasificación ESI (ej: ESI 2)
   - Click "🔓 Clasificar y Ver Sugerencia IA"
4. **FASE 2 (Comparison):**
   - Ver comparación: [Tu ESI] vs [IA ESI]
   - Confirmar o cambiar
   - Agregar feedback (opcional)
   - Click "Confirmar Validación"

### **Test C: Verificar datos en Supabase**
```sql
SELECT 
  anonymous_code,
  esi_level as ai_esi,
  nurse_esi_level as nurse_independent,
  nurse_override_level as nurse_final_if_changed,
  nurse_validated,
  created_at,
  updated_at
FROM clinical_records
WHERE anonymous_code = 'ABC-123';
```

**Resultado esperado:**
```
ai_esi | nurse_independent | nurse_final_if_changed | nurse_validated
-------+-------------------+------------------------+-----------------
   2   |        2          |         NULL           |      true
```

---

## 📊 PASO 4: Ejecutar Tests SQL Completos

```bash
# En Supabase SQL Editor, ejecutar:
cat supabase/test_nurse_esi_level.sql
```

Esto ejecutará 7 tests de verificación:
1. ✅ Columna existe
2. ✅ Constraints correctos
3. ✅ Índices creados
4. ✅ Estructura de datos
5. ✅ Queries de métricas (Kappa, Sensibilidad, Especificidad)
6. ✅ Integridad de datos
7. ✅ Exportación para análisis

---

## 🚨 TROUBLESHOOTING

### **Problema: Migración falla con "column already exists"**
```sql
-- La columna ya existe, verificar que sea correcta:
\d clinical_records

-- Si está mal configurada, eliminar y recrear:
ALTER TABLE clinical_records DROP COLUMN IF EXISTS nurse_esi_level;
-- Luego ejecutar migración completa
```

### **Problema: Frontend no guarda nurse_esi_level**
1. Verificar en DevTools → Network → UPDATE request
2. Ver payload:
   ```json
   {
     "nurse_esi_level": 2,
     "nurse_validated": true
   }
   ```
3. Si no aparece `nurse_esi_level`, revisar `ValidationDialog.tsx:80-90`

### **Problema: Modal no muestra comparación**
1. Verificar que `isRevealed` cambia a `true` en Fase 1
2. Verificar en React DevTools el estado del componente
3. Ver console.log si hay errores de guardado

---

## 📖 DOCUMENTACIÓN COMPLETA

- **Flujo técnico completo:** `VERIFICACION_DATOS_KAPPA.md`
- **Resumen de implementación:** `RESUMEN_IMPLEMENTACION.md`
- **Tests SQL:** `supabase/test_nurse_esi_level.sql`
- **Migración SQL:** `supabase/migrations/006_add_nurse_esi_level.sql`

---

## 🎓 RECORDATORIO: ¿Por qué esto es crítico?

### **ANTES (❌ INCORRECTO):**
```
Enfermera clasifica: ESI 3
IA sugiere: ESI 3
Enfermera confirma: ESI 3

BD guardada:
  esi_level = 3
  nurse_override_level = NULL

Problema: ❌ No sabemos qué clasificó la enfermera
Kappa: ❌ NO CALCULABLE
```

### **DESPUÉS (✅ CORRECTO):**
```
Enfermera clasifica: ESI 3 ← 🔥 GUARDADO en nurse_esi_level
IA sugiere: ESI 3
Enfermera confirma: ESI 3

BD guardada:
  esi_level = 3           (IA)
  nurse_esi_level = 3     (Enfermera independiente)
  nurse_override_level = NULL (No cambió)

Kappa: ✅ CALCULABLE (tenemos ambos valores)
```

---

## ⏱️ TIEMPO ESTIMADO

- Verificación local: **1 minuto**
- Aplicar migración: **2 minutos**
- Test manual: **5 minutos**
- Tests SQL: **3 minutos**

**TOTAL: ~10 minutos** ⚡

---

## ✅ CHECKLIST FINAL

- [ ] Script de verificación pasa (15/15 tests)
- [ ] Migración aplicada en Supabase
- [ ] Test manual completado con éxito
- [ ] Datos verificados en BD
- [ ] Tests SQL ejecutados sin errores

**Una vez completado → 🚀 LISTO PARA PILOTO**

---

**¿Dudas?** Consulta `VERIFICACION_DATOS_KAPPA.md` para detalles técnicos completos.


# Análisis de Brecha: Base de Datos vs Código Next.js

## 📊 Resumen Ejecutivo

Se realizó un análisis comparativo entre el esquema de base de datos existente en Supabase y los requisitos del código Next.js generado, identificando brechas y realizando las adaptaciones necesarias.

## ✅ Requisitos Críticos de Tesis - Estado

| Requisito | Columna BD | Estado | Acción |
|-----------|------------|--------|--------|
| `sintomas_paciente` | `symptoms_text` | ✅ Existe | - |
| `prediccion_ia_esi` | `esi_level` | ✅ Existe | - |
| `validacion_enfermero_esi` | `nurse_override_level` | ✅ Existe (nullable) | - |
| `feedback_enfermero` | `feedback_enfermero` | ❌ Faltaba | ✅ Agregada |

## 🔍 Análisis Detallado

### Esquema Real vs Código Generado

#### Columnas que Coinciden:
- ✅ `symptoms_text` → Input de síntomas del paciente
- ✅ `esi_level` → Predicción IA ESI (1-5)
- ✅ `nurse_override_level` → Validación enfermero ESI (1-5, nullable)
- ✅ `nurse_validated` → Estado de validación
- ✅ `patient_consent` → Consentimiento informado
- ✅ `created_at`, `updated_at` → Timestamps

#### Diferencias Encontradas:

**1. Estructura de Respuesta de IA:**
- **Código generado**: Intentaba insertar columnas separadas:
  - `ai_reasoning` (TEXT)
  - `critical_signs` (TEXT[])
  - `suggested_specialty` (TEXT)
  - `confidence` (DECIMAL)
  
- **Esquema real**: Usa `ai_response` (JSONB) que contiene toda la respuesta estructurada

**Solución**: Adaptado el código para:
- Guardar toda la respuesta de IA en `ai_response` (JSONB)
- Crear función helper `extractAIResponse()` para extraer campos cuando se leen
- Mantener compatibilidad con el esquema existente

**2. Campo Faltante:**
- **`feedback_enfermero`**: No existía en la BD pero es requisito crítico de tesis

**Solución**: 
- ✅ Migración SQL creada y aplicada: `002_add_feedback_enfermero.sql`
- ✅ Columna agregada: `feedback_enfermero TEXT NULL`
- ✅ Integrado en el ValidationDialog para capturar feedback textual

## 🔧 Cambios Realizados

### 1. Migración de Base de Datos
```sql
-- supabase/migrations/002_add_feedback_enfermero.sql
ALTER TABLE clinical_records
ADD COLUMN IF NOT EXISTS feedback_enfermero TEXT NULL;
```

### 2. Actualización de Tipos TypeScript
- ✅ Actualizado `lib/supabase/types.ts` con el esquema real
- ✅ Agregado tipo helper `AIResponse` para estructura JSONB
- ✅ Tipos regenerados desde Supabase

### 3. Adaptación del Código

#### API Route (`app/api/triage/route.ts`):
- Cambiado de insertar columnas separadas a guardar en `ai_response` JSONB
- Estructura JSONB mantiene toda la información de la respuesta de IA

#### Componentes Dashboard:
- ✅ `TriageList`: Extrae datos del JSONB usando `extractAIResponse()`
- ✅ `TriageCard`: Recibe datos extraídos del JSONB
- ✅ `ValidationDialog`: 
  - Extrae `ai_reasoning` del JSONB
  - Agregado campo `feedback_enfermero` (Textarea)
  - Soporte para guardar feedback junto con validación

#### Utilidades:
- ✅ Creado `lib/utils/triage.ts` con función `extractAIResponse()`
- ✅ Helper para extraer campos del JSONB de forma type-safe

## 📋 Mapeo Final: Requisitos Tesis → Esquema BD

| Requisito Tesis | Columna BD | Tipo | Nullable | Notas |
|-----------------|------------|------|----------|-------|
| sintomas_paciente | `symptoms_text` | TEXT | NO | Input del paciente |
| prediccion_ia_esi | `esi_level` | INTEGER | NO | 1-5, del JSONB `ai_response` |
| validacion_enfermero_esi | `nurse_override_level` | INTEGER | YES | 1-5, nullable inicial |
| feedback_enfermero | `feedback_enfermero` | TEXT | YES | ✅ Agregado |

### Campos Adicionales en `ai_response` (JSONB):
```json
{
  "esi_level": "1-5",
  "reasoning": "Razonamiento clínico...",
  "critical_signs": ["signo1", "signo2"],
  "suggested_specialty": "Cardiología",
  "confidence": 0.95
}
```

## ✅ Verificación Post-Implementación

- ✅ Migración aplicada exitosamente en Supabase
- ✅ Tipos TypeScript regenerados y actualizados
- ✅ Código adaptado al esquema real
- ✅ Sin errores de compilación TypeScript
- ✅ Sin errores de linting
- ✅ Funcionalidad de feedback integrada en UI

## 🎯 Próximos Pasos Recomendados

1. **Testing**: Probar el flujo completo:
   - Ingreso de síntomas → Guardado en BD
   - Visualización en dashboard → Extracción correcta del JSONB
   - Validación con feedback → Guardado de `feedback_enfermero`

2. **Validación de Datos**: Verificar que los datos existentes en `ai_response` sean compatibles con la estructura esperada

3. **Documentación**: Actualizar documentación de API si es necesario

## 📝 Notas Técnicas

- El uso de JSONB para `ai_response` permite flexibilidad para agregar campos sin modificar el esquema
- La función `extractAIResponse()` proporciona type-safety al trabajar con JSONB
- El campo `feedback_enfermero` es opcional (nullable) para permitir validaciones sin feedback

---

**Fecha de Análisis**: $(date)  
**Estado**: ✅ Completado y Verificado


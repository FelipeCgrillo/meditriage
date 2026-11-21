# Sistema de Auto-Triage con IA - MVP Tesis de Magíster

Sistema de triaje asistido por inteligencia artificial para centros de atención primaria (CESFAM) en Chile, utilizando el protocolo Emergency Severity Index (ESI).

## 🎯 Descripción

Aplicación web desarrollada como MVP para una tesis de magíster que permite:
- Pacientes ingresan síntomas vía texto (voz en desarrollo)
- IA (Claude Sonnet 5, SDK oficial de Anthropic con salida estructurada) analiza y clasifica según ESI
- Personal de enfermería valida la clasificación
- Cumple con estándares HL7 FHIR para interoperabilidad

## 🚀 Stack Tecnológico

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes (serverless)
- **IA**: SDK oficial de Anthropic (`@anthropic-ai/sdk`), modelo `claude-sonnet-5`
- **Base de Datos**: Supabase (PostgreSQL)
- **Hosting**: Vercel
- **Validación**: Zod
- **Estándares**: HL7 FHIR RiskAssessment

## 📋 Prerequisitos

- Node.js 18+ y npm
- Cuenta de Supabase (gratis en https://supabase.com)
- API Key de Anthropic (https://console.anthropic.com)
- Cuenta de Vercel (opcional, para deployment)

## 🛠️ Instalación

### 1. Clonar e Instalar Dependencias

```bash
cd App_tesis_triage
npm install
```

### 2. Configurar Variables de Entorno

Crea un archivo `.env.local` basado en `.env.local.example`:

```bash
cp .env.local.example .env.local
```

Edita `.env.local` con tus credenciales:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key

# Anthropic
ANTHROPIC_API_KEY=sk-ant-tu-api-key

# App
NEXT_PUBLIC_APP_ENV=development
```

### 3. Configurar Base de Datos Supabase

1. Ve a https://supabase.com y crea un nuevo proyecto
2. En el panel de Supabase, ve a **SQL Editor**
3. Ejecuta las migraciones de `supabase/migrations/` en orden numérico (001 a 013).

### 4. Ejecutar en Desarrollo

```bash
npm run dev
```

Abre http://localhost:3000

## 📱 Uso

### Flujo del Paciente

1. **Pantalla de Consentimiento** (`/`)
   - Paciente lee información sobre el uso de datos
   - Acepta el consentimiento informado

2. **Ingreso de Síntomas** 
   - Describe síntomas en texto libre
   - Presiona "Analizar Síntomas"
   - IA procesa y clasifica (ESI 1-5)

3. **Pantalla de Éxito**
   - Confirma registro exitoso
   - NO muestra clasificación al paciente (privacidad)
   - Instruye devolver tablet al personal

### Dashboard de Enfermería

1. Accede a `/nurse`
2. Ve lista de registros pendientes
3. Revisa:
   - Clasificación ESI sugerida
   - Síntomas del paciente
   - Signos críticos identificados
   - Razonamiento clínico (terminología médica)
   - Especialidad sugerida
4. Aprueba o modifica la clasificación

## 🔬 Análisis retrospectivo DAU (protocolo CEC-E-319)

Ruta `/resultados/dau` (rol `researcher` o `admin`). Implementa el protocolo de la respuesta al oficio OBS-E-319-02:

1. **Carga** del CSV o JSON del custodio. Columnas reconocidas: id, sexo, tramo etario quinquenal, mes, franja horaria, motivo de consulta, síntomas, categoría TENS y destino al egreso. Un Excel se exporta antes como CSV UTF 8.
2. **Desidentificación en el navegador** (`src/lib/dau/deidentify.ts`, versión `2026.11-v1`): RUT, teléfonos, correos, direcciones, fechas, horas, nombres, grados, unidades y establecimientos. Retira signos vitales y observaciones del examinador y marca el registro para el análisis de sensibilidad.
3. **Revisión manual obligatoria**: el 100% de los primeros 100 textos y una muestra aleatoria reproducible del 10% del resto. Nada sale del navegador antes de aprobarla.
4. **Clasificación**: al servidor viajan solo id, relato desidentificado, sexo y grupo etario. El ESI TENS y el desenlace se quedan en el navegador.
5. **Métricas** (`src/lib/dau/metrics.ts`):
   - Sensibilidad para el desenlace de alta gravedad (ESI 1 a 3 cuenta como identificado), con IC de Wilson y Clopper-Pearson.
   - Comparación pareada con McNemar.
   - Subtriage clínicamente relevante.
   - AUC ROC con DeLong.
   - Kappa ponderado con IC asintótico y bootstrap.
   - Tabla de interpretación a priori.
   - Criterio de continuidad.
   - Ablación del LLM aislado.
   - Análisis sin relatos con signos vitales.
   - Estratos por motivo, sexo y edad.
6. **Exportes**: resultados CSV, métricas JSON y bitácora JSONL con el texto exacto enviado. La bitácora se guarda solo en el equipo con cifrado de disco.

Cada corrida registra la huella del protocolo congelado: modelo, SHA-256 del prompt, versión de reglas, versión del detector y esfuerzo. El guardado rechaza mezclar versiones. Claude Sonnet 5 rechaza `temperature`, así que la consistencia se fija con el esfuerzo `high`.

## 🏥 Protocolo ESI

El sistema implementa el Emergency Severity Index:

- **Nivel 1 (Crítico)**: Requiere intervención inmediata para salvar la vida
- **Nivel 2 (Emergencia)**: Alto riesgo, evaluación inmediata
- **Nivel 3 (Urgente)**: Requiere 2+ recursos
- **Nivel 4 (Menos Urgente)**: Requiere 1 recurso
- **Nivel 5 (No Urgente)**: Solo consulta

## 🔐 Privacidad y Seguridad

- ✅ API stateless (no logs de datos médicos en Vercel)
- ✅ Row Level Security (RLS) en Supabase
- ✅ Clasificación NO mostrada al paciente
- ✅ Solo personal autorizado accede a datos
- ✅ Headers de seguridad (X-Frame-Options, CSP)
- ⚠️ **IMPORTANTE**: En producción, eliminar política RLS "anon" y configurar autenticación

## 🧪 Testing

### Prueba del API de Triaje

```bash
curl http://localhost:3000/api/triage \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"symptoms":"Tengo dolor de pecho intenso, dificultad para respirar y mareos desde hace 30 minutos"}'
```

Debería retornar ESI Nivel 1 o 2.

### Health Check

```bash
curl http://localhost:3000/api/triage
```

## 📊 Base de Datos

### Tabla `clinical_records`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK |
| patient_consent | BOOLEAN | Consentimiento |
| symptoms_text | TEXT | Síntomas ingresados |
| ai_response | JSONB | Respuesta completa de IA |
| esi_level | INTEGER | Nivel ESI (1-5) |
| nurse_validated | BOOLEAN | Si fue validado |
| fhir_bundle | JSONB | Recurso FHIR |
| created_at | TIMESTAMP | Fecha creación |

## 🚀 Deployment en Vercel

1. Conecta tu repositorio a Vercel
2. Configura las variables de entorno:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `ANTHROPIC_API_KEY`
3. Deploy automático con cada push

## 🔮 Roadmap

- [ ] Autenticación de enfermeras (Supabase Auth)
- [ ] Entrada por voz (Web Speech API)
- [ ] Dashboard de estadísticas
- [ ] Notificaciones WhatsApp para casos críticos
- [ ] Modo offline (Service Worker)
- [ ] Soporte multi-idioma (Mapudungun, Creole)
- [ ] Exportación de datos FHIR

## 📄 Licencia

Este proyecto es parte de una tesis de investigación académica.

## 👥 Contacto

Para preguntas sobre el proyecto de tesis, contactar al equipo CESFAM.

## 🙏 Agradecimientos

- Protocolo ESI: Emergency Severity Index Implementation Handbook
- Anthropic Claude 3.5 Sonnet por capacidades de razonamiento clínico
- Vercel AI SDK por abstracción de modelos de lenguaje
- Supabase por infraestructura de base de datos

---

**⚠️ Disclaimer**: Este sistema es una herramienta de asistencia y NO reemplaza el juicio clínico profesional. Toda clasificación debe ser validada por personal de enfermería calificado.

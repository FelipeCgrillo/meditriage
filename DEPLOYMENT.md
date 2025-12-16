# 🚀 Guía de Deployment - Sistema de Auto-Triage

## Pre-requisitos de Deployment

### ✅ Checklist Antes de Deployar

- [ ] Cuenta de Vercel creada (https://vercel.com)
- [ ] Proyecto Supabase configurado
- [ ] API Key de Anthropic obtenida
- [ ] Repositorio Git inicializado
- [ ] Variables de entorno definidas
- [ ] Migraciones de base de datos ejecutadas

## 1. Configuración de Supabase

### Proyecto Existente

Ya tienes el proyecto Supabase creado:
- **Name**: `App_Tesis_triage`
- **Region**: Configurada
- **Status**: Listo para usar

Si necesitas crear uno nuevo:
1. Ve a https://supabase.com/dashboard
2. Click en "New Project"
3. Configura nombre y región
4. Espera ~2 minutos para inicialización

### Ejecutar Migraciones

En tu proyecto **App_Tesis_triage**:

1. En Supabase Dashboard, ve a **SQL Editor**
2. Click en "New Query"
3. Copia y pega el contenido de `supabase/migrations/001_clinical_records.sql`
4. Click "Run" (debería ejecutarse sin errores)
5. Repite con `supabase/migrations/002_fhir_mapping.sql`

**Verificación**: En **Table Editor** deberías ver la tabla `clinical_records` creada

### Obtener Credenciales

En tu proyecto **App_Tesis_triage**:

1. Ve a **Settings** > **API**
2. Copia y guarda en un lugar seguro:
   - **Project URL** (será algo como `https://xxxxx.supabase.co`)
   - **Anon public key** (empieza con `eyJhbG...`)

Estas credenciales las necesitarás para el archivo `.env.local`

## 2. Configuración de Anthropic

### Obtener API Key

1. Ve a https://console.anthropic.com
2. Inicia sesión o crea cuenta
3. Ve a **API Keys**
4. Click "Create Key"
5. Copia la clave (empieza con `sk-ant-...`)
6. **IMPORTANTE**: Asegúrate de tener créditos disponibles

### Configurar Límites (Opcional)

Para controlar costos en desarrollo:
1. En Anthropic Console, ve a **Settings** > **Billing**
2. Configura un límite mensual (ej: $10 USD para MVP)

## 3. Deployment en Vercel

### Opción A: Deploy desde GitHub (Recomendado)

1. **Inicializa Git** (si no lo has hecho):
   ```bash
   git init
   git add .
   git commit -m "Initial commit: AI-powered triage system"
   ```

2. **Crea repositorio en GitHub**:
   - Ve a https://github.com/new
   - Nombre: `cesfam-triage-mvp`
   - Visibilidad: **Private** (datos médicos)
   - NO inicialices con README

3. **Push al repositorio**:
   ```bash
   git remote add origin https://github.com/TU_USUARIO/cesfam-triage-mvp.git
   git branch -M main
   git push -u origin main
   ```

4. **Conecta a Vercel**:
   - Ve a https://vercel.com/new
   - Click "Import Git Repository"
   - Selecciona tu repositorio `cesfam-triage-mvp`
   - Framework Preset: **Next.js** (auto-detectado)

5. **Configura Variables de Entorno**:
   En la sección "Environment Variables", agrega:
   
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xyzabc123.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
   ANTHROPIC_API_KEY=sk-ant-...
   NEXT_PUBLIC_APP_ENV=production
   ```

6. **Deploy**:
   - Click "Deploy"
   - Espera ~2 minutos
   - Vercel te dará una URL (ej: `cesfam-triage-mvp.vercel.app`)

### Opción B: Deploy con Vercel CLI

```bash
# Instalar Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel

# Sigue las instrucciones interactivas
# Configura las env vars cuando se solicite
```

## 4. Configuración Post-Deployment

### Seguridad en Producción

#### Eliminar Acceso Anónimo en Supabase

⚠️ **CRÍTICO**: El código actual permite acceso anónimo para facilitar desarrollo. 

1. En Supabase Dashboard, ve a **SQL Editor**
2. Ejecuta:
   ```sql
   -- Eliminar política de acceso anónimo
   DROP POLICY IF EXISTS "Allow all operations for anon (dev only)" 
     ON clinical_records;
   ```

3. Implementa autenticación de enfermeras (ver roadmap)

#### Configurar Dominio Personalizado (Opcional)

1. En Vercel Dashboard, ve a **Settings** > **Domains**
2. Agrega tu dominio (ej: `triage.cesfam.cl`)
3. Configura DNS según instrucciones de Vercel

### Configurar CORS (Si necesario)

Si accedes desde otras aplicaciones:

1. En `next.config.js`, agrega:
   ```javascript
   async headers() {
     return [
       {
         source: '/api/:path*',
         headers: [
           { key: 'Access-Control-Allow-Origin', value: 'https://tu-dominio.cl' },
         ],
       },
     ];
   },
   ```

## 5. Testing Post-Deployment

### Test de Health Check

```bash
curl https://tu-app.vercel.app/api/triage
```

Esperado:
```json
{
  "status": "operational",
  "service": "ESI Triage API",
  "ai_configured": true
}
```

### Test de Clasificación

```bash
curl https://tu-app.vercel.app/api/triage \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "symptoms": "Dolor de pecho intenso, dificultad para respirar, mareos"
  }'
```

### Test de UI

1. Abre `https://tu-app.vercel.app`
2. Completa flujo:
   - ✓ Pantalla de consentimiento
   - ✓ Ingreso de síntomas
   - ✓ Análisis con IA
   - ✓ Pantalla de éxito
3. Verifica en `/nurse` que aparece el registro

## 6. Monitoreo

### Logs en Vercel

1. Ve a Vercel Dashboard > Tu Proyecto
2. Click en **Logs**
3. Filtra por:
   - **Functions**: Para ver llamadas a API
   - **Static**: Para ver acceso a páginas

### Métricas de Supabase

1. Ve a Supabase Dashboard > **Database**
2. Revisa:
   - Número de registros en `clinical_records`
   - Uso de almacenamiento
   - Queries ejecutadas

### Costos de Anthropic

1. Ve a Anthropic Console > **Usage**
2. Monitorea:
   - Tokens utilizados
   - Costo actual
   - Proyección mensual

## 7. Troubleshooting

### Error: "AI service not configured"

**Causa**: `ANTHROPIC_API_KEY` no está configurada

**Solución**:
1. Vercel Dashboard > Settings > Environment Variables
2. Agrega `ANTHROPIC_API_KEY`
3. Redeploy: `vercel --prod`

### Error: "Database connection failed"

**Causa**: URL o Key de Supabase incorrecta

**Solución**:
1. Verifica en Supabase Dashboard > Settings > API
2. Copia nuevamente URL y Anon Key
3. Actualiza en Vercel env vars
4. Redeploy

### Error 500 en /api/triage

**Diagnóstico**:
```bash
# Ver logs en tiempo real
vercel logs --follow

# O en Vercel Dashboard > Logs
```

**Causas comunes**:
- Límite de tokens de Anthropic excedido
- Timeout (default 10s en Vercel Hobby)
- Error en validación Zod

### Base de Datos Vacía

**Verificar migraciones**:
```sql
-- En Supabase SQL Editor
SELECT * FROM clinical_records LIMIT 1;
```

Si da error, re-ejecuta migraciones.

## 8. Actualizaciones Continuas

### Deploy Automático

Vercel hace deploy automático en cada push a `main`:

```bash
git add .
git commit -m "feat: nueva funcionalidad"
git push
# Vercel auto-deploya
```

### Rollback

Si algo falla:
1. Vercel Dashboard > Deployments
2. Click en deployment anterior estable
3. Click "Promote to Production"

## 9. Backup y Recuperación

### Backup de Base de Datos

En Supabase (Plan Pro):
- Backups automáticos diarios
- Retención 7 días

En Plan Free:
```bash
# Exportar manualmente
pg_dump <database_url> > backup.sql
```

### Restaurar

```sql
-- En Supabase SQL Editor
\i backup.sql
```

## 10. Consideraciones de Producción

### Límites del Plan Free

**Vercel Hobby**:
- ✅ Unlimited deployments
- ✅ SSL automático
- ⚠️ 10s execution timeout (API Routes)
- ⚠️ 100GB bandwidth/mes

**Supabase Free**:
- ✅ 500MB database
- ✅ 1GB file storage
- ⚠️ Pausado después 7 días de inactividad

**Anthropic**:
- 💰 Pay-per-use (~$0.003/request promedio)

### Escalabilidad

Para pasar a producción real:
1. **Vercel Pro** ($20/mes): Timeouts 60s, analytics
2. **Supabase Pro** ($25/mes): Backups, no pausa
3. **Monitoring**: Sentry, Datadog
4. **Autenticación**: Supabase Auth + RLS
5. **Rate Limiting**: Proteger /api/triage

---

## 📞 Soporte

- Vercel: https://vercel.com/docs
- Supabase: https://supabase.com/docs
- Anthropic: https://docs.anthropic.com

## ✅ Checklist Final

- [ ] Aplicación desplegada en Vercel
- [ ] Variables de entorno configuradas
- [ ] Migraciones ejecutadas en Supabase
- [ ] Health check OK
- [ ] Test de clasificación funcional
- [ ] UI completa probada en producción
- [ ] Acceso anónimo removido (seguridad)
- [ ] Monitoreo configurado
- [ ] Documentación actualizada

¡Tu sistema de triaje con IA está listo para uso en CESFAM! 🏥✨

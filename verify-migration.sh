#!/bin/bash

# Script de Verificación: Implementación de nurse_esi_level
# Propósito: Confirmar que todos los cambios están aplicados correctamente
# Uso: ./verify-migration.sh

set -e

echo "🔍 VERIFICACIÓN DE IMPLEMENTACIÓN: nurse_esi_level"
echo "=================================================="
echo ""

# Colores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Contador de tests
PASSED=0
FAILED=0

# Función para verificar archivo
check_file() {
  if [ -f "$1" ]; then
    echo -e "${GREEN}✅${NC} Archivo existe: $1"
    ((PASSED++))
    return 0
  else
    echo -e "${RED}❌${NC} Archivo faltante: $1"
    ((FAILED++))
    return 1
  fi
}

# Función para verificar contenido en archivo
check_content() {
  if grep -q "$2" "$1" 2>/dev/null; then
    echo -e "${GREEN}✅${NC} Contenido encontrado en $1: '$2'"
    ((PASSED++))
    return 0
  else
    echo -e "${RED}❌${NC} Contenido faltante en $1: '$2'"
    ((FAILED++))
    return 1
  fi
}

echo "📁 VERIFICANDO ARCHIVOS..."
echo ""

# Test 1: Migración SQL
check_file "supabase/migrations/006_add_nurse_esi_level.sql"

# Test 2: Tipos TypeScript
check_file "lib/supabase/types.ts"
check_content "lib/supabase/types.ts" "nurse_esi_level"

# Test 3: ValidationDialog
check_file "components/dashboard/ValidationDialog.tsx"
check_content "components/dashboard/ValidationDialog.tsx" "nurse_esi_level"
check_content "components/dashboard/ValidationDialog.tsx" "FASE 1"
check_content "components/dashboard/ValidationDialog.tsx" "FASE 2"

# Test 4: Dashboard page
check_file "app/(nurse)/dashboard/page.tsx"
check_content "app/(nurse)/dashboard/page.tsx" "nurseLevel"

# Test 5: Documentación
check_file "VERIFICACION_DATOS_KAPPA.md"
check_file "RESUMEN_IMPLEMENTACION.md"
check_file "supabase/test_nurse_esi_level.sql"

echo ""
echo "📊 VERIFICANDO ESTRUCTURA DE CÓDIGO..."
echo ""

# Test 6: Verificar que no hay TODOs críticos
if grep -r "TODO.*nurse_esi_level" app/ components/ lib/ 2>/dev/null; then
  echo -e "${YELLOW}⚠️${NC} Se encontraron TODOs relacionados con nurse_esi_level"
  ((FAILED++))
else
  echo -e "${GREEN}✅${NC} No hay TODOs pendientes"
  ((PASSED++))
fi

# Test 7: Verificar que no hay console.logs olvidados
if grep -r "console.log.*nurse" app/ components/ 2>/dev/null | grep -v "console.error"; then
  echo -e "${YELLOW}⚠️${NC} Se encontraron console.logs de debug"
  ((FAILED++))
else
  echo -e "${GREEN}✅${NC} No hay console.logs de debug"
  ((PASSED++))
fi

echo ""
echo "🗃️ VERIFICANDO BASE DE DATOS..."
echo ""

# Test 8: Verificar si hay variables de entorno
if [ -f ".env.local" ]; then
  if grep -q "NEXT_PUBLIC_SUPABASE_URL" .env.local; then
    echo -e "${GREEN}✅${NC} Variables de entorno configuradas"
    ((PASSED++))
    
    # Intentar verificar estructura de BD (requiere supabase-cli)
    if command -v supabase &> /dev/null; then
      echo -e "${GREEN}✅${NC} Supabase CLI instalado"
      ((PASSED++))
      
      echo ""
      echo -e "${YELLOW}💡${NC} Para verificar la migración en la BD, ejecuta:"
      echo "   supabase db diff"
      echo ""
    else
      echo -e "${YELLOW}⚠️${NC} Supabase CLI no instalado (opcional)"
      echo "   Instalar con: npm install -g supabase"
      # No contamos esto como fallo crítico
    fi
  else
    echo -e "${RED}❌${NC} Variables de entorno incompletas"
    ((FAILED++))
  fi
else
  echo -e "${YELLOW}⚠️${NC} Archivo .env.local no encontrado"
  ((FAILED++))
fi

echo ""
echo "=================================================="
echo "📈 RESUMEN DE VERIFICACIÓN"
echo "=================================================="
echo ""
echo -e "Tests pasados:  ${GREEN}${PASSED}${NC}"
echo -e "Tests fallidos: ${RED}${FAILED}${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}🎉 ÉXITO: Todos los archivos están en su lugar${NC}"
  echo ""
  echo "⏭️ PRÓXIMOS PASOS:"
  echo ""
  echo "1. Aplicar migración SQL en Supabase:"
  echo "   - Ir a: https://supabase.com/dashboard/project/YOUR_PROJECT/sql"
  echo "   - Copiar contenido de: supabase/migrations/006_add_nurse_esi_level.sql"
  echo "   - Ejecutar la query"
  echo ""
  echo "2. Verificar que la columna existe:"
  echo "   SELECT column_name FROM information_schema.columns"
  echo "   WHERE table_name = 'clinical_records' AND column_name = 'nurse_esi_level';"
  echo ""
  echo "3. Hacer test manual del flujo:"
  echo "   - Crear caso en /paciente"
  echo "   - Validar en /nurse/dashboard"
  echo "   - Verificar que nurse_esi_level se guarda"
  echo ""
  echo "4. Ejecutar tests SQL:"
  echo "   - Abrir: supabase/test_nurse_esi_level.sql"
  echo "   - Ejecutar en Supabase SQL Editor"
  echo ""
  echo "📖 Documentación completa en:"
  echo "   - VERIFICACION_DATOS_KAPPA.md"
  echo "   - RESUMEN_IMPLEMENTACION.md"
  echo ""
  exit 0
else
  echo -e "${RED}❌ ADVERTENCIA: Hay tests fallidos${NC}"
  echo ""
  echo "Revisa los errores arriba y corrige antes de continuar."
  echo ""
  exit 1
fi


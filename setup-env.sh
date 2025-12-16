#!/bin/bash

echo "🔧 Configurador de .env.local para Sistema de Triaje"
echo "===================================================="
echo ""

# Check if .env.local already exists
if [ -f .env.local ]; then
    echo "⚠️  El archivo .env.local ya existe."
    read -p "¿Quieres sobrescribirlo? (s/n): " overwrite
    if [ "$overwrite" != "s" ]; then
        echo "Cancelado."
        exit 0
    fi
fi

echo "Por favor proporciona las siguientes credenciales:"
echo ""

# Supabase URL
echo "1️⃣  NEXT_PUBLIC_SUPABASE_URL"
echo "   Obtén esto de: Supabase Dashboard > App_Tesis_triage > Settings > API"
echo "   Ejemplo: https://xxxxx.supabase.co"
read -p "   URL: " SUPABASE_URL

# Supabase Anon Key
echo ""
echo "2️⃣  NEXT_PUBLIC_SUPABASE_ANON_KEY"
echo "   Obtén esto de: Supabase Dashboard > App_Tesis_triage > Settings > API"
echo "   Ejemplo: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
read -p "   Anon Key: " SUPABASE_ANON_KEY

# Anthropic API Key
echo ""
echo "3️⃣  ANTHROPIC_API_KEY (opcional para testing)"
echo "   Obtén esto de: https://console.anthropic.com/settings/keys"
echo "   Ejemplo: sk-ant-api03-..."
read -p "   API Key (deja vacío para omitir): " ANTHROPIC_KEY

if [ -z "$ANTHROPIC_KEY" ]; then
    ANTHROPIC_KEY="sk-ant-placeholder-replace-this"
fi

# Create .env.local file
cat > .env.local << EOF
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY

# Anthropic AI Configuration
ANTHROPIC_API_KEY=$ANTHROPIC_KEY

# Application Settings
NEXT_PUBLIC_APP_ENV=development
EOF

echo ""
echo "✅ Archivo .env.local creado exitosamente!"
echo ""
echo "Verifica el contenido:"
cat .env.local
echo ""
echo "🚀 Ahora puedes ejecutar: npm run dev"

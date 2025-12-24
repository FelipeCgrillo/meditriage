-- ================================================================
-- SCRIPT: Crear Usuario Investigador para Acceso a /resultados
-- ================================================================
-- Ejecutar este script DESPUÉS de crear el usuario en Supabase Auth
-- Dashboard → Authentication → Users → "Add user"

-- PASO 1: Crear usuario en Supabase Dashboard primero
-- Email: tu-email@ejemplo.com
-- Password: (tu contraseña segura)
-- Confirmar email automáticamente: ✅

-- PASO 2: Ejecutar este SQL (reemplaza USER_ID con el UUID del usuario creado)

-- Insertar perfil de investigador
INSERT INTO user_profiles (id, email, full_name, role)
VALUES (
    'USER_ID_AQUI',  -- 🔥 REEMPLAZAR con el UUID del usuario de Supabase Auth
    'tu-email@ejemplo.com',
    'Nombre del Investigador',
    'researcher'  -- ⭐ Rol necesario para acceder a /resultados
)
ON CONFLICT (id) DO UPDATE SET
    role = 'researcher',
    updated_at = NOW();

-- VERIFICAR que el usuario tiene el rol correcto
SELECT id, email, full_name, role, created_at
FROM user_profiles
WHERE role = 'researcher';

-- ================================================================
-- RESULTADO ESPERADO:
-- Deberías ver una fila con:
-- - id: UUID del usuario
-- - email: tu-email@ejemplo.com
-- - role: researcher
-- ================================================================

-- Migración 014: cierra la escalada de privilegios en user_profiles.
--
-- Problema: la política "Users can update own profile" (migración 006) solo
-- exigía auth.uid() = id, sin restringir columnas. Cualquier usuario
-- autenticado podía ejecutar desde el navegador, con la clave anon:
--   update user_profiles set role = 'admin', organization_id = null where id = auth.uid();
-- y convertirse en administrador de plataforma, con acceso a todos los tenants.
--
-- La aplicación nunca actualiza perfiles desde el cliente: todas las
-- escrituras (alta de usuarios, cambio de contraseña) usan service_role en
-- rutas de servidor. Por eso:
--   1. Se elimina la política de UPDATE para authenticated.
--   2. Se revocan los permisos de escritura de anon y authenticated sobre la
--      tabla (defensa en profundidad si alguien recrea una política amplia).
--   3. Un trigger rechaza cambios a columnas sensibles cuando quien escribe
--      no es service_role ni el propietario de la base.
--
-- Idempotente.

BEGIN;

-- 1. Política de UPDATE propia: fuera.
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;

-- 2. Solo lectura para los roles del cliente. SELECT sigue filtrado por la
--    política "Users can read own profile".
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
    ON public.user_profiles FROM anon, authenticated;
REVOKE ALL ON public.user_profiles FROM anon;
GRANT SELECT ON public.user_profiles TO authenticated;

-- 3. Guardia sobre columnas sensibles.
CREATE OR REPLACE FUNCTION public.guard_user_profiles_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      RAISE EXCEPTION 'user_profiles: alta de perfiles solo desde el servidor'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.role IS DISTINCT FROM OLD.role
       OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
       OR NEW.is_active IS DISTINCT FROM OLD.is_active
       OR NEW.must_change_password IS DISTINCT FROM OLD.must_change_password THEN
      RAISE EXCEPTION 'user_profiles: columna protegida, solo modificable desde el servidor'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_user_profiles_privileged_columns ON public.user_profiles;
CREATE TRIGGER guard_user_profiles_privileged_columns
  BEFORE INSERT OR UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_user_profiles_privileged_columns();

COMMIT;

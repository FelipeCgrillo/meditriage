import { createBrowserClient } from '@supabase/ssr';

/**
 * Sanitiza variables de entorno: elimina saltos de línea, tabs y espacios
 * en blanco que Vercel a veces inyecta accidentalmente al pegar valores.
 * Sin esto, la URL puede contener `\n` final y romper todas las peticiones.
 */
const sanitize = (s?: string) => s?.replace(/[\r\n\t]/g, '').trim();

const supabaseUrl = sanitize(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseAnonKey = sanitize(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/**
 * Supabase client for browser/client-side usage.
 *
 * No lanzamos error en module load cuando faltan vars — eso cascadea en
 * un hydration error de React y deja al usuario en pantalla en blanco.
 * Cuando faltan claves usamos placeholders, registramos warning, y dejamos
 * que los callers manejen los errores via sus ramas `if (error)`.
 */
const isConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isConfigured) {
    // eslint-disable-next-line no-console
    console.warn(
        '[supabase] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not configured. ' +
        'Database operations will be skipped. Set these env vars to enable persistence.',
    );
}

const safeUrl = supabaseUrl || 'https://placeholder.supabase.co';
const safeKey = supabaseAnonKey || 'placeholder-anon-key';

/**
 * Helpers de cookies sincronizados con el storage de Supabase.
 *
 * CRÍTICO: por defecto `createBrowserClient` de `@supabase/ssr` v0.8 escribe
 * la sesión en localStorage. El middleware de Next.js sólo puede leer cookies
 * — sin estas implementaciones explícitas el middleware ve al usuario como
 * anónimo en cada refresh/navegación directa y redirige a /login/nurse,
 * causando el spinner infinito tras F5.
 *
 * Estas implementaciones aseguran que la sesión también viva en cookies del
 * browser, donde el middleware (createServerClient con cookies()) sí puede
 * leerla y autenticar la request server-side.
 */
function getCookie(name: string): string | undefined {
    if (typeof document === 'undefined') return undefined;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift();
    return undefined;
}

type CookieAttrs = {
    maxAge?: number;
    path?: string;
    domain?: string;
    sameSite?: string | boolean;
    secure?: boolean;
    expires?: Date;
};

function setCookie(name: string, value: string, options: CookieAttrs = {}) {
    if (typeof document === 'undefined') return;
    let cookie = `${name}=${encodeURIComponent(value)}`;
    cookie += `; Path=${options.path ?? '/'}`;
    if (typeof options.maxAge === 'number') cookie += `; Max-Age=${options.maxAge}`;
    if (options.expires) cookie += `; Expires=${options.expires.toUTCString()}`;
    if (options.domain) cookie += `; Domain=${options.domain}`;
    const sameSite = options.sameSite ?? 'Lax';
    cookie += `; SameSite=${typeof sameSite === 'string' ? sameSite : (sameSite ? 'Strict' : 'Lax')}`;
    if (options.secure ?? (typeof window !== 'undefined' && window.location.protocol === 'https:')) {
        cookie += '; Secure';
    }
    document.cookie = cookie;
}

function removeCookie(name: string, options: CookieAttrs = {}) {
    if (typeof document === 'undefined') return;
    setCookie(name, '', { ...options, maxAge: 0 });
}

/**
 * Builder centralizado del cliente browser con cookies explícitas.
 * Esto garantiza que cualquier import (módulo singleton o factory) use la
 * misma configuración de persistencia.
 */
function buildBrowserClient() {
    return createBrowserClient(safeUrl, safeKey, {
        cookies: {
            get(name: string) {
                const raw = getCookie(name);
                return raw ? decodeURIComponent(raw) : undefined;
            },
            set(name: string, value: string, options?: CookieAttrs) {
                setCookie(name, value, options ?? {});
            },
            remove(name: string, options?: CookieAttrs) {
                removeCookie(name, options ?? {});
            },
        },
    });
}

/**
 * Supabase client. Cuando faltan envs es una instancia válida con
 * credenciales placeholder; las llamadas fallarán con errores que los
 * callers ya manejan.
 */
export const supabase = buildBrowserClient();

/**
 * Crea una nueva instancia del cliente browser.
 */
export function createClient() {
    return buildBrowserClient();
}

/**
 * Indica si las envs de Supabase estaban configuradas al cargar el módulo.
 */
export const isSupabaseConfigured = isConfigured;

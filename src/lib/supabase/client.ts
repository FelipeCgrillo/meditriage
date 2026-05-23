import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Supabase client for browser/client-side usage.
 *
 * We do NOT throw at module load when env vars are missing — that would
 * cascade into a React hydration error on every page that imports this
 * module, leaving the user stuck on a blank screen. Instead, when keys
 * are missing we build the client with safe placeholder values so the
 * module loads, log a loud warning, and let downstream callers handle
 * the resulting failures via their existing `if (error)` branches.
 */
const isConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isConfigured) {
    // Loud warning during build/runtime; the patient flow can still load.
    // eslint-disable-next-line no-console
    console.error(
        '[supabase] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not configured. ' +
        'Database operations will return errors. Set these env vars to enable persistence.',
    );
}

const safeUrl = supabaseUrl || 'https://placeholder.supabase.co';
const safeKey = supabaseAnonKey || 'placeholder-anon-key';

/**
 * Supabase client. When env vars are missing, this is still a valid
 * client instance bound to placeholder credentials; calls will fail
 * with network/auth errors that callers already handle via `.error`.
 */
export const supabase = createBrowserClient(safeUrl, safeKey);

/**
 * Create a new browser client instance.
 */
export function createClient() {
    return createBrowserClient(safeUrl, safeKey);
}

/**
 * Indicates whether Supabase env vars were configured at module load.
 * Callers can short-circuit DB calls when this is false.
 */
export const isSupabaseConfigured = isConfigured;

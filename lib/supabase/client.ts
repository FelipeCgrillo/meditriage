import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
}

/**
 * Supabase client for browser/client-side usage
 * Uses @supabase/ssr for proper cookie-based authentication
 */
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

/**
 * Create a new browser client instance
 * Use this when you need a fresh client
 */
export function createClient() {
    return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

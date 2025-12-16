import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
}

/**
 * Supabase client for browser/client-side usage
 * Note: Using default typing for flexibility with JSONB fields
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Create a Supabase client for server-side usage (API routes)
 * Uses the same credentials but can be extended with service role key if needed
 */
export function createServerClient() {
    return createClient(supabaseUrl, supabaseAnonKey);
}

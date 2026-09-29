import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const backendConfigured = Boolean(url && key) && import.meta.env.VITE_FORCE_DEMO !== '1';

/** Null when no backend is configured; callers fall back to labelled sample data. */
export const supabase: SupabaseClient | null = backendConfigured
  ? createClient(url as string, key as string, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

/** Base URL of Edge Functions (report-intake, otp, vote, …). */
export const functionsUrl = url ? `${url}/functions/v1` : null;

// Database access for Edge Functions. The service-role client bypasses row-level security, so it is only ever used
// to call the `svc_*` functions (which carry the rules) or to read reference data. It never leaves this process.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { env } from './env.ts';
import { HttpError } from './http.ts';

const opts = { auth: { persistSession: false, autoRefreshToken: false } };

let service: SupabaseClient | null = null;

export function serviceClient(): SupabaseClient {
  if (!service) {
    const url = env('SUPABASE_URL');
    const key = env('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) throw new HttpError(503, 'not_configured');
    service = createClient(url, key, opts);
  }
  return service;
}

/** A client that acts as the signed-in person: row-level security applies to everything it does. */
export function userClient(jwt: string): SupabaseClient {
  const url = env('SUPABASE_URL');
  const anon = env('SUPABASE_ANON_KEY');
  if (!url || !anon) throw new HttpError(503, 'not_configured');
  return createClient(url, anon, { ...opts, global: { headers: { Authorization: `Bearer ${jwt}` } } });
}

/** Call a service-role function. Database errors are logged here and never shown to the caller. */
export async function rpc<T = unknown>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await serviceClient().rpc(name, args);
  if (error) {
    console.error(`[rpc:${name}]`, error.code, error.message);
    // a reference to something that does not exist (bad ward, bad category) is the caller's mistake, not ours
    if (error.code === '23503' || error.code === '23514' || error.code === '22023') throw new HttpError(422, 'invalid_request');
    throw new HttpError(500, 'server_error');
  }
  return data as T;
}

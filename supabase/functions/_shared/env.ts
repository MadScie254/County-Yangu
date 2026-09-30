// Environment access that works in Deno (Supabase Edge Functions) and in Node (the unit tests).
// Secrets are only ever read here, from the function's environment. Nothing in this folder is sent to a browser.

type Host = { Deno?: { env: { get(k: string): string | undefined } }; process?: { env: Record<string, string | undefined> } };

export function env(name: string): string | undefined {
  const g = globalThis as unknown as Host;
  const v = g.Deno?.env.get(name) ?? g.process?.env[name];
  return v === undefined || v === '' ? undefined : v;
}

export function envInt(name: string, fallback: number): number {
  const n = Number(env(name));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/** The first key from a JSON object of named keys, as Supabase provides SUPABASE_SECRET_KEYS / SUPABASE_PUBLISHABLE_KEYS. */
function namedKey(name: string): string | undefined {
  const raw = env(name);
  if (!raw) return undefined;
  try {
    const keys = JSON.parse(raw) as Record<string, unknown>;
    const v = keys.default ?? Object.values(keys)[0];
    return typeof v === 'string' && v ? v : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The key that lets a function act as the service (bypassing row-level security). Prefers the new-style secret key, so
 * the legacy JWT-based service_role key can be switched off: COUNTY_SERVICE_KEY (set by the county), then the secret
 * keys Supabase injects, then the legacy key.
 */
export const serviceKey = (): string | undefined => env('COUNTY_SERVICE_KEY') ?? namedKey('SUPABASE_SECRET_KEYS') ?? env('SUPABASE_SERVICE_ROLE_KEY');

/** The public key used when acting as a signed-in person. Same order: publishable key first, legacy anon key last. */
export const publishableKey = (): string | undefined => env('COUNTY_PUBLISHABLE_KEY') ?? namedKey('SUPABASE_PUBLISHABLE_KEYS') ?? env('SUPABASE_ANON_KEY');

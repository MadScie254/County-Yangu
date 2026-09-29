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

// Africa's Talking calls us (USSD and inbound SMS) but does not sign its requests, so the callback URL carries a secret
// token, and can additionally be pinned to Africa's Talking's source addresses. Fail closed: nothing configured, nothing accepted.
import { env } from './env.ts';
import { timingSafeEqual } from './crypto.ts';

export function atAuthorized(url: URL, ip: string, tokenVar: string): boolean {
  const expected = env(tokenVar);
  if (!expected || expected.length < 24) return false;
  if (!timingSafeEqual(url.searchParams.get('token') ?? '', expected)) return false;
  const allowed = (env('AT_ALLOWED_IPS') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return allowed.length === 0 || allowed.includes(ip);
}

/** Africa's Talking posts application/x-www-form-urlencoded. */
export async function formFields(req: Request): Promise<Record<string, string>> {
  const form = await req.formData();
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === 'string') out[k] = v.slice(0, 1000);
  return out;
}

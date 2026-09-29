// Verifies Standard Webhooks signatures (what Supabase Auth hooks use). https://www.standardwebhooks.com
//   signed content = `${webhook-id}.${webhook-timestamp}.${raw body}`
//   webhook-signature = "v1,<base64 HMAC-SHA256>" (space separated if the secret is being rotated)
import { hmac, timingSafeEqual } from './crypto.ts';

const fromBase64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const toBase64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));

export async function verifyStandardWebhook(secret: string, headers: Headers, rawBody: string, now = Date.now(), toleranceSeconds = 300): Promise<boolean> {
  const id = headers.get('webhook-id');
  const ts = headers.get('webhook-timestamp');
  const sigs = headers.get('webhook-signature');
  if (!id || !ts || !sigs) return false;
  const t = Number(ts);
  if (!Number.isFinite(t) || Math.abs(now / 1000 - t) > toleranceSeconds) return false;

  let key: Uint8Array;
  try {
    // The secret looks like "v1,whsec_<base64>"
    key = fromBase64(secret.replace(/^v1,/, '').replace(/^whsec_/, ''));
  } catch {
    return false;
  }
  const expected = toBase64(await hmac(key, `${id}.${ts}.${rawBody}`));
  return sigs.split(' ').some((s) => {
    const [version, sig] = s.split(',');
    return version === 'v1' && sig !== undefined && timingSafeEqual(sig, expected);
  });
}

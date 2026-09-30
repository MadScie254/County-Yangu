// Hashing, keyed hashing, constant-time compare and signed tokens. WebCrypto only, so it runs in Deno and Node alike.
//
// One county secret (COUNTY_HMAC_SECRET) is used with a different label for each purpose, so a value computed for
// one purpose can never be replayed as another (a phone hash is not a voter hash, an OTP hash is not a token signature).
import { HttpError } from './http.ts';
import { env } from './env.ts';

const enc = new TextEncoder();

export const bytesToHex = (b: Uint8Array): string => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

export function b64url(b: Uint8Array): string {
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromB64url(s: string): Uint8Array {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export async function sha256(data: string | Uint8Array): Promise<Uint8Array> {
  const bytes = typeof data === 'string' ? enc.encode(data) : data;
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as BufferSource));
}

export async function hmac(key: string | Uint8Array, message: string): Promise<Uint8Array> {
  const raw = typeof key === 'string' ? enc.encode(key) : key;
  const k = await crypto.subtle.importKey('raw', raw as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(message)));
}

/** PostgREST takes bytea as a \x-prefixed hex string. */
export const pgBytea = (b: Uint8Array): string => '\\x' + bytesToHex(b);

/** Constant-time comparison (the work done does not depend on where the first difference is). */
export function timingSafeEqual(a: string | Uint8Array, b: string | Uint8Array): boolean {
  const x = typeof a === 'string' ? enc.encode(a) : a;
  const y = typeof b === 'string' ? enc.encode(b) : b;
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** `n` random decimal digits, uniformly distributed (rejection sampling, no modulo bias). */
export function randomDigits(n: number): string {
  let out = '';
  while (out.length < n) {
    for (const b of crypto.getRandomValues(new Uint8Array(n * 2))) {
      if (b < 250 && out.length < n) out += String(b % 10);
    }
  }
  return out;
}

export const randomToken = (bytes = 32): string => b64url(crypto.getRandomValues(new Uint8Array(bytes)));

// ---- the county secret ---------------------------------------------------------------------------------------------

export function countySecret(): string {
  const s = env('COUNTY_HMAC_SECRET');
  if (!s || s.length < 32) throw new HttpError(503, 'not_configured');
  return s;
}

export type Label = 'phone' | 'voter' | 'otp-code' | 'ip' | 'token' | 'supporter';

/** Keyed hash of `value` for one purpose. */
export async function mac(secret: string, label: Label, value: string): Promise<Uint8Array> {
  return hmac(secret, `county-yangu/v1/${label}\u0000${value}`);
}

// ---- verification tokens ------------------------------------------------------------------------------------------------
// After a phone is verified, the browser gets a short-lived signed token. It says "the holder proved they control the
// phone with hash `ph`, for this purpose, until `exp`". The server keeps no session for it.

export type VerifiedToken = {
  /** what the phone was verified for: vote | alerts | petition */
  p: string;
  /** keyed hash of the phone number, hex */
  ph: string;
  /** the number itself, present only for alerts (we need it to send the SMS) */
  m?: string;
  /** expiry, epoch milliseconds */
  exp: number;
};

export async function signToken(secret: string, payload: VerifiedToken): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = b64url(await mac(secret, 'token', body));
  return `${body}.${sig}`;
}

/** Returns the payload if the signature is genuine, the purpose matches and it has not expired; otherwise null. */
export async function verifyToken(secret: string, token: unknown, purpose: string, now = Date.now()): Promise<VerifiedToken | null> {
  if (typeof token !== 'string' || token.length > 1024) return null;
  const [body, sig, ...rest] = token.split('.');
  if (!body || !sig || rest.length) return null;
  const expected = b64url(await mac(secret, 'token', body));
  if (!timingSafeEqual(sig, expected)) return null;
  try {
    const p = JSON.parse(new TextDecoder().decode(fromB64url(body))) as VerifiedToken;
    if (p.p !== purpose || typeof p.ph !== 'string' || typeof p.exp !== 'number' || p.exp < now) return null;
    return p;
  } catch {
    return null;
  }
}

/** A stable UUID (v4-shaped) derived from a hash, for idempotency keys that must be the same on a retry. */
export function uuidFrom(hash: Uint8Array): string {
  const b = Uint8Array.from(hash.subarray(0, 16));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = bytesToHex(b);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

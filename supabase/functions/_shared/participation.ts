// What the OTP, vote, alerts and idea functions have in common: who is calling (by hashed address), the phone
// verification token, and the keyed hashes that identify a person without storing who they are.
import { bytesToHex, countySecret, mac, pgBytea, verifyToken, type VerifiedToken } from './crypto.ts';
import { rpc } from './db.ts';
import { clientIp, HttpError } from './http.ts';

export const PURPOSES = ['vote', 'alerts', 'petition'] as const;
export type Purpose = (typeof PURPOSES)[number];

/** Refuse (429) when `key` has been used more than `max` times in `windowSeconds`. */
export async function limit(key: string, windowSeconds: number, max: number): Promise<void> {
  if (!(await rpc<boolean>('svc_rate_limit', { p_key: key, p_window_seconds: windowSeconds, p_max: max }))) {
    throw new HttpError(429, 'rate_limited', { retry_after: windowSeconds });
  }
}

export async function ipKey(req: Request): Promise<string> {
  return bytesToHex(await mac(countySecret(), 'ip', clientIp(req)));
}

export const phoneHash = async (e164: string): Promise<Uint8Array> => mac(countySecret(), 'phone', e164);

/** A verified-phone token from the request body, for the given purpose, or 401. */
export async function requireVerified(token: unknown, purpose: Purpose): Promise<VerifiedToken> {
  const t = await verifyToken(countySecret(), token, purpose);
  if (!t) throw new HttpError(401, 'verification_required');
  return t;
}

/**
 * The identity used for "one person, one vote": a keyed hash of (scope, phone hash). The same phone gives the same
 * hash on the web and on USSD, so somebody cannot vote twice by switching channel, and nothing here can be turned back
 * into a phone number. `scope` is the cycle for votes and the idea for supports.
 */
export async function voterHash(scope: string, phoneHashHex: string): Promise<string> {
  return pgBytea(await mac(countySecret(), 'voter', `${scope}:${phoneHashHex}`));
}

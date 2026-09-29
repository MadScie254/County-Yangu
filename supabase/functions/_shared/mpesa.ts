// Safaricom Daraja helpers: pure formatting/parsing, no network. The functions do the I/O.
import { env } from './env.ts';
import { timingSafeEqual } from './crypto.ts';

export const darajaBase = (): string => (env('MPESA_ENV') === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke');

/** yyyyMMddHHmmss in UTC. Daraja only needs the Password and Timestamp to agree with each other. */
export const timestamp = (d = new Date()): string => d.toISOString().replace(/[-:T]/g, '').slice(0, 14);

export const stkPassword = (shortcode: string, passkey: string, ts: string): string => btoa(`${shortcode}${passkey}${ts}`);

export type StkResult = {
  checkoutRequestId: string;
  resultCode: number;
  receipt: string | null;
  amount: number | null;
  /** last four digits of the payer's number; the full number is never kept */
  last4: string | null;
};

type Item = { Name?: string; Value?: string | number };

/** Parse the STK push callback. Returns null if it is not shaped like one. */
export function parseStkCallback(body: unknown): StkResult | null {
  const cb = (body as { Body?: { stkCallback?: Record<string, unknown> } } | null)?.Body?.stkCallback;
  if (!cb || typeof cb.CheckoutRequestID !== 'string' || typeof cb.ResultCode !== 'number') return null;
  const items = ((cb.CallbackMetadata as { Item?: Item[] } | undefined)?.Item ?? []) as Item[];
  const get = (n: string) => items.find((i) => i.Name === n)?.Value;
  const amount = get('Amount');
  const receipt = get('MpesaReceiptNumber');
  const phone = get('PhoneNumber');
  return {
    checkoutRequestId: cb.CheckoutRequestID,
    resultCode: cb.ResultCode,
    receipt: typeof receipt === 'string' ? receipt : null,
    amount: typeof amount === 'number' ? amount : typeof amount === 'string' && Number.isFinite(Number(amount)) ? Number(amount) : null,
    last4: phone !== undefined ? String(phone).slice(-4) : null,
  };
}

export type C2B = { transId: string; amount: number; billRef: string; payerName: string | null; time: Date };

/** Parse a paybill (C2B) confirmation. */
export function parseC2B(body: unknown): C2B | null {
  const b = body as Record<string, unknown> | null;
  if (!b || typeof b.TransID !== 'string') return null;
  const amount = Number(b.TransAmount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const name = [b.FirstName, b.MiddleName, b.LastName].filter((x) => typeof x === 'string' && x).join(' ');
  const t = typeof b.TransTime === 'string' ? /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(b.TransTime) : null;
  // Safaricom sends East Africa Time
  const time = t ? new Date(`${t[1]}-${t[2]}-${t[3]}T${t[4]}:${t[5]}:${t[6]}+03:00`) : new Date();
  return { transId: b.TransID, amount, billRef: typeof b.BillRefNumber === 'string' ? b.BillRefNumber : '', payerName: name || null, time };
}

/**
 * Callbacks carry no signature, so the callback URL itself is the secret: a long random token in the query string.
 * Fail closed: if no token is configured, every callback is refused.
 */
export function callbackAuthorized(url: URL, ip: string): boolean {
  const expected = env('MPESA_CALLBACK_TOKEN');
  if (!expected || expected.length < 24) return false;
  if (!timingSafeEqual(url.searchParams.get('token') ?? '', expected)) return false;
  const allowed = (env('MPESA_ALLOWED_IPS') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return allowed.length === 0 || allowed.includes(ip);
}

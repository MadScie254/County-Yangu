// Talking to Safaricom Daraja: an OAuth token, and the STK push ("pay with M-Pesa" prompt on the customer's phone).
// Credentials come from the function's secrets. Nothing here is ever returned to a browser.
import { env } from './env.ts';
import { HttpError } from './http.ts';
import { darajaBase, stkPassword, timestamp } from './mpesa.ts';
import type { Fetch } from './sms.ts';

export type DarajaConfig = { key: string; secret: string; shortcode: string; passkey: string; callbackToken: string };

export function darajaConfig(): DarajaConfig {
  const key = env('MPESA_CONSUMER_KEY');
  const secret = env('MPESA_CONSUMER_SECRET');
  const shortcode = env('MPESA_SHORTCODE');
  const passkey = env('MPESA_PASSKEY');
  const callbackToken = env('MPESA_CALLBACK_TOKEN');
  if (!key || !secret || !shortcode || !passkey || !callbackToken || callbackToken.length < 24) throw new HttpError(503, 'not_configured');
  return { key, secret, shortcode, passkey, callbackToken };
}

let cached: { token: string; expires: number } | null = null;

export async function darajaToken(cfg: DarajaConfig, fetchImpl: Fetch = fetch): Promise<string> {
  if (cached && cached.expires > Date.now() + 30_000) return cached.token;
  const res = await fetchImpl(`${darajaBase()}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { authorization: `Basic ${btoa(`${cfg.key}:${cfg.secret}`)}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    console.error('[daraja] token', res.status);
    throw new HttpError(502, 'payment_unavailable');
  }
  const d = (await res.json()) as { access_token?: string; expires_in?: string | number };
  if (!d.access_token) throw new HttpError(502, 'payment_unavailable');
  cached = { token: d.access_token, expires: Date.now() + Number(d.expires_in ?? 3599) * 1000 };
  return d.access_token;
}

export type StkRequest = { amount: number; msisdn: string; reference: string; description: string; callbackUrl: string };

export async function stkPush(cfg: DarajaConfig, r: StkRequest, fetchImpl: Fetch = fetch): Promise<{ checkoutRequestId: string }> {
  const token = await darajaToken(cfg, fetchImpl);
  const ts = timestamp();
  const res = await fetchImpl(`${darajaBase()}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      BusinessShortCode: cfg.shortcode,
      Password: stkPassword(cfg.shortcode, cfg.passkey, ts),
      Timestamp: ts,
      TransactionType: 'CustomerPayBillOnline',
      Amount: r.amount,
      PartyA: r.msisdn,
      PartyB: cfg.shortcode,
      PhoneNumber: r.msisdn,
      CallBackURL: r.callbackUrl,
      AccountReference: r.reference.replace(/[^A-Za-z0-9]/g, '').slice(0, 12), // Daraja allows 12 characters
      TransactionDesc: r.description.slice(0, 13),
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const d = (await res.json().catch(() => ({}))) as { ResponseCode?: string; CheckoutRequestID?: string; errorMessage?: string; ResponseDescription?: string };
  if (!res.ok || d.ResponseCode !== '0' || !d.CheckoutRequestID) {
    console.error('[daraja] stkpush', res.status, d.ResponseCode, d.errorMessage ?? d.ResponseDescription);
    throw new HttpError(502, 'payment_unavailable');
  }
  return { checkoutRequestId: d.CheckoutRequestID };
}

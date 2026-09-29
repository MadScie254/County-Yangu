// SMS provider adapter. Everything that sends a text goes through `sendSms`, so the provider can change without touching
// a single function. Africa's Talking is the production provider; `mock` logs a masked number and sends nothing.
import { env } from './env.ts';
import { maskPhone } from './phone.ts';

export type SmsResult = { ok: boolean; id?: string; error?: string };
export type Fetch = typeof fetch;

export function smsProvider(): 'africastalking' | 'mock' {
  const chosen = env('SMS_PROVIDER');
  if (chosen === 'africastalking' || chosen === 'mock') return chosen;
  return env('AT_API_KEY') && env('AT_USERNAME') ? 'africastalking' : 'mock';
}

export async function sendSms(to: string, message: string, fetchImpl: Fetch = fetch): Promise<SmsResult> {
  if (smsProvider() === 'mock') {
    // The body is only logged when explicitly asked for (local development), because it may hold a one-time code.
    console.log(`[sms:mock] to ${maskPhone(to)}${env('MOCK_LOG_BODY') === 'true' ? `: ${message}` : ` (${message.length} chars)`}`);
    return { ok: true, id: 'mock' };
  }
  const username = env('AT_USERNAME')!;
  const key = env('AT_API_KEY')!;
  const host = username === 'sandbox' ? 'api.sandbox.africastalking.com' : 'api.africastalking.com';
  const body = new URLSearchParams({ username, to, message });
  const sender = env('AT_SENDER_ID');
  if (sender) body.set('from', sender);
  let res: Response;
  try {
    res = await fetchImpl(`https://${host}/version1/messaging`, {
      method: 'POST',
      headers: { apiKey: key, accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.name : 'network' };
  }
  if (!res.ok) return { ok: false, error: `http-${res.status}` };
  const data = (await res.json().catch(() => null)) as { SMSMessageData?: { Recipients?: { statusCode?: number; status?: string; messageId?: string }[] } } | null;
  const r = data?.SMSMessageData?.Recipients?.[0];
  // 100 processed, 101 sent, 102 queued
  if (r && typeof r.statusCode === 'number' && r.statusCode >= 100 && r.statusCode <= 102) return { ok: true, id: r.messageId };
  return { ok: false, error: r?.status ?? 'rejected' };
}

// Supabase Auth "Send SMS" hook. Auth generates the one-time code (used by County Assembly members who sign in with
// their phone) and calls this function to deliver it through our SMS provider. The request is signed (Standard Webhooks);
// anything unsigned or stale is refused.
import { env } from '../_shared/env.ts';
import { handler, HttpError } from '../_shared/http.ts';
import { toE164Kenya } from '../_shared/phone.ts';
import { sendSms } from '../_shared/sms.ts';
import { verifyStandardWebhook } from '../_shared/webhook.ts';

Deno.serve(handler('sms-hook', async (req) => {
  const secret = env('SEND_SMS_HOOK_SECRET');
  if (!secret) throw new HttpError(503, 'not_configured');
  const raw = await req.text();
  if (raw.length > 8192 || !(await verifyStandardWebhook(secret, req.headers, raw))) throw new HttpError(401, 'unauthenticated');

  const body = JSON.parse(raw) as { user?: { phone?: string }; sms?: { otp?: string } };
  const phone = toE164Kenya(body.user?.phone ?? '');
  const otp = body.sms?.otp;
  if (!phone || !otp || !/^\d{4,8}$/.test(otp)) throw new HttpError(422, 'invalid_request');

  const sent = await sendSms(phone, `${env('COUNTY_NAME') ?? 'County'} sign-in code: ${otp}. It expires in a few minutes. Never share it.`);
  if (!sent.ok) throw new HttpError(502, 'sms_failed');
  return {};
}));

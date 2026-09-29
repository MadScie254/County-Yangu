// Step 1 of proving you own a phone: send a six-digit code by SMS.
// The code is never stored: only a keyed hash of it, tied to the number and the purpose. It lasts five minutes and
// locks after five wrong tries (in the database). Sending is limited per address, per number and county-wide, because
// an open "send an SMS to any number" endpoint is a way to run up the county's SMS bill.
import { handler, HttpError, readJson } from '../_shared/http.ts';
import { bytesToHex, countySecret, mac, pgBytea, randomDigits } from '../_shared/crypto.ts';
import { env, envInt } from '../_shared/env.ts';
import { rpc } from '../_shared/db.ts';
import { limit, ipKey, PURPOSES, phoneHash } from '../_shared/participation.ts';
import { toE164Kenya } from '../_shared/phone.ts';
import { sendSms } from '../_shared/sms.ts';
import { oneOf, str } from '../_shared/validate.ts';

const TTL_SECONDS = 300;

Deno.serve(handler('otp-request', async (req) => {
  const body = await readJson(req);
  const purpose = oneOf(body, 'purpose', PURPOSES);
  const phone = toE164Kenya(str(body, 'phone', 7, 20));
  if (!phone) throw new HttpError(422, 'invalid_request', { field: 'phone' });

  const secret = countySecret();
  const ph = bytesToHex(await phoneHash(phone));
  await limit(`otp:ip:${await ipKey(req)}`, 3600, 10);
  await limit(`otp:phone:${ph}`, 600, 3);
  await limit(`otp:phone-day:${ph}`, 86_400, 10);
  await limit('otp:global', 3600, envInt('OTP_GLOBAL_PER_HOUR', 300));

  const code = randomDigits(6);
  const codeHash = await mac(secret, 'otp-code', `${phone}:${purpose}:${code}`);
  await rpc('svc_otp_issue', { p_phone: phone, p_phone_hash: pgBytea(await phoneHash(phone)), p_purpose: purpose, p_code_hash: pgBytea(codeHash), p_ttl_seconds: TTL_SECONDS });

  const sent = await sendSms(phone, `${env('COUNTY_NAME') ?? 'County'} verification code: ${code}. It expires in 5 minutes. Do not share it with anyone.`);
  if (!sent.ok) {
    console.error('[otp-request] sms failed', sent.error);
    throw new HttpError(502, 'sms_failed');
  }
  return { ok: true, expires_in: TTL_SECONDS };
}));

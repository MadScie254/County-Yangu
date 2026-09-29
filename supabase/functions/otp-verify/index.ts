// Step 2: check the code and hand back a short-lived signed token that says "this browser controls that phone".
// The token carries a keyed hash of the number (never the number, except for alerts where the SMS needs it).
import { handler, HttpError, readJson } from '../_shared/http.ts';
import { bytesToHex, countySecret, mac, pgBytea, signToken } from '../_shared/crypto.ts';
import { rpc } from '../_shared/db.ts';
import { limit, ipKey, PURPOSES, phoneHash } from '../_shared/participation.ts';
import { toE164Kenya } from '../_shared/phone.ts';
import { oneOf, str } from '../_shared/validate.ts';

const TOKEN_MINUTES = 30;

Deno.serve(handler('otp-verify', async (req) => {
  const body = await readJson(req);
  const purpose = oneOf(body, 'purpose', PURPOSES);
  const phone = toE164Kenya(str(body, 'phone', 7, 20));
  const code = str(body, 'code', 6, 6);
  if (!phone || !/^\d{6}$/.test(code)) throw new HttpError(422, 'invalid_request');

  const secret = countySecret();
  const phoneH = await phoneHash(phone);
  const ph = bytesToHex(phoneH);
  await limit(`otpv:ip:${await ipKey(req)}`, 600, 30);
  await limit(`otpv:phone:${ph}`, 600, 12);

  const codeHash = await mac(secret, 'otp-code', `${phone}:${purpose}:${code}`);
  const result = await rpc<'ok' | 'invalid' | 'expired' | 'locked'>('svc_otp_verify', { p_phone_hash: pgBytea(phoneH), p_purpose: purpose, p_code_hash: pgBytea(codeHash) });
  if (result === 'expired') throw new HttpError(400, 'expired');
  if (result === 'locked') throw new HttpError(429, 'rate_limited');
  if (result !== 'ok') throw new HttpError(400, 'invalid_code');

  const token = await signToken(secret, { p: purpose, ph, ...(purpose === 'alerts' ? { m: phone } : {}), exp: Date.now() + TOKEN_MINUTES * 60_000 });
  return { token };
}));

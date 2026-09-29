// Subscribe a verified phone to SMS alerts for a ward. Confirms by SMS, and every message ends with how to stop.
import { handler, HttpError, readJson } from '../_shared/http.ts';
import { env } from '../_shared/env.ts';
import { rpc } from '../_shared/db.ts';
import { wardsLight } from '../_shared/directory.ts';
import { ipKey, limit, requireVerified } from '../_shared/participation.ts';
import { sendSms } from '../_shared/sms.ts';
import { oneOf, slug } from '../_shared/validate.ts';

Deno.serve(handler('alerts-subscribe', async (req) => {
  const body = await readJson(req);
  const t = await requireVerified(body.token, 'alerts');
  if (!t.m) throw new HttpError(401, 'verification_required');
  const ward = slug(body, 'ward_id');
  const frequency = oneOf(body, 'frequency', ['instant', 'daily', 'weekly'] as const);
  await limit(`alerts:ip:${await ipKey(req)}`, 3600, 30);
  await limit(`alerts:phone:${t.ph}`, 86_400, 20);

  const wards = await wardsLight();
  const w = wards.find((x) => x.id === ward);
  if (!w) throw new HttpError(422, 'invalid_request', { field: 'ward_id' });

  await rpc('svc_subscribe', { p_phone: t.m, p_ward: ward, p_frequency: frequency });
  // best effort: the subscription is already saved, so a failed confirmation must not fail the request
  await sendSms(t.m, `${env('COUNTY_NAME') ?? 'County'}: you will get alerts for ${w.name} ward. Reply STOP any time to stop.`).catch(() => {});
  return { ok: true };
}));

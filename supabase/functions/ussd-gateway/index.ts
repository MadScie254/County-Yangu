// USSD: one short code for reporting, checking, voting and alerts. Africa's Talking calls this on every keypress.
// The phone number comes from the mobile network, not from the caller, so no code is needed to vote or subscribe.
import { handler, HttpError, clientIp } from '../_shared/http.ts';
import { atAuthorized, formFields } from '../_shared/at.ts';
import { bytesToHex, countySecret, mac, pgBytea, sha256, uuidFrom } from '../_shared/crypto.ts';
import { rpc } from '../_shared/db.ts';
import { categories, countyName, cycleOptions, openCycle, subCounties, wardsLight } from '../_shared/directory.ts';
import { limit } from '../_shared/participation.ts';
import { toE164Kenya } from '../_shared/phone.ts';
import { scrub } from '../_shared/pii.ts';
import { sendSms } from '../_shared/sms.ts';
import { ussd, type UssdDeps } from '../_shared/ussd.ts';

const text = (body: string) => new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } });

class DailyLimit extends Error {}

Deno.serve(handler('ussd-gateway', async (req) => {
  if (!atAuthorized(new URL(req.url), clientIp(req), 'USSD_CALLBACK_TOKEN')) throw new HttpError(401, 'unauthenticated');
  const f = await formFields(req);
  const phone = toE164Kenya(f.phoneNumber ?? '');
  const sessionId = f.sessionId ?? '';
  if (!phone || !sessionId) return text('END This service is for Kenyan mobile numbers.');

  const secret = countySecret();
  const phoneH = await mac(secret, 'phone', phone);
  const ph = bytesToHex(phoneH);
  try {
    await limit(`ussd:phone:${ph}`, 600, 80);
  } catch (e) {
    if (e instanceof HttpError && e.status === 429) return text('END Too many requests. Please try again in a few minutes.');
    throw e;
  }

  const wards = await wardsLight();
  const wardName = (id: string) => wards.find((w) => w.id === id)?.name ?? null;

  const deps: UssdDeps = {
    county: await countyName(),
    categories,
    subCounties,
    wards: async (sc) => wards.filter((w) => w.sub_county_id === sc).map((w) => ({ id: w.id, name: w.name })),
    wardName: async (id) => wardName(id),
    categoryName: async (id, lang) => {
      const c = (await categories()).find((x) => x.id === id);
      return c ? ((lang === 'sw' ? c.name_sw : null) ?? c.name) : null;
    },
    openCycle,
    options: cycleOptions,
    caseStatus: async (reference) => {
      const s = await rpc<{ status: string; category: string | null; ward: string; updated_at: string } | null>('case_status', { p_reference: reference });
      return s ?? null;
    },
    createReport: async (r) => {
      await limit(`ussd:report:${ph}`, 86_400, 5).catch((e) => { throw e instanceof HttpError && e.status === 429 ? new DailyLimit() : e; });
      // A retry of the same session must not make a second report: the key comes from the session, not from chance.
      const key = uuidFrom(await sha256(`${sessionId}:${ph}`));
      const out = await rpc<{ reference: string }>('svc_create_report', {
        p_id: crypto.randomUUID(), p_client_key: key, p_ward: r.ward_id, p_category: r.category_id, p_description: scrub(r.description).text,
        p_lat: null, p_lng: null, p_language: r.lang, p_channel: 'ussd', p_callback_phone: null, p_photo_paths: [],
      });
      // Only if the person asked: the number is used for this one message and is not stored with the report.
      if (r.smsMe) await sendSms(phone, `${await countyName()}: your report number is ${out.reference}. Dial the same code and choose 2 to check progress.`).catch(() => {});
      return { reference: out.reference };
    },
    vote: async (v) => rpc('svc_cast_vote', {
      p_cycle: v.cycle_id, p_ward: v.ward_id, p_option: v.option_id, p_channel: 'ussd',
      // same derivation as the web vote: one person cannot vote twice by switching channel
      p_voter_hash: pgBytea(await mac(secret, 'voter', `${v.cycle_id}:${ph}`)),
    }),
    subscribe: async (s) => { await rpc('svc_subscribe', { p_phone: phone, p_ward: s.ward_id, p_frequency: s.frequency }); },
  };

  try {
    return text(await ussd(f.text ?? '', deps));
  } catch (e) {
    if (e instanceof DailyLimit) return text('END You have sent several reports today. Please try again tomorrow.');
    console.error('[ussd-gateway]', e instanceof Error ? e.message : String(e));
    return text('END Sorry, something went wrong. Please try again later.');
  }
}));

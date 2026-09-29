// Anonymous problem reports. The only way a report gets in.
//   1. rate-limit by (hashed) address, and by callback number if one was given
//   2. validate, scrub personal details from the text
//   3. work out the ward (a dropped pin wins over the picker once boundaries are loaded)
//   4. identify each photo by its bytes, strip metadata, store it privately
//   5. create the case through svc_create_report (idempotent on client_key; routing and SLA timers are stamped by the database)
import { handler, HttpError, clientIp } from '../_shared/http.ts';
import { bytesToHex, countySecret, mac } from '../_shared/crypto.ts';
import { rpc, serviceClient } from '../_shared/db.ts';
import { categories, countyBbox, wardShapes, wardsLight } from '../_shared/directory.ts';
import { resolveWard } from '../_shared/geo.ts';
import { sanitizeImage } from '../_shared/image.ts';
import { parseReportPayload } from '../_shared/report.ts';

const MAX_PHOTOS = 3;
const MAX_PHOTO_BYTES = 2_000_000;
const MAX_REQUEST_BYTES = 8_000_000;

Deno.serve(handler('report-intake', async (req) => {
  const secret = countySecret();
  const ip = bytesToHex(await mac(secret, 'ip', clientIp(req)));
  if (!(await rpc<boolean>('svc_rate_limit', { p_key: `report:ip:${ip}`, p_window_seconds: 3600, p_max: 20 }))) throw new HttpError(429, 'rate_limited');

  if (!(req.headers.get('content-type') ?? '').startsWith('multipart/form-data')) throw new HttpError(415, 'unsupported_media_type');
  if (Number(req.headers.get('content-length') ?? 0) > MAX_REQUEST_BYTES) throw new HttpError(413, 'too_large');
  const form = await req.formData();

  let raw: unknown;
  try {
    raw = JSON.parse(String(form.get('payload') ?? ''));
  } catch {
    throw new HttpError(400, 'bad_json');
  }
  const [cats, wards] = await Promise.all([categories(), wardsLight()]);
  const input = parseReportPayload(raw, { categories: new Set(cats.map((c) => c.id)), wards: new Set(wards.map((w) => w.id)) });

  if (input.callback_phone) {
    const ph = bytesToHex(await mac(secret, 'phone', input.callback_phone));
    if (!(await rpc<boolean>('svc_rate_limit', { p_key: `report:phone:${ph}`, p_window_seconds: 86_400, p_max: 5 }))) throw new HttpError(429, 'rate_limited');
  }

  // Where is it? Only load the (large) boundary set when there is a pin to check.
  let ward_id = input.ward_id;
  let lat = input.lat;
  let lng = input.lng;
  if (lat !== null && lng !== null) {
    const r = resolveWard(await wardShapes(), input.ward_id, lat, lng, await countyBbox());
    ({ ward_id, lat, lng } = r);
  }

  // Photos: by content, stripped, private.
  const files = form.getAll('photo').filter((f): f is File => f instanceof File && f.size > 0).slice(0, MAX_PHOTOS);
  const reportId = crypto.randomUUID();
  const stored: string[] = [];
  const bucket = serviceClient().storage.from('report-photos');
  try {
    for (const [i, file] of files.entries()) {
      if (file.size > MAX_PHOTO_BYTES) throw new HttpError(413, 'photo_too_large');
      let clean;
      try {
        clean = sanitizeImage(new Uint8Array(await file.arrayBuffer()));
      } catch {
        throw new HttpError(422, 'bad_image');
      }
      const path = `${reportId}/${i}.${clean.ext}`;
      const up = await bucket.upload(path, clean.bytes, { contentType: clean.type, upsert: false });
      if (up.error) {
        console.error('[report-intake] upload', up.error.message);
        throw new HttpError(502, 'storage_failed');
      }
      stored.push(path);
    }

    const out = await rpc<{ reference: string; ward_id: string; status: string; duplicate: boolean }>('svc_create_report', {
      p_id: reportId, p_client_key: input.client_key, p_ward: ward_id, p_category: input.category_id, p_description: input.description,
      p_lat: lat, p_lng: lng, p_language: input.locale, p_channel: 'web', p_callback_phone: input.callback_phone, p_photo_paths: stored,
    });
    // a retry of a report that already exists: the photos we just stored belong to nobody
    if (out.duplicate && stored.length) await bucket.remove(stored);
    return { reference: out.reference, ward_id: out.ward_id, status: out.status };
  } catch (e) {
    if (stored.length) await bucket.remove(stored).catch(() => {});
    throw e;
  }
}));

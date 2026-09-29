// Validation of a resident's report before it touches the database. Pure, so it is unit-tested.
import { HttpError } from './http.ts';
import { toE164Kenya } from './phone.ts';
import { scrub } from './pii.ts';
import { isUuid } from './validate.ts';

export type ReportInput = {
  client_key: string;
  category_id: string;
  ward_id: string;
  description: string;
  redactions: number;
  lat: number | null;
  lng: number | null;
  locale: 'en' | 'sw';
  callback_phone: string | null;
};

const bad = (field: string) => new HttpError(422, 'invalid_request', { field });

// deno-lint-ignore no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function parseReportPayload(raw: unknown, known: { categories: ReadonlySet<string>; wards: ReadonlySet<string> }): ReportInput {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new HttpError(400, 'bad_json');
  const o = raw as Record<string, unknown>;

  if (!isUuid(o.client_key)) throw bad('client_key');
  if (typeof o.category_id !== 'string' || !known.categories.has(o.category_id)) throw bad('category_id');
  if (typeof o.ward_id !== 'string' || !known.wards.has(o.ward_id)) throw bad('ward_id');
  if (typeof o.description !== 'string') throw bad('description');

  const cleaned = o.description.replace(CONTROL, '').trim();
  if (cleaned.length > 2000) throw bad('description');
  const { text, redactions } = scrub(cleaned);
  if (text.length < 5) throw bad('description');

  let lat: number | null = null;
  let lng: number | null = null;
  if ((o.lat !== null && o.lat !== undefined) || (o.lng !== null && o.lng !== undefined)) {
    if (typeof o.lat !== 'number' || typeof o.lng !== 'number' || !Number.isFinite(o.lat) || !Number.isFinite(o.lng)) throw bad('lat');
    if (o.lat < -5 || o.lat > 5 || o.lng < 33 || o.lng > 42) throw bad('lat');
    lat = Math.round(o.lat * 1e6) / 1e6;
    lng = Math.round(o.lng * 1e6) / 1e6;
  }

  let callback_phone: string | null = null;
  if (o.callback_phone !== null && o.callback_phone !== undefined && o.callback_phone !== '') {
    if (typeof o.callback_phone !== 'string') throw bad('callback_phone');
    callback_phone = toE164Kenya(o.callback_phone);
    if (!callback_phone) throw bad('callback_phone');
  }

  return { client_key: o.client_key.toLowerCase(), category_id: o.category_id, ward_id: o.ward_id, description: text, redactions, lat, lng, locale: o.locale === 'sw' ? 'sw' : 'en', callback_phone };
}

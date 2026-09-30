// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { hmac, mac, sha256, bytesToHex, pgBytea, timingSafeEqual, randomDigits, signToken, verifyToken, b64url, fromB64url } from '../../supabase/functions/_shared/crypto.ts';
import { toE164Kenya, maskPhone, toMsisdn } from '../../supabase/functions/_shared/phone.ts';
import { scrub } from '../../supabase/functions/_shared/pii.ts';
import { resolveWard, pointInGeometry, distanceKm, type WardGeo } from '../../supabase/functions/_shared/geo.ts';
import { sanitizeImage, sniff, stripJpeg, stripPng, stripWebp } from '../../supabase/functions/_shared/image.ts';
import { HttpError, handler, readJson, corsHeaders } from '../../supabase/functions/_shared/http.ts';
import { str, oneOf, uuid, slug, optNum } from '../../supabase/functions/_shared/validate.ts';

describe('crypto', () => {
  it('matches known SHA-256 and HMAC vectors', async () => {
    expect(bytesToHex(await sha256('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    // RFC 4231 test case 2
    expect(bytesToHex(await hmac('Jefe', 'what do ya want for nothing?'))).toBe('5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843');
  });

  it('uses a different key for each purpose', async () => {
    const s = 'x'.repeat(40);
    const a = bytesToHex(await mac(s, 'phone', '+254712345678'));
    const b = bytesToHex(await mac(s, 'voter', '+254712345678'));
    expect(a).not.toBe(b);
    expect(a).toBe(bytesToHex(await mac(s, 'phone', '+254712345678')));
  });

  it('formats bytea for PostgREST and compares in constant time', () => {
    expect(pgBytea(new Uint8Array([0, 255, 16]))).toBe('\\x00ff10');
    expect(timingSafeEqual('abc', 'abc')).toBe(true);
    expect(timingSafeEqual('abc', 'abd')).toBe(false);
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
  });

  it('round-trips base64url', () => {
    const b = new Uint8Array([251, 255, 254, 0, 1, 2]);
    expect(b64url(b)).not.toMatch(/[+/=]/);
    expect([...fromB64url(b64url(b))]).toEqual([...b]);
  });

  it('draws six-digit codes that are digits only and not all the same', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const c = randomDigits(6);
      expect(c).toMatch(/^\d{6}$/);
      seen.add(c);
    }
    expect(seen.size).toBeGreaterThan(150);
  });
});

describe('verification tokens', () => {
  const secret = 'k'.repeat(48);
  const now = 1_700_000_000_000;
  const payload = { p: 'vote', ph: 'abc123', exp: now + 60_000 };

  it('accepts a genuine token for its own purpose', async () => {
    const t = await signToken(secret, payload);
    expect(await verifyToken(secret, t, 'vote', now)).toEqual(payload);
  });

  it('rejects another purpose, expiry, tampering, a different secret, and junk', async () => {
    const t = await signToken(secret, payload);
    expect(await verifyToken(secret, t, 'alerts', now)).toBeNull();
    expect(await verifyToken(secret, t, 'vote', now + 61_000)).toBeNull();
    expect(await verifyToken('z'.repeat(48), t, 'vote', now)).toBeNull();
    const [body, sig] = t.split('.');
    const forged = b64url(new TextEncoder().encode(JSON.stringify({ ...payload, ph: 'someone-else' })));
    expect(await verifyToken(secret, `${forged}.${sig}`, 'vote', now)).toBeNull();
    expect(await verifyToken(secret, `${body}.`, 'vote', now)).toBeNull();
    expect(await verifyToken(secret, 'a.b.c', 'vote', now)).toBeNull();
    expect(await verifyToken(secret, undefined, 'vote', now)).toBeNull();
    expect(await verifyToken(secret, 'x'.repeat(2000), 'vote', now)).toBeNull();
  });
});

describe('phone numbers', () => {
  it.each([
    ['0712345678', '+254712345678'],
    ['+254 712 345 678', '+254712345678'],
    ['254712345678', '+254712345678'],
    ['712345678', '+254712345678'],
    ['0112345678', '+254112345678'],
    ['07-12-34-56-78', '+254712345678'],
  ])('%s -> %s', (input, out) => expect(toE164Kenya(input)).toBe(out));

  it.each(['', '0812345678', '+255712345678', '07123456', '071234567890', 'hello'])('refuses %j', (input) => expect(toE164Kenya(input)).toBeNull());

  it('masks for logs and formats for Daraja', () => {
    expect(maskPhone('+254712345678')).toBe('+2547•• ••• 678');
    expect(maskPhone('+254712345678')).not.toContain('12345');
    expect(toMsisdn('+254712345678')).toBe('254712345678');
  });
});

describe('personal-detail scrubbing', () => {
  it('removes phone numbers in the ways people write them', () => {
    const r = scrub('Call me on 0712 345 678 or +254-722-111-222 or 254733000111 please');
    expect(r.text).toBe('Call me on [phone] or [phone] or [phone] please');
    expect(r.redactions).toBe(3);
  });

  it('removes emails, KRA PINs and labelled ID numbers but keeps ordinary numbers', () => {
    const r = scrub('Email me@example.co.ke, PIN A123456789Z, my national ID no: 12345678. The pothole is 40cm deep and cost KES 15000.');
    expect(r.text).toContain('[email]');
    expect(r.text).toContain('[pin]');
    expect(r.text).toContain('national ID no: [id number]');
    expect(r.text).toContain('40cm deep and cost KES 15000');
    expect(r.redactions).toBe(3);
  });

  it('leaves text with nothing to remove untouched', () => {
    const s = 'Streetlights on Argwings Kodhek Road have been out for three weeks near plot 209/1234.';
    expect(scrub(s)).toEqual({ text: s, redactions: 0 });
  });

  it('does not mistake a long number inside a bigger number for a phone', () => {
    expect(scrub('Reference 1230712345678999').redactions).toBe(0);
  });
});

describe('ward resolution', () => {
  const square = (x: number, y: number, s = 0.02) => ({ type: 'Polygon' as const, coordinates: [[[x, y], [x + s, y], [x + s, y + s], [x, y + s], [x, y]]] });
  const wards: WardGeo[] = [
    { id: 'a', sub_county_id: 's', centroid_lat: -1.29, centroid_lng: 36.81, bbox: [36.8, -1.3, 36.82, -1.28], geojson: square(36.8, -1.3) },
    { id: 'b', sub_county_id: 's', centroid_lat: -1.29, centroid_lng: 36.83, bbox: [36.82, -1.3, 36.84, -1.28], geojson: square(36.82, -1.3) },
  ];
  const county = [36.6, -1.5, 37.1, -1.1];

  it('handles holes in polygons', () => {
    const donut = { type: 'Polygon' as const, coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]], [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]]] };
    expect(pointInGeometry(1, 1, donut)).toBe(true);
    expect(pointInGeometry(5, 5, donut)).toBe(false);
    expect(pointInGeometry(11, 5, donut)).toBe(false);
    expect(pointInGeometry(5, 5, { type: 'MultiPolygon', coordinates: [donut.coordinates, [[[20, 20], [21, 20], [21, 21], [20, 20]]]] })).toBe(false);
  });

  it('keeps the chosen ward when there is no pin', () => {
    expect(resolveWard(wards, 'a', null, null, county)).toEqual({ ward_id: 'a', lat: null, lng: null, reason: 'no_pin' });
  });

  it('trusts the pin over the picker once boundaries exist', () => {
    expect(resolveWard(wards, 'a', -1.29, 36.81, county).reason).toBe('pin_in_ward');
    const moved = resolveWard(wards, 'a', -1.29, 36.83, county);
    expect([moved.ward_id, moved.reason]).toEqual(['b', 'pin_moved_ward']);
  });

  it('drops a pin outside the county, and one far from the chosen ward when there are no boundaries', () => {
    expect(resolveWard(wards, 'a', 0, 0, county)).toMatchObject({ ward_id: 'a', lat: null, reason: 'pin_outside_county' });
    const noShapes = wards.map((w) => ({ ...w, geojson: null }));
    expect(resolveWard(noShapes, 'a', -1.29, 36.81, county).reason).toBe('pin_plausible');
    expect(resolveWard(noShapes, 'a', -1.45, 37.05, county)).toMatchObject({ lat: null, reason: 'pin_far_from_ward' });
  });

  it('measures distance', () => {
    expect(distanceKm(-1.2864, 36.8172, -1.2864, 36.8172)).toBe(0);
    expect(distanceKm(-1.2864, 36.8172, -1.2921, 36.8219)).toBeCloseTo(0.84, 1);
  });
});

// ---- images ---------------------------------------------------------------------------------------------------

const u8 = (...n: number[]) => new Uint8Array(n);
const cat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
};
const text = (s: string) => new TextEncoder().encode(s);

const jpegSeg = (marker: number, payload: Uint8Array) => cat(u8(0xff, marker, (payload.length + 2) >> 8, (payload.length + 2) & 255), payload);
const exif = jpegSeg(0xe1, text('Exif\0\0GPS-LATITUDE-SECRET'));
const jfif = jpegSeg(0xe0, text('JFIF\0\x01\x01\0\0\x01\0\x01\0\0'));
const dqt = jpegSeg(0xdb, new Uint8Array(65));
const sos = cat(u8(0xff, 0xda, 0, 4, 0, 0), u8(1, 2, 3, 0xff, 0xd9));
const jpeg = cat(u8(0xff, 0xd8), jfif, exif, jpegSeg(0xfe, text('shot on my phone')), dqt, sos);

describe('image sanitising', () => {
  it('identifies files by their bytes', () => {
    expect(sniff(jpeg)).toBe('image/jpeg');
    expect(sniff(text('<script>alert(1)</script>'))).toBeNull();
    expect(sniff(u8(0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0, 0))).toBeNull(); // GIF is not accepted
  });

  it('strips EXIF and comments from a JPEG but keeps the picture', () => {
    const out = stripJpeg(jpeg);
    const s = new TextDecoder('latin1').decode(out);
    expect(s).not.toContain('GPS-LATITUDE-SECRET');
    expect(s).not.toContain('shot on my phone');
    expect(s).toContain('JFIF');
    expect(out.length).toBe(jpeg.length - exif.length - jpegSeg(0xfe, text('shot on my phone')).length);
    expect([out[0], out[1], out[out.length - 2], out[out.length - 1]]).toEqual([0xff, 0xd8, 0xff, 0xd9]);
  });

  it('refuses a truncated JPEG and one with no image data', () => {
    expect(() => stripJpeg(jpeg.subarray(0, 14))).toThrow('bad_image');
    expect(() => stripJpeg(cat(u8(0xff, 0xd8), jfif, u8(0xff, 0xd9)))).toThrow('bad_image');
  });

  const chunk = (type: string, data: Uint8Array) => cat(u8((data.length >> 24) & 255, (data.length >> 16) & 255, (data.length >> 8) & 255, data.length & 255), text(type), data, u8(0, 0, 0, 0));
  const pngSig = u8(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
  const png = cat(pngSig, chunk('IHDR', new Uint8Array(13)), chunk('eXIf', text('GPS-SECRET')), chunk('tEXt', text('Author\0Jane')), chunk('IDAT', u8(1, 2, 3)), chunk('IEND', new Uint8Array(0)));

  it('drops text and EXIF chunks from a PNG', () => {
    const out = stripPng(png);
    const s = new TextDecoder('latin1').decode(out);
    expect(s).toContain('IHDR');
    expect(s).toContain('IDAT');
    expect(s).not.toContain('GPS-SECRET');
    expect(s).not.toContain('Jane');
  });

  it('refuses a PNG with bytes after IEND', () => {
    expect(() => stripPng(cat(png, text('<?php evil ?>')))).toThrow('bad_image');
  });

  const le32 = (n: number) => u8(n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >> 24) & 255);
  const wchunk = (tag: string, data: Uint8Array) => cat(text(tag), le32(data.length), data, data.length % 2 ? u8(0) : new Uint8Array(0));
  const webp = (...chunks: Uint8Array[]) => { const body = cat(...chunks); return cat(text('RIFF'), le32(4 + body.length), text('WEBP'), body); };
  const vp8x = cat(u8(0x1c, 0, 0, 0), new Uint8Array(6)); // ICC + EXIF + XMP flags set

  it('drops EXIF and XMP from a WebP and clears the flags', () => {
    const src = webp(wchunk('VP8X', vp8x), wchunk('VP8 ', u8(1, 2, 3, 4)), wchunk('EXIF', text('GPS-SECRET!')), wchunk('XMP ', text('<x:xmpmeta>')));
    const out = stripWebp(src);
    const s = new TextDecoder('latin1').decode(out);
    expect(s).not.toContain('GPS-SECRET');
    expect(s).not.toContain('xmpmeta');
    expect(out[20]! & 0x0c).toBe(0); // flags byte: 12 (RIFF header) + 8 (chunk header)
    expect(out[20]! & 0x10).toBe(0x10); // ICC flag left alone
    expect(new DataView(out.buffer, out.byteOffset).getUint32(4, true)).toBe(out.length - 8);
  });

  it('routes by type and refuses everything else', () => {
    expect(sanitizeImage(jpeg).ext).toBe('jpg');
    expect(sanitizeImage(png).type).toBe('image/png');
    expect(() => sanitizeImage(text('GIF89a....'))).toThrow('bad_image');
    expect(() => sanitizeImage(new Uint8Array(0))).toThrow('bad_image');
  });
});

// ---- http ------------------------------------------------------------------------------------------------------------

describe('http plumbing', () => {
  const OLD = process.env.ALLOWED_ORIGINS;
  beforeEach(() => { delete process.env.ALLOWED_ORIGINS; });
  afterEach(() => { if (OLD === undefined) delete process.env.ALLOWED_ORIGINS; else process.env.ALLOWED_ORIGINS = OLD; });

  const post = (body: unknown, headers: Record<string, string> = {}) => new Request('https://x.test/fn', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), headers });

  it('turns HttpError into a JSON error and hides unexpected failures', async () => {
    const h = handler('t', async () => { throw new HttpError(429, 'rate_limited', { retry_after: 60 }); });
    const r = await h(post({}));
    expect(r.status).toBe(429);
    expect(await r.json()).toEqual({ error: 'rate_limited', code: 'rate_limited', retry_after: 60 });

    const boom = handler('t', async () => { throw new Error('connection string postgres://secret'); });
    const b = await boom(post({}));
    expect(b.status).toBe(500);
    expect(JSON.stringify(await b.json())).not.toContain('secret');
  });

  it('answers preflight and refuses other methods', async () => {
    const h = handler('t', async () => ({ ok: true }));
    expect((await h(new Request('https://x.test', { method: 'OPTIONS' }))).status).toBe(204);
    expect((await h(new Request('https://x.test', { method: 'GET' }))).status).toBe(405);
    expect(await (await h(post({}))).json()).toEqual({ ok: true });
  });

  it('only echoes an allowed origin when a list is configured', () => {
    process.env.ALLOWED_ORIGINS = 'https://yangu.example, https://console.example';
    const ok = corsHeaders(new Request('https://x.test', { headers: { origin: 'https://yangu.example' } }));
    const no = corsHeaders(new Request('https://x.test', { headers: { origin: 'https://evil.example' } }));
    expect(ok['access-control-allow-origin']).toBe('https://yangu.example');
    expect(no['access-control-allow-origin']).toBeUndefined();
  });

  it('reads only well-formed, small JSON objects', async () => {
    expect(await readJson(post({ a: 1 }))).toEqual({ a: 1 });
    await expect(readJson(post('not json'))).rejects.toMatchObject({ status: 400 });
    await expect(readJson(post('[1,2]'))).rejects.toMatchObject({ status: 400 });
    await expect(readJson(post({ big: 'x'.repeat(100) }), 50)).rejects.toMatchObject({ status: 413 });
  });
});

describe('validators', () => {
  it('accept good input and name the field that is wrong', () => {
    const o = { title: '  Street lights  ', kind: 'petition', id: 'D290F1EE-6C54-4B01-90E6-D701748F0851', ward: 'kileleshwa', lat: -1.3 };
    expect(str(o, 'title', 5, 50)).toBe('Street lights');
    expect(oneOf(o, 'kind', ['proposal', 'petition'] as const)).toBe('petition');
    expect(uuid(o, 'id')).toBe('d290f1ee-6c54-4b01-90e6-d701748f0851');
    expect(slug(o, 'ward')).toBe('kileleshwa');
    expect(optNum(o, 'lat', -5, 5)).toBe(-1.3);
    expect(optNum({}, 'lat', -5, 5)).toBeNull();
    expect(() => str(o, 'title', 20, 50)).toThrowError(expect.objectContaining({ status: 422, extra: { field: 'title' } }));
    expect(() => oneOf(o, 'kind', ['proposal'] as const)).toThrow();
    expect(() => uuid({ id: 'nope' }, 'id')).toThrow();
    expect(() => slug({ ward: "x'; drop table" }, 'ward')).toThrow();
    expect(() => optNum({ lat: 99 }, 'lat', -5, 5)).toThrow();
    expect(() => optNum({ lat: '1' }, 'lat', -5, 5)).toThrow();
  });
});

import { previousMonth } from '../../supabase/functions/_shared/dates.ts';
import { replyFor } from '../../supabase/functions/_shared/sms-commands.ts';

describe('digest calendar', () => {
  it('finds last month in East Africa Time', () => {
    expect(previousMonth(new Date('2026-10-01T05:00:00Z'))).toEqual({ start: '2026-09-01', end: '2026-09-30' });
    expect(previousMonth(new Date('2026-01-15T12:00:00Z'))).toEqual({ start: '2025-12-01', end: '2025-12-31' });
    expect(previousMonth(new Date('2026-03-01T00:00:00Z'))).toEqual({ start: '2026-02-01', end: '2026-02-28' });
    // 21:30 UTC on 30 Sept is already 1 Oct in Nairobi
    expect(previousMonth(new Date('2026-09-30T21:30:00Z'))).toEqual({ start: '2026-09-01', end: '2026-09-30' });
  });
});

describe('text message commands', () => {
  it.each([
    ['STOP', { kind: 'stop' }],
    ['  stop  ', { kind: 'stop' }],
    ['acha', { kind: 'stop' }],
    ['Status NAI-R1234567890', { kind: 'status', reference: 'NAI-R1234567890' }],
    ['hali nai-r1234567890 tafadhali', { kind: 'status', reference: 'NAI-R1234567890' }],
    ['STATUS', { kind: 'help' }],
    ['hello', { kind: 'help' }],
    ['', { kind: 'help' }],
  ])('%j', (text, expected) => expect(replyFor(text)).toEqual(expected));
});

import { parsePlan, describeCall, toRows, QUESTIONS, plannerPrompt } from '../../supabase/functions/_shared/ai.ts';
import { checkPin } from '../../supabase/functions/_shared/kra.ts';

describe('AI assistant questions', () => {
  it('turns a model reply into a validated plan, filling defaults', () => {
    expect(parsePlan('{"tool":"cases_by_ward","args":{"category":"drainage","limit":5}}')).toEqual({ tool: 'cases_by_ward', args: { p_category: 'drainage', p_open_only: true, p_limit: 5 } });
    expect(parsePlan('Sure:\n```json\n{"tool":"revenue_by_stream"}\n```')).toEqual({ tool: 'revenue_by_stream', args: { p_days: 30 } });
    expect(parsePlan('{"tool":"projects_by_status","args":{}}')).toEqual({ tool: 'projects_by_status', args: {} });
    expect(parsePlan('{"tool":"procurement_flags","args":{"min_severity":"high"}}')).toEqual({ tool: 'procurement_flags', args: { p_min_severity: 'high' } });
    expect(parsePlan('{"tool":"procurement_flags","args":{"min_severity":"high; drop table x"}}')).toBeNull();
  });

  it('refuses anything that is not a known question with sensible arguments', () => {
    expect(parsePlan('{"tool":"none"}')).toBeNull();
    expect(parsePlan('{"tool":"drop_table","args":{}}')).toBeNull();
    expect(parsePlan('{"tool":"__proto__"}')).toBeNull();
    expect(parsePlan('{"tool":"cases_by_ward","args":{"limit":5000}}')).toBeNull();
    expect(parsePlan('{"tool":"cases_by_ward","args":{"category":"x\'; drop table reports; --"}}')).toBeNull();
    expect(parsePlan('{"tool":"cases_by_ward","args":{"open_only":"yes"}}')).toBeNull();
    expect(parsePlan('{"tool":"revenue_by_stream","args":{"days":1.5}}')).toBeNull();
    expect(parsePlan('I cannot help')).toBeNull();
  });

  it('shows exactly what ran, with values quoted', () => {
    const plan = parsePlan('{"tool":"cases_by_ward","args":{"category":"drainage","limit":5}}')!;
    expect(describeCall(plan)).toBe("select * from public.ai_cases_by_ward(p_category => 'drainage', p_open_only => true, p_limit => 5);");
  });

  it('orders result columns as labelled and caps the rows', () => {
    const plan = parsePlan('{"tool":"cases_by_ward"}')!;
    const data = Array.from({ length: 80 }, (_, i) => ({ ward: `W${i}`, cases: 80 - i, extra: 'ignored' }));
    const rows = toRows(plan, data);
    expect(rows).toHaveLength(50);
    expect(rows[0]).toEqual(['W0', 80]);
    expect(QUESTIONS.cases_by_ward!.columns).toHaveLength(rows[0]!.length);
  });

  it('lists every question and the valid categories in the planner prompt', () => {
    const p = plannerPrompt(['pothole', 'drainage']);
    for (const k of Object.keys(QUESTIONS)) expect(p).toContain(k);
    expect(p).toContain('pothole, drainage');
  });
});

describe('KRA PIN check', () => {
  it('validates the format and never claims compliance without KRA saying so', async () => {
    expect(await checkPin('a123456789z')).toEqual({ pin_format_valid: true, status: 'unknown', source: 'format-only' });
    expect(await checkPin('P051234567X')).toMatchObject({ pin_format_valid: true, status: 'unknown' });
    expect(await checkPin('12345')).toEqual({ pin_format_valid: false, status: 'non_compliant', source: 'format-only' });
    expect(await checkPin('A12345678Z')).toMatchObject({ pin_format_valid: false });
  });
});

import { publishableKey, serviceKey } from '../../supabase/functions/_shared/env.ts';
describe('which API key a function uses', () => {
  const names = ['COUNTY_SERVICE_KEY', 'SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY', 'COUNTY_PUBLISHABLE_KEY', 'SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY'];
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => { for (const n of names) { saved[n] = process.env[n]; delete process.env[n]; } });
  afterEach(() => { for (const n of names) { if (saved[n] === undefined) delete process.env[n]; else process.env[n] = saved[n]; } });

  it('prefers the county key, then the injected new-style keys, then the legacy ones', () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'legacy';
    expect(serviceKey()).toBe('legacy');
    process.env.SUPABASE_SECRET_KEYS = JSON.stringify({ default: 'sb_secret_x' });
    expect(serviceKey()).toBe('sb_secret_x');
    process.env.COUNTY_SERVICE_KEY = 'sb_secret_county';
    expect(serviceKey()).toBe('sb_secret_county');
  });
  it('reads the publishable key the same way and ignores malformed JSON', () => {
    process.env.SUPABASE_ANON_KEY = 'legacy-anon';
    process.env.SUPABASE_PUBLISHABLE_KEYS = 'not json';
    expect(publishableKey()).toBe('legacy-anon');
    process.env.SUPABASE_PUBLISHABLE_KEYS = JSON.stringify({ web: 'sb_publishable_y' });
    expect(publishableKey()).toBe('sb_publishable_y');
  });
});

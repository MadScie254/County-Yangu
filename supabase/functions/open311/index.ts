// Open311 GeoReport v2, read side: the open standard FixMyStreet, SeeClickFix and many cities use, so apps,
// researchers and reporters can read this county's issue reports without scraping.
//   GET /open311/discovery.json                        what this endpoint supports
//   GET /open311/services.json                         report categories
//   GET /open311/requests.json?service_code=&status=&start_date=&end_date=&service_request_id=a,b
//   GET /open311/requests/{service_request_id}.json
// What it returns is decided in the database (open311_* in migration 0021): no descriptions, photos or reporters,
// locations rounded to about 100 metres, and nothing from sensitive categories. New reports go through report-intake,
// which scrubs personal details, so POST is not offered here.
import { handler, HttpError } from '../_shared/http.ts';
import { env } from '../_shared/env.ts';
import { rpc } from '../_shared/db.ts';

const isoOrNull = (v: string | null, field: string) => {
  if (!v) return null;
  const t = Date.parse(v);
  if (Number.isNaN(t)) throw new HttpError(400, 'invalid_request', { field });
  return new Date(t).toISOString();
};
const json = (body: unknown, maxAge = 300) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': `public, max-age=${maxAge}` } });

Deno.serve(handler('open311', async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*\/open311/, '') || '/';
  const q = url.searchParams;

  if (path === '/' || path === '/discovery.json') {
    const base = `${env('SUPABASE_URL') ?? ''}/functions/v1/open311`;
    return json({
      changeset: '2026-10-01T00:00:00Z',
      contact: 'Use the county website to report a problem. This endpoint is read only.',
      key_service: 'Not needed: this endpoint is read only.',
      endpoints: [{ specification: 'http://wiki.open311.org/GeoReport_v2', url: base, changeset: '2026-10-01T00:00:00Z', type: 'production', formats: ['application/json'] }],
    }, 3600);
  }
  if (path === '/services.json') return json(await rpc('open311_services'), 3600);

  const one = path.match(/^\/requests\/([A-Za-z0-9-]{4,40})\.json$/);
  if (one) {
    const r = await rpc<unknown[]>('open311_requests', { p_ids: [one[1]!] });
    if (!r?.length) throw new HttpError(404, 'not_found');
    return json(r, 60);
  }
  if (path === '/requests.json') {
    const status = q.get('status');
    if (status && status !== 'open' && status !== 'closed') throw new HttpError(400, 'invalid_request', { field: 'status' });
    const code = q.get('service_code');
    if (code && !/^[a-z0-9_,-]{1,200}$/.test(code)) throw new HttpError(400, 'invalid_request', { field: 'service_code' });
    const ids = q.get('service_request_id');
    const idList = ids ? ids.split(',').map((s) => s.trim()).filter((s) => /^[A-Za-z0-9-]{4,40}$/.test(s)).slice(0, 100) : null;
    return json(await rpc('open311_requests', {
      p_service_code: code, p_status: status, p_start: isoOrNull(q.get('start_date'), 'start_date'), p_end: isoOrNull(q.get('end_date'), 'end_date'),
      p_ids: idList && idList.length ? idList : null,
    }), 60);
  }
  throw new HttpError(404, 'not_found');
}, ['GET']));

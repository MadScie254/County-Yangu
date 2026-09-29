// Post an idea or a petition. Ideas are public the moment they are stored, so personal details are scrubbed
// from the text first, and each verified phone may post only a few a day.
import { handler, HttpError, readJson } from '../_shared/http.ts';
import { rpc } from '../_shared/db.ts';
import { wardsLight } from '../_shared/directory.ts';
import { scrub } from '../_shared/pii.ts';
import { ipKey, limit, requireVerified, voterHash } from '../_shared/participation.ts';
import { oneOf, optSlug, str } from '../_shared/validate.ts';

Deno.serve(handler('proposal-submit', async (req) => {
  const body = await readJson(req, 16_384);
  const t = await requireVerified(body.token, 'petition');
  const kind = oneOf(body, 'kind', ['proposal', 'petition'] as const);
  const ward = optSlug(body, 'ward_id');
  const title = scrub(str(body, 'title', 5, 160));
  const text = scrub(str(body, 'body', 10, 4000));
  if (title.text.length < 5 || text.text.length < 10) throw new HttpError(422, 'invalid_request');
  await limit(`idea:phone:${t.ph}`, 86_400, 5);
  await limit(`idea:ip:${await ipKey(req)}`, 3600, 20);
  if (ward && !(await wardsLight()).some((w) => w.id === ward)) throw new HttpError(422, 'invalid_request', { field: 'ward_id' });

  const id = crypto.randomUUID();
  await rpc('svc_submit_proposal', { p_id: id, p_ward: ward, p_kind: kind, p_title: title.text, p_body: text.text, p_voter_hash: await voterHash(`idea:${id}`, t.ph) });
  return { ok: true };
}));

// Back an idea or sign a petition. One signature per person per idea.
import { handler, HttpError, readJson } from '../_shared/http.ts';
import { rpc } from '../_shared/db.ts';
import { ipKey, limit, requireVerified, voterHash } from '../_shared/participation.ts';
import { uuid } from '../_shared/validate.ts';

Deno.serve(handler('proposal-support', async (req) => {
  const body = await readJson(req);
  const t = await requireVerified(body.token, 'petition');
  const id = uuid(body, 'proposal_id');
  await limit(`support:ip:${await ipKey(req)}`, 3600, 60);

  const result = await rpc<'ok' | 'duplicate' | 'closed' | 'not_found'>('svc_support_proposal', { p_id: id, p_voter_hash: await voterHash(`idea:${id}`, t.ph) });
  if (result === 'not_found') throw new HttpError(404, 'not_found');
  if (result === 'closed') throw new HttpError(409, 'closed');
  if (result === 'duplicate') throw new HttpError(409, 'already_supported');
  return { ok: true };
}));

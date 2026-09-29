// Cast a vote in a participatory-budget round. One person, one vote per round, across web and USSD together.
// The vote row stores a keyed hash, not a phone number, and carries no link back to any report or account.
import { handler, HttpError, readJson } from '../_shared/http.ts';
import { rpc } from '../_shared/db.ts';
import { ipKey, limit, requireVerified, voterHash } from '../_shared/participation.ts';
import { slug } from '../_shared/validate.ts';

Deno.serve(handler('vote', async (req) => {
  const body = await readJson(req);
  const t = await requireVerified(body.token, 'vote');
  const cycle = slug(body, 'cycle_id');
  const ward = slug(body, 'ward_id');
  const option = slug(body, 'option_id');
  await limit(`vote:ip:${await ipKey(req)}`, 3600, 60);

  const result = await rpc<'ok' | 'duplicate' | 'closed' | 'invalid_option'>('svc_cast_vote', {
    p_cycle: cycle, p_ward: ward, p_option: option, p_channel: 'web', p_voter_hash: await voterHash(cycle, t.ph),
  });
  if (result === 'duplicate') throw new HttpError(409, 'already_voted');
  if (result === 'closed') throw new HttpError(409, 'voting_closed');
  if (result === 'invalid_option') throw new HttpError(422, 'invalid_request', { field: 'option_id' });
  return { ok: true };
}));

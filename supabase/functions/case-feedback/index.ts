// Two things a resident can say about a case they hold the reference for:
//   { reference, fixed, comment? }     "Was it fixed?" A yes is counted; a no reopens the case.
//   { reference, action: 'metoo' }     "Me too": the same problem affects me. One voice per address per case.
// The reference is the only key needed (it is the same key that opens the public status page), so the endpoint is
// rate limited by address and by reference, comments are scrubbed like report text, and a "me too" is stored only as a
// keyed hash of (case, address), never the address itself.
import { handler, HttpError, readJson } from '../_shared/http.ts';
import { rpc } from '../_shared/db.ts';
import { ipKey, limit } from '../_shared/participation.ts';
import { scrub } from '../_shared/pii.ts';
import { countySecret, mac, pgBytea } from '../_shared/crypto.ts';
import { optStr, str } from '../_shared/validate.ts';

Deno.serve(handler('case-feedback', async (req) => {
  const body = await readJson(req);
  const reference = str(body, 'reference', 6, 40).toUpperCase();
  const ip = await ipKey(req);

  if (body.action === 'metoo') {
    await limit(`metoo:ip:${ip}`, 3600, 30);
    const result = await rpc<'ok' | 'duplicate' | 'not_found' | 'closed'>('svc_case_metoo', {
      p_reference: reference, p_supporter: pgBytea(await mac(countySecret(), 'supporter', `${reference}:${ip}`)),
    });
    if (result === 'not_found') throw new HttpError(404, 'not_found');
    if (result === 'closed') throw new HttpError(409, 'closed');
    if (result === 'duplicate') throw new HttpError(409, 'already_added');
    return { ok: true };
  }

  if (typeof body.fixed !== 'boolean') throw new HttpError(422, 'invalid_request', { field: 'fixed' });
  const comment = optStr(body, 'comment', 500);
  await limit(`feedback:ip:${ip}`, 3600, 20);
  await limit(`feedback:ref:${reference}`, 86400, 6);

  const result = await rpc<'ok' | 'not_found' | 'not_resolved' | 'duplicate'>('svc_case_feedback', {
    p_reference: reference, p_fixed: body.fixed, p_comment: comment ? scrub(comment).text : null,
  });
  if (result === 'not_found') throw new HttpError(404, 'not_found');
  if (result === 'not_resolved') throw new HttpError(409, 'not_resolved');
  if (result === 'duplicate') throw new HttpError(409, 'already_answered');
  return { ok: true, reopened: !body.fixed };
}));

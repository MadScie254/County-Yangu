// An invited auditor creates their account. The token proves the invitation; the invitation names the email it is for.
// Every way the invitation can be wrong (unknown, used, expired, different email) gets the same answer.
import { handler, HttpError, readJson } from '../_shared/http.ts';
import { pgBytea, sha256 } from '../_shared/crypto.ts';
import { rpc, serviceClient } from '../_shared/db.ts';
import { envInt } from '../_shared/env.ts';
import { ipKey, limit } from '../_shared/participation.ts';
import { str } from '../_shared/validate.ts';

Deno.serve(handler('auditor-accept', async (req) => {
  const body = await readJson(req);
  const token = str(body, 'token', 20, 200);
  const email = str(body, 'email', 5, 200).toLowerCase();
  const name = str(body, 'name', 2, 120);
  const password = typeof body.password === 'string' ? body.password : '';
  if (password.length < 12 || password.length > 200) throw new HttpError(422, 'invalid_request', { field: 'password' });
  await limit(`accept:ip:${await ipKey(req)}`, 3600, 10);

  const hash = pgBytea(await sha256(token));
  if (!(await rpc<boolean>('svc_invite_check', { p_token_hash: hash, p_email: email }))) throw new HttpError(400, 'expired');

  const admin = serviceClient().auth.admin;
  const created = await admin.createUser({ email, password, email_confirm: true, user_metadata: { name } });
  if (created.error || !created.data.user) {
    if (created.error?.message.toLowerCase().includes('already')) throw new HttpError(409, 'account_exists');
    console.error('[auditor-accept] createUser', created.error?.message);
    throw new HttpError(500, 'server_error');
  }
  const ok = await rpc<boolean>('svc_accept_invite', { p_token_hash: hash, p_email: email, p_user: created.data.user.id, p_access_days: envInt('AUDITOR_ACCESS_DAYS', 30) })
    .catch(async (e) => { await admin.deleteUser(created.data.user!.id); throw e; });
  if (!ok) {
    // lost a race for the same invitation: do not leave an orphan account behind
    await admin.deleteUser(created.data.user.id);
    throw new HttpError(400, 'expired');
  }
  return { ok: true };
}));

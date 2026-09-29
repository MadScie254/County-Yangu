// An administrator invites an external auditor (OAG, Controller of Budget). The invitation is a long random token that
// is emailed as a link and stored only as a hash, so nobody with database access can read it back. It works once and expires.
import { handler, HttpError, readJson } from '../_shared/http.ts';
import { ADMIN_ROLES, requireRole } from '../_shared/auth.ts';
import { pgBytea, randomToken, sha256 } from '../_shared/crypto.ts';
import { rpc } from '../_shared/db.ts';
import { sendEmail } from '../_shared/email.ts';
import { env } from '../_shared/env.ts';
import { limit } from '../_shared/participation.ts';
import { optStr, str } from '../_shared/validate.ts';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(handler('auditor-invite', async (req) => {
  const admin = await requireRole(req, ADMIN_ROLES);
  const body = await readJson(req);
  const email = str(body, 'email', 5, 200).toLowerCase();
  if (!EMAIL.test(email)) throw new HttpError(422, 'invalid_request', { field: 'email' });
  const organisation = optStr(body, 'organisation', 120);
  const days = Math.min(Math.max(Number(body.days) || 7, 1), 30);
  const consoleUrl = env('CONSOLE_URL');
  if (!consoleUrl) throw new HttpError(503, 'not_configured');
  await limit(`invite:${admin.id}`, 3600, 20);

  const token = randomToken(32);
  await rpc('svc_invite_create', { p_token_hash: pgBytea(await sha256(token)), p_email: email, p_org: organisation, p_days: days, p_created_by: admin.id });
  const sent = await sendEmail(email, `${env('COUNTY_NAME') ?? 'County'}: your invitation to review county records`,
    `You have been invited to view ${env('COUNTY_NAME') ?? 'the county'}'s service records as an auditor${organisation ? ` for ${organisation}` : ''}.\n\n` +
    `Create your account here (the link works once and expires in ${days} days):\n${consoleUrl}/invite/${token}\n\n` +
    'Access is read-only. If you were not expecting this, ignore this email.');
  if (!sent.ok) throw new HttpError(502, 'email_failed');
  return { ok: true };
}));

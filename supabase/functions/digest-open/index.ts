// The link in a digest email. It records that a recipient opened the digest, then sends them to the console.
// It answers the same way for any token, so it cannot be used to find out which tokens exist.
import { handler } from '../_shared/http.ts';
import { env } from '../_shared/env.ts';
import { rpc } from '../_shared/db.ts';
import { isUuid } from '../_shared/validate.ts';

Deno.serve(handler('digest-open', async (req) => {
  const t = new URL(req.url).searchParams.get('t');
  if (isUuid(t)) await rpc('svc_digest_opened', { p_token: t }).catch(() => {});
  const to = env('CONSOLE_URL') ? `${env('CONSOLE_URL')}/oversight` : '/';
  return new Response(null, { status: 302, headers: { location: to, 'cache-control': 'no-store' } });
}, ['GET']));

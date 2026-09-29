// Scheduled jobs (escalations, digests, the outbox) are called by pg_cron with a shared secret in a header.
// Fail closed: without CRON_SECRET configured, nobody can run them.
import { env } from './env.ts';
import { HttpError } from './http.ts';
import { timingSafeEqual } from './crypto.ts';

export function requireCron(req: Request): void {
  const expected = env('CRON_SECRET');
  if (!expected || expected.length < 24) throw new HttpError(503, 'not_configured');
  if (!timingSafeEqual(req.headers.get('x-cron-secret') ?? '', expected)) throw new HttpError(401, 'unauthenticated');
}

// Scheduled summaries.
//   ?job=monthly                          last month's digests for the Assembly, the Controller of Budget, the Auditor-General and the executive
//   ?job=ward-updates&frequency=daily     short SMS summaries for people who chose "daily" (or weekly)
import { handler, HttpError } from '../_shared/http.ts';
import { requireCron } from '../_shared/cron.ts';
import { rpc } from '../_shared/db.ts';
import { previousMonth } from '../_shared/dates.ts';
import { drainOutbox } from '../_shared/outbox.ts';

const KINDS = ['assembly', 'controller_of_budget', 'auditor_general', 'executive'] as const;

Deno.serve(handler('digest-builder', async (req) => {
  requireCron(req);
  const url = new URL(req.url);
  const job = url.searchParams.get('job');
  let built: string[] = [];
  let queued = 0;

  if (job === 'monthly') {
    const { start, end } = previousMonth(new Date());
    for (const kind of KINDS) built.push(await rpc<string>('svc_build_digest', { p_kind: kind, p_start: start, p_end: end }));
  } else if (job === 'ward-updates') {
    const frequency = url.searchParams.get('frequency');
    if (frequency !== 'daily' && frequency !== 'weekly') throw new HttpError(422, 'invalid_request', { field: 'frequency' });
    queued = await rpc<number>('svc_ward_updates', { p_frequency: frequency });
  } else {
    throw new HttpError(422, 'invalid_request', { field: 'job' });
  }
  built = built.filter(Boolean);
  return { digests: built.length, sms_queued: queued, ...(await drainOutbox()) };
}, ['POST']));

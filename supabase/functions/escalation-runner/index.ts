// Hourly: move overdue cases up the ladder (reminder, sub-county, chief officer, CEC and Assembly), tell the right people,
// and tidy expired codes and old counters. The rules are in the database (run_escalations); nothing here calls a model.
import { handler } from '../_shared/http.ts';
import { requireCron } from '../_shared/cron.ts';
import { rpc } from '../_shared/db.ts';
import { drainOutbox } from '../_shared/outbox.ts';

Deno.serve(handler('escalation-runner', async (req) => {
  requireCron(req);
  const notified = await rpc<number>('svc_escalate');
  await rpc('svc_cleanup');
  const r = await drainOutbox();
  return { notified, ...r };
}));

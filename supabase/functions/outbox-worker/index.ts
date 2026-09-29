// Every minute: turn approved alerts into messages, then send what is waiting.
import { handler } from '../_shared/http.ts';
import { requireCron } from '../_shared/cron.ts';
import { rpc } from '../_shared/db.ts';
import { drainOutbox } from '../_shared/outbox.ts';

Deno.serve(handler('outbox-worker', async (req) => {
  requireCron(req);
  const queued = await rpc<number>('svc_dispatch_alerts');
  const r = await drainOutbox();
  return { alert_messages_queued: queued, ...r };
}));

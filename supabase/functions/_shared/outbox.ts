// Sends whatever is waiting in the outbox (SMS, email), a few at a time, recording success or a retry for each.
// Every message the system sends by itself goes through here: alerts, escalations, digests, ward summaries.
import { rpc } from './db.ts';
import { sendEmail } from './email.ts';
import { env } from './env.ts';
import { sendSms } from './sms.ts';

type Row = { id: string; channel: 'sms' | 'email' | 'push'; recipient: string; subject: string | null; body: string; attempts: number; related: Record<string, unknown> };

async function deliver(m: Row): Promise<{ ok: boolean; error?: string }> {
  if (m.channel === 'sms') return sendSms(m.recipient, m.body);
  if (m.channel === 'email') {
    // Digest emails carry a link that records when the recipient opened it.
    const token = typeof m.related?.open_token === 'string' ? m.related.open_token : null;
    const link = token && env('SUPABASE_URL') ? `${env('SUPABASE_URL')}/functions/v1/digest-open?t=${token}` : (env('CONSOLE_URL') ?? '');
    return sendEmail(m.recipient, m.subject ?? 'Notification', m.body.replaceAll('{{open_url}}', link));
  }
  return { ok: false, error: 'unsupported_channel' };
}

const CONCURRENCY = 5;

export async function drainOutbox(opts: { maxBatches?: number; deadlineMs?: number } = {}): Promise<{ sent: number; failed: number }> {
  const started = Date.now();
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < (opts.maxBatches ?? 8) && Date.now() - started < (opts.deadlineMs ?? 40_000); i++) {
    const batch = await rpc<Row[]>('svc_outbox_claim', { p_limit: 25 });
    if (!batch?.length) break;
    for (let at = 0; at < batch.length; at += CONCURRENCY) {
      await Promise.all(batch.slice(at, at + CONCURRENCY).map(async (m) => {
        let r: { ok: boolean; error?: string };
        try {
          r = await deliver(m);
        } catch (e) {
          r = { ok: false, error: e instanceof Error ? e.name : 'error' };
        }
        await rpc('svc_outbox_done', { p_id: m.id, p_ok: r.ok, p_error: r.error ?? null });
        if (r.ok) sent++;
        else failed++;
      }));
    }
  }
  return { sent, failed };
}

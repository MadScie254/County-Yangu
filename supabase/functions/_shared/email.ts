// Email adapter (Resend). Used for staff escalations, oversight digests and auditor invitations.
// Without RESEND_API_KEY it logs that a message would have been sent, and nothing else.
import { env } from './env.ts';
import type { Fetch } from './sms.ts';

export type EmailResult = { ok: boolean; id?: string; error?: string };

export async function sendEmail(to: string, subject: string, text: string, fetchImpl: Fetch = fetch): Promise<EmailResult> {
  const key = env('RESEND_API_KEY');
  const from = env('EMAIL_FROM');
  if (!key || !from) {
    // Bodies (which may hold an invitation link) are only logged when explicitly asked for, for local development.
    console.log(`[email:mock] "${subject}" (${text.length} chars)${env('MOCK_LOG_BODY') === 'true' ? `\n${text}` : ''}`);
    return { ok: true, id: 'mock' };
  }
  let res: Response;
  try {
    res = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, text }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.name : 'network' };
  }
  const data = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;
  return res.ok ? { ok: true, id: data?.id } : { ok: false, error: `http-${res.status}` };
}

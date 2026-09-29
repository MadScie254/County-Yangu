// Text messages sent TO the county's number (Africa's Talking inbound callback):
//   STOP            leave every alert list          (also ACHA)
//   STATUS <ref>    where is my report              (also HALI)
//   anything else   how to use the number
// Replies are sent straight back; the sender's number is not stored.
import { handler, HttpError, clientIp } from '../_shared/http.ts';
import { atAuthorized, formFields } from '../_shared/at.ts';
import { bytesToHex, countySecret, mac } from '../_shared/crypto.ts';
import { rpc } from '../_shared/db.ts';
import { countyName } from '../_shared/directory.ts';
import { limit } from '../_shared/participation.ts';
import { toE164Kenya } from '../_shared/phone.ts';
import { replyFor } from '../_shared/sms-commands.ts';
import { sendSms } from '../_shared/sms.ts';

const STATUS: Record<string, string> = { received: 'received', triaged: 'being reviewed', assigned: 'assigned to a team', in_progress: 'being fixed', resolved: 'fixed', closed: 'closed', rejected: 'not accepted' };

Deno.serve(handler('sms-inbound', async (req) => {
  if (!atAuthorized(new URL(req.url), clientIp(req), 'SMS_CALLBACK_TOKEN')) throw new HttpError(401, 'unauthenticated');
  const f = await formFields(req);
  const from = toE164Kenya(f.from ?? '');
  if (!from) return { ok: true };
  const ph = bytesToHex(await mac(countySecret(), 'phone', from));
  await limit(`sms-in:${ph}`, 3600, 10);

  const name = await countyName();
  const cmd = replyFor(f.text ?? '');
  let reply: string;
  if (cmd.kind === 'stop') {
    await rpc('svc_unsubscribe', { p_phone: from, p_ward: null });
    reply = `${name}: you have been unsubscribed and will get no more alerts.`;
  } else if (cmd.kind === 'status') {
    const s = await rpc<{ status: string; category: string | null; ward: string } | null>('case_status', { p_reference: cmd.reference });
    reply = s ? `${cmd.reference}: ${STATUS[s.status] ?? s.status}${s.category ? `, ${s.category}` : ''}, ${s.ward}.` : `${name}: we could not find report ${cmd.reference}. Check the number and try again.`;
  } else {
    reply = `${name}: text STATUS <report number> to check a report, or STOP to end alerts.`;
  }
  await sendSms(from, reply).catch(() => {});
  return { ok: true };
}));

// The whistleblower inbox: a protected, two-way channel to the county's integrity desk.
//   { action: 'create', topic, ward_id?, body }   -> { reference, key }   the key is shown once and never stored
//   { action: 'read', key }                         -> the thread
//   { action: 'reply', key, body }                  -> { ok }
// No account, phone number or address is kept. Only a keyed hash of the secret key is stored, so the county can
// answer the reporter without ever being able to find out who they are. Rate limits use a keyed hash of the address
// that is never written next to the disclosure.
import { handler, HttpError, readJson } from '../_shared/http.ts';
import { rpc } from '../_shared/db.ts';
import { countySecret, mac, pgBytea } from '../_shared/crypto.ts';
import { wardsLight } from '../_shared/directory.ts';
import { ipKey, limit } from '../_shared/participation.ts';
import { oneOf, str } from '../_shared/validate.ts';

const TOPICS = ['bribery', 'procurement', 'payroll', 'theft', 'abuse_of_office', 'other'] as const;
// No 0/O or 1/I/L, so a key copied by hand onto paper reads back correctly.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const KEY_RE = /^[A-HJKMNP-Z2-9]{4}(-[A-HJKMNP-Z2-9]{4}){3}$/;

export function newKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]);
  return [0, 4, 8, 12].map((i) => chars.slice(i, i + 4).join('')).join('-');
}
const keyHash = async (key: string) => pgBytea(await mac(countySecret(), 'disclosure', key));
const readKey = (body: Record<string, unknown>) => {
  const k = typeof body.key === 'string' ? body.key.trim().toUpperCase().replace(/\s+/g, '') : '';
  if (!KEY_RE.test(k)) throw new HttpError(422, 'invalid_request', { field: 'key' });
  return k;
};

Deno.serve(handler('disclosure', async (req) => {
  const body = await readJson(req, 16_384);
  const ip = await ipKey(req);
  const action = oneOf(body, 'action', ['create', 'read', 'reply'] as const);

  if (action === 'create') {
    await limit(`disclose:ip:${ip}`, 86_400, 5);
    const topic = oneOf(body, 'topic', TOPICS);
    const text = str(body, 'body', 20, 6000);
    let ward: string | null = null;
    if (typeof body.ward_id === 'string' && body.ward_id) {
      if (!(await wardsLight()).some((w) => w.id === body.ward_id)) throw new HttpError(422, 'invalid_request', { field: 'ward_id' });
      ward = body.ward_id;
    }
    const key = newKey();
    const reference = await rpc<string>('svc_disclosure_create', { p_key_hash: await keyHash(key), p_topic: topic, p_ward: ward, p_body: text });
    return { reference, key };
  }

  // Reading and replying both need the key; guessing is throttled hard by address.
  await limit(`disclose-key:ip:${ip}`, 3600, 30);
  const key = readKey(body);
  if (action === 'read') {
    const thread = await rpc<unknown>('svc_disclosure_thread', { p_key_hash: await keyHash(key) });
    if (!thread) throw new HttpError(404, 'not_found');
    return { thread };
  }
  const text = str(body, 'body', 2, 6000);
  const result = await rpc<'ok' | 'not_found' | 'closed' | 'limit'>('svc_disclosure_reply', { p_key_hash: await keyHash(key), p_body: text });
  if (result === 'not_found') throw new HttpError(404, 'not_found');
  if (result === 'closed') throw new HttpError(409, 'closed');
  if (result === 'limit') throw new HttpError(429, 'rate_limited');
  return { ok: true };
}));

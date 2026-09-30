// Migration 0017: "me too" on open reports, and the public participation calendar.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, as, newUser } from './harness.mjs';

let db, admin, ward, resident, report;
const one = async (sql, params) => (await db.query(sql, params)).rows[0];
const all = async (sql, params) => (await db.query(sql, params)).rows;
const svc = (sql, params) => as(db, 'service_role', null, () => one(sql, params));
const h = (s) => Buffer.from(s);

before(async () => {
  db = await freshDb();
  admin = await newUser(db, 'admin@county.go.ke');
  ward = await newUser(db, 'ward@county.go.ke');
  resident = await newUser(db, 'mama@example.com');
  await db.query(`select public.grant_staff_role($1, 'admin')`, [admin]);
  await db.query(`select public.grant_staff_role($1, 'ward_admin', null, null, 'kileleshwa')`, [ward]);
  report = await one(`insert into public.reports (ward_id, description, status) values ('kileleshwa', 'Burst pipe on the road', 'received') returning id, reference`);
});

test('me too counts one voice per person and shows on the public page', async () => {
  assert.equal((await svc(`select public.svc_case_metoo($1, $2) r`, [report.reference, h('a')])).r, 'ok');
  assert.equal((await svc(`select public.svc_case_metoo($1, $2) r`, [report.reference.toLowerCase(), h('b')])).r, 'ok');
  assert.equal((await svc(`select public.svc_case_metoo($1, $2) r`, [report.reference, h('a')])).r, 'duplicate');
  assert.equal((await svc(`select public.svc_case_metoo('NOPE-1', $1) r`, [h('a')])).r, 'not_found');
  const s = await as(db, 'anon', null, () => one(`select public.case_status($1) s`, [report.reference]));
  assert.equal(s.s.supporters, 2);
});

test('residents cannot call it directly or read who supported', async () => {
  await assert.rejects(as(db, 'anon', null, () => one(`select public.svc_case_metoo($1, $2)`, [report.reference, h('x')])), /permission denied/);
  await assert.rejects(as(db, 'authenticated', resident, () => all(`select * from private.report_supporters`)), /permission denied/);
});

test('ten voices raise the priority once, with a staff note', async () => {
  for (let i = 0; i < 8; i += 1) await svc(`select public.svc_case_metoo($1, $2)`, [report.reference, h(`p${i}`)]);
  const r = await one(`select supporters, priority from public.reports where id = $1`, [report.id]);
  assert.equal(r.supporters, 10);
  assert.equal(r.priority, 'high');
  assert.equal((await all(`select 1 from public.report_events where report_id = $1 and kind = 'note' and not is_public`, [report.id])).length, 1);
});

test('a closed report takes no more voices', async () => {
  await db.query(`update public.reports set status = 'resolved' where id = $1`, [report.id]);
  assert.equal((await svc(`select public.svc_case_metoo($1, $2) r`, [report.reference, h('late')])).r, 'closed');
});

test('meetings: anyone reads, ward admins publish, residents cannot', async () => {
  await as(db, 'authenticated', ward, () => db.query(`insert into public.public_meetings (ward_id, kind, title, venue, starts_at, ends_at) values ('kileleshwa', 'baraza', 'Ward baraza on drainage', 'Chief''s camp', now() + interval '3 days', now() + interval '3 days 2 hours')`));
  await assert.rejects(as(db, 'authenticated', resident, () => db.query(`insert into public.public_meetings (title, venue, starts_at, ends_at) values ('Fake meeting', 'Nowhere', now(), now() + interval '1 hour')`)), /row-level security/);
  const rows = await as(db, 'anon', null, () => all(`select title from public.public_meetings`));
  assert.deepEqual(rows.map((r) => r.title), ['Ward baraza on drainage']);
});

test('a new meeting reaches ward followers and instant SMS subscribers; a cancellation too', async () => {
  await as(db, 'authenticated', resident, () => db.query(`insert into public.follows (user_id, kind, key, label) values ($1, 'ward_tenders', 'kileleshwa', 'Kileleshwa')`, [resident]));
  await db.query(`insert into private.subscribers (phone_e164, ward_id, frequency, verified_at) values ('+254700000009', 'kileleshwa', 'instant', now()), ('+254700000010', 'kileleshwa', 'weekly', now())`);
  const m = await as(db, 'authenticated', admin, () => one(`insert into public.public_meetings (ward_id, kind, title, venue, starts_at, ends_at) values ('kileleshwa', 'budget_hearing', 'Budget hearing 2027', 'Social hall', now() + interval '7 days', now() + interval '7 days 3 hours') returning id`));
  assert.equal((await all(`select 1 from public.notifications where user_id = $1 and title like 'New meeting:%'`, [resident])).length, 1);
  const sms = await all(`select recipient, body from private.outbox where related ->> 'meeting_id' = $1`, [m.id]);
  assert.deepEqual(sms.map((s) => s.recipient), ['+254700000009']);
  assert.match(sms[0].body, /Budget hearing 2027/);
  await as(db, 'authenticated', admin, () => db.query(`update public.public_meetings set status = 'cancelled' where id = $1`, [m.id]));
  assert.equal((await all(`select 1 from public.notifications where user_id = $1 and title like 'Meeting cancelled:%'`, [resident])).length, 1);
});

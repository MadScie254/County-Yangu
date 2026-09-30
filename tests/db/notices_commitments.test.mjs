// Migration 0019: service notices and the county's public commitments.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, as, newUser } from './harness.mjs';

let db, admin, ward, resident;
const one = async (sql, params) => (await db.query(sql, params)).rows[0];
const all = async (sql, params) => (await db.query(sql, params)).rows;

before(async () => {
  db = await freshDb();
  admin = await newUser(db, 'admin@county.go.ke');
  ward = await newUser(db, 'ward@county.go.ke');
  resident = await newUser(db, 'mama@example.com');
  await db.query(`select public.grant_staff_role($1, 'admin')`, [admin]);
  await db.query(`select public.grant_staff_role($1, 'ward_admin', null, null, 'kileleshwa')`, [ward]);
  await as(db, 'authenticated', resident, () => db.query(`insert into public.follows (user_id, kind, key, label) values ($1, 'ward_tenders', 'kileleshwa', 'Kileleshwa')`, [resident]));
  await db.query(`insert into private.subscribers (phone_e164, ward_id, frequency, verified_at) values
    ('+254700000001', 'kileleshwa', 'instant', now()), ('+254700000001', 'kilimani', 'instant', now()),
    ('+254700000002', 'kileleshwa', 'weekly', now()), ('+254700000003', 'kilimani', 'instant', now())`);
});

test('notices: ward admins post for their own ward only, residents not at all, everyone reads', async () => {
  await as(db, 'authenticated', ward, () => db.query(`insert into public.service_notices (ward_id, kind, title) values ('kileleshwa', 'water', 'No water on Othaya Road')`));
  await assert.rejects(as(db, 'authenticated', ward, () => db.query(`insert into public.service_notices (ward_id, kind, title) values ('kilimani', 'water', 'No water in Kilimani')`)), /row-level security/);
  await assert.rejects(as(db, 'authenticated', ward, () => db.query(`insert into public.service_notices (kind, title) values ('road', 'County-wide road works')`)), /row-level security/);
  await assert.rejects(as(db, 'authenticated', resident, () => db.query(`insert into public.service_notices (ward_id, title) values ('kileleshwa', 'Fake notice here')`)), /row-level security/);
  const rows = await as(db, 'anon', null, () => all(`select title from public.service_notices`));
  assert.deepEqual(rows.map((r) => r.title), ['No water on Othaya Road']);
});

test('notices: a disruption reaches ward followers and instant SMS subscribers, and so does the all clear', async () => {
  assert.equal((await all(`select 1 from public.notifications where user_id = $1 and title like 'Service disruption:%'`, [resident])).length, 1);
  const sms = await all(`select recipient from private.outbox where related ? 'notice_id' order by recipient`);
  assert.deepEqual(sms.map((r) => r.recipient), ['+254700000001']);
  const n = await one(`select id from public.service_notices limit 1`);
  await as(db, 'authenticated', ward, () => db.query(`update public.service_notices set status = 'resolved', resolved_note = 'Water is back' where id = $1`, [n.id]));
  assert.ok((await one(`select resolved_at from public.service_notices where id = $1`, [n.id])).resolved_at);
  assert.equal((await all(`select 1 from public.notifications where user_id = $1 and title like 'Back to normal:%'`, [resident])).length, 1);
  assert.equal((await all(`select 1 from private.outbox where related ? 'notice_id'`)).length, 2);
});

test('notices: a county-wide emergency texts every instant subscriber once; an info notice texts nobody', async () => {
  await as(db, 'authenticated', admin, () => db.query(`insert into public.service_notices (kind, severity, title) values ('health', 'emergency', 'Cholera alert: boil drinking water')`));
  const sms = await all(`select recipient from private.outbox where body like '%Cholera%' order by recipient`);
  assert.deepEqual(sms.map((r) => r.recipient), ['+254700000001', '+254700000003']);
  await as(db, 'authenticated', admin, () => db.query(`insert into public.service_notices (ward_id, kind, severity, title) values ('kilimani', 'waste', 'info', 'Collection moves to Saturday')`));
  assert.equal((await all(`select 1 from private.outbox where body like '%Saturday%'`)).length, 0);
});

test('commitments: county roles publish, ward admins and residents cannot', async () => {
  await as(db, 'authenticated', admin, () => db.query(`insert into public.commitments (slug, title, source, due_on) values ('street-lights-kileleshwa', 'Street lights on every main road in Kileleshwa', 'Budget speech 2026', '2026-12-31')`));
  await assert.rejects(as(db, 'authenticated', ward, () => db.query(`insert into public.commitments (slug, title, source) values ('fake-one', 'A promise nobody made', 'Nowhere')`)), /row-level security/);
  await as(db, 'authenticated', resident, () => db.query(`update public.commitments set status = 'delivered'`));
  assert.equal((await one(`select status from public.commitments`)).status, 'not_started');
});

test('commitments: every status and due date change is on the public record and followers hear about it', async () => {
  await as(db, 'authenticated', resident, () => db.query(`insert into public.follows (user_id, kind, key, label) values ($1, 'commitment', 'street-lights-kileleshwa', 'Street lights')`, [resident]));
  const c = await one(`select id from public.commitments`);
  await as(db, 'authenticated', admin, () => db.query(`update public.commitments set status = 'in_progress', evidence = 'Contract signed' where id = $1`, [c.id]));
  await as(db, 'authenticated', admin, () => db.query(`update public.commitments set due_on = '2027-06-30' where id = $1`, [c.id]));
  await as(db, 'authenticated', admin, () => db.query(`update public.commitments set detail = 'More words' where id = $1`, [c.id]));
  const h = await as(db, 'anon', null, () => all(`select status, note from public.commitment_updates where commitment_id = $1 order by id`, [c.id]));
  assert.deepEqual(h.map((r) => r.status), ['not_started', 'in_progress', 'in_progress']);
  assert.equal(h[1].note, 'Contract signed');
  assert.match(h[2].note, /^Due date changed from 2026-12-31/);
  assert.equal((await all(`select 1 from public.notifications where user_id = $1 and title like 'County promise updated:%'`, [resident])).length, 1);
  await assert.rejects(as(db, 'authenticated', admin, () => db.query(`insert into public.commitment_updates (commitment_id, status) values ($1, 'delivered')`, [c.id])), /permission denied|row-level security/);
});

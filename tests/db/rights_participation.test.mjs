// Migration 0020: information requests, consultations, petition thresholds and data rights.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, as, newUser } from './harness.mjs';

let db, admin, officer, resident, other;
const one = async (sql, params) => (await db.query(sql, params)).rows[0];
const all = async (sql, params) => (await db.query(sql, params)).rows;
const asUser = (uid, sql, params) => as(db, 'authenticated', uid, () => one(sql, params));

before(async () => {
  db = await freshDb();
  admin = await newUser(db, 'admin@county.go.ke');
  officer = await newUser(db, 'officer@county.go.ke');
  resident = await newUser(db, 'mama@example.com');
  other = await newUser(db, 'baba@example.com');
  await db.query(`select public.grant_staff_role($1, 'admin')`, [admin]);
  await db.query(`select public.grant_staff_role($1, 'officer')`, [officer]);
});

test('information request: the 21-day clock is set by the database, not the form', async () => {
  await assert.rejects(asUser(resident, `insert into public.info_requests (title, body, due_at) values ('Road tender documents', 'Please share the evaluation report for the Kileleshwa road tender.', now() + interval '1 year')`), /permission denied/);
  const r = await asUser(resident, `insert into public.info_requests (title, body) values ('Road tender documents', 'Please share the evaluation report for the Kileleshwa road tender.') returning reference, status, due_at, created_at`);
  assert.equal(r.status, 'submitted');
  const days = (new Date(r.due_at) - new Date(r.created_at)) / 86_400_000;
  assert.ok(Math.abs(days - 21) < 0.01, `due in ${days} days`);
  assert.match(r.reference, /-I[0-9A-F]{10}$/);
  const u = await asUser(resident, `insert into public.info_requests (title, body, urgent, urgent_reason) values ('Detained hawker medical record', 'Where is my brother held and has he seen a doctor since Monday?', true, 'He is in custody without medicine') returning due_at, created_at`);
  assert.ok(Math.abs((new Date(u.due_at) - new Date(u.created_at)) / 3_600_000 - 48) < 0.01);
  assert.equal((await all(`select 1 from public.notifications where user_id = $1 and title like 'New information request%'`, [admin])).length, 2);
});

test('information request: the public sees the request but never who asked; private ones stay private', async () => {
  await asUser(other, `insert into public.info_requests (title, body, is_public) values ('My own land rates file', 'Please send me a copy of the rates record for my plot number 123.', false)`);
  const pub = await as(db, 'anon', null, () => all(`select title from public.info_requests order by created_at`));
  assert.deepEqual(pub.map((x) => x.title), ['Road tender documents', 'Detained hawker medical record']);
  await assert.rejects(as(db, 'anon', null, () => all(`select user_id from public.info_requests`)), /permission denied/);
  const mine = await as(db, 'authenticated', other, () => all(`select title from public.my_info_requests()`));
  assert.deepEqual(mine.map((x) => x.title), ['My own land rates file']);
  const staff = await as(db, 'authenticated', officer, () => all(`select title from public.info_requests`));
  assert.equal(staff.length, 3);
});

test('information request: one extension of 14 days, with a reason; refusals must cite a reason; closed stays closed', async () => {
  const r = await one(`select id, due_at from public.info_requests where title = 'Road tender documents'`);
  await assert.rejects(asUser(officer, `update public.info_requests set status = 'extended' where id = $1`, [r.id]), /reason/);
  await asUser(officer, `update public.info_requests set status = 'extended', extension_reason = 'Records are with the procurement office' where id = $1`, [r.id]);
  const e = await one(`select extended_to, due_at from public.info_requests where id = $1`, [r.id]);
  assert.equal(new Date(e.extended_to) - new Date(r.due_at), 14 * 86_400_000);
  assert.equal(new Date(e.due_at).getTime(), new Date(r.due_at).getTime());
  await assert.rejects(asUser(officer, `update public.info_requests set status = 'refused' where id = $1`, [r.id]), /reason/);
  await asUser(officer, `update public.info_requests set status = 'answered', response = 'The evaluation report is attached.', response_url = 'https://nairobi.go.ke/doc.pdf' where id = $1`, [r.id]);
  assert.ok((await one(`select answered_at from public.info_requests where id = $1`, [r.id])).answered_at);
  assert.equal((await all(`select 1 from public.notifications where user_id = $1 and title like 'Your request was answered%'`, [resident])).length, 1);
  await assert.rejects(asUser(officer, `update public.info_requests set status = 'submitted' where id = $1`, [r.id]), /closed/);
  await asUser(resident, `update public.info_requests set status = 'answered', response = 'fake' where title = 'Detained hawker medical record'`);
  assert.equal((await one(`select status from public.info_requests where title = 'Detained hawker medical record'`)).status, 'submitted');
});

test('consultations: county roles publish, residents comment only while open, totals are public', async () => {
  await assert.rejects(asUser(resident, `insert into public.consultations (slug, title, summary, closes_at) values ('x-bill', 'A fake bill here', 'Twenty characters or more of summary.', now() + interval '10 days')`), /row-level security/);
  await asUser(admin, `insert into public.consultations (slug, kind, title, summary, questions, closes_at) values ('finance-bill-2027', 'bill', 'Nairobi Finance Bill 2027', 'New parking fees and a single business permit. Tell us what you think.', array['Parking fees', 'Single business permit'], now() + interval '14 days')`);
  await asUser(admin, `insert into public.consultations (slug, title, summary, opens_at, closes_at) values ('old-plan', 'An old closed plan', 'This consultation has already closed for comments.', now() - interval '30 days', now() - interval '20 days')`);
  const c = await one(`select id from public.consultations where slug = 'finance-bill-2027'`);
  const old = await one(`select id from public.consultations where slug = 'old-plan'`);
  await asUser(resident, `insert into public.consultation_comments (consultation_id, stance, question, body, ward_id) values ($1, 'oppose', 0, 'Parking fees are too high for boda riders.', 'kileleshwa')`, [c.id]);
  await asUser(other, `insert into public.consultation_comments (consultation_id, stance, question, body) values ($1, 'support', 9, 'One permit is a good idea.')`, [c.id]);
  assert.equal((await one(`select question from public.consultation_comments where body like 'One permit%'`)).question, null);
  await assert.rejects(asUser(resident, `insert into public.consultation_comments (consultation_id, body) values ($1, 'Too late to say this')`, [old.id]), /row-level security/);
  await assert.rejects(as(db, 'anon', null, () => all(`select user_id from public.consultation_comments`)), /permission denied/);
  const t = await as(db, 'anon', null, () => one(`select public.consultation_tally('finance-bill-2027') t`));
  assert.equal(t.t.comments, 2);
  assert.equal(t.t.people, 2);
  assert.deepEqual(t.t.by_stance, { oppose: 1, support: 1 });
});

test('consultations: publishing the report tells everyone who took part', async () => {
  await asUser(admin, `update public.consultations set report = 'We heard 2 comments. Parking fees for boda riders were halved.' where slug = 'finance-bill-2027'`);
  assert.ok((await one(`select report_at from public.consultations where slug = 'finance-bill-2027'`)).report_at);
  for (const u of [resident, other]) assert.equal((await all(`select 1 from public.notifications where user_id = $1 and title like 'What the county heard%'`, [u])).length, 1);
});

test('petitions: reaching the threshold starts a 30-day clock and alerts staff, once', async () => {
  const p = await one(`insert into public.proposals (ward_id, kind, title, body) values ('kileleshwa', 'petition', 'Fix the Othaya Road drainage', 'Every rain floods the road and homes.') returning id`);
  await db.query(`update public.proposals set supporters = 199 where id = $1`, [p.id]);
  assert.equal((await one(`select response_due_at from public.proposals where id = $1`, [p.id])).response_due_at, null);
  await db.query(`update public.proposals set supporters = 200 where id = $1`, [p.id]);
  const r = await one(`select threshold_reached_at, response_due_at from public.proposals where id = $1`, [p.id]);
  assert.equal(new Date(r.response_due_at) - new Date(r.threshold_reached_at), 30 * 86_400_000);
  await db.query(`update public.proposals set supporters = 250 where id = $1`, [p.id]);
  assert.equal((await all(`select 1 from public.notifications where user_id = $1 and title like 'A petition needs an answer%'`, [admin])).length, 1);
});

test('data rights: a copy of my data, an erasure request with a 14-day deadline, carried out by an admin', async () => {
  const d = await as(db, 'authenticated', resident, () => one(`select public.my_data() d`));
  assert.equal(d.d.information_requests.length, 2);
  assert.equal(d.d.consultation_comments.length, 1);
  assert.ok(!('user_id' in d.d.information_requests[0]));
  assert.equal((await as(db, 'anon', null, () => one(`select public.my_data() d`)).catch((e) => ({ d: e.message }))).d.includes('permission denied'), true);
  const due = (await asUser(other, `select public.request_erasure('I am moving away') d`)).d;
  assert.ok(Math.abs((new Date(due) - Date.now()) / 86_400_000 - 14) < 0.01);
  assert.equal(new Date((await asUser(other, `select public.request_erasure() d`)).d).getTime(), new Date(due).getTime());
  assert.deepEqual((await asUser(resident, `select public.erasure_queue() q`)).q, []);
  const q = (await asUser(admin, `select public.erasure_queue() q`)).q;
  assert.equal(q.length, 1);
  await assert.rejects(asUser(resident, `select public.carry_out_erasure($1)`, [q[0].id]), /administrators/);
  await asUser(admin, `select public.carry_out_erasure($1)`, [q[0].id]);
  assert.equal((await all(`select 1 from public.consultation_comments where user_id = $1`, [other])).length, 0);
  assert.equal((await one(`select email from public.profiles where id = $1`, [other])).email, null);
  assert.deepEqual((await asUser(admin, `select public.erasure_queue() q`)).q, []);
});

// Migration 0021: the Open311 read API and the public legal-deadline scoreboard.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, as, newUser } from './harness.mjs';

let db, admin, resident;
const one = async (sql, params) => (await db.query(sql, params)).rows[0];
const anon = (sql, params) => as(db, 'anon', null, () => one(sql, params));

before(async () => {
  db = await freshDb();
  admin = await newUser(db, 'admin@county.go.ke');
  resident = await newUser(db, 'mama@example.com');
  await db.query(`select public.grant_staff_role($1, 'admin')`, [admin]);
  const cats = (await db.query(`select id, sensitive from public.report_categories order by id`)).rows;
  const open = cats.find((c) => !c.sensitive).id;
  const secret = cats.find((c) => c.sensitive)?.id ?? null;
  await db.query(`insert into public.reports (ward_id, category_id, description, status, lat, lng) values ('kileleshwa', $1, 'Burst pipe outside house number 12', 'received', -1.281234, 36.781234)`, [open]);
  await db.query(`insert into public.reports (ward_id, category_id, description, status) values ('kilimani', $1, 'Streetlight fixed already', 'resolved')`, [open]);
  if (secret) await db.query(`insert into public.reports (ward_id, category_id, description, status) values ('kilimani', $1, 'Officer asked me for a bribe', 'received')`, [secret]);
});

test('open311: services list the public categories only', async () => {
  const s = (await anon(`select public.open311_services() s`)).s;
  assert.ok(s.length > 0);
  assert.ok(s.every((x) => x.service_code && x.service_name && x.type === 'realtime' && x.metadata === false));
  const sensitive = (await db.query(`select id from public.report_categories where sensitive`)).rows.map((r) => r.id);
  assert.ok(s.every((x) => !sensitive.includes(x.service_code)));
});

test('open311: requests carry no description, rounded locations, no sensitive reports, and filter by status', async () => {
  const r = (await anon(`select public.open311_requests() r`)).r;
  assert.equal(r.length, 2);
  assert.ok(r.every((x) => x.description === null && x.media_url === null));
  assert.ok(!JSON.stringify(r).includes('bribe'));
  const pinned = r.find((x) => x.lat !== null);
  assert.equal(Number(pinned.lat), -1.281);
  assert.equal(Number(pinned.long), 36.781);
  assert.equal((await anon(`select public.open311_requests(p_status => 'closed') r`)).r.length, 1);
  const ref = pinned.service_request_id;
  assert.equal((await anon(`select public.open311_requests(p_ids => array[lower($1)]) r`, [ref])).r[0].service_request_id, ref);
});

test('deadlines: on-time and late answers are counted from the database, not claimed', async () => {
  await as(db, 'authenticated', resident, () => db.query(`insert into public.info_requests (title, body) values ('Water kiosk spending', 'Please share payments to water kiosk contractors in 2025.'), ('Road tender report', 'Please share the evaluation report for the Othaya Road tender.')`));
  // the rules trigger refuses to move a deadline, which is the point; bypass it here only to simulate time passing
  await db.query(`alter table public.info_requests disable trigger info_requests_rules`);
  await db.query(`update public.info_requests set due_at = now() - interval '1 day' where title = 'Road tender report'`);
  await db.query(`alter table public.info_requests enable trigger info_requests_rules`);
  await as(db, 'authenticated', admin, () => db.query(`update public.info_requests set status = 'answered', response = 'Attached.' where title = 'Water kiosk spending'`));
  const p = await one(`insert into public.proposals (ward_id, kind, title, body) values ('kileleshwa', 'petition', 'Fix the Othaya Road drains', 'Every rain floods the road and homes.') returning id`);
  await db.query(`update public.proposals set supporters = 200 where id = $1`, [p.id]);
  await db.query(`update public.proposals set response = 'Desilting starts in May.' where id = $1`, [p.id]);
  const d = (await anon(`select public.legal_deadlines() d`)).d;
  assert.deepEqual(d.info, { decided: 1, on_time: 1, waiting: 1, late_now: 1 });
  assert.equal(d.petitions.due, 1);
  assert.equal(d.petitions.answered_on_time, 1);
  assert.equal(d.petitions.late_now, 0);
  assert.ok('erasure' in d && 'consultations' in d && 'promises' in d);
});

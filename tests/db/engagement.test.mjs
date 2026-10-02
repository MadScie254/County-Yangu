// Migration 0023: fixed message, ward league, live feed, community events, Ask your MCA, promise deadlines, weekly SMS.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, as, newUser } from './harness.mjs';

let db, admin, wardStaff, mca, otherMca, resident, other, third, champ;
const one = async (sql, params) => (await db.query(sql, params)).rows[0];
const all = async (sql, params) => (await db.query(sql, params)).rows;
const asU = (uid, sql, params) => as(db, 'authenticated', uid, () => one(sql, params));
const anon = (sql, params) => as(db, 'anon', null, () => one(sql, params));
const svc = (sql, params) => as(db, 'service_role', null, () => one(sql, params));
const uuid = () => crypto.randomUUID();
const report = async (ward, cats, phone = null) =>
  (await svc(`select public.svc_create_report_group($1, $2, $3, $4, 'Something is broken on this road', null, null, 'en', 'web', $5) r`, [uuid(), uuid(), ward, cats, phone])).r;

before(async () => {
  db = await freshDb();
  admin = await newUser(db, 'admin@county.go.ke');
  wardStaff = await newUser(db, 'ward@county.go.ke');
  mca = await newUser(db, 'mca.kileleshwa@assembly.go.ke');
  otherMca = await newUser(db, 'mca.karura@assembly.go.ke');
  resident = await newUser(db, 'mama@example.com');
  other = await newUser(db, 'baba@example.com');
  third = await newUser(db, 'dada@example.com');
  champ = await newUser(db, 'champ@example.com');
  await db.query(`select public.grant_staff_role($1, 'admin')`, [admin]);
  await db.query(`select public.grant_staff_role($1, 'ward_admin', null, null, 'kileleshwa')`, [wardStaff]);
  await db.query(`select public.grant_staff_role($1, 'assembly_member', null, null, 'kileleshwa')`, [mca]);
  await db.query(`select public.grant_staff_role($1, 'assembly_member', null, null, 'karura')`, [otherMca]);
});

test('the reporter is told it is fixed, how many days it took and where to see the photos', async () => {
  const r = await report('kileleshwa', ['pothole'], '+254712345678');
  const id = (await one(`select id from public.reports where reference = $1`, [r.reference])).id;
  await asU(admin, `insert into public.fix_photos (report_id, kind, path) values ($1, 'after', 'a/after.webp')`, [id]);
  await asU(admin, `select public.case_transition($1, 'resolved', 'Patched and rolled', true)`, [id]);
  const sms = await one(`select body from private.outbox where related ->> 'event' = 'fixed' and related ->> 'report_id' = $1`, [id]);
  assert.match(sms.body, /^Fixed! NAI-R\w+ was fixed the same day\. Patched and rolled/);
});

test('the ward league scores wards with enough reports, shows the previous window, and anyone can read it', async () => {
  for (let i = 0; i < 3; i++) await report('kileleshwa', ['streetlight']);
  const l = (await anon(`select public.ward_league(30) l`)).l;
  const k = l.wards.find((w) => w.ward_id === 'kileleshwa');
  assert.ok(k.score !== null && k.score >= 0 && k.score <= 100);
  assert.equal(k.reports, 4);
  assert.equal(k.previous, null);
  assert.equal(l.wards[0].ward_id, 'kileleshwa');
  assert.equal(l.wards.find((w) => w.ward_id === 'karura').score, null);
});

test('the live feed shows categories and wards but never descriptions or sensitive reports', async () => {
  await report('karura', ['missing_funds']);
  const feed = (await anon(`select public.live_activity(50) f`)).f;
  assert.ok(feed.some((x) => x.kind === 'report' && x.ward_id === 'kileleshwa'));
  assert.ok(feed.some((x) => x.kind === 'resolved' && x.days === 0));
  assert.ok(!feed.some((x) => x.ward_id === 'karura'));
  assert.ok(!JSON.stringify(feed).includes('Something is broken'));
});

test('active champions and ward staff post events; residents say they are going; a cancellation reaches them', async () => {
  const when = [new Date(Date.now() + 86400e3).toISOString(), new Date(Date.now() + 90000e3).toISOString()];
  const ins = `insert into public.community_events (ward_id, title, meet_at, starts_at, ends_at) values ('kileleshwa', 'Saturday clean-up', 'Kileleshwa market gate', $1, $2) returning id`;
  await assert.rejects(asU(resident, ins, when), /row-level security/);
  await asU(champ, `insert into public.ward_champions (ward_id, display_name) values ('kileleshwa', 'Champ K.')`);
  await assert.rejects(asU(champ, ins, when), /row-level security/);
  await asU(wardStaff, `update public.ward_champions set status = 'active' where ward_id = 'kileleshwa'`);
  const ev = (await asU(champ, ins, when)).id;
  await asU(resident, `insert into public.event_rsvps (event_id) values ($1)`, [ev]);
  await asU(other, `insert into public.event_rsvps (event_id) values ($1)`, [ev]);
  assert.equal((await anon(`select going from public.community_events where id = $1`, [ev])).going, 2);
  await asU(other, `delete from public.event_rsvps where event_id = $1`, [ev]);
  assert.equal((await anon(`select going from public.community_events where id = $1`, [ev])).going, 1);
  await assert.rejects(anon(`select created_by from public.community_events`), /permission denied/);
  await asU(champ, `update public.community_events set status = 'cancelled' where id = $1`, [ev]);
  assert.equal((await one(`select count(*)::int n from public.notifications where user_id = $1 and title like 'Event cancelled%'`, [resident])).n, 1);
  await assert.rejects(asU(resident, `insert into public.event_rsvps (event_id) values ($1)`, [ev]), /row-level security/);
});

test('residents ask their MCA in public; only that ward\'s MCA answers; the asker hears back; answer rates are public', async () => {
  const q = (await asU(resident, `insert into public.mca_questions (ward_id, body) values ('kileleshwa', 'When will the Kileleshwa drains be cleared?') returning id`)).id;
  assert.equal((await one(`select count(*)::int n from public.notifications where user_id = $1 and link = '/console/questions'`, [mca])).n, 1);
  await assert.rejects(anon(`select user_id from public.mca_questions`), /permission denied/);
  await asU(other, `insert into public.mca_question_votes (question_id) values ($1)`, [q]);
  await asU(third, `insert into public.mca_question_votes (question_id) values ($1)`, [q]);
  await assert.rejects(asU(other, `insert into public.mca_question_votes (question_id) values ($1)`, [q]), /duplicate key/);
  assert.equal((await anon(`select votes from public.mca_questions where id = $1`, [q])).votes, 2);
  const upd = `update public.mca_questions set answer = 'The drains are scheduled for next week.' where id = $1 returning status`;
  assert.equal(await asU(resident, upd, [q]), undefined);
  assert.equal(await asU(otherMca, upd, [q]), undefined);
  assert.equal((await asU(mca, upd, [q])).status, 'answered');
  assert.equal((await one(`select count(*)::int n from public.notifications where user_id = $1 and title = 'Your MCA answered'`, [resident])).n, 1);
  await assert.rejects(asU(mca, `update public.mca_questions set hidden = true where id = $1`, [q]), /Only administrators/);
  const board = (await anon(`select public.mca_scoreboard() b`)).b;
  assert.deepEqual(board.find((x) => x.ward_id === 'kileleshwa'), { ward_id: 'kileleshwa', asked: 1, answered: 1, on_time: 1, waiting: 0 });
  for (const u of [resident, other, third]) await asU(u, `insert into public.content_flags (kind, target_id, reason) values ('mca_question', $1, 'abuse')`, [q]);
  assert.equal(await anon(`select id from public.mca_questions where id = $1`, [q]), undefined);
  const ask = `insert into public.mca_questions (ward_id, body) values ('kileleshwa', 'Another question about the ward?')`;
  await asU(resident, ask); await asU(resident, ask);
  await assert.rejects(asU(resident, ask), /3 questions a day/);
});

test('followers hear once when a promise passes its due date', async () => {
  await db.query(`insert into public.commitments (slug, title, source, due_on, status) values ('late-promise', 'Build the late thing', 'Test', current_date - 2, 'in_progress')`);
  await db.query(`insert into public.follows (user_id, kind, key, label) values ($1, 'commitment', 'late-promise', 'Late promise')`, [resident]);
  assert.equal((await svc(`select public.svc_promise_deadlines() n`)).n, 1);
  assert.equal((await svc(`select public.svc_promise_deadlines() n`)).n, 0);
  assert.equal((await one(`select count(*)::int n from public.notifications where user_id = $1 and title like 'Promise deadline passed%'`, [resident])).n, 1);
  await assert.rejects(asU(resident, `select public.svc_promise_deadlines()`), /permission denied/);
});

test('the weekly ward SMS has three lines: fixed, late and one thing to do', async () => {
  await db.query(`insert into private.subscribers (phone_e164, ward_id, frequency, verified_at) values ('+254700000001', 'kileleshwa', 'weekly', now())`);
  await db.query(`insert into public.polls (slug, question, options, closes_at) values ('water-days', 'Which days for water rationing?', '[{"id":"a","label":"Mon"},{"id":"b","label":"Tue"}]', now() + interval '3 days')`);
  assert.equal((await svc(`select public.svc_ward_updates('weekly') n`)).n, 1);
  const body = (await one(`select body from private.outbox where recipient = '+254700000001'`)).body;
  assert.match(body, /^Kileleshwa this week:\nFixed: 1\. Late: 0 of \d+ open\.\nDo: Answer the poll: Which days for water rationing\?/);
});

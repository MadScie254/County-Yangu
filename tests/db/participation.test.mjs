// Migration 0014: published budget results, quarterly rounds, and follows.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, as, newUser } from './harness.mjs';

let db, admin, mama, baba;
const one = async (sql, params) => (await db.query(sql, params)).rows[0];
const all = async (sql, params) => (await db.query(sql, params)).rows;
const anon = (sql, params) => as(db, 'anon', null, () => one(sql, params));

before(async () => {
  db = await freshDb();
  admin = await newUser(db, 'admin@county.go.ke');
  mama = await newUser(db, 'mama@example.com');
  baba = await newUser(db, 'baba@example.com');
  await db.query(`select public.grant_staff_role($1, 'admin')`, [admin]);
  await db.query(`insert into public.budget_cycles (id, title, status, starts_at, ends_at, published_results)
    values ('2026-q1', 'Q1 round', 'closed', '2026-01-01', '2026-01-15', true), ('2026-q2', 'Q2 round', 'closed', '2026-04-01', '2026-04-15', false)`);
  await db.query(`insert into public.ward_budget_envelopes values ('2026-q1', 'kileleshwa', 10000000)`);
  await db.query(`insert into public.project_options (id, cycle_id, ward_id, title, sector, amount) values
    ('a', '2026-q1', 'kileleshwa', 'Streetlights', 'Roads', 6000000),
    ('b', '2026-q1', 'kileleshwa', 'Clinic wing', 'Health', 5000000),
    ('c', '2026-q1', 'kileleshwa', 'Footbridge', 'Roads', 3000000),
    ('z', '2026-q2', 'kileleshwa', 'Hidden option', 'Roads', 1000000)`);
  const vote = (opt, n) => Array.from({ length: n }, (_, i) => db.query(`insert into public.votes (cycle_id, ward_id, option_id, channel, voter_hash) values ('2026-q1', 'kileleshwa', $1, 'web', $2)`, [opt, Buffer.from(`${opt}-${i}`)]));
  await Promise.all([...vote('a', 5), ...vote('b', 3), ...vote('c', 2)]);
});

test('results show votes and what fits inside the envelope, in vote order', async () => {
  const r = (await anon(`select public.budget_results() r`)).r;
  assert.equal(r.cycle.id, '2026-q1');
  assert.equal(Number(r.total_votes), 10);
  const w = r.wards[0];
  assert.deepEqual(w.options.map((o) => [o.id, Number(o.votes), o.funded]), [['a', 5, true], ['b', 3, false], ['c', 2, false]]);
});

test('an unpublished round is invisible', async () => {
  const r = (await anon(`select public.budget_results('2026-q2') r`)).r;
  assert.equal(r.cycle, null);
  assert.deepEqual(r.cycles.map((c) => c.id), ['2026-q1']);
});

test('the scheduler drafts next quarter with the same envelopes, once', async () => {
  const id = (await as(db, 'authenticated', admin, () => one(`select public.draft_next_round() r`))).r;
  assert.match(id, /^\d{4}-q[1-4]$/);
  const env = await all(`select * from public.ward_budget_envelopes where cycle_id = $1`, [id]);
  assert.equal(env.length, 1);
  assert.equal((await as(db, 'authenticated', admin, () => one(`select public.draft_next_round() r`))).r, null);
  await assert.rejects(as(db, 'authenticated', mama, () => one(`select public.draft_next_round()`)), /administrator/);
});

test('the scheduler opens a round that has options and closes one that has ended', async () => {
  await db.query(`insert into public.budget_cycles (id, title, status, starts_at, ends_at) values ('now', 'Live', 'draft', now() - interval '1 day', now() + interval '5 days'), ('empty', 'No options', 'draft', now() - interval '1 day', now() + interval '5 days'), ('old', 'Ended', 'open', now() - interval '20 days', now() - interval '1 day')`);
  await db.query(`insert into public.project_options (id, cycle_id, ward_id, title, sector, amount) values ('n1', 'now', 'kileleshwa', 'Something', 'Roads', 100)`);
  const r = await as(db, 'service_role', null, () => one(`select public.svc_round_scheduler() r`));
  assert.equal(r.r.opened, 1);
  assert.equal(r.r.closed, 1);
  assert.equal((await one(`select status from public.budget_cycles where id = 'now'`)).status, 'open');
  assert.equal((await one(`select status from public.budget_cycles where id = 'empty'`)).status, 'draft');
  assert.equal((await one(`select status from public.budget_cycles where id = 'old'`)).status, 'closed');
  await assert.rejects(as(db, 'anon', null, () => one(`select public.svc_round_scheduler()`)), /permission denied/);
});

test('followers hear about the tenders, awards and flags they follow, and only them', async () => {
  const c = (await one(`insert into public.contractors (name) values ('Alpha Builders') returning id`)).id;
  await as(db, 'authenticated', mama, () => db.query(`insert into public.follows (user_id, kind, key, label) values ($1, 'supplier', $2, 'Alpha Builders'), ($1, 'ward_tenders', 'kileleshwa', 'Kileleshwa')`, [mama, String(c)]));
  await as(db, 'authenticated', baba, () => db.query(`insert into public.follows (user_id, kind, key, label) values ($1, 'sector', 'health', 'Health')`, [baba]));

  await db.query(`insert into public.tenders (reference, title, ward_id, sector, status, estimated_budget) values ('T-1', 'Road works', 'kileleshwa', 'Roads', 'open', 1000000)`);
  await db.query(`update public.tenders set status = 'awarded', awarded_contractor_id = $1 where reference = 'T-1'`, [c]);
  const m = await all(`select title from public.notifications where user_id = $1 order by created_at, title`, [mama]);
  assert.deepEqual(m.map((n) => n.title).sort(), ['Alpha Builders won a tender', 'New tender in your ward', 'Tender awarded in your ward']);
  assert.equal((await all(`select 1 from public.notifications where user_id = $1`, [baba])).length, 0);

  await db.query(`insert into public.procurement_flags (code, subject_key, severity, subject_kind, subject_label, title, detail) values ('dominant_supplier', $1, 'high', 'contractor', 'Alpha Builders', 'Alpha holds 60%', 'x')`, [String(c)]);
  assert.equal((await all(`select 1 from public.notifications where user_id = $1 and title = 'New flag on Alpha Builders'`, [mama])).length, 1);
});

test('project follows: status and spending updates', async () => {
  const p = await one(`insert into public.projects (slug, ward_id, title, sector, status, budget, published) values ('road-1', 'kileleshwa', 'Main road', 'Roads', 'in_progress', 100, true) returning id`);
  await as(db, 'authenticated', baba, () => db.query(`insert into public.follows (user_id, kind, key, label) values ($1, 'project', $2, 'Main road')`, [baba, String(p.id)]));
  await db.query(`update public.projects set status = 'stalled' where id = $1`, [p.id]);
  const n = await one(`select message, kind, link from public.notifications where user_id = $1 and title = 'Main road'`, [baba]);
  assert.equal(n.kind, 'warning');
  assert.equal(n.link, '/projects/road-1');
});

test('follows are private to their owner and capped', async () => {
  assert.equal((await as(db, 'authenticated', baba, () => all(`select * from public.follows`))).every((f) => f.user_id === baba), true);
  await assert.rejects(as(db, 'authenticated', baba, () => db.query(`insert into public.follows (user_id, kind, key, label) values ($1, 'sector', 'x', 'x')`, [mama])), /row-level security/);
  await assert.rejects(as(db, 'anon', null, () => all(`select * from public.follows`)), /permission denied/);
  await as(db, 'authenticated', mama, async () => {
    for (let i = 0; i < 38; i += 1) await db.query(`insert into public.follows (user_id, kind, key, label) values ($1, 'sector', $2, 'k')`, [mama, `s${i}`]);
  });
  await assert.rejects(as(db, 'authenticated', mama, () => db.query(`insert into public.follows (user_id, kind, key, label) values ($1, 'sector', 'overflow', 'k')`, [mama])), /up to 40/);
});

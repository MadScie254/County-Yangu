// Migration 0018: open reports to join before filing, and community checks on projects.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, as, newUser } from './harness.mjs';

let db, admin, ward, other, projectId;
const one = async (sql, params) => (await db.query(sql, params)).rows[0];
const all = async (sql, params) => (await db.query(sql, params)).rows;
const svc = (sql, params) => as(db, 'service_role', null, () => one(sql, params));
const anon = async (sql, params) => as(db, 'anon', null, async () => (await one(sql, params)).v);
const h = (s) => Buffer.from(s);

before(async () => {
  db = await freshDb();
  admin = await newUser(db, 'admin@county.go.ke');
  ward = await newUser(db, 'ward@county.go.ke');
  other = await newUser(db, 'otherward@county.go.ke');
  await db.query(`select public.grant_staff_role($1, 'admin')`, [admin]);
  await db.query(`select public.grant_staff_role($1, 'ward_admin', null, null, 'kileleshwa')`, [ward]);
  await db.query(`select public.grant_staff_role($1, 'ward_admin', null, null, 'kilimani')`, [other]);
  const cat = (await one(`select id from public.report_categories limit 1`)).id;
  await db.query(`insert into public.reports (ward_id, category_id, description, status, supporters) values
    ('kileleshwa', $1, 'Private words about my gate', 'received', 3),
    ('kileleshwa', $1, 'Another one', 'in_progress', 0),
    ('kileleshwa', $1, 'Old and fixed', 'resolved', 9),
    ('kilimani', $1, 'Elsewhere', 'received', 0)`, [cat]);
  globalThis.__cat = cat;
  projectId = (await one(`insert into public.projects (slug, ward_id, title, sector, status, budget, published) values ('road-1', 'kileleshwa', 'Main road', 'Roads', 'completed', 100, true) returning id`)).id;
  await db.query(`insert into public.projects (slug, ward_id, title, sector, budget, published) values ('hidden', 'kileleshwa', 'Draft project', 'Roads', 1, false)`);
});

test('open cases: only open reports in that ward, most joined first, no descriptions', async () => {
  const v = await anon(`select public.open_cases('kileleshwa', $1) v`, [globalThis.__cat]);
  assert.equal(v.length, 2);
  assert.equal(v[0].supporters, 3);
  assert.equal(JSON.stringify(v).includes('Private words'), false);
  assert.equal((await anon(`select public.open_cases('kilimani') v`)).length, 1);
});

test('project checks: one answer per person, public totals and comments, drafts refused', async () => {
  assert.equal((await svc(`select public.svc_project_check('road-1', 'as_shown', null, $1) r`, [h('a')])).r, 'ok');
  assert.equal((await svc(`select public.svc_project_check('road-1', 'not_as_shown', 'Only half the road is tarmacked', $1) r`, [h('b')])).r, 'ok');
  assert.equal((await svc(`select public.svc_project_check('road-1', 'as_shown', null, $1) r`, [h('a')])).r, 'duplicate');
  assert.equal((await svc(`select public.svc_project_check('hidden', 'as_shown', null, $1) r`, [h('c')])).r, 'not_found');
  const v = await anon(`select public.project_checks('road-1') v`);
  assert.equal(Number(v.as_shown), 1);
  assert.equal(Number(v.not_as_shown), 1);
  assert.equal(v.comments[0].comment, 'Only half the road is tarmacked');
  assert.equal(await anon(`select public.project_checks('hidden') v`), null);
});

test('the third doubt reaches admins and that ward, not other wards', async () => {
  await svc(`select public.svc_project_check('road-1', 'not_as_shown', null, $1)`, [h('d')]);
  await svc(`select public.svc_project_check('road-1', 'not_as_shown', null, $1)`, [h('e')]);
  const who = (await all(`select user_id from public.notifications where title = 'Residents question a project'`)).map((r) => r.user_id).sort();
  assert.deepEqual(who, [admin, ward].sort());
});

test('residents cannot call the write function or read raw checks', async () => {
  await assert.rejects(as(db, 'anon', null, () => one(`select public.svc_project_check('road-1', 'as_shown', null, $1)`, [h('x')])), /permission denied/);
  await assert.rejects(as(db, 'anon', null, () => all(`select * from private.project_checks`)), /permission denied/);
});

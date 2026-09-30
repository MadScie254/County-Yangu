// Migration 0015: committee dashboards, ward scorecards, open contracting data.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, as } from './harness.mjs';

let db, roads;
const one = async (sql, params) => (await db.query(sql, params)).rows[0];
const anon = async (sql, params) => as(db, 'anon', null, async () => (await one(sql, params)).v);

before(async () => {
  db = await freshDb();
  roads = (await one(`select id from public.departments where code = 'roads'`)).id;
  const c = (await one(`insert into public.contractors (name) values ('Alpha Builders') returning id`)).id;
  await db.query(`insert into public.tenders (reference, title, ward_id, sector, status, estimated_budget, award_amount, awarded_contractor_id, applicants_count, published_at, closes_at, awarded_at)
    values ('T-1', 'Road works', 'kileleshwa', 'Roads', 'awarded', 1000000, 900000, $1, 3, now() - interval '30 days', now() - interval '10 days', now() - interval '5 days'),
           ('T-2', 'Clinic fence', 'kileleshwa', 'Health', 'open', 500000, null, null, 0, now(), now() + interval '14 days', null),
           ('T-3', 'Draft only', 'kileleshwa', 'Roads', 'draft', 1, null, null, 0, null, null, null)`, [c]);
  await db.query(`insert into public.projects (slug, ward_id, title, sector, status, budget, spent, published) values
    ('p1', 'kileleshwa', 'Main road', 'Roads', 'stalled', 1000, 1200, true), ('p2', 'kileleshwa', 'Clinic', 'Health', 'in_progress', 500, 100, true)`);
  await db.query(`insert into public.reports (ward_id, department_id, description, status, resolved_at, created_at, resolve_due_at, reopened_count) values
    ('kileleshwa', $1, 'Pothole near school', 'resolved', now() - interval '1 day', now() - interval '5 days', now() + interval '1 day', 1),
    ('kileleshwa', $1, 'Blocked drain', 'in_progress', null, now() - interval '20 days', now() - interval '3 days', 0)`, [roads]);
});

test('committee dashboards count by sector and department', async () => {
  const d = await anon(`select public.assembly_dashboard() v`);
  const r = d.find((c) => c.code === 'roads');
  assert.equal(Number(r.cases.open), 1);
  assert.equal(Number(r.cases.overdue), 1);
  assert.equal(Number(r.cases.resolved_90d), 1);
  assert.equal(Number(r.cases.reopened), 1);
  assert.equal(Number(r.cases.median_days), 4);
  assert.equal(Number(r.projects.stalled), 1);
  assert.equal(Number(r.tenders.awarded_value), 900000);
  assert.equal(r.attention[0].slug, 'p1');
  assert.equal(Number(d.find((c) => c.code === 'health').tenders.open), 1);
});

test('the ward scorecard summarises one ward and knows nothing about others', async () => {
  const s = await anon(`select public.ward_scorecard('kileleshwa') v`);
  assert.equal(s.ward, 'Kileleshwa');
  assert.equal(Number(s.cases.received_90d), 2);
  assert.equal(Number(s.projects.count), 2);
  assert.equal(Number(s.tenders.awarded), 1);
  assert.equal(Number(s.tenders.open), 1);
  assert.equal(await anon(`select public.ward_scorecard('nowhere') v`), null);
});

test('OCDS: awards carry supplier and value, drafts are left out, paging is capped', async () => {
  const p = await anon(`select public.ocds_releases() v`);
  assert.equal(p.version, '1.1');
  assert.equal(p.releases.length, 2);
  const award = p.releases.find((r) => r.tag[0] === 'award');
  assert.equal(award.awards[0].suppliers[0].name, 'Alpha Builders');
  assert.equal(award.awards[0].value.currency, 'KES');
  assert.equal(award.tender.procurementMethod, 'open');
  assert.equal((await anon(`select public.ocds_releases(1, 0) v`)).releases.length, 1);
  assert.equal((await anon(`select public.ocds_releases(1, 5) v`)).releases.length, 0);
});

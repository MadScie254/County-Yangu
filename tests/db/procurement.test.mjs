// Procurement watch (migration 0012): the rules behind the Open County page, the review workflow and the daily scan.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, as, newUser } from './harness.mjs';

let db, admin, auditor, officer, roads;

const one = async (sql, params) => (await db.query(sql, params)).rows[0];
const all = async (sql, params) => (await db.query(sql, params)).rows;
const day = (n) => `2026-03-${String(n).padStart(2, '0')}T09:00:00Z`;
const watch = async (role = 'anon', user = null) => as(db, role, user, async () => (await one(`select public.procurement_watch() w`)).w);
const flagOf = (w, code, key) => w.flags.find((f) => f.code === code && (!key || f.subject_key === key));

before(async () => {
  db = await freshDb();
  admin = await newUser(db, 'admin@county.go.ke');
  auditor = await newUser(db, 'audit@oag.go.ke');
  officer = await newUser(db, 'officer@county.go.ke');
  roads = (await one(`select id from public.departments where code = 'roads'`)).id;
  await db.query(`select public.grant_staff_role($1, 'admin')`, [admin]);
  await db.query(`select public.grant_staff_role($1, 'auditor')`, [auditor]);
  await db.query(`select public.grant_staff_role($1, 'officer', $2)`, [officer, roads]);

  const c = async (name, kra = null) => (await one(`insert into public.contractors (name, kra_compliant) values ($1, $2) returning id`, [name, kra])).id;
  const alpha = await c('Alpha Builders'), beta = await c('Beta Roads'), gamma = await c('Gamma Works', false), delta = await c('Delta Supplies'), echo = await c('Echo Ltd');
  let n = 0;
  const award = async (cid, { estimate, amount = null, bids = 3, method = 'open_tender', pub, close, at, ward = 'kileleshwa', sector = 'Roads' }) => {
    n += 1;
    await db.query(
      `insert into public.tenders (reference, title, ward_id, sector, status, estimated_budget, award_amount, applicants_count, procurement_method, awarded_contractor_id, published_at, closes_at, awarded_at)
       values ($1, $2, $3, $4, 'awarded', $5, $6, $7, $8, $9, $10, $11, $12)`,
      [`T-${n}`, `Tender ${n}`, ward, sector, estimate, amount, bids, method, cid, pub, close, at],
    );
  };
  // Alpha: four road awards in ten days, each open for four days
  for (const d of [2, 5, 8, 11]) await award(alpha, { estimate: 10_000_000, pub: day(d - 1), close: day(d + 3), at: day(d) });
  await award(beta, { estimate: 5_000_000, bids: 1, method: 'direct', pub: day(1), close: day(20), at: day(25), sector: 'Water' });
  await award(gamma, { estimate: 3_000_000, pub: day(1), close: day(20), at: day(25), sector: 'Health', ward: null });
  await award(delta, { estimate: 2_000_000, bids: 1, pub: day(1), close: day(20), at: day(25), sector: 'Education', ward: null });
  await award(echo, { estimate: 2_000_000, amount: 3_000_000, pub: day(1), close: day(20), at: day(25), sector: 'Markets', ward: null });

  await db.query(`insert into public.projects (slug, ward_id, title, sector, status, budget, spent, published) values
    ('over', 'kileleshwa', 'Over budget road', 'Roads', 'in_progress', 10000000, 13000000, true),
    ('stuck', 'kileleshwa', 'Stalled market', 'Markets', 'stalled', 8000000, 5000000, true),
    ('late', 'kileleshwa', 'Late clinic', 'Health', 'in_progress', 4000000, 1000000, true),
    ('quiet', 'kileleshwa', 'On track', 'Roads', 'in_progress', 4000000, 1000000, true)`);
  await db.query(`update public.projects set expected_at = current_date - 90 where slug = 'late'`);
});

test('anyone can read the analysis, and it adds up', async () => {
  const w = await watch('anon');
  assert.equal(w.summary.awarded_count, 8);
  assert.equal(Number(w.summary.awarded_value), 53_000_000);
  assert.equal(w.summary.suppliers, 5);
  assert.equal(w.contractors[0].name, 'Alpha Builders');
  assert.equal(Number(w.contractors[0].share_value), 75.5);
  assert.equal(w.summary.hhi_band, 'high');
  assert.ok(Number(w.summary.top3_share) > 85);
  assert.deepEqual(w.methods.map((m) => m.method).sort(), ['direct', 'open_tender']);
});

test('each rule fires on the pattern it is named for', async () => {
  const w = await watch();
  const codes = new Set(w.flags.map((f) => f.code));
  for (const c of ['dominant_supplier', 'repeat_winner', 'top3_concentration', 'single_bidder_share', 'short_tender_period', 'award_above_estimate', 'split_awards', 'kra_noncompliant', 'project_overrun', 'stalled_after_spend', 'project_late']) {
    assert.ok(codes.has(c), `missing ${c}`);
  }
  assert.equal(flagOf(w, 'dominant_supplier').severity, 'high');
  assert.equal(flagOf(w, 'award_above_estimate').severity, 'high', '150% of estimate is serious');
  assert.equal(flagOf(w, 'project_overrun').severity, 'high');
  assert.equal(flagOf(w, 'project_late').severity, 'info');
  assert.ok(!w.flags.some((f) => f.subject_label === 'On track'), 'a healthy project is not flagged');
  // direct awards are 5M of 54M: under the 30% line
  assert.ok(!codes.has('non_competitive_share'));
  // most serious first
  const order = w.flags.map((f) => ({ high: 0, watch: 1, info: 2 })[f.severity]);
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
});

test('a market with no awards raises nothing and does not divide by zero', async () => {
  const empty = await freshDb();
  const w = (await empty.query(`select public.procurement_watch() w`)).rows[0].w;
  assert.equal(w.flags.length, 0);
  assert.equal(w.summary.awarded_count, 0);
  assert.equal(w.summary.hhi_band, 'low');
});

test('only an administrator can review a flag, a closing response is required, and it becomes public', async () => {
  const key = (await watch()).flags.find((f) => f.code === 'dominant_supplier').subject_key;
  await as(db, 'authenticated', officer, async () => {
    await assert.rejects(db.query(`select public.flag_review('dominant_supplier', $1, 'reviewing', null)`, [key]), /administrator/);
  });
  await as(db, 'authenticated', auditor, async () => {
    await assert.rejects(db.query(`select public.flag_review('dominant_supplier', $1, 'reviewing', null)`, [key]), /administrator/);
  });
  await as(db, 'anon', null, async () => {
    await assert.rejects(db.query(`select public.flag_review('dominant_supplier', $1, 'reviewing', null)`, [key]), /permission denied/i);
  });
  await as(db, 'authenticated', admin, async () => {
    await assert.rejects(db.query(`select public.flag_review('dominant_supplier', $1, 'explained', 'ok')`, [key]), /public response/);
    await assert.rejects(db.query(`select public.flag_review('dominant_supplier', $1, 'nonsense', 'A proper response here')`, [key]), /Unknown status/);
    await assert.rejects(db.query(`select public.flag_review('dominant_supplier', 'no-such-subject', 'reviewing', null)`), /no longer applies/);
    await db.query(`select public.flag_review('dominant_supplier', $1, 'explained', 'Framework contract awarded after open tender in 2025; see notice T-1.')`, [key]);
  });
  const shown = flagOf(await watch('anon'), 'dominant_supplier', key);
  assert.equal(shown.status, 'explained');
  assert.match(shown.response, /Framework contract/);
  const audited = await one(`select count(*)::int n from public.audit_log where entity = 'procurement_flags'`);
  assert.ok(audited.n >= 1, 'a review leaves an audit record');
});

test('the scan is closed to residents and staff, remembers flags, and tells administrators and auditors about new serious ones once', async () => {
  await as(db, 'authenticated', admin, async () => {
    await assert.rejects(db.query(`select public.svc_procurement_scan()`), /permission denied/i);
  });
  const first = await as(db, 'service_role', null, async () => (await one(`select public.svc_procurement_scan() n`)).n);
  assert.ok(first >= 1);
  const mail = await all(`select recipient, subject from private.outbox where subject like '%procurement flag%'`);
  const recipients = new Set(mail.map((m) => m.recipient));
  assert.ok(recipients.has('admin@county.go.ke') && recipients.has('audit@oag.go.ke'));
  assert.ok(!recipients.has('officer@county.go.ke'), 'officers are not in the loop');
  const queued = mail.length;
  const again = await as(db, 'service_role', null, async () => (await one(`select public.svc_procurement_scan() n`)).n);
  assert.equal(again, 0, 'nothing new the second time');
  assert.equal((await all(`select 1 from private.outbox where subject like '%procurement flag%'`)).length, queued, 'and nobody is emailed twice');
  // reviewed flags keep their status through a scan
  const kept = await one(`select status from public.procurement_flags where code = 'dominant_supplier'`);
  assert.equal(kept.status, 'explained');
});

test('a flag whose cause goes away is closed by the next scan', async () => {
  await db.query(`update public.projects set spent = 5000000 where slug = 'over'`);
  await as(db, 'service_role', null, async () => { await db.query(`select public.svc_procurement_scan()`); });
  assert.equal((await one(`select status from public.procurement_flags where code = 'project_overrun'`)).status, 'cleared');
  assert.ok(!flagOf(await watch(), 'project_overrun'));
});

test('the staff assistant can list flags, and anonymous callers cannot', async () => {
  const rows = await as(db, 'authenticated', officer, async () => all(`select * from public.ai_procurement_flags('high')`));
  assert.ok(rows.length >= 1 && rows.every((r) => r.severity === 'high'));
  await as(db, 'anon', null, async () => {
    await assert.rejects(db.query(`select * from public.ai_procurement_flags()`), /permission denied/i);
  });
});

test('public tender data carries the method and award details and nothing private', async () => {
  const row = await as(db, 'anon', null, async () => one(`select * from public.public_tenders where reference = 'T-5'`));
  assert.equal(row.procurement_method, 'direct');
  assert.equal(row.awarded_to, 'Beta Roads');
  assert.ok(!('created_by' in row) && !('kra_pin' in row));
});

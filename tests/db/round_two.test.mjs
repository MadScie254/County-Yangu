// Migration 0022: multi-issue reports, fix photos, whistleblower inbox, champions, procurement concerns,
// county finance, statements, polls and content flags.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, as, newUser } from './harness.mjs';

let db, admin, ward, officer, auditor, resident, other, third;
const one = async (sql, params) => (await db.query(sql, params)).rows[0];
const all = async (sql, params) => (await db.query(sql, params)).rows;
const asU = (uid, sql, params) => as(db, 'authenticated', uid, () => one(sql, params));
const anon = (sql, params) => as(db, 'anon', null, () => one(sql, params));
const svc = (sql, params) => as(db, 'service_role', null, () => one(sql, params));
const h = (s) => Buffer.from(s);
const uuid = () => crypto.randomUUID();

before(async () => {
  db = await freshDb();
  admin = await newUser(db, 'admin@county.go.ke');
  ward = await newUser(db, 'ward@county.go.ke');
  officer = await newUser(db, 'officer@county.go.ke');
  auditor = await newUser(db, 'audit@oag.go.ke');
  resident = await newUser(db, 'mama@example.com');
  other = await newUser(db, 'baba@example.com');
  third = await newUser(db, 'dada@example.com');
  await db.query(`select public.grant_staff_role($1, 'admin')`, [admin]);
  await db.query(`select public.grant_staff_role($1, 'ward_admin', null, null, 'kileleshwa')`, [ward]);
  await db.query(`select public.grant_staff_role($1, 'officer')`, [officer]);
  await db.query(`select public.grant_staff_role($1, 'auditor')`, [auditor]);
});

test('several issues in one visit become linked cases, each routed on its own, and a retry returns the same group', async () => {
  const key = uuid();
  const args = [uuid(), key, 'kileleshwa', ['pothole', 'drainage', 'pothole', 'streetlight'], 'Road broken and the drain blocked next to the market', null, null, 'en', 'web', '+254712345678', ['x/0.webp']];
  const r = (await svc(`select public.svc_create_report_group($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) r`, args)).r;
  assert.equal(r.duplicate, false);
  assert.deepEqual(r.reports.map((x) => x.category_id), ['pothole', 'drainage', 'streetlight']);
  const rows = await all(`select category_id, group_id, department_id from public.reports where group_id is not null order by created_at`);
  assert.equal(rows.length, 3);
  assert.equal(new Set(rows.map((x) => x.group_id)).size, 1);
  assert.equal((await one(`select count(*)::int n from public.report_photos`)).n, 3);
  const again = (await svc(`select public.svc_create_report_group($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) r`, args)).r;
  assert.equal(again.duplicate, true);
  assert.equal(again.reports.length, 3);
  const status = (await anon(`select public.case_status($1) s`, [r.reference])).s;
  assert.equal(status.group.length, 2);
  await assert.rejects(svc(`select public.svc_create_report_group($1, $2, 'kileleshwa', $3, 'Too many things wrong here', null, null, 'en', 'web') r`, [uuid(), uuid(), ['pothole', 'drainage', 'streetlight', 'garbage', 'sewer', 'dumping']]), /one and five/);
  await assert.rejects(anon(`select public.svc_create_report_group($1, $2, 'kileleshwa', $3, 'Not allowed directly', null, null, 'en', 'web')`, [uuid(), uuid(), ['pothole']]), /permission denied/);
});

test('a physical problem cannot be marked fixed without an after photo; the photo is public and so is the gallery', async () => {
  const rep = await one(`select id, reference from public.reports where category_id = 'pothole' and group_id is not null`);
  await assert.rejects(asU(admin, `select public.case_transition($1, 'resolved', 'Fixed', true)`, [rep.id]), /after photo/);
  await assert.rejects(asU(resident, `insert into public.fix_photos (report_id, kind, path) values ($1, 'after', 'x/after.webp')`, [rep.id]), /row-level security/);
  await asU(admin, `insert into public.fix_photos (report_id, kind, path) values ($1, 'before', 'r/before.webp'), ($1, 'after', 'r/after.webp')`, [rep.id]);
  await asU(admin, `select public.case_transition($1, 'resolved', 'Fixed', true)`, [rep.id]);
  const g = (await anon(`select public.fixed_gallery() g`)).g;
  assert.equal(g.length, 1);
  assert.equal(g[0].after, 'r/after.webp');
  assert.equal(g[0].before, 'r/before.webp');
  assert.equal((await anon(`select public.case_status($1) s`, [rep.reference])).s.fix_photos.length, 2);
});

test('whistleblower inbox: anonymous thread by key hash, two-way, readable only by the integrity desk', async () => {
  const ref = (await svc(`select public.svc_disclosure_create($1, 'procurement', 'kileleshwa', 'The roads tender was decided before bids opened.') r`, [h('key-1')])).r;
  assert.match(ref, /-W[0-9A-F]{10}$/);
  assert.equal((await all(`select 1 from public.notifications where user_id = $1 and title = 'New protected disclosure'`, [admin])).length, 1);
  assert.equal((await svc(`select public.svc_disclosure_thread($1) t`, [h('wrong')])).t, null);
  const inbox = (await asU(auditor, `select public.disclosure_inbox() i`)).i;
  assert.equal(inbox.length, 1);
  assert.deepEqual((await asU(officer, `select public.disclosure_inbox() i`)).i, []);
  await asU(admin, `select public.disclosure_answer($1, 'Thank you. Do you have the bid opening minutes?', 'reviewing')`, [inbox[0].id]);
  await assert.rejects(asU(officer, `select public.disclosure_answer($1, 'hello')`, [inbox[0].id]), /integrity desk/);
  assert.equal((await svc(`select public.svc_disclosure_reply($1, 'Yes, attached by hand to the ward office.') r`, [h('key-1')])).r, 'ok');
  const t = (await svc(`select public.svc_disclosure_thread($1) t`, [h('key-1')])).t;
  assert.equal(t.status, 'reviewing');
  assert.deepEqual(t.messages.map((m) => m.from_reporter), [true, false, true]);
  await assert.rejects(asU(admin, `select * from private.disclosures`), /permission denied/);
});

test('ward champions: residents apply, ward staff approve, only active champions in the ward can post a named check', async () => {
  await asU(resident, `insert into public.ward_champions (ward_id, display_name, motivation) values ('kileleshwa', 'Wanjiru K.', 'I walk past the market road every day.')`);
  await assert.rejects(asU(other, `insert into public.ward_champions (user_id, ward_id, display_name, status) values ($1, 'kileleshwa', 'Sneaky', 'active')`, [other]), /permission denied|row-level security/);
  const proj = await one(`insert into public.projects (slug, title, ward_id, sector, budget, published) values ('kileleshwa-road', 'Kileleshwa market road', 'kileleshwa', 'Roads', 5000000, true) returning id`);
  await assert.rejects(asU(resident, `insert into public.champion_checks (project_id, verdict) values ($1, 'as_shown')`, [proj.id]), /row-level security/);
  assert.equal((await anon(`select count(*)::int n from public.ward_champions`)).n, 0);
  await asU(ward, `update public.ward_champions set status = 'active' where user_id = $1`, [resident]);
  assert.equal((await all(`select 1 from public.notifications where user_id = $1 and title = 'You are now a ward champion'`, [resident])).length, 1);
  await asU(resident, `insert into public.champion_checks (project_id, verdict, comment) values ($1, 'not_as_shown', 'Only half the road is tarmacked.')`, [proj.id]);
  await assert.rejects(asU(resident, `insert into public.champion_checks (project_id, verdict) values ($1, 'as_shown')`, [proj.id]), /per week/);
  const checks = (await anon(`select public.champion_checks_for('kileleshwa-road') c`)).c;
  assert.equal(checks[0].champion, 'Wanjiru K.');
  assert.equal((await all(`select 1 from public.notifications where user_id = $1 and title = 'A ward champion questions a project'`, [ward])).length, 1);
  await assert.rejects(anon(`select user_id from public.ward_champions`), /permission denied/);
});

test('procurement concerns: residents raise, the county answers in public within 14 days, or the resident escalates', async () => {
  const t = await one(`insert into public.tenders (reference, title, sector, status, estimated_budget) values ('NCC/T/1', 'Drainage works', 'Water', 'open', 1000000) returning id`);
  const c = await asU(resident, `insert into public.tender_concerns (tender_id, kind, body) values ($1, 'short_deadline', 'Bidders were given only three days to respond to this tender.') returning id, reference, due_at, created_at`, [t.id]);
  assert.ok(Math.abs((new Date(c.due_at) - new Date(c.created_at)) / 86_400_000 - 14) < 0.01);
  await assert.rejects(asU(resident, `update public.tender_concerns set status = 'fixed', response = 'I fixed it myself' where id = $1`, [c.id]), /Only the county/);
  await assert.rejects(asU(resident, `update public.tender_concerns set status = 'escalated', escalated_to = 'PPRA' where id = $1`, [c.id]), /late or has dismissed/);
  await assert.rejects(asU(admin, `update public.tender_concerns set status = 'fixed' where id = $1`, [c.id]), /answer in public/);
  await asU(admin, `update public.tender_concerns set status = 'fixed', response = 'The deadline was extended to 21 days.' where id = $1`, [c.id]);
  assert.equal((await all(`select 1 from public.notifications where user_id = $1 and title = 'Your procurement concern was answered'`, [resident])).length, 1);
  const c2 = await asU(other, `insert into public.tender_concerns (tender_id, kind, body) values ($1, 'single_bid', 'Only one company bid and it belongs to a relative of an officer.') returning id`, [t.id]);
  await db.query(`alter table public.tender_concerns disable trigger tender_concerns_rules`);
  await db.query(`update public.tender_concerns set due_at = now() - interval '1 day' where id = $1`, [c2.id]);
  await db.query(`alter table public.tender_concerns enable trigger tender_concerns_rules`);
  await asU(other, `update public.tender_concerns set status = 'escalated', escalated_to = 'EACC' where id = $1`, [c2.id]);
  await assert.rejects(anon(`select user_id from public.tender_concerns`), /permission denied/);
  const d = (await anon(`select public.legal_deadlines() d`)).d;
  assert.equal(d.concerns.fixed, 1);
  assert.equal(d.concerns.on_time, 1);
});

test('county finance: admins enter figures with a source, everyone reads them', async () => {
  await asU(admin, `insert into public.county_finance (county_code, fiscal_year, dev_budget, dev_spent, osr_target, osr_actual, audit_opinion, source) values (47, '2024/25', 100, 40, 200, 150, 'qualified', 'Controller of Budget, County Budget Implementation Review Report FY 2024/25')`);
  await assert.rejects(asU(resident, `insert into public.county_finance (county_code, fiscal_year, source) values (1, '2024/25', 'Made up')`), /row-level security/);
  await assert.rejects(asU(admin, `insert into public.county_finance (county_code, fiscal_year, source) values (48, '2024/25', 'No such county')`), /check/);
  assert.equal((await anon(`select count(*)::int n from public.county_finance`)).n, 1);
});

test('statements: residents add short statements while open, vote once each (changeable), results include a pseudonymous matrix', async () => {
  const k = await asU(admin, `insert into public.consultations (slug, title, summary, closes_at) values ('parking-2027', 'Parking fees 2027', 'Proposed new parking fees in the city centre and estates.', now() + interval '10 days') returning id`);
  const s1 = await asU(resident, `insert into public.consultation_statements (consultation_id, body) values ($1, 'Parking fees should be lower for boda riders.') returning id`, [k.id]);
  const s2 = await asU(other, `insert into public.consultation_statements (consultation_id, body) values ($1, 'Money from parking should fix estate roads first.') returning id`, [k.id]);
  for (let i = 0; i < 2; i += 1) await asU(resident, `insert into public.consultation_statements (consultation_id, body) values ($1, $2)`, [k.id, `Another statement number ${i} here`]);
  await assert.rejects(asU(resident, `insert into public.consultation_statements (consultation_id, body) values ($1, 'One statement too many here')`, [k.id]), /up to 3/);
  await asU(resident, `insert into public.statement_votes (statement_id, vote) values ($1, 1), ($2, 1)`, [s1.id, s2.id]);
  await asU(other, `insert into public.statement_votes (statement_id, vote) values ($1, -1), ($2, 1)`, [s1.id, s2.id]);
  await asU(other, `update public.statement_votes set vote = 0 where statement_id = $1`, [s1.id]);
  await assert.rejects(asU(other, `insert into public.statement_votes (statement_id, vote) values ($1, 1)`, [s2.id]), /duplicate key|unique/);
  const r = (await anon(`select public.statement_results('parking-2027') r`)).r;
  assert.equal(r.participants, 2);
  const st = r.statements.find((x) => x.id === Number(s2.id));
  assert.equal(st.agree, 2);
  assert.equal(r.votes.length, 4);
  assert.ok(r.votes.every((v) => typeof v[0] === 'number'));
  await assert.rejects(anon(`select * from public.statement_votes`), /permission denied/);
});

test('polls: one vote per account while open, results by option and ward', async () => {
  await asU(ward, `insert into public.polls (slug, question, options, ward_id, closes_at) values ('water-days', 'Which days should water rationing fall on?', '[{"id":"a","label":"Mon and Thu"},{"id":"b","label":"Tue and Fri"}]', 'kileleshwa', now() + interval '5 days')`);
  const p = await one(`select id from public.polls where slug = 'water-days'`);
  await asU(resident, `insert into public.poll_votes (poll_id, option_id, ward_id) values ($1, 'a', 'kileleshwa')`, [p.id]);
  await asU(other, `insert into public.poll_votes (poll_id, option_id, ward_id) values ($1, 'b', 'kilimani')`, [p.id]);
  await assert.rejects(asU(resident, `insert into public.poll_votes (poll_id, option_id) values ($1, 'b')`, [p.id]), /duplicate key|unique/);
  await assert.rejects(asU(third, `insert into public.poll_votes (poll_id, option_id) values ($1, 'zzz')`, [p.id]), /row-level security/);
  await assert.rejects(asU(resident, `insert into public.polls (slug, question, options, closes_at) values ('mine', 'Resident made poll?', '[{"id":"a","label":"x"},{"id":"b","label":"y"}]', now() + interval '1 day')`), /row-level security/);
  const r = (await anon(`select public.poll_results('water-days') r`)).r;
  assert.equal(r.total, 2);
  assert.deepEqual(r.by_option, { a: 1, b: 1 });
});

test('flags: three people hide a statement until an administrator decides', async () => {
  const s = await one(`select id from public.consultation_statements order by id limit 1`);
  for (const u of [resident, other, third]) await asU(u, `insert into public.content_flags (kind, target_id, reason) values ('statement', $1, 'abuse')`, [String(s.id)]);
  assert.equal((await one(`select hidden from public.consultation_statements where id = $1`, [s.id])).hidden, true);
  assert.equal((await anon(`select count(*)::int n from public.consultation_statements where id = $1`, [s.id])).n, 0);
  const q = (await asU(admin, `select public.moderation_queue() q`)).q;
  assert.equal(q[0].flags, 3);
  await assert.rejects(asU(resident, `select public.moderate('statement', $1, false)`, [String(s.id)]), /administrators/);
  await asU(admin, `select public.moderate('statement', $1, false)`, [String(s.id)]);
  assert.equal((await one(`select hidden from public.consultation_statements where id = $1`, [s.id])).hidden, false);
  assert.deepEqual((await asU(admin, `select public.moderation_queue() q`)).q, []);
});

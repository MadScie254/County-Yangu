// The resident loop (migration 0013): feedback and reopening, SMS on change, verifiable permits and receipts.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, as, newUser } from './harness.mjs';

let db, admin, officer, resident, roads, report, ref, service;
const one = async (sql, params) => (await db.query(sql, params)).rows[0];
const all = async (sql, params) => (await db.query(sql, params)).rows;
const svc = async (sql, params) => as(db, 'service_role', null, () => one(sql, params));

before(async () => {
  db = await freshDb();
  admin = await newUser(db, 'admin@county.go.ke');
  officer = await newUser(db, 'officer@county.go.ke');
  resident = await newUser(db, 'mama@example.com');
  roads = (await one(`select id from public.departments where code = 'roads'`)).id;
  await db.query(`select public.grant_staff_role($1, 'admin')`, [admin]);
  await db.query(`select public.grant_staff_role($1, 'officer', $2)`, [officer, roads]);
  report = (await one(`insert into public.reports (ward_id, department_id, description, status) values ('kileleshwa', $1, 'Pothole on the main road', 'in_progress') returning id, reference`, [roads]));
  ref = report.reference;
  await db.query(`insert into private.report_contacts (report_id, phone_e164) values ($1, '+254700000001')`, [report.id]);
});

test('feedback is refused until the case is resolved', async () => {
  assert.equal((await svc(`select public.svc_case_feedback($1, true, null) r`, [ref])).r, 'not_resolved');
  assert.equal((await svc(`select public.svc_case_feedback('NOPE', true, null) r`)).r, 'not_found');
});

test('the resident cannot call the feedback function directly', async () => {
  await assert.rejects(as(db, 'anon', null, () => one(`select public.svc_case_feedback($1, true, null)`, [ref])), /permission denied/);
});

test('resolving a case texts the reporter once, with a link to the case', async () => {
  await db.query(`update public.reports set status = 'resolved', resolved_at = now() where id = $1`, [report.id]);
  await as(db, 'authenticated', officer, () => one(`select public.case_transition($1, 'resolved', 'Patched today', true)`, [report.id]));
  const sms = await all(`select body from private.outbox where related ->> 'report_id' = $1`, [report.id]);
  assert.equal(sms.length, 1);
  assert.match(sms[0].body, /^Fixed! NAI-R\w+ was fixed the same day\. Patched today/);
  assert.match(sms[0].body, new RegExp(ref));
});

test('a private note or an unshared transition sends nothing', async () => {
  await as(db, 'authenticated', officer, () => one(`select public.case_note($1, 'internal only')`, [report.id]));
  await as(db, 'authenticated', officer, () => one(`select public.case_transition($1, 'resolved', 'quiet', false)`, [report.id]));
  assert.equal((await all(`select 1 from private.outbox where related ->> 'report_id' = $1`, [report.id])).length, 1);
});

test('"not fixed" reopens the case and it shows on the public timeline', async () => {
  assert.equal((await svc(`select public.svc_case_feedback($1, false, 'Water is still pooling') r`, [ref])).r, 'ok');
  const r = await one(`select status, reopened_count, resolved_at from public.reports where id = $1`, [report.id]);
  assert.equal(r.status, 'in_progress');
  assert.equal(r.reopened_count, 1);
  assert.equal(r.resolved_at, null);
  const pub = await as(db, 'anon', null, () => one(`select public.case_status($1) s`, [ref]));
  assert.equal(pub.s.reopened_count, 1);
  assert.deepEqual(pub.s.events.map((e) => e.kind).slice(-2), ['feedback', 'reopened']);
  // and the reporter is told
  assert.ok((await all(`select body from private.outbox where related ->> 'event' = 'reopened'`)).length >= 1);
});

test('one answer per resolution, "fixed" is counted, ward figures are public', async () => {
  await as(db, 'authenticated', officer, () => one(`select public.case_transition($1, 'resolved', 'Redone properly', true)`, [report.id]));
  assert.equal((await svc(`select public.svc_case_feedback($1, true, 'Thank you') r`, [ref])).r, 'ok');
  assert.equal((await svc(`select public.svc_case_feedback($1, true, 'again') r`, [ref])).r, 'duplicate');
  const st = await as(db, 'anon', null, () => one(`select public.fix_confirmation_stats() s`));
  assert.equal(Number(st.s.responses), 2);
  assert.equal(Number(st.s.fixed), 1);
  assert.equal(st.s.by_ward[0].ward_id, 'kileleshwa');
  const pub = await as(db, 'anon', null, () => one(`select public.case_status($1) s`, [ref]));
  assert.equal(pub.s.feedback_given, true);
});

test('feedback rows are invisible to everyone directly', async () => {
  for (const [role, who] of [['anon', null], ['authenticated', resident], ['authenticated', admin]]) {
    const rows = await as(db, role, who, async () => { try { return await all(`select * from public.case_feedback`); } catch { return []; } });
    assert.equal(rows.length, 0);
  }
});

// ---- permits and receipts ---------------------------------------------------------------------------------------

async function newApplication() {
  service = await one(`insert into public.services (slug, name, department_id, fee, status) values ('permit-' || substr(gen_random_uuid()::text, 1, 6), 'Single business permit', $1, 0, 'active') returning id`, [roads]);
  const app = await one(`insert into public.applications (service_id, applicant_id, business_name, ward_id) values ($1, $2, 'Mama Nuru Groceries', 'kileleshwa') returning id, reference`, [service.id, resident]);
  await db.query(`update public.applications set status = 'submitted' where id = $1`, [app.id]);
  return app;
}

test('approval issues a code that anyone can verify, without exposing personal details', async () => {
  const app = await newApplication();
  await db.query(`update public.profiles set phone = '+254711111111' where id = $1`, [resident]);
  await as(db, 'authenticated', admin, () => one(`select public.decide_application($1, 'approved', null)`, [app.id]));
  const { verify_code: code } = await one(`select verify_code from public.applications where id = $1`, [app.id]);
  assert.match(code, /^CY-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  const v = (await as(db, 'anon', null, () => one(`select public.verify_document($1) v`, [code.toLowerCase()]))).v;
  assert.equal(v.valid, true);
  assert.equal(v.kind, 'permit');
  assert.equal(v.holder, 'Mama Nuru Groceries');
  assert.equal(JSON.stringify(v).includes('mama@example.com'), false);
  const sms = await one(`select body from private.outbox where related ->> 'application_id' = $1 and body like '%approved%'`, [app.id]);
  assert.match(sms.body, new RegExp(code));
  globalThis.__app = { ...app, code };
});

test('a resident cannot mint, change or revoke a code', async () => {
  const { id } = globalThis.__app;
  await assert.rejects(as(db, 'authenticated', resident, () => one(`update public.applications set verify_code = 'CY-AAAA-AAAA' where id = $1`, [id])), /Protected|permission|not allowed|denied/i);
  await assert.rejects(as(db, 'authenticated', resident, () => one(`select public.revoke_document($1, 'trying it out')`, [id])), /administrator/);
});

test('revoking makes the code read as revoked and tells the holder', async () => {
  const { id, code } = globalThis.__app;
  await as(db, 'authenticated', admin, () => one(`select public.revoke_document($1, 'Issued in error')`, [id]));
  const v = (await as(db, 'anon', null, () => one(`select public.verify_document($1) v`, [code]))).v;
  assert.equal(v.valid, false);
  assert.equal(v.state, 'revoked');
  assert.equal(v.revoked_reason, 'Issued in error');
  assert.ok((await all(`select 1 from public.notifications where user_id = $1 and message like 'This permit was withdrawn%'`, [resident])).length === 1);
});

test('unknown codes and receipts', async () => {
  const pub = (code) => as(db, 'anon', null, async () => (await one(`select public.verify_document($1) v`, [code])).v);
  assert.equal((await pub('CY-ZZZZ-ZZZZ')).valid, false);
  assert.equal((await pub('x')).valid, false);
  await db.query(`insert into public.payments (amount, status, mpesa_receipt, stream, completed_at) values (1500, 'completed', 'SIK1234ABC', 'market_fees', now())`);
  const r = await pub('sik1234abc');
  assert.equal(r.kind, 'receipt');
  assert.equal(r.valid, true);
  assert.equal(Number(r.amount), 1500);
});

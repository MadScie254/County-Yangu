// The service API (migration 0010): the rules the Edge Functions rely on, tested against the real schema.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, as, newUser } from './harness.mjs';

let db;
let alice, bob, admin, cec, roadsOfficer, wardAdmin, assembly;
let roads;

const one = async (sql, params) => (await db.query(sql, params)).rows[0];
const all = async (sql, params) => (await db.query(sql, params)).rows;
const svc = (sql, params) => as(db, 'service_role', null, () => one(sql, params));
const bytes = (s) => Buffer.from(s);

before(async () => {
  db = await freshDb();
  alice = await newUser(db, 'alice@example.com', { name: 'Alice' });
  bob = await newUser(db, 'bob@example.com', { name: 'Bob' });
  admin = await newUser(db, 'root@county.go.ke');
  cec = await newUser(db, 'cec@county.go.ke');
  roadsOfficer = await newUser(db, 'roads.officer@county.go.ke', { name: 'Rita Roads' });
  wardAdmin = await newUser(db, 'kileleshwa.admin@county.go.ke');
  assembly = await newUser(db, 'mca@assembly.go.ke', { name: 'Hon. Assembly' });
  roads = (await one(`select id from public.departments where code = 'roads'`)).id;
  await db.query(`select public.grant_staff_role($1, 'super_admin')`, [admin]);
  await db.query(`select public.grant_staff_role($1, 'admin')`, [cec]);
  await db.query(`select public.grant_staff_role($1, 'officer', $2)`, [roadsOfficer, roads]);
  await db.query(`select public.grant_staff_role($1, 'ward_admin', null, null, 'kileleshwa')`, [wardAdmin]);
  await db.query(`select public.grant_staff_role($1, 'assembly_member')`, [assembly]);
});

// ---- who may call what ---------------------------------------------------------

test('every svc_* function is closed to residents, staff and anonymous callers', async () => {
  const fns = await all(`select p.oid::regprocedure::text as sig, p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'svc\\_%'`);
  assert.ok(fns.length >= 29, `expected the whole service API, found ${fns.length}`);
  for (const f of fns) {
    const r = await one(`select has_function_privilege('anon', $1, 'execute') a, has_function_privilege('authenticated', $1, 'execute') u, has_function_privilege('service_role', $1, 'execute') s`, [f.oid]);
    assert.deepEqual([r.a, r.u, r.s], [false, false, true], f.sig);
  }
});

test('a signed-in user calling the service API is refused', async () => {
  await as(db, 'authenticated', admin, async () => {
    await assert.rejects(db.query(`select public.svc_rate_limit('x', 60, 5)`), /permission denied/i);
    await assert.rejects(db.query(`select public.svc_dispatch_alerts()`), /permission denied/i);
  });
  await as(db, 'anon', null, async () => {
    await assert.rejects(db.query(`select public.svc_cast_vote('c','w','o','web','\\x00')`), /permission denied/i);
  });
});

// ---- rate limiting -----------------------------------------------------------------

test('rate limit: allows up to the limit in a window, then refuses', async () => {
  const hits = [];
  for (let i = 0; i < 5; i++) hits.push((await svc(`select public.svc_rate_limit('otp:254700000001', 600, 3) ok`)).ok);
  assert.deepEqual(hits, [true, true, true, false, false]);
  assert.equal((await svc(`select public.svc_rate_limit('otp:254700000002', 600, 3) ok`)).ok, true, 'a different key has its own counter');
});

// ---- one-time codes ----------------------------------------------------------------

test('otp: a correct code works once; a wrong code locks after five tries; a new code retires the old one', async () => {
  const ph = bytes('phone-hash-1');
  await svc(`select public.svc_otp_issue('+254700000010', $1, 'vote', $2, 300)`, [ph, bytes('code-A')]);
  assert.equal((await svc(`select public.svc_otp_verify($1, 'vote', $2) r`, [ph, bytes('nope')])).r, 'invalid');
  assert.equal((await svc(`select public.svc_otp_verify($1, 'alerts', $2) r`, [ph, bytes('code-A')])).r, 'invalid', 'a code is bound to its purpose');
  assert.equal((await svc(`select public.svc_otp_verify($1, 'vote', $2) r`, [ph, bytes('code-A')])).r, 'ok');
  assert.equal((await svc(`select public.svc_otp_verify($1, 'vote', $2) r`, [ph, bytes('code-A')])).r, 'invalid', 'single use');

  await svc(`select public.svc_otp_issue('+254700000010', $1, 'vote', $2, 300)`, [ph, bytes('code-B')]);
  const results = [];
  for (let i = 0; i < 6; i++) results.push((await svc(`select public.svc_otp_verify($1, 'vote', $2) r`, [ph, bytes('guess' + i)])).r);
  assert.deepEqual(results, ['invalid', 'invalid', 'invalid', 'invalid', 'invalid', 'locked']);
  assert.equal((await svc(`select public.svc_otp_verify($1, 'vote', $2) r`, [ph, bytes('code-B')])).r, 'locked', 'even the right code is refused once locked');

  await svc(`select public.svc_otp_issue('+254700000010', $1, 'vote', $2, 300)`, [ph, bytes('code-C')]);
  await svc(`select public.svc_otp_issue('+254700000010', $1, 'vote', $2, 300)`, [ph, bytes('code-D')]);
  assert.equal((await svc(`select public.svc_otp_verify($1, 'vote', $2) r`, [ph, bytes('code-C')])).r, 'invalid', 'the older code no longer works');
  assert.equal((await svc(`select public.svc_otp_verify($1, 'vote', $2) r`, [ph, bytes('code-D')])).r, 'ok');
});

test('otp: an expired code is refused', async () => {
  const ph = bytes('phone-hash-2');
  await svc(`select public.svc_otp_issue('+254700000011', $1, 'alerts', $2, -1)`, [ph, bytes('old')]);
  assert.equal((await svc(`select public.svc_otp_verify($1, 'alerts', $2) r`, [ph, bytes('old')])).r, 'expired');
});

// ---- voting -----------------------------------------------------------------------------------

test('votes: one per person per cycle, only while the cycle is open, only for options on that ward’s ballot', async () => {
  await svc(`insert into public.budget_cycles (id, title, status, starts_at, ends_at) values ('fy-open', 'Open', 'open', now() - interval '1 day', now() + interval '10 days')`);
  await svc(`insert into public.budget_cycles (id, title, status, starts_at, ends_at) values ('fy-closed', 'Closed', 'closed', now() - interval '20 days', now() - interval '10 days')`);
  await svc(`insert into public.project_options (id, cycle_id, ward_id, title, sector, amount) values ('o1', 'fy-open', 'kileleshwa', 'Borehole', 'Water', 1000000), ('o2', 'fy-open', 'karura', 'Road', 'Roads', 2000000)`);
  const v = (cycle, ward, option, hash, channel = 'web') => svc(`select public.svc_cast_vote($1, $2, $3, $4, $5) r`, [cycle, ward, option, channel, bytes(hash)]).then((x) => x.r);
  assert.equal(await v('fy-open', 'kileleshwa', 'o1', 'voter-1'), 'ok');
  assert.equal(await v('fy-open', 'kileleshwa', 'o1', 'voter-1'), 'duplicate');
  assert.equal(await v('fy-open', 'kileleshwa', 'o1', 'voter-1', 'ussd'), 'duplicate', 'the same person on another channel is still the same voter');
  assert.equal(await v('fy-open', 'kileleshwa', 'o2', 'voter-2'), 'invalid_option', 'option belongs to another ward');
  assert.equal(await v('fy-closed', 'kileleshwa', 'o1', 'voter-3'), 'closed');
  assert.equal(await v('fy-open', 'kileleshwa', 'o1', 'voter-2'), 'ok');
  assert.equal((await svc(`select count(*)::int n from public.votes where cycle_id = 'fy-open'`)).n, 2);
});

// ---- alerts sign-up --------------------------------------------------------------------------------

test('alerts: subscribe, change frequency, STOP one ward or all', async () => {
  await svc(`select public.svc_subscribe('+254711000001', 'kileleshwa', 'weekly')`);
  await svc(`select public.svc_subscribe('+254711000001', 'kileleshwa', 'daily')`);
  await svc(`select public.svc_subscribe('+254711000001', 'karura', 'instant')`);
  const rows = await svc(`select count(*)::int n, min(frequency) f from private.subscribers where phone_e164 = '+254711000001' and ward_id = 'kileleshwa'`);
  assert.equal(rows.n, 1);
  assert.equal(rows.f, 'daily');
  assert.equal((await svc(`select public.svc_unsubscribe('+254711000001', 'karura') n`)).n, 1);
  assert.equal((await svc(`select public.svc_unsubscribe('+254711000001') n`)).n, 1, 'STOP with no ward switches off what is left');
  await svc(`select public.svc_subscribe('+254711000001', 'karura', 'instant')`);
  assert.equal((await svc(`select opted_out_at is null as active from private.subscribers where phone_e164 = '+254711000001' and ward_id = 'karura'`)).active, true, 'subscribing again turns it back on');
});

// ---- proposals ----------------------------------------------------------------------------------------

test('proposals: the author is the first supporter; nobody supports twice; closed ideas stop collecting', async () => {
  const { id } = (await svc(`select public.svc_submit_proposal(null, 'kileleshwa', 'proposal', 'Street lights on Argwings', 'Please fix the street lights along the road.', $1) id`, [bytes('author')]));
  assert.equal((await svc(`select supporters from public.proposals where id = $1`, [id])).supporters, 1);
  assert.equal((await svc(`select public.svc_support_proposal($1, $2) r`, [id, bytes('author')])).r, 'duplicate');
  assert.equal((await svc(`select public.svc_support_proposal($1, $2) r`, [id, bytes('neighbour')])).r, 'ok');
  assert.equal((await svc(`select supporters from public.proposals where id = $1`, [id])).supporters, 2);
  await svc(`update public.proposals set status = 'declined' where id = $1`, [id]);
  assert.equal((await svc(`select public.svc_support_proposal($1, $2) r`, [id, bytes('late')])).r, 'closed');
  assert.equal((await svc(`select public.svc_support_proposal(gen_random_uuid(), $1) r`, [bytes('x')])).r, 'not_found');
});

// ---- reports ----------------------------------------------------------------------------------------------

test('reports: created once per client key, routed and timed by the schema, contact kept apart', async () => {
  const key = '11111111-1111-4111-8111-111111111111';
  const id = '22222222-2222-4222-8222-222222222222';
  const mk = () => svc(`select public.svc_create_report($1, $2, 'kileleshwa', 'pothole', 'Deep pothole at the junction', -1.28, 36.78, 'en', 'web', '+254722000001', array['report-photos/x/0.webp']) r`, [id, key]);
  const first = (await mk()).r;
  const again = (await mk()).r;
  assert.equal(first.duplicate, false);
  assert.equal(again.duplicate, true);
  assert.equal(again.reference, first.reference);
  assert.match(first.reference, /^NAI-R[0-9A-F]{10}$/);
  const row = await svc(`select department_id, ack_due_at is not null as timed, resolve_due_at is not null as due, status from public.reports where reference = $1`, [first.reference]);
  assert.ok(row.department_id && row.timed && row.due);
  assert.equal((await svc(`select count(*)::int n from public.reports where client_key = $1`, [key])).n, 1);
  assert.equal((await svc(`select count(*)::int n from public.report_photos where report_id = $1`, [id])).n, 1);
  assert.equal((await svc(`select phone_e164 from private.report_contacts where report_id = $1`, [id])).phone_e164, '+254722000001');
  // a report made without consent has no contact row at all
  const noContact = (await svc(`select public.svc_create_report(null, null, 'karura', 'pothole', 'Another pothole here', null, null, 'sw', 'ussd') r`)).r;
  assert.equal((await svc(`select count(*)::int n from private.report_contacts c join public.reports r on r.id = c.report_id where r.reference = $1`, [noContact.reference])).n, 0);
});

// ---- payments ---------------------------------------------------------------------------------------------------

async function payableApplication(owner, fee = 5000) {
  const s = await svc(`insert into public.services (slug, name, fee, status, department_id) values ($1, 'Permit', $2, 'active', (select id from public.departments where code = 'trade')) returning id`, ['permit-' + Math.random().toString(36).slice(2), fee]);
  const app = await svc(`insert into public.applications (service_id, applicant_id) values ($1, $2) returning id, reference`, [s.id, owner]);
  await svc(`update public.applications set status = 'awaiting_payment' where id = $1`, [app.id]);
  return app;
}
const prep = (app, user) => svc(`select public.svc_payment_prepare($1, $2) r`, [app.id, user]).then((x) => x.r);
async function startPayment(app, user, checkout) {
  const p = await prep(app, user);
  await svc(`select public.svc_payment_record($1, $2, $3, $4, '4321')`, [app.id, user, checkout, p.amount]);
  return p;
}

test('payments: the amount comes from the service fee and only the owner can start a payment', async () => {
  const app = await payableApplication(alice, 5000);
  const p = await prep(app, alice);
  assert.equal(p.status, 'ok');
  assert.equal(Number(p.amount), 5000);
  assert.equal((await prep(app, bob)).status, 'not_found', 'somebody else’s application looks like it does not exist');
  await startPayment(app, alice, 'ws_CO_A1');
  assert.equal((await prep(app, alice)).status, 'pending_exists', 'no second prompt while one is outstanding');
  const free = await payableApplication(alice, 0);
  assert.equal((await prep(free, alice)).status, 'not_payable');
});

test('payments: a successful callback settles once, submits the application, records revenue and tells the applicant', async () => {
  const app = await payableApplication(alice, 5000);
  await startPayment(app, alice, 'ws_CO_B2');
  const settle = (code, receipt, amount) => svc(`select public.svc_payment_settle('ws_CO_B2', $1, $2, $3, '4321') r`, [code, receipt, amount]).then((x) => x.r);
  assert.equal(await settle(0, 'SIM1ABC', 5000), 'completed');
  assert.equal(await settle(0, 'SIM1ABC', 5000), 'already', 'Safaricom retries callbacks; the second one changes nothing');
  const a = await svc(`select status from public.applications where id = $1`, [app.id]);
  assert.equal(a.status, 'submitted');
  const rev = await all(`select * from public.revenue_entries where reference = 'SIM1ABC'`);
  assert.equal(rev.length, 1);
  assert.equal(rev[0].reconciled, true);
  assert.equal(Number(rev[0].amount), 5000);
  assert.equal((await svc(`select count(*)::int n from public.notifications where user_id = $1 and title = 'Payment received'`, [alice])).n, 1);
});

test('payments: a wrong amount does not settle; a failed or cancelled prompt leaves the application unpaid', async () => {
  const app = await payableApplication(alice, 5000);
  await startPayment(app, alice, 'ws_CO_C3');
  assert.equal((await svc(`select public.svc_payment_settle('ws_CO_C3', 0, 'SIMSHORT', 100) r`)).r, 'amount_mismatch');
  assert.equal((await svc(`select status from public.payments where checkout_request_id = 'ws_CO_C3'`)).status, 'pending');
  assert.equal((await svc(`select status from public.applications where id = $1`, [app.id])).status, 'awaiting_payment');
  const orphan = await svc(`select reconciled, stream from public.revenue_entries where reference = 'SIMSHORT'`);
  assert.deepEqual([orphan.reconciled, orphan.stream], [false, 'unallocated'], 'the money that did arrive is visible to finance');

  const app2 = await payableApplication(alice, 5000);
  await startPayment(app2, alice, 'ws_CO_D4');
  assert.equal((await svc(`select public.svc_payment_settle('ws_CO_D4', 1032, null, null) r`)).r, 'failed');
  assert.equal((await svc(`select status from public.applications where id = $1`, [app2.id])).status, 'awaiting_payment');
  assert.equal((await svc(`select public.svc_payment_settle('ws_CO_UNKNOWN', 0, 'X', 1) r`)).r, 'unknown');
});

test('payments: a paybill payment with an application reference and the exact amount pays it; anything else is left for finance', async () => {
  const app = await payableApplication(bob, 2500);
  const c2b = (id, amount, ref) => svc(`select public.svc_c2b_record($1, $2, $3, 'J DOE') r`, [id, amount, ref]).then((x) => x.r);
  assert.equal(await c2b('C2B1', 2500, app.reference.toLowerCase()), 'matched');
  assert.equal((await svc(`select status from public.applications where id = $1`, [app.id])).status, 'submitted');
  assert.equal(await c2b('C2B1', 2500, app.reference), 'duplicate');
  assert.equal(await c2b('C2B2', 999, 'NOSUCHREF'), 'recorded');
  const app2 = await payableApplication(bob, 2500);
  assert.equal(await c2b('C2B3', 1000, app2.reference), 'recorded', 'a part payment does not clear the application');
  assert.equal((await svc(`select status from public.applications where id = $1`, [app2.id])).status, 'awaiting_payment');
});

// ---- outgoing messages ---------------------------------------------------------------------------------------------

test('outbox: claimed once, retried with a growing delay, abandoned after five tries', async () => {
  const m = await svc(`insert into private.outbox (channel, recipient, body) values ('sms', '+254733000001', 'hello') returning id`);
  const first = await as(db, 'service_role', null, () => all(`select * from public.svc_outbox_claim(10)`));
  assert.ok(first.some((r) => r.id === m.id));
  const second = await as(db, 'service_role', null, () => all(`select * from public.svc_outbox_claim(10)`));
  assert.ok(!second.some((r) => r.id === m.id), 'a claimed message is not handed out twice');
  await svc(`select public.svc_outbox_done($1, false, 'gateway timeout')`, [m.id]);
  let r = await svc(`select status, attempts, run_after > now() as later from private.outbox where id = $1`, [m.id]);
  assert.deepEqual([r.status, r.attempts, r.later], ['queued', 1, true]);
  for (let i = 0; i < 4; i++) await svc(`select public.svc_outbox_done($1, false, 'still down')`, [m.id]);
  assert.equal((await svc(`select status from private.outbox where id = $1`, [m.id])).status, 'failed');
  const ok = await svc(`insert into private.outbox (channel, recipient, body) values ('sms', '+254733000002', 'hi') returning id`);
  await svc(`select public.svc_outbox_done($1, true)`, [ok.id]);
  assert.equal((await svc(`select status from private.outbox where id = $1`, [ok.id])).status, 'sent');
});

test('alerts: an approved alert reaches verified, opted-in subscribers of its ward once, and STOP is respected', async () => {
  await svc(`delete from private.subscribers`);
  await svc(`select public.svc_subscribe('+254744000001', 'kileleshwa', 'weekly')`);
  await svc(`select public.svc_subscribe('+254744000002', 'kileleshwa', 'instant')`);
  await svc(`select public.svc_subscribe('+254744000003', 'karura', 'instant')`);
  await svc(`select public.svc_subscribe('+254744000004', 'kileleshwa', 'instant')`);
  await svc(`select public.svc_unsubscribe('+254744000004')`);
  await svc(`insert into private.subscribers (phone_e164, ward_id) values ('+254744000005', 'kileleshwa')`); // never verified
  await svc(`delete from private.outbox`);

  const ward = (await svc(`insert into public.alerts (ward_id, title, body, status, created_by, approved_by, approved_at) values ('kileleshwa', 'Water', 'Water off 9am to 4pm Tuesday.', 'approved', $1, $2, now()) returning id`, [wardAdmin, admin])).id;
  assert.equal((await svc(`select public.svc_dispatch_alerts() n`)).n, 2);
  const to = (await all(`select recipient from private.outbox where related ->> 'alert_id' = $1 order by 1`, [ward])).map((r) => r.recipient);
  assert.deepEqual(to, ['+254744000001', '+254744000002'], 'weekly subscribers still get official alerts at once');
  const a = await svc(`select status, recipients from public.alerts where id = $1`, [ward]);
  assert.deepEqual([a.status, a.recipients], ['sent', 2]);
  assert.match((await svc(`select body from private.outbox where recipient = '+254744000001'`)).body, /^Nairobi.*Reply STOP to opt out\.$/);
  assert.equal((await svc(`select public.svc_dispatch_alerts() n`)).n, 0, 'sent alerts are not sent again');

  await svc(`insert into public.alerts (title, body, status, created_by, approved_by, approved_at) values ('All', 'County-wide notice.', 'approved', $1, $2, now())`, [wardAdmin, admin]);
  assert.equal((await svc(`select public.svc_dispatch_alerts() n`)).n, 3, 'a county-wide alert reaches every verified subscriber once');
});

test('ward updates: only people who chose that frequency get a summary', async () => {
  await svc(`delete from private.outbox`);
  await svc(`delete from private.subscribers`);
  await svc(`select public.svc_subscribe('+254744000010', 'kileleshwa', 'weekly')`);
  await svc(`select public.svc_subscribe('+254744000011', 'kileleshwa', 'daily')`);
  assert.equal((await svc(`select public.svc_ward_updates('weekly') n`)).n, 1);
  assert.equal((await svc(`select public.svc_ward_updates('instant') n`)).n, 0);
  assert.match((await svc(`select body from private.outbox where recipient = '+254744000010'`)).body, /^Kileleshwa this week:\nFixed: \d+\. Late: \d+ of \d+ open\.\nDo: /);
});

// ---- escalation ---------------------------------------------------------------------------------------------------------

test('escalation: each rung notifies the people it is meant for, exactly once', async () => {
  await svc(`delete from private.outbox`);
  await svc(`update public.county set settings = settings || '{"console_url": "https://console.example"}'::jsonb`);
  const r = (await svc(`select public.svc_create_report(null, null, 'kileleshwa', 'pothole', 'Big pothole that nobody has looked at', null, null, 'en', 'web') r`)).r;
  await svc(`update public.reports set ack_due_at = now() - interval '2 days', created_at = now() - interval '3 days' where reference = $1`, [r.reference]);
  assert.ok((await svc(`select public.svc_escalate() n`)).n >= 2, 'level 1 goes to the ward admin and the roads officers');
  let mail = await all(`select recipient, related from private.outbox where related ->> 'report_id' = (select id::text from public.reports where reference = $1)`, [r.reference]);
  assert.ok(mail.some((m) => m.recipient === 'kileleshwa.admin@county.go.ke'));
  assert.ok(mail.some((m) => m.recipient === 'roads.officer@county.go.ke'));
  assert.ok(mail.every((m) => m.related.level === 1));
  assert.equal((await svc(`select public.svc_escalate() n`)).n, 0, 'running it again does not repeat the reminder');

  // long overdue: jumps to the top of the ladder and the Assembly hears about it
  await svc(`update public.reports set resolve_due_at = now() - interval '45 days' where reference = $1`, [r.reference]);
  const mca = await newUser(db, null, { name: 'Hon. Phone Only' }); // signs in with a phone number, has no email
  await db.query(`select public.grant_staff_role($1, 'assembly_member')`, [mca]);
  await svc(`update public.profiles set phone = '+254755000009' where id = $1`, [mca]);
  await svc(`select public.svc_escalate()`);
  mail = await all(`select recipient, channel, related from private.outbox where related ->> 'report_id' = (select id::text from public.reports where reference = $1) and (related ->> 'level')::int >= 3`, [r.reference]);
  assert.ok(mail.some((m) => m.recipient === 'cec@county.go.ke' && m.channel === 'email'));
  assert.ok(mail.some((m) => m.recipient === '+254755000009' && m.channel === 'sms'), 'an Assembly member with no email is reached by SMS');
  assert.ok(mail.some((m) => m.recipient === 'mca@assembly.go.ke' && m.channel === 'email'), 'an Assembly member with an email is emailed');
  assert.ok(!mail.some((m) => m.recipient === 'alice@example.com'), 'residents are never notified through the ladder');
});

// ---- digests -----------------------------------------------------------------------------------------------------------------

test('digests: built once per period; the Assembly copy names officers, the auditor copy does not; opens are counted', async () => {
  await svc(`delete from private.outbox`);
  await svc(`update public.county set settings = settings || '{"digest_recipients": {"assembly": ["Clerk@Assembly.go.ke"], "auditor_general": ["oag@audit.go.ke"]}}'::jsonb`);
  const r = (await svc(`select public.svc_create_report(null, null, 'kileleshwa', 'pothole', 'Ancient pothole assigned to Rita', null, null, 'en', 'web') r`)).r;
  await svc(`update public.reports set assigned_to = $2, resolve_due_at = now() - interval '60 days' where reference = $1`, [r.reference, roadsOfficer]);
  const a = (await svc(`select public.svc_build_digest('assembly', date_trunc('month', now())::date, (date_trunc('month', now()) + interval '1 month - 1 day')::date) id`)).id;
  const o = (await svc(`select public.svc_build_digest('auditor_general', date_trunc('month', now())::date, (date_trunc('month', now()) + interval '1 month - 1 day')::date) id`)).id;
  const again = (await svc(`select public.svc_build_digest('assembly', date_trunc('month', now())::date, (date_trunc('month', now()) + interval '1 month - 1 day')::date) id`)).id;
  assert.equal(again, a, 'the same period is not built twice');
  const assemblyBody = (await svc(`select body_md from public.digests where id = $1`, [a])).body_md;
  const auditBody = (await svc(`select body_md from public.digests where id = $1`, [o])).body_md;
  assert.match(assemblyBody, /Rita Roads/);
  assert.doesNotMatch(auditBody, /Rita Roads/);
  assert.match(auditBody, /Roads/);
  const mail = await all(`select recipient, body, related from private.outbox where related ? 'digest_id' order by recipient`);
  assert.deepEqual(mail.map((m) => m.recipient), ['clerk@assembly.go.ke', 'oag@audit.go.ke']);
  assert.match(mail[0].body, /\{\{open_url\}\}/);
  const token = mail[0].related.open_token;
  assert.equal((await svc(`select public.svc_digest_opened($1) ok`, [token])).ok, true);
  assert.equal((await svc(`select public.svc_digest_opened($1) ok`, [token])).ok, true);
  assert.equal((await svc(`select open_count from public.digest_recipients where open_token = $1`, [token])).open_count, 2);
  assert.equal((await svc(`select public.svc_digest_opened(gen_random_uuid()) ok`)).ok, false);
});

// ---- staff accounts ------------------------------------------------------------------------------------------------------------

test('staff check: honours expiry and the MFA switch', async () => {
  const chk = (user, roles, aal) => svc(`select public.svc_staff_check($1, $2::text[], $3) ok`, [user, roles, aal]).then((x) => x.ok);
  assert.equal(await chk(admin, ['admin', 'super_admin'], null), true);
  assert.equal(await chk(alice, ['admin', 'super_admin'], null), false);
  await svc(`update public.county set settings = settings || '{"require_staff_mfa": true}'::jsonb`);
  assert.equal(await chk(admin, ['super_admin'], 'aal1'), false, 'password only is not enough once MFA is required');
  assert.equal(await chk(admin, ['super_admin'], 'aal2'), true);
  await svc(`update public.county set settings = settings - 'require_staff_mfa'`);
});

test('auditor invitations: single use, right email only, and the role is time-limited', async () => {
  const hash = bytes('sha256-of-token');
  await svc(`select public.svc_invite_create($1, 'Auditor@OAG.go.ke', 'OAG', 7, $2)`, [hash, admin]);
  assert.equal((await svc(`select public.svc_invite_check($1, 'auditor@oag.go.ke') ok`, [hash])).ok, true);
  assert.equal((await svc(`select public.svc_invite_check($1, 'someone.else@example.com') ok`, [hash])).ok, false);
  assert.equal((await svc(`select public.svc_invite_check($1, 'auditor@oag.go.ke') ok`, [bytes('guessed')])).ok, false);
  const newAuditor = await newUser(db, 'auditor@oag.go.ke');
  assert.equal((await svc(`select public.svc_accept_invite($1, 'someone.else@example.com', $2, 30) ok`, [hash, newAuditor])).ok, false);
  assert.equal((await svc(`select public.svc_accept_invite($1, 'auditor@oag.go.ke', $2, 30) ok`, [hash, newAuditor])).ok, true);
  assert.equal((await svc(`select public.svc_accept_invite($1, 'auditor@oag.go.ke', $2, 30) ok`, [hash, newAuditor])).ok, false, 'a used invitation is dead');
  const role = await svc(`select role, expires_at > now() as future, expires_at < now() + interval '31 days' as limited from public.staff_roles where user_id = $1`, [newAuditor]);
  assert.deepEqual([role.role, role.future, role.limited], ['auditor', true, true]);
  // expired
  const h2 = bytes('expired-token');
  await svc(`select public.svc_invite_create($1, 'late@oag.go.ke', 'OAG', -1, $2)`, [h2, admin]);
  assert.equal((await svc(`select public.svc_invite_check($1, 'late@oag.go.ke') ok`, [h2])).ok, false);
});

// ---- AI spend control -----------------------------------------------------------------------------------------------------------------

test('AI: nothing is allowed until a budget exists; spend counts against the department; the cap stops further calls', async () => {
  const check = (dept) => svc(`select public.svc_ai_check($1) r`, [dept]).then((x) => x.r);
  assert.equal((await check(roads)).allowed, false, 'no budget, no AI');
  await svc(`update public.county set settings = settings || '{"ai_default_cap_kes": 100}'::jsonb`);
  assert.equal((await check(roads)).allowed, true);
  await svc(`select public.svc_ai_log('draft_reply', 'test-model', 'county', $1, $2, 500, 200, 60, true, 2)`, [roads, roadsOfficer]);
  assert.equal(Number((await check(roads)).spent), 60);
  assert.equal((await check(null)).spent, 0, 'another department’s pool is untouched');
  await svc(`select public.svc_ai_log('draft_reply', 'test-model', 'county', $1, $2, 500, 200, 45, true, 0)`, [roads, roadsOfficer]);
  assert.equal((await check(roads)).allowed, false, 'over the cap');
  await svc(`insert into public.ai_budgets (department_id, month, cap_kes) values ($1, date_trunc('month', now())::date, 1000)`, [roads]);
  assert.equal((await check(roads)).allowed, true, 'a department budget overrides the default');
  assert.equal(await svc(`select public.svc_ai_department($1) d`, [roadsOfficer]).then((x) => x.d), roads);
  assert.equal(await svc(`select public.svc_ai_department($1) d`, [alice]).then((x) => x.d), null);
});

test('AI questions run as the person asking: an officer sees their department, nobody anonymous can ask', async () => {
  await svc(`delete from public.reports`);
  await svc(`select public.svc_create_report(null, null, 'kileleshwa', 'pothole', 'Pothole one, roads department', null, null, 'en', 'web')`);
  await svc(`select public.svc_create_report(null, null, 'karura', 'sewer', 'Blocked sewer overflowing on the street', null, null, 'en', 'web')`);
  const seen = await as(db, 'authenticated', roadsOfficer, () => all(`select * from public.ai_cases_by_ward()`));
  assert.deepEqual(seen.map((r) => r.ward), ['Kileleshwa'], 'row-level security still applies inside the question');
  const everything = await as(db, 'authenticated', admin, () => all(`select * from public.ai_cases_by_ward()`));
  assert.equal(everything.length, 2);
  await as(db, 'authenticated', alice, async () => {
    const mine = await all(`select * from public.ai_cases_by_ward()`);
    assert.equal(mine.length, 0, 'a resident sees no cases through it');
  });
  await as(db, 'anon', null, async () => {
    await assert.rejects(db.query(`select * from public.ai_cases_by_ward()`), /permission denied/i);
  });
  const sla = await as(db, 'authenticated', admin, () => all(`select * from public.ai_sla_performance(30)`));
  assert.ok(sla.length >= 1);
});

// ---- administration (migration 0011) -----------------------------------------------------------------------------------------------------

test('services: a chief officer can edit their own department’s services and no one else’s', async () => {
  const waterChief = await newUser(db, 'water.chief@county.go.ke');
  const water = (await one(`select id from public.departments where code = 'water'`)).id;
  await db.query(`select public.grant_staff_role($1, 'chief_officer', $2)`, [waterChief, water]);
  const mine = await svc(`insert into public.services (slug, name, fee, status, department_id) values ('water-connection', 'Water connection', 500, 'active', $1) returning id`, [water]);
  const theirs = await svc(`insert into public.services (slug, name, fee, status, department_id) values ('road-cut', 'Road cut permit', 500, 'active', $1) returning id`, [roads]);
  await as(db, 'authenticated', waterChief, async () => {
    await db.query(`update public.services set fee = 750 where id = $1`, [mine.id]);
    const r = await db.query(`update public.services set fee = 1 where id = $1 returning id`, [theirs.id]);
    assert.equal(r.rows.length, 0, 'another department’s service is not theirs to change');
    await assert.rejects(db.query(`insert into public.services (slug, name, fee, status, department_id) values ('sneaky', 'x', 0, 'active', $1)`, [roads]), /row-level security/i);
  });
  assert.equal(Number((await svc(`select fee from public.services where id = $1`, [mine.id])).fee), 750);
  assert.equal(Number((await svc(`select fee from public.services where id = $1`, [theirs.id])).fee), 500);
  await as(db, 'authenticated', admin, async () => {
    await db.query(`update public.services set fee = 600 where id = $1`, [theirs.id]);
  });
  assert.equal(Number((await svc(`select fee from public.services where id = $1`, [theirs.id])).fee), 600);
});

test('two-factor switch: an administrator cannot turn it on from a password-only session', async () => {
  const flip = (claims) => as(db, 'authenticated', admin, async () => {
    if (claims) await db.query(`select set_config('request.jwt.claims', $1, false)`, [claims]);
    try { return await db.query(`update public.county set settings = jsonb_set(settings, '{require_staff_mfa}', 'true') returning id`); }
    finally { await db.query(`select set_config('request.jwt.claims', '', false)`); }
  });
  await assert.rejects(flip(JSON.stringify({ aal: 'aal1' })), /authenticator app/i);
  await assert.rejects(flip(null), /authenticator app/i);
  try {
    assert.equal((await flip(JSON.stringify({ aal: 'aal2' }))).rows.length, 1);
    // turning it off is always allowed (nobody is locked out by that)
    await as(db, 'authenticated', admin, async () => {
      await db.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ aal: 'aal2' })]);
      try { await db.query(`update public.county set settings = settings - 'require_staff_mfa'`); }
      finally { await db.query(`select set_config('request.jwt.claims', '', false)`); }
    });
  } finally {
    await db.query(`update public.county set settings = settings - 'require_staff_mfa'`);
  }
});

test('AI usage and budgets: visible to administrators only', async () => {
  await svc(`update public.county set settings = settings || '{"ai_default_cap_kes": 100}'::jsonb`);
  await svc(`select public.svc_ai_log('draft_reply', 'm', 'county', $1, $2, 1, 1, 12.5, true, 0)`, [roads, roadsOfficer]);
  const usage = await as(db, 'authenticated', admin, () => all(`select * from public.ai_usage()`));
  const r = usage.find((u) => u.department === 'Roads' || u.department_id === roads);
  assert.ok(r);
  assert.equal(Number(r.spent_kes) >= 12.5, true);
  assert.equal(usage[0].department, 'County-wide pool', 'the shared pool is listed first');
  assert.equal((await as(db, 'authenticated', roadsOfficer, () => all(`select * from public.ai_usage()`))).length, 0);
  assert.equal((await as(db, 'authenticated', alice, () => all(`select * from public.ai_usage()`))).length, 0);

  await as(db, 'authenticated', admin, async () => { await db.query(`select public.set_ai_budget($1, 40)`, [roads]); });
  assert.equal(Number((await svc(`select public.svc_ai_check($1) r`, [roads])).r.cap), 40);
  await as(db, 'authenticated', admin, async () => { await db.query(`select public.set_ai_budget($1, null)`, [roads]); });
  assert.equal(Number((await svc(`select public.svc_ai_check($1) r`, [roads])).r.cap), 100, 'clearing falls back to the default');
  await as(db, 'authenticated', roadsOfficer, async () => {
    await assert.rejects(db.query(`select public.set_ai_budget($1, 99999)`, [roads]), /row-level security|permission/i);
  });
  await as(db, 'anon', null, async () => {
    await assert.rejects(db.query(`select * from public.ai_usage()`), /permission denied/i);
  });
});

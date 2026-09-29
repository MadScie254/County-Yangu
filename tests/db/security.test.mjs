import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, as, newUser } from './harness.mjs';

let db;
let alice, bob, superAdmin, admin, roadsOfficer, waterOfficer, wardAdmin, otherWardAdmin, assembly, auditor;
let roads, water, integrity;

const denied = /permission denied|row-level security|violates row-level|not allowed|Only a|Only an|append-only|Protected|Invalid status|Payment required|second person|not exist/i;

async function one(sql, params) {
  return (await db.query(sql, params)).rows[0];
}
async function insertReport(fields = {}) {
  const f = { ward: 'kileleshwa', category: 'pothole', description: 'Big pothole near the junction', channel: 'web', ...fields };
  return as(db, 'service_role', null, () =>
    one(
      `insert into public.reports (ward_id, category_id, description, channel, client_key)
       values ($1, $2, $3, $4, $5) returning id, reference, status, department_id, assigned_to, flagged_financial,
       ack_due_at, resolve_due_at, priority`,
      [f.ward, f.category, f.description, f.channel, f.key ?? null],
    ),
  );
}

before(async () => {
  db = await freshDb();
  alice = await newUser(db, 'alice@example.com', { name: 'Alice' });
  bob = await newUser(db, 'bob@example.com', { name: 'Bob' });
  superAdmin = await newUser(db, 'root@county.go.ke');
  admin = await newUser(db, 'admin@county.go.ke');
  roadsOfficer = await newUser(db, 'roads.officer@county.go.ke', { name: 'Rita Roads' });
  waterOfficer = await newUser(db, 'water.officer@county.go.ke');
  wardAdmin = await newUser(db, 'kileleshwa.admin@county.go.ke');
  otherWardAdmin = await newUser(db, 'karura.admin@county.go.ke');
  assembly = await newUser(db, 'mca@assembly.go.ke', { name: 'Hon. Assembly' });
  auditor = await newUser(db, 'oag@audit.go.ke');
  roads = (await one(`select id from public.departments where code = 'roads'`)).id;
  water = (await one(`select id from public.departments where code = 'water'`)).id;
  integrity = (await one(`select id from public.departments where code = 'integrity'`)).id;

  // trusted bootstrap (SQL editor): first super admin, then operational roles
  await db.query(`select public.grant_staff_role($1, 'super_admin')`, [superAdmin]);
  await as(db, 'authenticated', superAdmin, async () => {
    await db.query(`select public.grant_staff_role($1, 'admin')`, [admin]);
  });
  await as(db, 'authenticated', admin, async () => {
    await db.query(`select public.grant_staff_role($1, 'officer', $2)`, [roadsOfficer, roads]);
    await db.query(`select public.grant_staff_role($1, 'officer', $2)`, [waterOfficer, water]);
    await db.query(`select public.grant_staff_role($1, 'ward_admin', null, null, 'kileleshwa')`, [wardAdmin]);
    await db.query(`select public.grant_staff_role($1, 'ward_admin', null, null, 'karura')`, [otherWardAdmin]);
    await db.query(`select public.grant_staff_role($1, 'assembly_member')`, [assembly]);
    await db.query(`select public.grant_staff_role($1, 'auditor', null, null, null, now() + interval '30 days')`, [auditor]);
  });
});

test('seed: Nairobi has 85 wards in 17 sub-counties and a working category matrix', async () => {
  const r = await one(`select (select count(*) from public.wards) w, (select count(*) from public.sub_counties) s, (select count(*) from public.report_categories where active) c`);
  assert.equal(Number(r.w), 85);
  assert.equal(Number(r.s), 17);
  assert.equal(Number(r.c), 15);
});

// ---- privilege escalation ----------------------------------------------------

test('signup metadata cannot grant a role: new users are plain residents', async () => {
  const mallory = await newUser(db, 'mallory@example.com', { name: 'Mallory', role: 'super_admin', roles: ['admin'] });
  const p = await one(`select * from public.profiles where id = $1`, [mallory]);
  assert.equal(p.name, 'Mallory');
  assert.equal(p.role, undefined, 'profiles has no role column');
  const roles = await one(`select count(*)::int n from public.staff_roles where user_id = $1`, [mallory]);
  assert.equal(roles.n, 0);
  await as(db, 'authenticated', mallory, async () => {
    const r = await one(`select private.is_staff() as s`);
    assert.equal(r.s, false);
  });
});

test('a signed-in user cannot write staff_roles or edit their own role', async () => {
  await as(db, 'authenticated', alice, async () => {
    await assert.rejects(db.query(`insert into public.staff_roles (user_id, role) values ($1, 'super_admin')`, [alice]), denied);
    await assert.rejects(db.query(`update public.staff_roles set active = true where user_id = $1`, [alice]), denied);
    await assert.rejects(db.query(`update public.profiles set role = 'admin' where id = $1`, [alice]), /column|permission/i);
    await assert.rejects(db.query(`select public.grant_staff_role($1, 'admin')`, [alice]), denied);
  });
});

test('an admin cannot mint another admin or super admin; a super admin can', async () => {
  const mallory = await newUser(db, 'mallory2@example.com');
  await as(db, 'authenticated', admin, async () => {
    await assert.rejects(db.query(`select public.grant_staff_role($1, 'admin')`, [mallory]), /Only a super admin/);
    await assert.rejects(db.query(`select public.grant_staff_role($1, 'super_admin')`, [mallory]), /Only a super admin/);
  });
  await as(db, 'authenticated', superAdmin, async () => {
    await db.query(`select public.grant_staff_role($1, 'admin')`, [mallory]);
  });
  const r = await one(`select count(*)::int n from public.staff_roles where user_id = $1 and role = 'admin'`, [mallory]);
  assert.equal(r.n, 1);
});

test('scoped roles must carry their scope', async () => {
  const u = await newUser(db, 'scope@example.com');
  await assert.rejects(db.query(`select public.grant_staff_role($1, 'chief_officer')`, [u]), /staff_roles_scope|check/i);
  await assert.rejects(db.query(`select public.grant_staff_role($1, 'ward_admin')`, [u]), /staff_roles_scope|check/i);
});

test('users can edit personal details on their own profile only', async () => {
  await as(db, 'authenticated', alice, async () => {
    await db.query(`update public.profiles set name = 'Alice W', locale = 'sw' where id = $1`, [alice]);
    const r = await db.query(`update public.profiles set name = 'Hacked' where id = $1 returning id`, [bob]);
    assert.equal(r.rows.length, 0, 'cannot touch another profile');
    const seen = await db.query(`select id from public.profiles`);
    assert.deepEqual(seen.rows.map((x) => x.id), [alice], 'cannot read other profiles');
  });
});

// ---- anonymous access ----------------------------------------------------------------

test('anonymous visitors read reference data and aggregate views, nothing personal', async () => {
  await as(db, 'anon', null, async () => {
    assert.equal(Number((await one(`select count(*) n from public.wards`)).n), 85);
    await db.query(`select * from public.public_ward_stats limit 1`);
    await db.query(`select * from public.public_county_summary`);
    for (const t of ['reports', 'votes', 'report_events', 'staff_roles', 'profiles', 'applications', 'payments', 'audit_log', 'proposal_supports', 'digests', 'ai_calls']) {
      await assert.rejects(db.query(`select * from public.${t} limit 1`), denied, `anon must not read ${t}`);
    }
    await assert.rejects(db.query(`select * from private.report_contacts`), denied);
    await assert.rejects(db.query(`select * from private.otp_codes`), denied);
  });
});

test('anonymous visitors cannot write anything directly', async () => {
  await as(db, 'anon', null, async () => {
    await assert.rejects(db.query(`insert into public.reports (ward_id, description) values ('kileleshwa', 'spam spam spam')`), denied);
    await assert.rejects(db.query(`insert into public.votes (cycle_id, ward_id, option_id, channel, voter_hash) values ('x','kileleshwa','y','web','\\x00')`), denied);
    await assert.rejects(db.query(`insert into public.projects (slug, ward_id, title, sector, budget) values ('a','kileleshwa','t','s',1)`), denied);
    await assert.rejects(db.query(`update public.wards set name = 'x'`), denied);
    await assert.rejects(db.query(`delete from public.departments`), denied);
    await assert.rejects(db.query(`select public.run_escalations()`), denied);
    await assert.rejects(db.query(`select public.grant_staff_role('${alice}', 'admin')`), denied);
  });
});

test('signed-in residents cannot write reference data or reports either', async () => {
  await as(db, 'authenticated', alice, async () => {
    // RLS-filtered UPDATE/DELETE do not raise: they simply touch no rows.
    assert.equal((await db.query(`update public.wards set name = 'x' returning id`)).rows.length, 0);
    assert.equal((await db.query(`delete from public.departments returning id`)).rows.length, 0);
    await assert.rejects(db.query(`insert into public.report_categories (id, name) values ('x','x')`), denied);
    await assert.rejects(db.query(`insert into public.reports (ward_id, description) values ('kileleshwa', 'spam spam spam')`), denied);
  });
  assert.equal((await one(`select count(*)::int n from public.wards where name = 'x'`)).n, 0);
});

// ---- cases: routing, SLA, scoping -------------------------------------------------------

test('a new report is routed by the matrix and gets both SLA timers', async () => {
  const r = await insertReport();
  assert.equal(r.department_id, roads);
  assert.equal(r.status, 'received');
  assert.match(r.reference, /^NAI-R[0-9A-F]{10}$/);
  assert.ok(new Date(r.ack_due_at) > new Date());
  assert.ok(new Date(r.resolve_due_at) > new Date(r.ack_due_at));
  const ev = await db.query(`select kind, is_public from public.report_events where report_id = $1`, [r.id]);
  assert.deepEqual(ev.rows, [{ kind: 'created', is_public: true }]);
});

test('urgent categories use hour-based timers', async () => {
  const r = await insertReport({ category: 'water_main' });
  assert.equal(r.priority, 'urgent');
  const hours = (new Date(r.ack_due_at) - Date.now()) / 3600000;
  assert.ok(hours > 1.5 && hours < 2.5, `ack in ~2h, got ${hours}`);
});

test('sensitive categories go to the integrity desk, not the department they complain about', async () => {
  const r = await insertReport({ category: 'abandoned' });
  assert.equal(r.department_id, integrity);
  assert.equal(r.flagged_financial, true);
});

test('offline replays are idempotent: the same client key cannot create two reports', async () => {
  const key = '11111111-1111-4111-8111-111111111111';
  await insertReport({ key });
  await assert.rejects(insertReport({ key }), /unique|duplicate/i);
});

test('staff see only the cases their role and scope entitle them to', async () => {
  const r = await insertReport({ ward: 'kileleshwa', category: 'pothole' });
  const seen = async (uid) => as(db, 'authenticated', uid, async () => (await db.query(`select id from public.reports where id = $1`, [r.id])).rows.length);
  assert.equal(await seen(roadsOfficer), 1, 'roads officer sees roads cases in their dept');
  assert.equal(await seen(waterOfficer), 0, 'water officer does not');
  assert.equal(await seen(wardAdmin), 1, 'ward admin of that ward');
  assert.equal(await seen(otherWardAdmin), 0, 'ward admin of another ward');
  assert.equal(await seen(admin), 1);
  assert.equal(await seen(assembly), 0, 'assembly members use oversight summaries, not case rows');
  assert.equal(await seen(auditor), 0);
  assert.equal(await seen(alice), 0, 'residents never');
});

test('case actions: authorised staff can act and it lands on the timeline; others are refused', async () => {
  const r = await insertReport();
  await as(db, 'authenticated', waterOfficer, async () => {
    await assert.rejects(db.query(`select public.case_transition($1, 'resolved', 'done', true)`, [r.id]), /Not allowed/);
    await assert.rejects(db.query(`select public.case_note($1, 'peek')`, [r.id]), /Not allowed/);
  });
  await as(db, 'authenticated', alice, async () => {
    await assert.rejects(db.query(`select public.case_transition($1, 'resolved', 'done', true)`, [r.id]), /Not allowed/);
  });
  await as(db, 'authenticated', roadsOfficer, async () => {
    await assert.rejects(db.query(`select public.case_transition($1, 'bogus')`, [r.id]), /Invalid status/);
    await db.query(`select public.case_note($1, 'internal: crew booked')`, [r.id]);
    await db.query(`select public.case_transition($1, 'in_progress', 'Crew dispatched', true)`, [r.id]);
  });
  const row = await one(`select status, acknowledged_at is not null as acked from public.reports where id = $1`, [r.id]);
  assert.equal(row.status, 'in_progress');
  assert.equal(row.acked, true);
});

test('public case status shows public messages only, never internal notes or people', async () => {
  const r = await insertReport();
  await as(db, 'authenticated', roadsOfficer, async () => {
    await db.query(`select public.case_note($1, 'INTERNAL: contractor is the MCA''s cousin')`, [r.id]);
    await db.query(`select public.case_transition($1, 'in_progress', 'Crew dispatched', true)`, [r.id]);
  });
  const st = await as(db, 'anon', null, () => one(`select public.case_status($1) as s`, [r.reference.toLowerCase()]));
  const s = st.s;
  assert.equal(s.status, 'in_progress');
  assert.equal(s.ward, 'Kileleshwa');
  const text = JSON.stringify(s);
  assert.ok(text.includes('Crew dispatched'));
  assert.ok(!text.includes('INTERNAL'), 'internal notes stay internal');
  assert.ok(!text.includes('assigned'), 'no officer info');
  const none = await as(db, 'anon', null, () => one(`select public.case_status('NAI-RNOPE') as s`));
  assert.equal(none.s, null);
});

test('a public update queues an SMS only when the reporter opted in', async () => {
  const withNumber = await insertReport();
  const without = await insertReport();
  await db.query(`insert into private.report_contacts (report_id, phone_e164) values ($1, '+254700000001')`, [withNumber.id]);
  await as(db, 'authenticated', roadsOfficer, async () => {
    await db.query(`select public.case_transition($1, 'in_progress', 'On it', true)`, [withNumber.id]);
    await db.query(`select public.case_transition($1, 'in_progress', 'On it', true)`, [without.id]);
  });
  const out = await db.query(`select recipient, body from private.outbox where related->>'report_id' in ($1, $2)`, [withNumber.id, without.id]);
  assert.equal(out.rows.length, 1);
  assert.equal(out.rows[0].recipient, '+254700000001');
});

test('escalation ladder climbs by rules and stays quiet about people', async () => {
  const r = await insertReport({ category: 'garbage' });
  await db.query(`update public.reports set created_at = now() - interval '40 days', ack_due_at = now() - interval '39 days', resolve_due_at = now() - interval '36 days' where id = $1`, [r.id]);
  const out = await as(db, 'service_role', null, () => db.query(`select * from public.run_escalations()`));
  const levels = out.rows.filter((x) => x.report_id === r.id).map((x) => x.level);
  assert.deepEqual(levels, [1, 2, 3, 4], 'every rung crossed is recorded and notified, even when the runner jumps several at once');
  const again = await as(db, 'service_role', null, () => db.query(`select * from public.run_escalations()`));
  assert.equal(again.rows.find((x) => x.report_id === r.id), undefined, 'idempotent: does not re-escalate');
  const pub = await as(db, 'anon', null, () => one(`select public.case_status($1) as s`, [r.reference]));
  assert.ok(pub.s.events.some((e) => /Past its target/.test(e.message ?? '')), 'public sees that the case is overdue');
  assert.ok(!JSON.stringify(pub.s).includes(roadsOfficer));
});

test('oversight: assembly members see named officers, auditors see the department only, residents see nothing', async () => {
  const r = await insertReport({ category: 'pothole' });
  await db.query(`update public.reports set assigned_to = $2, resolve_due_at = now() - interval '3 days' where id = $1`, [r.id, roadsOfficer]);
  await db.query(`update public.profiles set name = 'Rita Roads' where id = $1`, [roadsOfficer]);
  const get = (uid) => as(db, 'authenticated', uid, async () => (await db.query(`select * from public.oversight_overdue()`)).rows);
  const a = (await get(assembly)).find((x) => x.reference === r.reference);
  assert.equal(a.officer, 'Rita Roads');
  const u = (await get(auditor)).find((x) => x.reference === r.reference);
  assert.equal(u.officer, null);
  assert.equal(u.department, 'Roads, Transport & Public Works');
  assert.equal((await get(alice)).length, 0);
});

test('the public overdue counter never names anyone', async () => {
  const cols = (await db.query(`select column_name from information_schema.columns where table_name = 'public_overdue_counts'`)).rows.map((c) => c.column_name);
  assert.deepEqual(cols.sort(), ['department_id', 'open_count', 'overdue_count', 'ward_id']);
});

// ---- applications & payments ---------------------------------------------------------------

test('applications: price comes from the service, payment is required, decisions are department-scoped', async () => {
  const svc = await as(db, 'authenticated', admin, () =>
    one(`insert into public.services (slug, name, department_id, fee, status) values ('single-business-permit', 'Single Business Permit', (select id from public.departments where code = 'trade'), 5000, 'active') returning id`),
  );
  const trade = (await one(`select id from public.departments where code = 'trade'`)).id;
  const tradeOfficer = await newUser(db, 'trade.officer@county.go.ke');
  await db.query(`select public.grant_staff_role($1, 'officer', $2)`, [tradeOfficer, trade]);

  const app = await as(db, 'authenticated', alice, async () => {
    const r = await one(`insert into public.applications (service_id, applicant_id, business_name) values ($1, $2, 'Alice Traders') returning id, amount, status, reference, due_at`, [svc.id, alice]);
    assert.equal(Number(r.amount), 5000, 'fee copied from the service');
    assert.equal(r.status, 'draft');
    assert.match(r.reference, /^NAI-A/);
    // cheating attempts
    await assert.rejects(db.query(`update public.applications set amount = 1 where id = $1`, [r.id]), /Protected|permission/i);
    await assert.rejects(db.query(`insert into public.applications (service_id, applicant_id, status) values ($1, $2, 'approved')`, [svc.id, alice]), denied);
    await assert.rejects(db.query(`insert into public.applications (service_id, applicant_id) values ($1, $2)`, [svc.id, bob]), denied); // as someone else
    await assert.rejects(db.query(`update public.applications set status = 'approved' where id = $1`, [r.id]), /Invalid status|permission/i);
    await assert.rejects(db.query(`update public.applications set status = 'submitted' where id = $1`, [r.id]), /Payment required/);
    return r;
  });

  // Bob cannot see or touch Alice's application
  await as(db, 'authenticated', bob, async () => {
    assert.equal((await db.query(`select id from public.applications`)).rows.length, 0);
    const u = await db.query(`update public.applications set business_name = 'x' where id = $1 returning id`, [app.id]);
    assert.equal(u.rows.length, 0);
  });

  // payment settles (service role = the M-Pesa webhook), then she can submit
  await as(db, 'service_role', null, () =>
    db.query(`insert into public.payments (application_id, payer_id, amount, status, mpesa_receipt) values ($1, $2, 5000, 'completed', 'SIK123ABC')`, [app.id, alice]),
  );
  await as(db, 'authenticated', alice, () => db.query(`update public.applications set status = 'submitted' where id = $1`, [app.id]));

  // only the owning department (or admin) may decide
  await as(db, 'authenticated', roadsOfficer, async () => {
    assert.equal((await db.query(`select id from public.applications`)).rows.length, 0, 'roads officer cannot even see trade applications');
    await assert.rejects(db.query(`select public.decide_application($1, 'approved')`, [app.id]), /Not allowed/);
  });
  await as(db, 'authenticated', alice, async () => {
    await assert.rejects(db.query(`select public.decide_application($1, 'approved')`, [app.id]), /Not allowed/);
  });
  await as(db, 'authenticated', tradeOfficer, async () => {
    await db.query(`select public.decide_application($1, 'approved', 'All documents in order')`, [app.id]);
  });
  const done = await one(`select status, decided_by from public.applications where id = $1`, [app.id]);
  assert.equal(done.status, 'approved');
  assert.equal(done.decided_by, tradeOfficer);
  await as(db, 'authenticated', alice, async () => {
    const n = await db.query(`select message from public.notifications`);
    assert.ok(n.rows.some((x) => /approved/.test(x.message)), 'applicant is notified');
  });
});

test('inactive services cannot be applied for', async () => {
  const svc = await one(`insert into public.services (slug, name, fee, status) values ('draft-svc', 'Draft', 0, 'draft') returning id`);
  await as(db, 'authenticated', alice, async () => {
    await assert.rejects(db.query(`insert into public.applications (service_id, applicant_id) values ($1, $2)`, [svc.id, alice]), /not available|permission|row-level/i);
  });
});

// ---- alerts: four eyes ------------------------------------------------------------------------------

test('alerts need a second person to approve', async () => {
  const a = await as(db, 'authenticated', wardAdmin, () =>
    one(`insert into public.alerts (ward_id, title, body, created_by) values ('kileleshwa', 'Water shutdown', 'No water 9-5 Tuesday', $1) returning id`, [wardAdmin]),
  );
  await as(db, 'authenticated', wardAdmin, async () => {
    await db.query(`select public.alert_submit($1)`, [a.id]);
    await assert.rejects(db.query(`select public.alert_approve($1)`, [a.id]), /second person|not pending/i);
  });
  await as(db, 'authenticated', alice, async () => {
    await assert.rejects(db.query(`select public.alert_approve($1)`, [a.id]), /Not allowed/);
  });
  await as(db, 'authenticated', admin, () => db.query(`select public.alert_approve($1)`, [a.id]));
  assert.equal((await one(`select status from public.alerts where id = $1`, [a.id])).status, 'approved');
});

// ---- audit ------------------------------------------------------------------------------------------------

test('the audit log records staff changes and cannot be edited by anyone, including superusers', async () => {
  const n = await one(`select count(*)::int n from public.audit_log where entity = 'staff_roles'`);
  assert.ok(n.n > 0, 'role grants are audited');
  await assert.rejects(db.query(`update public.audit_log set action = 'X'`), /append-only/);
  await assert.rejects(db.query(`delete from public.audit_log`), /append-only/);
  await assert.rejects(db.query(`truncate public.audit_log`), /append-only/);
  await as(db, 'service_role', null, async () => {
    await assert.rejects(db.query(`delete from public.audit_log`), /append-only|permission/i);
  });
  await as(db, 'authenticated', admin, async () => {
    assert.ok((await db.query(`select * from public.audit_log limit 1`)).rows.length === 1, 'admins can read it');
  });
  await as(db, 'authenticated', roadsOfficer, async () => {
    assert.equal((await db.query(`select * from public.audit_log limit 1`)).rows.length, 0, 'officers see none of it');
  });
});

// ---- working days ---------------------------------------------------------------------------------------------

test('working-day timers skip weekends and public holidays', async () => {
  // Fri 2026-10-16 + 1 working day = Mon 2026-10-19
  const a = await one(`select private.add_working_days('2026-10-16 10:00+03', 1) as t`);
  assert.equal(new Date(a.t).toISOString().slice(0, 10), '2026-10-19');
  // Fri 2026-10-16 + 3 working days = Mon 19, Tue 20 (Mashujaa Day, holiday), so Wed 21 -> Thu 22
  const b = await one(`select private.add_working_days('2026-10-16 10:00+03', 3) as t`);
  assert.equal(new Date(b.t).toISOString().slice(0, 10), '2026-10-22');
});

// ---- outbox and private tables ----------------------------------------------------------------------------------

test('private tables and the rate limiter are unreachable to clients and work for the service role', async () => {
  await as(db, 'authenticated', admin, async () => {
    await assert.rejects(db.query(`select * from private.outbox`), denied);
    await assert.rejects(db.query(`select private.rate_limit_hit('x', 60, 1)`), denied);
  });
  await as(db, 'service_role', null, async () => {
    const r1 = await one(`select private.rate_limit_hit('otp:+254700', 60, 2) as ok`);
    const r2 = await one(`select private.rate_limit_hit('otp:+254700', 60, 2) as ok`);
    const r3 = await one(`select private.rate_limit_hit('otp:+254700', 60, 2) as ok`);
    assert.deepEqual([r1.ok, r2.ok, r3.ok], [true, true, false]);
  });
});

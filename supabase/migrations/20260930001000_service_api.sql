-- 0010  Service API: what the Edge Functions do to the database, as small functions.
--
-- Why functions and not table writes from the Edge Functions?
--  * The rules that matter (one vote per phone, a code that locks after five tries, a payment that
--    settles exactly once, an alert that needs a second person) live in ONE place, next to the data,
--    and are covered by the offline database tests.
--  * The Edge Functions stay thin: validate, rate-limit, talk to the outside world (SMS, M-Pesa, KRA,
--    the AI provider), then call one of these.
--
-- Every `svc_*` function is SECURITY DEFINER and executable by the service role ONLY. Residents and staff
-- can not call them, even with a valid session; the tests check that.
-- The `ai_*` functions at the end are the opposite: SECURITY INVOKER, run with the asker's own permissions.

alter table private.outbox add column claimed_at timestamptz;

-- ---- abuse control -------------------------------------------------------------------------------------------

create function public.svc_rate_limit(p_key text, p_window_seconds int, p_max int)
returns boolean
language sql
security definer
set search_path = ''
as $$ select private.rate_limit_hit(p_key, p_window_seconds, p_max); $$;

-- Housekeeping: expired codes and old counters do not need to live in the database.
create function public.svc_cleanup()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from private.otp_codes  where created_at < now() - interval '1 day';
  delete from private.rate_limits where window_start < now() - interval '2 days';
  delete from private.outbox     where status in ('sent', 'failed') and created_at < now() - interval '90 days';
$$;

-- ---- one-time codes ---------------------------------------------------------------------------------------------
-- The function never sees a plain code: it stores and compares keyed hashes computed by the Edge Function.

create function public.svc_otp_issue(p_phone text, p_phone_hash bytea, p_purpose text, p_code_hash bytea, p_ttl_seconds int default 300)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  -- Only the newest code works: retire any earlier one for the same phone and purpose.
  update private.otp_codes set consumed_at = now()
   where phone_hash = p_phone_hash and purpose = p_purpose and consumed_at is null;
  insert into private.otp_codes (phone_hash, phone_e164, code_hash, purpose, expires_at)
  values (p_phone_hash, p_phone, p_code_hash, p_purpose, now() + make_interval(secs => p_ttl_seconds))
  returning id into v_id;
  return v_id;
end;
$$;

-- 'ok' | 'invalid' | 'expired' | 'locked'. A code is single-use and locks after too many wrong tries.
create function public.svc_otp_verify(p_phone_hash bytea, p_purpose text, p_code_hash bytea, p_max_attempts int default 5)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  r private.otp_codes;
begin
  select * into r from private.otp_codes
   where phone_hash = p_phone_hash and purpose = p_purpose and consumed_at is null
   order by created_at desc limit 1
   for update;
  if not found then return 'invalid'; end if;
  if r.expires_at < now() then
    update private.otp_codes set consumed_at = now() where id = r.id;
    return 'expired';
  end if;
  if r.attempts >= p_max_attempts then return 'locked'; end if;
  update private.otp_codes set attempts = attempts + 1 where id = r.id;
  if r.code_hash = p_code_hash then
    update private.otp_codes set consumed_at = now() where id = r.id;
    return 'ok';
  end if;
  return 'invalid';
end;
$$;

-- ---- participation ------------------------------------------------------------------------------------------------

-- 'ok' | 'duplicate' | 'closed' | 'invalid_option'. The voter is only ever a keyed hash.
create function public.svc_cast_vote(p_cycle text, p_ward text, p_option text, p_channel text, p_voter_hash bytea)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.budget_cycles c
                  where c.id = p_cycle and c.status = 'open' and now() between c.starts_at and c.ends_at) then
    return 'closed';
  end if;
  if not exists (select 1 from public.project_options o
                  where o.id = p_option and o.cycle_id = p_cycle and o.ward_id = p_ward) then
    return 'invalid_option';
  end if;
  insert into public.votes (cycle_id, ward_id, option_id, channel, voter_hash)
  values (p_cycle, p_ward, p_option, p_channel, p_voter_hash);
  return 'ok';
exception when unique_violation then
  return 'duplicate';
end;
$$;

create function public.svc_subscribe(p_phone text, p_ward text, p_frequency text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.subscribers (phone_e164, ward_id, frequency, verified_at)
  values (p_phone, p_ward, p_frequency, now())
  on conflict (phone_e164, ward_id)
    do update set frequency = excluded.frequency, verified_at = now(), opted_out_at = null;
$$;

-- STOP: leave one ward, or every ward when p_ward is null. Returns how many subscriptions were switched off.
create function public.svc_unsubscribe(p_phone text, p_ward text default null)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  update private.subscribers set opted_out_at = now()
   where phone_e164 = p_phone and opted_out_at is null and (p_ward is null or ward_id = p_ward);
  get diagnostics n = row_count;
  return n;
end;
$$;

-- The caller chooses the id so it can compute the author's supporter hash for THIS idea, the same way it will for
-- everyone else; otherwise the author could back their own idea a second time.
create function public.svc_submit_proposal(p_id uuid, p_ward text, p_kind text, p_title text, p_body text, p_voter_hash bytea)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.proposals (id, ward_id, kind, title, body)
  values (coalesce(p_id, gen_random_uuid()), p_ward, p_kind, p_title, p_body) returning id into v_id;
  -- the author is the first supporter
  insert into public.proposal_supports (proposal_id, voter_hash) values (v_id, p_voter_hash);
  return v_id;
end;
$$;

-- 'ok' | 'duplicate' | 'closed' | 'not_found'
create function public.svc_support_proposal(p_id uuid, p_voter_hash bytea)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  select status into v_status from public.proposals where id = p_id;
  if not found then return 'not_found'; end if;
  if v_status not in ('submitted', 'under_review') then return 'closed'; end if;
  insert into public.proposal_supports (proposal_id, voter_hash) values (p_id, p_voter_hash);
  return 'ok';
exception when unique_violation then
  return 'duplicate';
end;
$$;

-- ---- reports ----------------------------------------------------------------------------------------------------------
-- Idempotent on client_key, so an offline queue that retries never creates a second case.
-- Routing, priority and both SLA timers are stamped by the trigger on insert.

create function public.svc_create_report(
  p_id uuid, p_client_key uuid, p_ward text, p_category text, p_description text,
  p_lat numeric, p_lng numeric, p_language text, p_channel text,
  p_callback_phone text default null, p_photo_paths text[] default '{}'
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.reports;
  p text;
begin
  if p_client_key is not null then
    select * into r from public.reports where client_key = p_client_key;
    if found then
      return jsonb_build_object('reference', r.reference, 'ward_id', r.ward_id, 'status', r.status, 'duplicate', true);
    end if;
  end if;

  insert into public.reports (id, client_key, ward_id, category_id, description, lat, lng, language, channel)
  values (coalesce(p_id, gen_random_uuid()), p_client_key, p_ward, p_category, p_description, p_lat, p_lng, p_language, p_channel)
  returning * into r;

  foreach p in array coalesce(p_photo_paths, '{}') loop
    insert into public.report_photos (report_id, storage_path) values (r.id, p);
  end loop;
  if p_callback_phone is not null then
    insert into private.report_contacts (report_id, phone_e164) values (r.id, p_callback_phone);
  end if;
  return jsonb_build_object('reference', r.reference, 'ward_id', r.ward_id, 'status', r.status, 'duplicate', false);
exception when unique_violation then
  -- a concurrent retry of the same client_key won the race
  select * into r from public.reports where client_key = p_client_key;
  if found then
    return jsonb_build_object('reference', r.reference, 'ward_id', r.ward_id, 'status', r.status, 'duplicate', true);
  end if;
  raise;
end;
$$;

-- ---- payments ---------------------------------------------------------------------------------------------------------
-- The server decides what is owed. The browser only says WHICH application to pay for.

create function public.svc_payment_prepare(p_application uuid, p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.applications;
  v_service text;
begin
  select * into a from public.applications where id = p_application and applicant_id = p_user;
  if not found then return jsonb_build_object('status', 'not_found'); end if;
  if a.status <> 'awaiting_payment' or a.amount <= 0 then return jsonb_build_object('status', 'not_payable'); end if;
  if exists (select 1 from public.payments p
              where p.application_id = a.id and p.status = 'pending' and p.created_at > now() - interval '2 minutes') then
    return jsonb_build_object('status', 'pending_exists');
  end if;
  select name into v_service from public.services where id = a.service_id;
  return jsonb_build_object('status', 'ok', 'reference', a.reference, 'amount', a.amount, 'service', v_service);
end;
$$;

create function public.svc_payment_record(p_application uuid, p_user uuid, p_checkout text, p_amount numeric, p_last4 text)
returns uuid
language sql
security definer
set search_path = ''
as $$
  insert into public.payments (application_id, payer_id, checkout_request_id, amount, phone_last4, status, stream)
  values (p_application, p_user, p_checkout, p_amount, p_last4, 'pending', 'services')
  returning id;
$$;

-- Called by the M-Pesa callback. 'completed' | 'failed' | 'already' | 'unknown' | 'amount_mismatch' | 'invalid'.
-- Idempotent: Safaricom retries callbacks, and a second delivery must change nothing.
create function public.svc_payment_settle(p_checkout text, p_result_code int, p_receipt text, p_amount numeric, p_last4 text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.payments;
  a public.applications;
begin
  select * into p from public.payments where checkout_request_id = p_checkout for update;
  if not found then return 'unknown'; end if;
  if p.status <> 'pending' then return 'already'; end if;
  if p.application_id is not null then select * into a from public.applications where id = p.application_id; end if;

  if p_result_code <> 0 then
    update public.payments set status = case when p_result_code = 1037 then 'timeout' else 'failed' end where id = p.id;
    if a.id is not null then
      insert into public.notifications (user_id, title, message, kind, link)
      values (a.applicant_id, 'Payment not completed',
              'We did not receive your M-Pesa payment for ' || a.reference || '. You can try again from the application.',
              'warning', '/services/applications/' || a.id);
    end if;
    return 'failed';
  end if;

  if p_receipt is null or p_amount is null then return 'invalid'; end if;

  -- Money arrived but not the amount we asked for: leave the payment pending and put the receipt in front of finance.
  if p_amount is distinct from p.amount then
    insert into public.revenue_entries (reference, amount, stream, source, reconciled)
    values (p_receipt, p_amount, 'unallocated', 'mpesa', false)
    on conflict (reference) do nothing;
    return 'amount_mismatch';
  end if;

  begin
    update public.payments
       set status = 'completed', mpesa_receipt = p_receipt, phone_last4 = coalesce(p_last4, phone_last4), completed_at = now()
     where id = p.id;
  exception when unique_violation then
    return 'already';   -- the same receipt was already recorded
  end;

  insert into public.revenue_entries (reference, amount, stream, source, payment_id, reconciled)
  values (p_receipt, p.amount, p.stream, 'mpesa', p.id, true)
  on conflict (reference) do nothing;

  if a.id is not null and a.status = 'awaiting_payment' then
    update public.applications set status = 'submitted' where id = a.id;
    insert into public.notifications (user_id, title, message, kind, link)
    values (a.applicant_id, 'Payment received',
            'KES ' || to_char(p.amount, 'FM999,999,990') || ' received. Your application ' || a.reference || ' is now with the county.',
            'success', '/services/applications/' || a.id);
  end if;
  return 'completed';
end;
$$;

-- Paybill (C2B) confirmation. If the account number is an application reference that is waiting for exactly this
-- amount, the application is paid. Anything else is recorded as unallocated revenue for finance to place.
-- 'matched' | 'recorded' | 'duplicate'
create function public.svc_c2b_record(p_trans_id text, p_amount numeric, p_bill_ref text, p_payer_name text default null, p_time timestamptz default now())
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.applications;
  v_pay uuid;
begin
  if exists (select 1 from public.revenue_entries where reference = p_trans_id) then return 'duplicate'; end if;

  select * into a from public.applications
   where reference = upper(trim(coalesce(p_bill_ref, ''))) and status = 'awaiting_payment'
   for update;
  if found and a.amount = p_amount then
    insert into public.payments (application_id, payer_id, amount, status, mpesa_receipt, stream, completed_at)
    values (a.id, a.applicant_id, p_amount, 'completed', p_trans_id, 'services', now())
    returning id into v_pay;
    insert into public.revenue_entries (reference, amount, payer_name, stream, source, payment_id, reconciled, received_at)
    values (p_trans_id, p_amount, p_payer_name, 'services', 'mpesa', v_pay, true, p_time);
    update public.applications set status = 'submitted' where id = a.id;
    insert into public.notifications (user_id, title, message, kind, link)
    values (a.applicant_id, 'Payment received',
            'KES ' || to_char(p_amount, 'FM999,999,990') || ' received. Your application ' || a.reference || ' is now with the county.',
            'success', '/services/applications/' || a.id);
    return 'matched';
  end if;

  insert into public.revenue_entries (reference, amount, payer_name, stream, source, reconciled, received_at)
  values (p_trans_id, p_amount, p_payer_name, 'unallocated', 'mpesa', false, p_time);
  return 'recorded';
end;
$$;

-- ---- outgoing messages -------------------------------------------------------------------------------------------------

create function public.svc_outbox_claim(p_limit int default 25)
returns table (id uuid, channel text, recipient text, subject text, body text, attempts int, related jsonb)
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- give back anything a crashed worker left half-sent
  update private.outbox set status = 'queued' where status = 'sending' and claimed_at < now() - interval '10 minutes';
  return query
  with due as (
    select o.id from private.outbox o
     where o.status = 'queued' and o.run_after <= now()
     order by o.created_at
     limit greatest(p_limit, 1)
     for update skip locked
  )
  update private.outbox o set status = 'sending', claimed_at = now()
    from due where o.id = due.id
  returning o.id, o.channel, o.recipient, o.subject, o.body, o.attempts, o.related;
end;
$$;

-- Success, or a failure that is retried with a growing delay and abandoned after five attempts.
create function public.svc_outbox_done(p_id uuid, p_ok boolean, p_error text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  if p_ok then
    update private.outbox set status = 'sent', sent_at = now(), last_error = null where id = p_id;
    return;
  end if;
  select attempts + 1 into n from private.outbox where id = p_id;
  update private.outbox
     set attempts = n,
         last_error = left(p_error, 300),
         status = case when n >= 5 then 'failed' else 'queued' end,
         run_after = now() + make_interval(mins => (5 * n * n))
   where id = p_id;
end;
$$;

-- An approved alert goes to every verified subscriber of its ward (everyone, if it is county-wide).
-- Official alerts ignore the subscriber's digest frequency: a water shut-off is not a weekly summary.
create function public.svc_dispatch_alerts()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.alerts;
  n int;
  total int := 0;
  v_name text;
begin
  select c.name into v_name from public.county c limit 1;
  for a in select * from public.alerts where status = 'approved' order by created_at for update skip locked loop
    insert into private.outbox (channel, recipient, body, related)
    select 'sms', s.phone_e164, left(coalesce(v_name, 'County') || ': ' || a.body || ' Reply STOP to opt out.', 480), jsonb_build_object('alert_id', a.id)
      from (select distinct x.phone_e164 from private.subscribers x
             where x.verified_at is not null and x.opted_out_at is null
               and (a.ward_id is null or x.ward_id = a.ward_id)) s;
    get diagnostics n = row_count;
    update public.alerts set status = 'sent', sent_at = now(), recipients = n where id = a.id;
    total := total + n;
  end loop;
  return total;
end;
$$;

-- Short SMS summaries for people who chose "daily" or "weekly" instead of instant alerts.
create function public.svc_ward_updates(p_frequency text)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_days int := case p_frequency when 'daily' then 1 when 'weekly' then 7 else null end;
  v_name text;
  v_url text;
  w record;
  n int;
  total int := 0;
begin
  if v_days is null then return 0; end if;
  select c.name, c.settings ->> 'web_url' into v_name, v_url from public.county c limit 1;
  for w in
    select ward.id, ward.name,
           (select count(*) from public.reports r where r.ward_id = ward.id and r.resolved_at >= now() - make_interval(days => v_days)) as fixed,
           (select count(*) from public.reports r where r.ward_id = ward.id and r.status not in ('resolved', 'closed', 'rejected')) as open_now
      from public.wards ward
     where exists (select 1 from private.subscribers s
                    where s.ward_id = ward.id and s.frequency = p_frequency and s.verified_at is not null and s.opted_out_at is null)
  loop
    insert into private.outbox (channel, recipient, body, related)
    select 'sms', s.phone_e164,
           left(format('%s, %s %s: %s problem%s fixed, %s still open.%s Reply STOP to opt out.',
                       w.name, coalesce(v_name, 'County'), case p_frequency when 'daily' then 'today' else 'this week' end,
                       w.fixed, case when w.fixed = 1 then '' else 's' end, w.open_now,
                       case when v_url is null then '' else ' ' || v_url end), 480),
           jsonb_build_object('ward_id', w.id, 'frequency', p_frequency)
      from private.subscribers s
     where s.ward_id = w.id and s.frequency = p_frequency and s.verified_at is not null and s.opted_out_at is null;
    get diagnostics n = row_count;
    total := total + n;
  end loop;
  return total;
end;
$$;

-- ---- escalation ladder: run it, then tell the right people ------------------------------------------------------------

create function public.svc_escalate()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  e record;
  r public.reports;
  w public.wards;
  v_name text;
  v_url text;
  v_cat text;
  v_ref text;
  v_msg text;
  n int;
  total int := 0;
begin
  select c.name, c.settings ->> 'console_url' into v_name, v_url from public.county c limit 1;
  for e in select * from public.run_escalations() loop
    select * into r from public.reports where id = e.report_id;
    select * into w from public.wards where id = r.ward_id;
    select name into v_cat from public.report_categories where id = r.category_id;
    v_ref := format('%s (%s, %s)', r.reference, coalesce(v_cat, 'Report'), w.name);
    v_msg := case e.level
      when 1 then 'Reminder: case ' || v_ref || ' has not been acknowledged yet.'
      when 2 then 'Case ' || v_ref || ' has waited more than 5 working days without being acknowledged.'
      when 3 then 'Case ' || v_ref || ' has passed its target date.'
      else        'Case ' || v_ref || ' is more than 30 days past its target date and has been escalated to the CEC member and Assembly committee.'
    end || case when v_url is null then '' else ' ' || v_url || '/cases/' || r.id end;

    with recips as (
      select distinct s.user_id
        from public.staff_roles s
       where s.active and (s.expires_at is null or s.expires_at > now())
         and (   (e.level = 1 and r.assigned_to is not null and s.user_id = r.assigned_to)
              or (e.level = 1 and s.role = 'ward_admin' and s.ward_id = r.ward_id)
              or (e.level = 1 and r.assigned_to is null and s.role = 'officer' and s.department_id = r.department_id)
              or (e.level = 2 and s.role = 'sub_county_admin' and s.sub_county_id = w.sub_county_id)
              or (e.level = 3 and s.role = 'chief_officer' and s.department_id = r.department_id)
              or (e.level >= 4 and s.role in ('admin', 'assembly_member')))
    ), contacts as (
      -- email where they have one; otherwise the phone they signed in with (assembly members)
      select 'email' as channel, u.email as recipient from recips join auth.users u on u.id = recips.user_id where u.email is not null
      union
      select 'sms', p.phone from recips join public.profiles p on p.id = recips.user_id
       where p.phone is not null and not exists (select 1 from auth.users u where u.id = recips.user_id and u.email is not null)
    )
    insert into private.outbox (channel, recipient, subject, body, related)
    select c.channel, c.recipient,
           case when c.channel = 'email' then format('[%s] %s', coalesce(v_name, 'County'), 'Case ' || r.reference || ' needs attention') end,
           case when c.channel = 'sms' then left(coalesce(v_name, 'County') || ': ' || v_msg, 320) else v_msg end,
           jsonb_build_object('report_id', r.id, 'level', e.level)
      from contacts c;
    get diagnostics n = row_count;
    total := total + n;
  end loop;
  return total;
end;
$$;

-- ---- digests to oversight bodies ---------------------------------------------------------------------------------------------
-- kind: assembly | controller_of_budget | auditor_general | executive (| ward | department, no recipients).
-- Recipients come from county.settings.digest_recipients = { "<kind>": ["email", ...] }.
-- Assembly and executive digests name the officer holding a case that is 30+ days late; the two audit bodies
-- see departments only. Each recipient gets a link that records when it was opened.
create function public.svc_build_digest(p_kind text, p_start date, p_end date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_name text;
  v_named boolean := p_kind in ('assembly', 'executive');
  v_received int; v_resolved int; v_open int; v_overdue int;
  v_apps_in int; v_apps_out int;
  v_stalled int; v_over_budget int;
  v_rev numeric; v_unmatched int;
  v_dept text; v_top text; v_body text;
  v_emails jsonb;
  v_tok record;
begin
  select id into v_id from public.digests where kind = p_kind and period_start = p_start and period_end = p_end;
  if found then return v_id; end if;
  select c.name, c.settings -> 'digest_recipients' -> p_kind into v_name, v_emails from public.county c limit 1;

  select count(*) filter (where created_at::date between p_start and p_end),
         count(*) filter (where resolved_at::date between p_start and p_end),
         count(*) filter (where status not in ('resolved', 'closed', 'rejected')),
         count(*) filter (where status not in ('resolved', 'closed', 'rejected') and resolve_due_at < now())
    into v_received, v_resolved, v_open, v_overdue
    from public.reports;
  select count(*) filter (where created_at::date between p_start and p_end),
         count(*) filter (where decided_at::date between p_start and p_end)
    into v_apps_in, v_apps_out from public.applications;
  select count(*) filter (where status = 'stalled'), count(*) filter (where spent > budget * 1.02)
    into v_stalled, v_over_budget from public.projects where published;
  select coalesce(sum(amount), 0), count(*) filter (where not reconciled)
    into v_rev, v_unmatched from public.revenue_entries where received_at::date between p_start and p_end;

  select coalesce(string_agg(format('- %s: %s overdue, longest wait %s days', d.name, x.n, x.longest), E'\n' order by x.n desc), '- None')
    into v_dept
    from (select r.department_id, count(*) n, max(extract(day from now() - r.resolve_due_at))::int longest
            from public.reports r
           where r.status not in ('resolved', 'closed', 'rejected') and r.resolve_due_at < now() group by r.department_id) x
    join public.departments d on d.id = x.department_id;

  select coalesce(string_agg(format('- %s · %s · %s · %s days late · %s', r.reference, coalesce(c.name, 'Report'), w.name,
                                    extract(day from now() - r.resolve_due_at)::int,
                                    case when v_named then coalesce(nullif(pr.name, ''), d.name, 'unassigned') else coalesce(d.name, 'unassigned') end),
                           E'\n' order by r.resolve_due_at), '- None')
    into v_top
    from public.reports r
    join public.wards w on w.id = r.ward_id
    left join public.report_categories c on c.id = r.category_id
    left join public.departments d on d.id = r.department_id
    left join public.profiles pr on pr.id = r.assigned_to
   where r.status not in ('resolved', 'closed', 'rejected') and r.resolve_due_at < now() - interval '30 days';

  v_body := format(E'# %s County service digest, %s to %s\n\n', coalesce(v_name, 'County'), p_start, p_end)
         || format(E'**Cases:** %s received, %s resolved, %s open, **%s overdue**.\n', v_received, v_resolved, v_open, v_overdue)
         || format(E'**Applications:** %s received, %s decided.\n', v_apps_in, v_apps_out)
         || format(E'**Projects:** %s stalled, %s over budget.\n', v_stalled, v_over_budget)
         || format(E'**Revenue:** KES %s collected, %s payments not yet matched.\n\n', to_char(v_rev, 'FM999,999,999,990'), v_unmatched)
         || format(E'## Overdue by department\n%s\n\n## More than 30 days late\n%s\n', v_dept, v_top);

  insert into public.digests (kind, period_start, period_end, body_md, payload)
  values (p_kind, p_start, p_end, v_body,
          jsonb_build_object('received', v_received, 'resolved', v_resolved, 'open', v_open, 'overdue', v_overdue,
                             'applications_received', v_apps_in, 'applications_decided', v_apps_out,
                             'stalled_projects', v_stalled, 'over_budget_projects', v_over_budget, 'revenue', v_rev))
  returning id into v_id;

  if v_emails is not null and jsonb_typeof(v_emails) = 'array' then
    for v_tok in
      with ins as (
        insert into public.digest_recipients (digest_id, email)
        select v_id, lower(trim(e)) from jsonb_array_elements_text(v_emails) e where position('@' in e) > 1
        returning email, open_token
      ) select * from ins
    loop
      insert into private.outbox (channel, recipient, subject, body, related)
      values ('email', v_tok.email, format('[%s] Service digest %s to %s', coalesce(v_name, 'County'), p_start, p_end),
              v_body || E'\nOpen the full digest: {{open_url}}\n', jsonb_build_object('digest_id', v_id, 'open_token', v_tok.open_token));
    end loop;
  end if;
  return v_id;
end;
$$;

-- The link in a digest email: counts the open, and says which recipient it was.
create function public.svc_digest_opened(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.digest_recipients
     set open_count = open_count + 1, first_opened_at = coalesce(first_opened_at, now())
   where open_token = p_token;
  return found;
end;
$$;

-- ---- staff accounts created outside the console ---------------------------------------------------------------------------------

-- Same rule as private.mfa_ok(), but for a session the Edge Function has already verified
-- (it passes the token's `aal` claim). Returns true if the user holds any of the roles.
create function public.svc_staff_check(p_user uuid, p_roles text[], p_aal text default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff_roles r
     where r.user_id = p_user and r.active and (r.expires_at is null or r.expires_at > now())
       and r.role = any (p_roles)
       and (coalesce((select c.settings ->> 'require_staff_mfa' from public.county c limit 1), 'false') <> 'true' or p_aal = 'aal2')
  );
$$;

create function public.svc_invite_create(p_token_hash bytea, p_email text, p_org text, p_days int, p_created_by uuid)
returns uuid
language sql
security definer
set search_path = ''
as $$
  insert into public.auditor_invites (token_hash, email, organisation, expires_at, created_by)
  values (p_token_hash, lower(trim(p_email)), p_org, now() + make_interval(days => p_days), p_created_by)
  returning id;
$$;

create function public.svc_invite_check(p_token_hash bytea, p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.auditor_invites i
                  where i.token_hash = p_token_hash and i.used_at is null and i.expires_at > now()
                    and i.email = lower(trim(p_email)));
$$;

-- Uses the invitation (once) and gives the new account a time-limited auditor role.
create function public.svc_accept_invite(p_token_hash bytea, p_email text, p_user uuid, p_access_days int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  update public.auditor_invites set used_at = now()
   where token_hash = p_token_hash and used_at is null and expires_at > now() and email = lower(trim(p_email))
  returning id into v_id;
  if v_id is null then return false; end if;
  perform public.grant_staff_role(p_user, 'auditor', null, null, null, now() + make_interval(days => p_access_days));
  return true;
end;
$$;

create function public.svc_kra_record(p_contractor uuid, p_compliant boolean)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.contractors set kra_compliant = p_compliant, kra_checked_at = now() where id = p_contractor;
$$;

-- ---- AI spend control ---------------------------------------------------------------------------------------------------------------

-- The department a staff member's AI use is billed to: the department on their role, else the county-wide pool.
create function public.svc_ai_department(p_user uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select r.department_id from public.staff_roles r
   where r.user_id = p_user and r.active and (r.expires_at is null or r.expires_at > now()) and r.department_id is not null
   order by r.created_at limit 1;
$$;

-- Cap for this month: the department's own budget, else the county-wide one, else settings.ai_default_cap_kes, else nothing.
create function public.svc_ai_check(p_department uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', now())::date;
  v_cap numeric;
  v_spent numeric;
begin
  select cap_kes into v_cap from public.ai_budgets where department_id is not distinct from p_department and month = v_month;
  if v_cap is null then select cap_kes into v_cap from public.ai_budgets where department_id is null and month = v_month; end if;
  if v_cap is null then
    select coalesce((c.settings ->> 'ai_default_cap_kes')::numeric, 0) into v_cap from public.county c limit 1;
  end if;
  v_spent := private.ai_spend_mtd(p_department);
  return jsonb_build_object('spent', v_spent, 'cap', coalesce(v_cap, 0), 'allowed', v_spent < coalesce(v_cap, 0));
end;
$$;

create function public.svc_ai_log(p_task text, p_model text, p_side text, p_department uuid, p_actor uuid,
                                  p_tokens_in int, p_tokens_out int, p_cost_kes numeric, p_ok boolean, p_redactions int)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.ai_calls (task, model, side, department_id, actor_id, tokens_in, tokens_out, cost_kes, ok, redactions)
  values (p_task, p_model, p_side, p_department, p_actor, p_tokens_in, p_tokens_out, p_cost_kes, p_ok, p_redactions);
$$;

-- ---- grants: service role only --------------------------------------------------------------------------------------------------------------

do $$
declare
  f regprocedure;
begin
  for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname like 'svc\_%' loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

-- ---- the AI assistant's questions ---------------------------------------------------------------------------------------------------------
-- The model never writes SQL. It picks one of these named questions and fills in the parameters; the gateway
-- runs it as the person asking, so row-level security decides what they may see. Small, fixed, read-only.

create function public.ai_cases_by_ward(p_category text default null, p_open_only boolean default true, p_limit int default 10)
returns table (ward text, cases bigint)
language sql
stable
set search_path = ''
as $$
  select w.name, count(*)
    from public.reports r join public.wards w on w.id = r.ward_id
   where (p_category is null or r.category_id = p_category)
     and (not p_open_only or r.status not in ('resolved', 'closed', 'rejected'))
   group by w.name order by 2 desc, 1
   limit least(greatest(p_limit, 1), 50);
$$;

create function public.ai_overdue_by_department(p_min_days int default 1)
returns table (department text, overdue bigint, longest_days int)
language sql
stable
set search_path = ''
as $$
  select coalesce(d.name, 'Unassigned'), count(*), max(extract(day from now() - r.resolve_due_at))::int
    from public.reports r left join public.departments d on d.id = r.department_id
   where r.status not in ('resolved', 'closed', 'rejected')
     and r.resolve_due_at < now() - make_interval(days => greatest(p_min_days, 0))
   group by d.name order by 2 desc;
$$;

create function public.ai_revenue_by_stream(p_days int default 30)
returns table (stream text, collected numeric, payments bigint)
language sql
stable
set search_path = ''
as $$
  select e.stream, sum(e.amount), count(*)
    from public.revenue_entries e
   where e.received_at >= now() - make_interval(days => least(greatest(p_days, 1), 366))
   group by e.stream order by 2 desc;
$$;

create function public.ai_sla_performance(p_days int default 30)
returns table (category text, received bigint, resolved_on_time_pct numeric, median_hours_to_acknowledge numeric)
language sql
stable
set search_path = ''
as $$
  select coalesce(c.name, r.category_id, 'Uncategorised'),
         count(*),
         round(100.0 * count(*) filter (where r.resolved_at is not null and r.resolved_at <= r.resolve_due_at) / nullif(count(*) filter (where r.resolved_at is not null), 0), 1),
         round((percentile_cont(0.5) within group (order by extract(epoch from (r.acknowledged_at - r.created_at)) / 3600))::numeric, 1)
    from public.reports r left join public.report_categories c on c.id = r.category_id
   where r.created_at >= now() - make_interval(days => least(greatest(p_days, 1), 366))
   group by 1 order by 2 desc;
$$;

create function public.ai_projects_by_status()
returns table (status text, projects bigint, budget numeric, spent numeric)
language sql
stable
set search_path = ''
as $$
  select p.status, count(*), sum(p.budget), sum(p.spent) from public.projects p group by p.status order by 2 desc;
$$;

revoke all on function public.ai_cases_by_ward(text, boolean, int), public.ai_overdue_by_department(int),
  public.ai_revenue_by_stream(int), public.ai_sla_performance(int), public.ai_projects_by_status() from public, anon;
grant execute on function public.ai_cases_by_ward(text, boolean, int), public.ai_overdue_by_department(int),
  public.ai_revenue_by_stream(int), public.ai_sla_performance(int), public.ai_projects_by_status() to authenticated;

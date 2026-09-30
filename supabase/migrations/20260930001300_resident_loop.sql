-- The resident loop (migration 0013): "Was it fixed?" feedback and reopening, SMS when a case or application moves,
-- and verification codes for permits and receipts.

-- ---- "Was it fixed?" ----------------------------------------------------------------------------------------------

alter table public.reports add column reopened_count int not null default 0;

alter table public.report_events drop constraint report_events_kind_check;
alter table public.report_events add constraint report_events_kind_check
  check (kind in ('created', 'triaged', 'assigned', 'status', 'note', 'public_message', 'reminder', 'escalated', 'merged', 'feedback', 'reopened'));

create table public.case_feedback (
  id         uuid primary key default gen_random_uuid(),
  report_id  uuid not null references public.reports (id) on delete cascade,
  fixed      boolean not null,
  comment    text check (char_length(comment) <= 500),
  created_at timestamptz not null default now()
);
create index case_feedback_report_idx on public.case_feedback (report_id, created_at);
alter table public.case_feedback enable row level security;
-- No policies: nobody reads or writes this table directly. Staff see the totals below; the public sees the totals too.

-- Called only by the case-feedback Edge Function. 'ok' | 'not_found' | 'not_resolved' | 'duplicate'.
-- A "no, still not fixed" answer reopens the case, puts it back with its team and starts a new target.
create function public.svc_case_feedback(p_reference text, p_fixed boolean, p_comment text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r public.reports;
  v_comment text := nullif(left(trim(coalesce(p_comment, '')), 500), '');
begin
  select r.* into v_r from public.reports r where r.reference = upper(trim(p_reference)) for update;
  if not found then return 'not_found'; end if;
  if v_r.status not in ('resolved', 'closed') then return 'not_resolved'; end if;
  if exists (select 1 from public.case_feedback f where f.report_id = v_r.id and f.created_at >= coalesce(v_r.resolved_at, v_r.created_at)) then
    return 'duplicate';
  end if;

  insert into public.case_feedback (report_id, fixed, comment) values (v_r.id, p_fixed, v_comment);
  insert into public.report_events (report_id, kind, is_public, message, data)
  values (v_r.id, 'feedback', true,
          case when p_fixed then 'The resident confirmed it was fixed.' else 'The resident says it is not fixed.' end
            || coalesce(' "' || v_comment || '"', ''),
          jsonb_build_object('fixed', p_fixed));

  if not p_fixed then
    update public.reports
       set status = 'in_progress', resolved_at = null, reopened_count = reopened_count + 1,
           resolve_due_at = private.add_sla(now(), 72, 'hours'), escalation_level = 0, last_escalated_at = null
     where id = v_r.id;
    insert into public.report_events (report_id, kind, is_public, message, data)
    values (v_r.id, 'reopened', true, 'Reopened at the resident''s request.', jsonb_build_object('status', 'in_progress'));
  end if;
  return 'ok';
end;
$$;
revoke all on function public.svc_case_feedback(text, boolean, text) from public, anon, authenticated;

-- How often the county's "resolved" turns out to be true, county-wide and by ward. Public.
create function public.fix_confirmation_stats()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'responses', (select count(*) from public.case_feedback),
    'fixed', (select count(*) from public.case_feedback where fixed),
    'reopened', (select count(*) from public.case_feedback where not fixed),
    'by_ward', coalesce((
      select jsonb_agg(x order by x.responses desc, x.ward)
      from (
        select w.id as ward_id, w.name as ward, count(*) as responses, count(*) filter (where f.fixed) as fixed
        from public.case_feedback f
        join public.reports r on r.id = f.report_id
        join public.wards w on w.id = r.ward_id
        group by w.id, w.name
      ) x), '[]'::jsonb));
$$;
grant execute on function public.fix_confirmation_stats() to anon, authenticated;

-- The public status page now also says whether feedback has been given for the latest resolution.
create or replace function public.case_status(p_reference text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'reference', r.reference,
    'status', r.status,
    'category_id', r.category_id,
    'category', c.name,
    'category_sw', c.name_sw,
    'ward', w.name,
    'ward_id', r.ward_id,
    'created_at', r.created_at,
    'updated_at', r.updated_at,
    'resolve_due_at', r.resolve_due_at,
    'project_slug', p.slug,
    'reopened_count', r.reopened_count,
    'feedback_given', exists (select 1 from public.case_feedback f where f.report_id = r.id and f.created_at >= coalesce(r.resolved_at, r.created_at) and r.status in ('resolved', 'closed')),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object('kind', e.kind, 'message', e.message, 'at', e.created_at) order by e.created_at)
      from public.report_events e where e.report_id = r.id and e.is_public), '[]'::jsonb))
  from public.reports r
  join public.wards w on w.id = r.ward_id
  left join public.report_categories c on c.id = r.category_id
  left join public.projects p on p.id = r.project_id and p.published
  where r.reference = upper(trim(p_reference));
$$;

-- ---- SMS when a case moves ----------------------------------------------------------------------------------------
-- One rule for every path (staff action, escalation, reopening): a public timeline event reaches the reporter.

create function private.notify_report_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text;
  v_ref text;
  v_url text;
  v_line text;
begin
  if not new.is_public or new.kind not in ('status', 'public_message', 'reopened') then return new; end if;
  select c.phone_e164 into v_phone from private.report_contacts c where c.report_id = new.report_id;
  if v_phone is null then return new; end if;
  select r.reference into v_ref from public.reports r where r.id = new.report_id;
  select c.settings ->> 'web_url' into v_url from public.county c limit 1;
  v_line := case
    when new.kind = 'status' then initcap(replace(coalesce(new.data ->> 'status', 'updated'), '_', ' '))
    else null end;
  insert into private.outbox (channel, recipient, body, related)
  values ('sms', v_phone,
          'County update ' || v_ref || ': ' || coalesce(v_line, '') || case when v_line is not null and new.message is not null then ' - ' else '' end
            || coalesce(new.message, '') || case when v_url is not null then ' ' || v_url || '/case/' || v_ref else '' end,
          jsonb_build_object('report_id', new.report_id, 'event', new.kind));
  return new;
end;
$$;
create trigger report_events_notify after insert on public.report_events
  for each row execute function private.notify_report_event();

-- case_transition no longer sends its own SMS (the trigger above does, for every path).
create or replace function public.case_transition(
  p_report uuid,
  p_status text,
  p_message text default null,
  p_public boolean default false
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r public.reports;
begin
  if p_status not in ('triaged', 'assigned', 'in_progress', 'resolved', 'closed', 'rejected') then
    raise exception 'Invalid status %', p_status using errcode = '22023';
  end if;
  select r.* into v_r from public.reports r where r.id = p_report for update;
  if not found then raise exception 'Case not found' using errcode = 'P0002'; end if;
  if not private.can_work_case(v_r.ward_id, v_r.department_id, v_r.assigned_to) then
    raise exception 'Not allowed to work this case' using errcode = '42501';
  end if;

  update public.reports
     set status = p_status,
         acknowledged_at = coalesce(acknowledged_at, now()),
         resolved_at = case when p_status in ('resolved', 'closed') then coalesce(resolved_at, now()) else resolved_at end
   where id = p_report;

  insert into public.report_events (report_id, kind, actor_id, is_public, message, data)
  values (p_report, 'status', (select auth.uid()), p_public, p_message, jsonb_build_object('status', p_status));
end;
$$;

-- ---- permits and receipts you can check ---------------------------------------------------------------------------

alter table public.applications
  add column verify_code text unique,
  add column revoked_at timestamptz,
  add column revoked_reason text;

-- Short, readable, no look-alike characters: CY-XXXX-XXXX.
create function private.new_verify_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
  v_bytes bytea;
begin
  loop
    v_bytes := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
    v_code := 'CY-' || (select string_agg(substr(alphabet, 1 + (get_byte(v_bytes, i) % 31), 1), '' order by i) from generate_series(0, 3) i)
              || '-' || (select string_agg(substr(alphabet, 1 + (get_byte(v_bytes, i) % 31), 1), '' order by i) from generate_series(4, 7) i);
    exit when not exists (select 1 from public.applications a where a.verify_code = v_code);
  end loop;
  return v_code;
end;
$$;

create function private.applications_verify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not private.is_staff()
     and (new.verify_code is distinct from old.verify_code or new.revoked_at is distinct from old.revoked_at or new.revoked_reason is distinct from old.revoked_reason) then
    raise exception 'Protected application fields cannot be changed' using errcode = '42501';
  end if;
  if new.status = 'approved' and old.status is distinct from 'approved' and new.verify_code is null then
    new.verify_code := private.new_verify_code();
  end if;
  return new;
end;
$$;
create trigger applications_verify before update on public.applications
  for each row execute function private.applications_verify();

-- Anyone holding a code (printed on a permit or receipt, or scanned from its QR) can check it. Reveals only what is
-- printed on the document: no ID numbers, no phone numbers.
create function public.verify_document(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_code text := upper(trim(coalesce(p_code, '')));
  v_a record;
  v_p record;
begin
  if char_length(v_code) < 6 or char_length(v_code) > 40 then return jsonb_build_object('valid', false, 'kind', null); end if;

  select a.reference, a.business_name, a.decided_at, a.revoked_at, a.revoked_reason, a.status, s.name as service, w.name as ward
    into v_a
    from public.applications a
    join public.services s on s.id = a.service_id
    left join public.wards w on w.id = a.ward_id
   where a.verify_code = v_code;
  if found then
    return jsonb_build_object(
      'kind', 'permit',
      'valid', v_a.status = 'approved' and v_a.revoked_at is null,
      'state', case when v_a.revoked_at is not null then 'revoked' when v_a.status = 'approved' then 'valid' else 'not_valid' end,
      'service', v_a.service, 'holder', v_a.business_name, 'ward', v_a.ward, 'issued_at', v_a.decided_at,
      'reference', v_a.reference, 'revoked_at', v_a.revoked_at, 'revoked_reason', v_a.revoked_reason);
  end if;

  select p.mpesa_receipt, p.amount, p.stream, p.completed_at, p.status into v_p
    from public.payments p where p.mpesa_receipt = v_code;
  if found then
    return jsonb_build_object(
      'kind', 'receipt', 'valid', v_p.status = 'completed', 'state', case when v_p.status = 'completed' then 'valid' else 'not_valid' end,
      'amount', v_p.amount, 'stream', v_p.stream, 'issued_at', v_p.completed_at, 'reference', v_p.mpesa_receipt);
  end if;

  return jsonb_build_object('valid', false, 'kind', null, 'state', 'unknown');
end;
$$;
grant execute on function public.verify_document(text) to anon, authenticated;

-- An administrator can withdraw a permit (fraud, error). The holder is told and the code then reads "revoked".
create function public.revoke_document(p_application uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a public.applications;
begin
  if not private.is_admin() then raise exception 'Only an administrator can revoke a permit' using errcode = '42501'; end if;
  if char_length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'Say why' using errcode = '22023'; end if;
  select a.* into v_a from public.applications a where a.id = p_application for update;
  if not found or v_a.verify_code is null then raise exception 'No issued permit' using errcode = 'P0002'; end if;
  update public.applications set revoked_at = now(), revoked_reason = trim(p_reason) where id = p_application;
  insert into public.notifications (user_id, title, message, kind, link)
  values (v_a.applicant_id, 'Permit ' || v_a.reference, 'This permit was withdrawn: ' || trim(p_reason), 'error', '/services/applications/' || v_a.id);
end;
$$;
grant execute on function public.revoke_document(uuid, text) to authenticated;

-- ---- SMS when an application moves --------------------------------------------------------------------------------

create function private.notify_application_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text;
  v_url text;
  v_text text;
begin
  v_text := case new.status
    when 'approved' then 'approved. Verify it with code ' || coalesce(new.verify_code, '')
    when 'rejected' then 'not approved' || coalesce(': ' || new.decision_note, '')
    when 'changes_requested' then 'waiting for changes' || coalesce(': ' || new.decision_note, '')
    when 'under_review' then 'under review'
    else null end;
  if v_text is null then return new; end if;
  select p.phone into v_phone from public.profiles p where p.id = new.applicant_id;
  if v_phone is null or v_phone !~ '^\+[1-9][0-9]{7,14}$' then return new; end if;
  select c.settings ->> 'web_url' into v_url from public.county c limit 1;
  insert into private.outbox (channel, recipient, body, related)
  values ('sms', v_phone, 'County application ' || new.reference || ' is ' || v_text || case when v_url is not null then '. ' || v_url || '/services/applications/' || new.id else '' end,
          jsonb_build_object('application_id', new.id));
  return new;
end;
$$;
create trigger applications_notify after update of status on public.applications
  for each row when (old.status is distinct from new.status) execute function private.notify_application_change();

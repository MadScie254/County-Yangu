-- 0005  Operations: audit log, case workflow (SLA, routing, events, RPCs), escalation,
--       oversight, alerts approval, AI spend control, digests.

-- ---- audit log (append-only) -------------------------------------------------

create table public.audit_log (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  actor_id   uuid,                       -- null = system / service role
  via        text,                       -- jwt role at the time (authenticated, service_role, ...)
  action     text not null,              -- INSERT / UPDATE / DELETE
  entity     text not null,
  entity_id  text,
  before     jsonb,
  after      jsonb
);
create index audit_log_entity_idx on public.audit_log (entity, entity_id);
create index audit_log_actor_idx  on public.audit_log (actor_id, at desc);

create function private.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_new jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
begin
  insert into public.audit_log (actor_id, via, action, entity, entity_id, before, after)
  values ((select auth.uid()),
          current_setting('request.jwt.claim.role', true),
          tg_op, tg_table_name,
          coalesce(v_new ->> 'id', v_old ->> 'id'),
          v_old, v_new);
  return coalesce(new, old);
end;
$$;

-- Nobody edits history: not staff, not admins, not the service role.
create function private.audit_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_log is append-only' using errcode = '42501';
end;
$$;
create trigger audit_log_no_update before update or delete on public.audit_log
  for each row execute function private.audit_immutable();
create trigger audit_log_no_truncate before truncate on public.audit_log
  for each statement execute function private.audit_immutable();

do $$
declare t text;
begin
  foreach t in array array[
    'staff_roles', 'routing_rules', 'report_categories', 'services', 'applications',
    'projects', 'tenders', 'contractors', 'budget_cycles', 'alerts', 'proposals',
    'payments', 'revenue_entries', 'departments', 'wards'
  ] loop
    execute format('create trigger audit_%1$s after insert or update or delete on public.%1$I
                    for each row execute function private.audit_row()', t);
  end loop;
end $$;

-- Reports are audited on updates/deletes only (inserts are the high-volume path and already
-- recorded as a `created` event on the case timeline).
create trigger audit_reports after update or delete on public.reports
  for each row execute function private.audit_row();

-- ---- case workflow ------------------------------------------------------------

-- On insert: route (matrix), set priority and both SLA timers, write the first event.
create function private.route_and_stamp_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cat public.report_categories;
  v_rule public.routing_rules;
begin
  if new.category_id is not null then
    select * into v_cat from public.report_categories where id = new.category_id;
    -- most specific rule wins: ward-specific before county-wide
    select * into v_rule from public.routing_rules
     where category_id = new.category_id and (ward_id = new.ward_id or ward_id is null)
     order by (ward_id is null) asc limit 1;
  end if;

  if v_cat.id is not null then
    new.priority       := coalesce(nullif(new.priority, 'normal'), v_cat.default_priority);
    new.ack_due_at     := coalesce(new.ack_due_at,     private.add_sla(new.created_at, v_cat.ack_value, v_cat.ack_unit));
    new.resolve_due_at := coalesce(new.resolve_due_at, private.add_sla(new.created_at, v_cat.resolve_value, v_cat.resolve_unit));
    -- sensitive (integrity/finance) categories are flagged for review and routed around the ordinary chain
    if v_cat.sensitive then new.flagged_financial := true; end if;
  end if;

  if v_rule.id is not null then
    new.department_id := coalesce(new.department_id, v_rule.department_id);
    new.assigned_to   := coalesce(new.assigned_to, v_rule.officer_id);
  elsif v_cat.department_id is not null then
    new.department_id := coalesce(new.department_id, v_cat.department_id);
  end if;

  if new.assigned_to is not null and new.status = 'received' then
    new.status := 'assigned';
  end if;
  return new;
end;
$$;
create trigger reports_route_before_insert
  before insert on public.reports
  for each row execute function private.route_and_stamp_report();

create function private.report_created_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.report_events (report_id, kind, is_public, message, data)
  values (new.id, 'created', true, 'Report received',
          jsonb_build_object('channel', new.channel, 'category', new.category_id));
  if new.assigned_to is not null then
    insert into public.report_events (report_id, kind, is_public, message, data)
    values (new.id, 'assigned', false, 'Routed by rule', jsonb_build_object('assigned_to', new.assigned_to));
  end if;
  return new;
end;
$$;
create trigger reports_after_insert_event
  after insert on public.reports
  for each row execute function private.report_created_event();

create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger reports_touch before update on public.reports for each row execute function private.touch_updated_at();
create trigger projects_touch before update on public.projects for each row execute function private.touch_updated_at();
create trigger services_touch before update on public.services for each row execute function private.touch_updated_at();

-- Staff move a case along. Every call writes a timeline event; a public message
-- also reaches the reporter by SMS if they left a number.
create function public.case_transition(
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
  v_phone text;
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

  if p_public then
    select c.phone_e164 into v_phone from private.report_contacts c where c.report_id = p_report;
    if v_phone is not null then
      insert into private.outbox (channel, recipient, body, related)
      values ('sms', v_phone,
              'County update ' || v_r.reference || ': ' || p_status || coalesce(' - ' || p_message, ''),
              jsonb_build_object('report_id', p_report));
    end if;
  end if;
end;
$$;

create function public.case_assign(p_report uuid, p_officer uuid, p_department uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r public.reports;
begin
  select r.* into v_r from public.reports r where r.id = p_report for update;
  if not found then raise exception 'Case not found' using errcode = 'P0002'; end if;
  if not private.can_work_case(v_r.ward_id, v_r.department_id, v_r.assigned_to)
     or private.has_role(array['officer']) and not private.has_role(array['super_admin','admin','chief_officer','sub_county_admin','ward_admin']) then
    raise exception 'Not allowed to assign this case' using errcode = '42501';
  end if;
  update public.reports
     set assigned_to = p_officer,
         department_id = coalesce(p_department, department_id),
         status = case when status in ('received', 'triaged') then 'assigned' else status end
   where id = p_report;
  insert into public.report_events (report_id, kind, actor_id, message, data)
  values (p_report, 'assigned', (select auth.uid()), null,
          jsonb_build_object('assigned_to', p_officer, 'department_id', coalesce(p_department, v_r.department_id)));
end;
$$;

create function public.case_note(p_report uuid, p_message text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r public.reports;
begin
  select r.* into v_r from public.reports r where r.id = p_report;
  if not found then raise exception 'Case not found' using errcode = 'P0002'; end if;
  if not private.can_work_case(v_r.ward_id, v_r.department_id, v_r.assigned_to) then
    raise exception 'Not allowed to work this case' using errcode = '42501';
  end if;
  insert into public.report_events (report_id, kind, actor_id, is_public, message)
  values (p_report, 'note', (select auth.uid()), false, p_message);
end;
$$;

grant execute on function public.case_transition(uuid, text, text, boolean) to authenticated;
grant execute on function public.case_assign(uuid, uuid, uuid) to authenticated;
grant execute on function public.case_note(uuid, text) to authenticated;

-- The public status page: reveals only status, category, ward and public messages.
create function public.case_status(p_reference text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'reference', r.reference,
    'status', r.status,
    'category', c.name,
    'category_sw', c.name_sw,
    'ward', w.name,
    'ward_id', r.ward_id,
    'created_at', r.created_at,
    'updated_at', r.updated_at,
    'resolve_due_at', r.resolve_due_at,
    'project_slug', p.slug,
    'events', coalesce((
      select jsonb_agg(jsonb_build_object('kind', e.kind, 'message', e.message, 'at', e.created_at) order by e.created_at)
      from public.report_events e where e.report_id = r.id and e.is_public), '[]'::jsonb))
  from public.reports r
  join public.wards w on w.id = r.ward_id
  left join public.report_categories c on c.id = r.category_id
  left join public.projects p on p.id = r.project_id and p.published
  where r.reference = upper(trim(p_reference));
$$;

-- ---- escalation ladder -----------------------------------------------------------
-- Rules decide who is told and when; nothing here calls a model.
--   level 1  acknowledgement overdue          -> reminder to officer + supervisor
--   level 2  5 working days unacknowledged    -> sub-county administrator
--   level 3  resolve target missed            -> chief officer (and the public overdue counter)
--   level 4  30 days past target              -> CEC member and Assembly committee (named in digest)
--   level 5  monthly digest to OAG / Controller of Budget carries every case still open
-- Called hourly by the escalation-runner Edge Function.

create function public.run_escalations()
returns table (report_id uuid, level smallint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.reports;
  v_target smallint;
  v_level smallint;
begin
  if (select auth.uid()) is not null and not private.is_admin() then
    raise exception 'Only the escalation runner may call this' using errcode = '42501';
  end if;

  for r in
    select * from public.reports
     where status not in ('resolved', 'closed', 'rejected')
       and duplicate_of is null
     for update skip locked
  loop
    v_target := 0;
    if r.acknowledged_at is null and r.ack_due_at is not null and now() > r.ack_due_at then v_target := 1; end if;
    if r.acknowledged_at is null and now() > private.add_working_days(r.created_at, 5) then v_target := 2; end if;
    if r.resolve_due_at is not null and now() > r.resolve_due_at then v_target := 3; end if;
    if r.resolve_due_at is not null and now() > r.resolve_due_at + interval '30 days' then v_target := 4; end if;

    if v_target > r.escalation_level then
      update public.reports set escalation_level = v_target, last_escalated_at = now() where id = r.id;
      -- One event per level crossed, so every rung of the ladder is notified and recorded even if the
      -- runner was down for a while and the case jumped several levels at once.
      for v_level in (r.escalation_level + 1)..v_target loop
        insert into public.report_events (report_id, kind, is_public, message, data)
        values (r.id, case when v_level = 1 then 'reminder' else 'escalated' end,
                v_level >= 3,   -- from level 3 the public sees that the case is overdue (never who holds it)
                case v_level
                  when 1 then 'Reminder sent: waiting to be acknowledged'
                  when 2 then 'Escalated to the sub-county administrator'
                  when 3 then 'Past its target date; escalated to the chief officer'
                  else 'Escalated to the CEC member and Assembly committee'
                end,
                jsonb_build_object('level', v_level));
        report_id := r.id; level := v_level; return next;
      end loop;
    end if;
  end loop;
end;
$$;
grant execute on function public.run_escalations() to service_role;

-- ---- oversight (Assembly members, auditors): summaries, and named officers only where entitled ----

create function public.oversight_overdue()
returns table (
  reference text, ward text, category text, department text, days_overdue int,
  escalation_level smallint, flagged_financial boolean, officer text, created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.reference, w.name, c.name, d.name,
         greatest(0, floor(extract(epoch from (now() - r.resolve_due_at)) / 86400))::int,
         r.escalation_level, r.flagged_financial,
         -- named officer only for Assembly members and admins; auditors see the department
         case when private.has_role(array['assembly_member', 'admin', 'super_admin']) then p.name else null end,
         r.created_at
    from public.reports r
    join public.wards w on w.id = r.ward_id
    left join public.report_categories c on c.id = r.category_id
    left join public.departments d on d.id = r.department_id
    left join public.profiles p on p.id = r.assigned_to
   where private.has_role(array['assembly_member', 'auditor', 'admin', 'super_admin'])
     and r.status not in ('resolved', 'closed', 'rejected')
     and r.resolve_due_at < now()
   order by r.resolve_due_at asc;
$$;
grant execute on function public.oversight_overdue() to authenticated;

-- ---- ward alerts: draft -> pending -> approved by a second person ------------------

create function public.alert_submit(p_alert uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.alerts set status = 'pending_approval'
   where id = p_alert and created_by = (select auth.uid()) and status = 'draft';
  if not found then raise exception 'Alert not found or not a draft' using errcode = 'P0002'; end if;
end;
$$;

create function public.alert_approve(p_alert uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_role(array['super_admin', 'admin', 'chief_officer', 'sub_county_admin', 'ward_admin']) then
    raise exception 'Not allowed to approve alerts' using errcode = '42501';
  end if;
  update public.alerts
     set status = 'approved', approved_by = (select auth.uid()), approved_at = now()
   where id = p_alert and status = 'pending_approval' and created_by <> (select auth.uid());
  if not found then
    raise exception 'Alert not pending, or you wrote it (a second person must approve)' using errcode = '42501';
  end if;
end;
$$;
grant execute on function public.alert_submit(uuid), public.alert_approve(uuid) to authenticated;

-- ---- AI spend control ---------------------------------------------------------------

create table public.ai_budgets (
  id            uuid primary key default gen_random_uuid(),
  department_id uuid references public.departments (id),   -- null = county-wide default
  month         date not null,
  cap_kes       numeric(12, 2) not null check (cap_kes >= 0),
  unique nulls not distinct (department_id, month)
);

create table public.ai_calls (
  id            uuid primary key default gen_random_uuid(),
  at            timestamptz not null default now(),
  task          text not null,
  model         text not null,
  side          text not null check (side in ('citizen', 'county')),
  department_id uuid references public.departments (id),
  actor_id      uuid,
  tokens_in     int not null default 0,
  tokens_out    int not null default 0,
  cost_kes      numeric(12, 4) not null default 0,
  ok            boolean not null default true,
  redactions    int not null default 0
);
create index ai_calls_month_idx on public.ai_calls (department_id, at);

-- Month-to-date spend; the gateway refuses calls once a department reaches its cap.
create function private.ai_spend_mtd(p_department uuid)
returns numeric
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(cost_kes), 0)
    from public.ai_calls
   where side = 'county'
     and department_id is not distinct from p_department
     and at >= date_trunc('month', now());
$$;
revoke execute on function private.ai_spend_mtd(uuid) from authenticated;
grant execute on function private.ai_spend_mtd(uuid) to service_role;

-- ---- oversight digests -------------------------------------------------------------------

create table public.digests (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in ('assembly', 'controller_of_budget', 'auditor_general', 'ward', 'department', 'executive')),
  period_start date not null,
  period_end   date not null,
  body_md      text not null,
  payload      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  unique (kind, period_start, period_end)
);

create table public.digest_recipients (
  id          uuid primary key default gen_random_uuid(),
  digest_id   uuid not null references public.digests (id) on delete cascade,
  email       text not null,
  open_token  uuid not null default gen_random_uuid() unique,
  sent_at     timestamptz,
  first_opened_at timestamptz,
  open_count  int not null default 0
);

-- ---- RLS for operations tables -------------------------------------------------------------

alter table public.audit_log        enable row level security;
alter table public.ai_budgets       enable row level security;
alter table public.ai_calls         enable row level security;
alter table public.digests          enable row level security;
alter table public.digest_recipients enable row level security;

create policy "audit: read" on public.audit_log for select to authenticated
  using (private.has_role(array['super_admin', 'admin', 'auditor']));
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;

create policy "ai budgets: admins" on public.ai_budgets for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
create policy "ai calls: read" on public.ai_calls for select to authenticated
  using (private.has_role(array['super_admin', 'admin', 'auditor']));
revoke all on public.ai_budgets, public.ai_calls from anon, authenticated;
grant select, insert, update, delete on public.ai_budgets to authenticated;
grant select on public.ai_calls to authenticated;

create policy "digests: oversight read" on public.digests for select to authenticated
  using (private.has_role(array['super_admin', 'admin', 'assembly_member', 'auditor', 'chief_officer']));
revoke all on public.digests, public.digest_recipients from anon, authenticated;
grant select on public.digests to authenticated;

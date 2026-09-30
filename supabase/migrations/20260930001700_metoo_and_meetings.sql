-- 0017  "Me too" on open reports, and the public participation calendar.

-- ---- me too -----------------------------------------------------------------------------------------------------------
-- A neighbour who has the same problem adds their voice instead of filing a duplicate. Only a keyed hash of who they
-- are is kept (the same kind of hash as a vote), one per person per report. Ten or more voices raise the priority.
alter table public.reports add column supporters int not null default 0;

create table private.report_supporters (
  report_id      uuid not null references public.reports (id) on delete cascade,
  supporter_hash bytea not null,
  created_at     timestamptz not null default now(),
  primary key (report_id, supporter_hash)
);

-- Called only by the case-feedback Edge Function. 'ok' | 'duplicate' | 'not_found' | 'closed'.
create function public.svc_case_metoo(p_reference text, p_supporter bytea)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r public.reports;
begin
  select r.* into v_r from public.reports r where r.reference = upper(trim(p_reference)) for update;
  if not found then return 'not_found'; end if;
  if v_r.status in ('resolved', 'closed', 'rejected') then return 'closed'; end if;
  begin
    insert into private.report_supporters (report_id, supporter_hash) values (v_r.id, p_supporter);
  exception when unique_violation then
    return 'duplicate';
  end;
  update public.reports set supporters = supporters + 1 where id = v_r.id;
  if v_r.supporters + 1 = 10 and v_r.priority in ('low', 'normal') then
    update public.reports set priority = 'high' where id = v_r.id;
    insert into public.report_events (report_id, kind, is_public, message, data)
    values (v_r.id, 'note', false, 'Ten residents report the same problem. Priority raised to high.', jsonb_build_object('supporters', 10));
  end if;
  return 'ok';
end;
$$;
revoke all on function public.svc_case_metoo(text, bytea) from public, anon, authenticated;

-- The public status page also shows how many people have the same problem.
create or replace function internal.case_status(p_reference text)
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
    'supporters', r.supporters,
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

-- ---- public participation calendar ----------------------------------------------------------------------------------
-- The Constitution (Art. 196) and the County Governments Act require the county to involve residents; this is where
-- ward barazas, budget hearings and Assembly sittings are announced, with the outcome recorded afterwards.
create table public.public_meetings (
  id          uuid primary key default gen_random_uuid(),
  ward_id     text references public.wards (id),            -- null = county-wide
  kind        text not null default 'baraza' check (kind in ('baraza', 'budget_hearing', 'assembly_sitting', 'town_hall', 'other')),
  title       text not null check (char_length(title) between 5 and 160),
  title_sw    text check (char_length(title_sw) <= 160),
  agenda      text check (char_length(agenda) <= 2000),
  venue       text not null check (char_length(venue) between 2 and 200),
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  status      text not null default 'scheduled' check (status in ('scheduled', 'cancelled', 'held')),
  outcome     text check (char_length(outcome) <= 4000),        -- what was decided, published after the meeting
  attendance  int check (attendance >= 0),
  created_by  uuid references auth.users (id),
  created_at  timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index public_meetings_when_idx on public.public_meetings (starts_at);
create index public_meetings_ward_idx on public.public_meetings (ward_id);
alter table public.public_meetings enable row level security;
create policy "meetings: public read" on public.public_meetings for select to anon, authenticated using (true);
create policy "meetings: publishers insert" on public.public_meetings for insert to authenticated
  with check (private.has_role(array['super_admin', 'admin', 'chief_officer', 'sub_county_admin', 'ward_admin']));
create policy "meetings: publishers update" on public.public_meetings for update to authenticated
  using (private.has_role(array['super_admin', 'admin', 'chief_officer', 'sub_county_admin', 'ward_admin']))
  with check (private.has_role(array['super_admin', 'admin', 'chief_officer', 'sub_county_admin', 'ward_admin']));
create policy "meetings: admins delete" on public.public_meetings for delete to authenticated using (private.is_admin());
grant select on public.public_meetings to anon, authenticated;
grant insert, update, delete on public.public_meetings to authenticated;
create trigger audit_public_meetings after insert or update or delete on public.public_meetings
  for each row execute function private.audit_row();

-- A new or cancelled meeting reaches the ward's followers in the app and its instant SMS subscribers.
create function private.meetings_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_what text;
  v_ward text;
begin
  if tg_op = 'INSERT' and new.status = 'scheduled' then
    v_what := 'New meeting';
  elsif tg_op = 'UPDATE' and new.status = 'cancelled' and old.status <> 'cancelled' then
    v_what := 'Meeting cancelled';
  else
    return new;
  end if;
  select w.name into v_ward from public.wards w where w.id = new.ward_id;
  if new.ward_id is not null then
    perform private.tell_followers('ward_tenders', new.ward_id, v_what || ': ' || new.title,
      to_char(new.starts_at at time zone 'Africa/Nairobi', 'Dy DD Mon, HH24:MI') || ' at ' || new.venue, '/meetings',
      case when new.status = 'cancelled' then 'warning' else 'info' end);
    insert into private.outbox (channel, recipient, body, related)
    select 'sms', s.phone_e164,
           left(v_what || ' (' || coalesce(v_ward, '') || '): ' || new.title || ', '
                || to_char(new.starts_at at time zone 'Africa/Nairobi', 'Dy DD Mon HH24:MI') || ', ' || new.venue || '. Reply STOP to stop.', 300),
           jsonb_build_object('meeting_id', new.id)
      from private.subscribers s
     where s.ward_id = new.ward_id and s.verified_at is not null and s.opted_out_at is null and s.frequency = 'instant';
  end if;
  return new;
end;
$$;
create trigger public_meetings_notify after insert or update of status on public.public_meetings
  for each row execute function private.meetings_notify();

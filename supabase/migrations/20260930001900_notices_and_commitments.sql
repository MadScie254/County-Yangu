-- 0019  Service notices (water, power, roads, waste) and the county's public commitments with a status history.

-- ---- service notices ----------------------------------------------------------------------------------------------
-- "No water in Kawangware until Thursday", "Ngong Road closed at Adams", "Collection moved to Saturday". Ward staff post
-- for their own ward; county-wide notices need a county role. Followers of the ward are told in the app, and instant SMS
-- subscribers get a text when a disruption starts and when the service is back.
create table public.service_notices (
  id           uuid primary key default gen_random_uuid(),
  ward_id      text references public.wards (id),            -- null = county-wide
  kind         text not null default 'other' check (kind in ('water', 'power', 'road', 'waste', 'health', 'other')),
  severity     text not null default 'disruption' check (severity in ('info', 'disruption', 'emergency')),
  title        text not null check (char_length(title) between 5 and 160),
  title_sw     text check (char_length(title_sw) <= 160),
  body         text check (char_length(body) <= 2000),
  area         text check (char_length(area) <= 200),        -- estates, roads or landmarks affected
  starts_at    timestamptz not null default now(),
  ends_at      timestamptz,                                    -- expected end, if known
  status       text not null default 'active' check (status in ('active', 'resolved', 'cancelled')),
  resolved_at  timestamptz,
  resolved_note text check (char_length(resolved_note) <= 1000),
  created_by   uuid references auth.users (id) default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
create index service_notices_live_idx on public.service_notices (status, starts_at desc);
create index service_notices_ward_idx on public.service_notices (ward_id);
alter table public.service_notices enable row level security;
create policy "notices: public read" on public.service_notices for select to anon, authenticated using (true);
create policy "notices: ward staff insert" on public.service_notices for insert to authenticated
  with check (case when ward_id is null then private.has_role(array['super_admin', 'admin', 'chief_officer']) else private.can_manage_ward(ward_id) end);
create policy "notices: ward staff update" on public.service_notices for update to authenticated
  using (case when ward_id is null then private.has_role(array['super_admin', 'admin', 'chief_officer']) else private.can_manage_ward(ward_id) end)
  with check (case when ward_id is null then private.has_role(array['super_admin', 'admin', 'chief_officer']) else private.can_manage_ward(ward_id) end);
create policy "notices: admins delete" on public.service_notices for delete to authenticated using (private.is_admin());
grant select on public.service_notices to anon, authenticated;
grant insert, update, delete on public.service_notices to authenticated;
create trigger audit_service_notices after insert or update or delete on public.service_notices
  for each row execute function private.audit_row();
create trigger service_notices_touch before update on public.service_notices
  for each row execute function private.touch_updated_at();

create function private.notices_stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'resolved' and (tg_op = 'INSERT' or old.status <> 'resolved') then
    new.resolved_at := coalesce(new.resolved_at, now());
  elsif new.status <> 'resolved' then
    new.resolved_at := null;
  end if;
  return new;
end;
$$;
create trigger service_notices_stamp before insert or update of status on public.service_notices
  for each row execute function private.notices_stamp();

create function private.notices_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_what text;
  v_ward text;
  v_msg text;
begin
  if tg_op = 'INSERT' and new.status = 'active' then
    v_what := case new.severity when 'emergency' then 'Emergency' when 'info' then 'Notice' else 'Service disruption' end;
    v_msg := coalesce(nullif(new.area, '') || '. ', '')
             || case when new.ends_at is not null then 'Expected back ' || to_char(new.ends_at at time zone 'Africa/Nairobi', 'Dy DD Mon HH24:MI') || '.' else '' end;
  elsif tg_op = 'UPDATE' and new.status = 'resolved' and old.status = 'active' then
    v_what := 'Back to normal';
    v_msg := coalesce(new.resolved_note, 'The county says this is resolved.');
  else
    return new;
  end if;
  if new.ward_id is not null then
    select w.name into v_ward from public.wards w where w.id = new.ward_id;
    perform private.tell_followers('ward_tenders', new.ward_id, v_what || ': ' || new.title, v_msg, '/notices',
      case when v_what = 'Back to normal' then 'success' when new.severity = 'emergency' then 'warning' else 'info' end);
  end if;
  -- SMS only for things that change a resident's day: disruptions and emergencies, and the all clear after them.
  if new.severity <> 'info' then
    insert into private.outbox (channel, recipient, body, related)
    select distinct on (s.phone_e164) 'sms', s.phone_e164,
           left(v_what || coalesce(' (' || v_ward || ')', '') || ': ' || new.title || '. ' || v_msg || ' Reply STOP to stop.', 300),
           jsonb_build_object('notice_id', new.id)
      from private.subscribers s
     where s.verified_at is not null and s.opted_out_at is null and s.frequency = 'instant'
       and (s.ward_id = new.ward_id or (new.ward_id is null and new.severity = 'emergency'));
  end if;
  return new;
end;
$$;
create trigger service_notices_notify after insert or update of status on public.service_notices
  for each row execute function private.notices_notify();

-- ---- commitments: what the county promised, and whether it kept it ------------------------------------------------
create table public.commitments (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,78}$'),
  title       text not null check (char_length(title) between 5 and 200),
  title_sw    text check (char_length(title_sw) <= 200),
  detail      text check (char_length(detail) <= 3000),
  source      text not null check (char_length(source) between 2 and 200),   -- e.g. "CIDP 2023-2027", "Budget speech 2026"
  source_url  text check (source_url ~ '^https://'),
  made_on     date,
  due_on      date,
  sector      text check (char_length(sector) <= 60),
  ward_id     text references public.wards (id),                             -- null = county-wide
  project_id  uuid references public.projects (id) on delete set null,
  status      text not null default 'not_started' check (status in ('not_started', 'in_progress', 'delivered', 'delayed', 'dropped')),
  evidence    text check (char_length(evidence) <= 2000),                     -- what shows it was delivered, or why not
  created_by  uuid references auth.users (id) default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index commitments_status_idx on public.commitments (status, due_on);
alter table public.commitments enable row level security;
create policy "commitments: public read" on public.commitments for select to anon, authenticated using (true);
create policy "commitments: county insert" on public.commitments for insert to authenticated
  with check (private.has_role(array['super_admin', 'admin', 'chief_officer']));
create policy "commitments: county update" on public.commitments for update to authenticated
  using (private.has_role(array['super_admin', 'admin', 'chief_officer']))
  with check (private.has_role(array['super_admin', 'admin', 'chief_officer']));
create policy "commitments: admins delete" on public.commitments for delete to authenticated using (private.is_admin());
grant select on public.commitments to anon, authenticated;
grant insert, update, delete on public.commitments to authenticated;
create trigger audit_commitments after insert or update or delete on public.commitments
  for each row execute function private.audit_row();
create trigger commitments_touch before update on public.commitments
  for each row execute function private.touch_updated_at();

-- Every status change is kept in public, so a promise cannot quietly move from "delayed" back to "not started", and a
-- due date that slips is on the record. Rows are written only by the trigger.
create table public.commitment_updates (
  id            bigint generated always as identity primary key,
  commitment_id uuid not null references public.commitments (id) on delete cascade,
  status        text not null,
  due_on        date,
  note          text,
  created_at    timestamptz not null default now()
);
create index commitment_updates_idx on public.commitment_updates (commitment_id, created_at);
alter table public.commitment_updates enable row level security;
create policy "commitment updates: public read" on public.commitment_updates for select to anon, authenticated using (true);
grant select on public.commitment_updates to anon, authenticated;

create function private.commitments_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status or old.due_on is distinct from new.due_on then
    insert into public.commitment_updates (commitment_id, status, due_on, note)
    values (new.id, new.status, new.due_on,
            case when tg_op = 'INSERT' then 'Published'
                 when old.due_on is distinct from new.due_on and old.status is not distinct from new.status then 'Due date changed from ' || coalesce(old.due_on::text, 'none')
                 else nullif(new.evidence, '') end);
    if tg_op = 'UPDATE' and old.status is distinct from new.status then
      perform private.tell_followers('commitment', new.slug, 'County promise updated: ' || left(new.title, 100),
        'Now ' || replace(new.status, '_', ' ') || '.', '/promises#' || new.slug,
        case when new.status = 'delivered' then 'success' when new.status in ('delayed', 'dropped') then 'warning' else 'info' end);
    end if;
  end if;
  return new;
end;
$$;
create trigger commitments_history after insert or update on public.commitments
  for each row execute function private.commitments_history();

-- Residents can follow a single promise.
alter table public.follows drop constraint follows_kind_check;
alter table public.follows add constraint follows_kind_check check (kind in ('supplier', 'project', 'ward_tenders', 'sector', 'commitment'));

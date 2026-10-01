-- 0022  What the best civic platforms elsewhere do that this one did not yet:
--   * one visit, several problems: up to five issues filed together become linked cases, each routed to its own team
--   * before and after photos to close a case (staff-taken, public), so "fixed" can be seen
--   * a secure two-way whistleblower inbox: anonymous, reached only with a secret key the reporter keeps
--   * ward champions: verified residents whose project checks carry a badge (after Nigeria's Tracka monitors)
--   * procurement concerns against a tender, answered within 14 days or escalated (after Ukraine's DOZORRO)
--   * county finance and audit figures for all 47 counties, entered from Controller of Budget and Auditor-General reports
--   * agree / disagree statements on consultations, without replies (after Taiwan's Pol.is)
--   * quick polls with results by ward (after U-Report)
--   * flagging of abusive public content, hidden for review after three flags

-- ===================================================================================================================
-- 1. Several issues in one report
-- ===================================================================================================================
alter table public.reports add column group_id uuid;
create index reports_group_idx on public.reports (group_id) where group_id is not null;

-- Idempotent on the client key of the first issue: a retry returns the whole group, never a second one.
create function public.svc_create_report_group(
  p_id uuid, p_client_key uuid, p_ward text, p_categories text[], p_description text,
  p_lat numeric, p_lng numeric, p_language text, p_channel text,
  p_callback_phone text default null, p_photo_paths text[] default '{}'
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cats text[];
  v_first public.reports;
  r public.reports;
  v_group uuid := coalesce(p_id, gen_random_uuid());
  v_out jsonb := '[]'::jsonb;
  c text;
  p text;
  i int := 0;
begin
  -- distinct issues, in the order the resident chose them: the first is the main one
  select array_agg(x order by o) into v_cats
    from (select t.x, min(t.o) as o from unnest(p_categories) with ordinality t(x, o) where t.x is not null group by t.x) d;
  if v_cats is null or array_length(v_cats, 1) > 5 then
    raise exception 'Choose between one and five issues' using errcode = '22023';
  end if;

  if p_client_key is not null then
    select * into v_first from public.reports where client_key = p_client_key;
    if found then
      select coalesce(jsonb_agg(jsonb_build_object('reference', g.reference, 'category_id', g.category_id) order by g.created_at, g.reference), '[]'::jsonb)
        into v_out from public.reports g where g.group_id = coalesce(v_first.group_id, v_first.id) or g.id = v_first.id;
      return jsonb_build_object('reference', v_first.reference, 'ward_id', v_first.ward_id, 'status', v_first.status, 'duplicate', true, 'reports', v_out);
    end if;
  end if;

  foreach c in array v_cats loop
    i := i + 1;
    insert into public.reports (id, client_key, ward_id, category_id, description, lat, lng, language, channel, group_id)
    values (case when i = 1 then v_group else gen_random_uuid() end, case when i = 1 then p_client_key end,
            p_ward, c, p_description, p_lat, p_lng, p_language, p_channel, case when array_length(v_cats, 1) > 1 then v_group end)
    returning * into r;
    if i = 1 then v_first := r; end if;
    foreach p in array coalesce(p_photo_paths, '{}') loop
      insert into public.report_photos (report_id, storage_path) values (r.id, p);
    end loop;
    if p_callback_phone is not null then
      insert into private.report_contacts (report_id, phone_e164) values (r.id, p_callback_phone);
    end if;
    v_out := v_out || jsonb_build_array(jsonb_build_object('reference', r.reference, 'category_id', r.category_id));
  end loop;
  return jsonb_build_object('reference', v_first.reference, 'ward_id', v_first.ward_id, 'status', v_first.status, 'duplicate', false, 'reports', v_out);
exception when unique_violation then
  select * into v_first from public.reports where client_key = p_client_key;
  if found then
    select coalesce(jsonb_agg(jsonb_build_object('reference', g.reference, 'category_id', g.category_id) order by g.created_at, g.reference), '[]'::jsonb)
      into v_out from public.reports g where g.group_id = coalesce(v_first.group_id, v_first.id) or g.id = v_first.id;
    return jsonb_build_object('reference', v_first.reference, 'ward_id', v_first.ward_id, 'status', v_first.status, 'duplicate', true, 'reports', v_out);
  end if;
  raise;
end;
$$;
revoke all on function public.svc_create_report_group(uuid, uuid, text, text[], text, numeric, numeric, text, text, text, text[]) from public, anon, authenticated;
grant execute on function public.svc_create_report_group(uuid, uuid, text, text[], text, numeric, numeric, text, text, text, text[]) to service_role;

-- ===================================================================================================================
-- 2. Before and after photos
-- ===================================================================================================================
-- Taken by staff at the site and public on purpose: residents' own photos stay private, these show the work.
create table public.fix_photos (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid not null references public.reports (id) on delete cascade,
  kind        text not null check (kind in ('before', 'after')),
  path        text not null check (char_length(path) between 5 and 300),
  caption     text check (char_length(caption) <= 200),
  uploaded_by uuid references auth.users (id) default auth.uid(),
  created_at  timestamptz not null default now()
);
create index fix_photos_report_idx on public.fix_photos (report_id);
alter table public.fix_photos enable row level security;
create policy "fix photos: public read" on public.fix_photos for select to anon, authenticated
  using (exists (select 1 from public.reports r join public.report_categories c on c.id = r.category_id where r.id = report_id and not c.sensitive));
create policy "fix photos: staff on their cases" on public.fix_photos for insert to authenticated
  with check (exists (select 1 from public.reports r where r.id = report_id and private.can_work_case(r.ward_id, r.department_id, r.assigned_to)));
create policy "fix photos: admins delete" on public.fix_photos for delete to authenticated using (private.is_admin());
grant select on public.fix_photos to anon, authenticated;
grant insert, delete on public.fix_photos to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fix-photos', 'fix-photos', true, 4194304, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;
create policy "fix photos: staff upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'fix-photos' and private.has_role(array['super_admin', 'admin', 'chief_officer', 'sub_county_admin', 'ward_admin', 'officer']));

-- A physical problem is closed with proof. Staff resolving it through the app must first add an "after" photo.
-- (Reports that are not physical, such as suspected misuse of funds, and changes made by the system are exempt.)
create function private.reports_need_after_photo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'resolved' and old.status <> 'resolved' and (select auth.uid()) is not null
     and new.category_id not in ('missing_funds', 'other')
     and not exists (select 1 from public.fix_photos f where f.report_id = new.id and f.kind = 'after') then
    raise exception 'Add an after photo before marking this fixed' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger reports_need_after_photo before update of status on public.reports
  for each row execute function private.reports_need_after_photo();

-- The public "fixed" gallery: recently resolved cases with an after photo.
create function internal.fixed_gallery(p_limit int default 24)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(x order by x ->> 'resolved_at' desc), '[]'::jsonb) from (
    select jsonb_build_object('reference', r.reference, 'category_id', r.category_id, 'category', c.name, 'category_sw', c.name_sw,
             'ward', w.name, 'ward_id', r.ward_id, 'reported_at', r.created_at, 'resolved_at', coalesce(r.resolved_at, r.updated_at),
             'before', (select f.path from public.fix_photos f where f.report_id = r.id and f.kind = 'before' order by f.created_at desc limit 1),
             'after', (select f.path from public.fix_photos f where f.report_id = r.id and f.kind = 'after' order by f.created_at desc limit 1)) as x
      from public.reports r
      join public.wards w on w.id = r.ward_id
      join public.report_categories c on c.id = r.category_id
     where r.status in ('resolved', 'closed') and not c.sensitive
       and exists (select 1 from public.fix_photos f where f.report_id = r.id and f.kind = 'after')
     order by coalesce(r.resolved_at, r.updated_at) desc
     limit least(greatest(p_limit, 1), 100)
  ) t;
$$;
create function public.fixed_gallery(p_limit int default 24)
returns jsonb language sql stable security invoker set search_path = ''
as $$ select internal.fixed_gallery(p_limit => p_limit) $$;
revoke all on function public.fixed_gallery(int) from public;
grant execute on function public.fixed_gallery(int) to anon, authenticated, service_role;
grant execute on function internal.fixed_gallery(int) to anon, authenticated, service_role;

-- The public status page also lists the other issues filed in the same visit, and the before / after photos.
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
      from public.report_events e where e.report_id = r.id and e.is_public), '[]'::jsonb),
    'group', coalesce((
      select jsonb_agg(jsonb_build_object('reference', g.reference, 'category_id', g.category_id, 'status', g.status) order by g.created_at, g.reference)
      from public.reports g where r.group_id is not null and g.group_id = r.group_id and g.id <> r.id), '[]'::jsonb),
    'fix_photos', case when c.sensitive then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('kind', f.kind, 'path', f.path, 'caption', f.caption, 'at', f.created_at) order by f.created_at)
      from public.fix_photos f where f.report_id = r.id), '[]'::jsonb) end)
  from public.reports r
  join public.wards w on w.id = r.ward_id
  left join public.report_categories c on c.id = r.category_id
  left join public.projects p on p.id = r.project_id and p.published
  where r.reference = upper(trim(p_reference));
$$;

-- ===================================================================================================================
-- 3. Whistleblower inbox
-- ===================================================================================================================
-- Nothing here can identify the reporter: no account, no phone, no address. The reporter holds a secret key; only a
-- keyed hash of it is stored. The Edge Function `disclosure` is the only way in for the reporter.
create table private.disclosures (
  id          uuid primary key default gen_random_uuid(),
  reference   text not null unique default private.new_reference('W'),
  key_hash    bytea not null unique,
  topic       text not null check (topic in ('bribery', 'procurement', 'payroll', 'theft', 'abuse_of_office', 'other')),
  ward_id     text references public.wards (id),
  status      text not null default 'received' check (status in ('received', 'reviewing', 'referred', 'closed')),
  referred_to text check (char_length(referred_to) <= 120),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create table private.disclosure_messages (
  id            bigint generated always as identity primary key,
  disclosure_id uuid not null references private.disclosures (id) on delete cascade,
  from_reporter boolean not null,
  body          text not null check (char_length(body) between 2 and 6000),
  created_at    timestamptz not null default now()
);
create index disclosure_messages_idx on private.disclosure_messages (disclosure_id, created_at);

create function public.svc_disclosure_create(p_key_hash bytea, p_topic text, p_ward text, p_body text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  d private.disclosures;
begin
  insert into private.disclosures (key_hash, topic, ward_id) values (p_key_hash, p_topic, p_ward) returning * into d;
  insert into private.disclosure_messages (disclosure_id, from_reporter, body) values (d.id, true, p_body);
  insert into public.notifications (user_id, title, message, kind, link)
  select distinct r.user_id, 'New protected disclosure', 'A whistleblower report (' || replace(p_topic, '_', ' ') || ') is waiting. ' || d.reference, 'warning', '/console/disclosures'
    from public.staff_roles r where r.active and (r.expires_at is null or r.expires_at > now()) and r.role in ('super_admin', 'admin');
  return d.reference;
end;
$$;

create function public.svc_disclosure_thread(p_key_hash bytea)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('reference', d.reference, 'topic', d.topic, 'status', d.status, 'referred_to', d.referred_to, 'created_at', d.created_at,
           'messages', coalesce((select jsonb_agg(jsonb_build_object('from_reporter', m.from_reporter, 'body', m.body, 'at', m.created_at) order by m.created_at)
                                   from private.disclosure_messages m where m.disclosure_id = d.id), '[]'::jsonb))
    from private.disclosures d where d.key_hash = p_key_hash;
$$;

create function public.svc_disclosure_reply(p_key_hash bytea, p_body text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  d private.disclosures;
begin
  select * into d from private.disclosures where key_hash = p_key_hash;
  if not found then return 'not_found'; end if;
  if d.status = 'closed' then return 'closed'; end if;
  if (select count(*) from private.disclosure_messages m where m.disclosure_id = d.id and m.from_reporter and m.created_at > now() - interval '1 day') >= 10 then
    return 'limit';
  end if;
  insert into private.disclosure_messages (disclosure_id, from_reporter, body) values (d.id, true, p_body);
  update private.disclosures set updated_at = now() where id = d.id;
  return 'ok';
end;
$$;
revoke all on function public.svc_disclosure_create(bytea, text, text, text) from public, anon, authenticated;
revoke all on function public.svc_disclosure_thread(bytea) from public, anon, authenticated;
revoke all on function public.svc_disclosure_reply(bytea, text) from public, anon, authenticated;
grant execute on function public.svc_disclosure_create(bytea, text, text, text) to service_role;
grant execute on function public.svc_disclosure_thread(bytea) to service_role;
grant execute on function public.svc_disclosure_reply(bytea, text) to service_role;

-- The integrity desk: county administrators, and auditors so that a report about an administrator has another reader.
create function private.integrity_reader()
returns boolean language sql stable security definer set search_path = ''
as $$ select private.has_role(array['super_admin', 'admin', 'auditor']) $$;

create function internal.disclosure_inbox()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.integrity_reader() then coalesce(jsonb_agg(jsonb_build_object(
      'id', d.id, 'reference', d.reference, 'topic', d.topic, 'ward_id', d.ward_id, 'status', d.status, 'referred_to', d.referred_to,
      'created_at', d.created_at, 'updated_at', d.updated_at,
      'messages', (select jsonb_agg(jsonb_build_object('from_reporter', m.from_reporter, 'body', m.body, 'at', m.created_at) order by m.created_at)
                     from private.disclosure_messages m where m.disclosure_id = d.id)) order by d.updated_at desc), '[]'::jsonb)
    else '[]'::jsonb end
  from private.disclosures d;
$$;
create function public.disclosure_inbox()
returns jsonb language sql stable security invoker set search_path = ''
as $$ select internal.disclosure_inbox() $$;

create function internal.disclosure_answer(p_id uuid, p_body text default null, p_status text default null, p_referred_to text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.integrity_reader() then raise exception 'Only the integrity desk can do this' using errcode = '42501'; end if;
  if p_status is not null and p_status not in ('received', 'reviewing', 'referred', 'closed') then raise exception 'Invalid status' using errcode = '22023'; end if;
  if nullif(trim(coalesce(p_body, '')), '') is not null then
    insert into private.disclosure_messages (disclosure_id, from_reporter, body) values (p_id, false, left(trim(p_body), 6000));
  end if;
  update private.disclosures set status = coalesce(p_status, status), referred_to = coalesce(nullif(trim(p_referred_to), ''), referred_to), updated_at = now() where id = p_id;
  if not found then raise exception 'Not found' using errcode = 'P0002'; end if;
end;
$$;
create function public.disclosure_answer(p_id uuid, p_body text default null, p_status text default null, p_referred_to text default null)
returns void language sql volatile security invoker set search_path = ''
as $$ select internal.disclosure_answer(p_id => p_id, p_body => p_body, p_status => p_status, p_referred_to => p_referred_to) $$;
revoke all on function public.disclosure_inbox() from public, anon;
revoke all on function internal.disclosure_inbox() from public, anon;
revoke all on function public.disclosure_answer(uuid, text, text, text) from public, anon;
revoke all on function internal.disclosure_answer(uuid, text, text, text) from public, anon;
grant execute on function public.disclosure_inbox() to authenticated, service_role;
grant execute on function internal.disclosure_inbox() to authenticated, service_role;
grant execute on function public.disclosure_answer(uuid, text, text, text) to authenticated, service_role;
grant execute on function internal.disclosure_answer(uuid, text, text, text) to authenticated, service_role;

-- ===================================================================================================================
-- 4. Ward champions
-- ===================================================================================================================
create table public.ward_champions (
  user_id      uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  ward_id      text not null references public.wards (id),
  display_name text not null check (char_length(display_name) between 2 and 60),
  motivation   text check (char_length(motivation) <= 600),
  status       text not null default 'applied' check (status in ('applied', 'active', 'paused', 'declined')),
  approved_by  uuid references auth.users (id),
  approved_at  timestamptz,
  created_at   timestamptz not null default now()
);
alter table public.ward_champions enable row level security;
create policy "champions: active are public" on public.ward_champions for select to anon using (status = 'active');
create policy "champions: own, active and ward staff" on public.ward_champions for select to authenticated
  using (status = 'active' or user_id = (select auth.uid()) or private.can_manage_ward(ward_id));
create policy "champions: apply for yourself" on public.ward_champions for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'applied');
create policy "champions: ward staff decide" on public.ward_champions for update to authenticated
  using (private.can_manage_ward(ward_id)) with check (private.can_manage_ward(ward_id));
revoke all on public.ward_champions from anon, authenticated;
grant select (ward_id, display_name, status, approved_at, created_at) on public.ward_champions to anon;
grant select on public.ward_champions to authenticated;
grant insert (ward_id, display_name, motivation) on public.ward_champions to authenticated;
grant update (status) on public.ward_champions to authenticated;

create function private.champions_stamp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    new.approved_by := auth.uid();
    new.approved_at := now();
    insert into public.notifications (user_id, title, message, kind, link)
    values (new.user_id, case new.status when 'active' then 'You are now a ward champion' when 'declined' then 'Ward champion application' else 'Ward champion status changed' end,
            case new.status when 'active' then 'Your project checks now carry the champion badge. Thank you for keeping an eye on your ward.'
                            when 'declined' then 'Your application was not approved this time.' else 'Your champion status is now ' || new.status || '.' end,
            case new.status when 'active' then 'success' else 'info' end, '/champions');
  end if;
  return new;
end;
$$;
create trigger ward_champions_stamp before update of status on public.ward_champions
  for each row execute function private.champions_stamp();

-- A champion's check on a project in their ward: named, public, and a doubt reaches staff at once.
create table public.champion_checks (
  id          bigint generated always as identity primary key,
  project_id  uuid not null references public.projects (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade default auth.uid(),
  verdict     text not null check (verdict in ('as_shown', 'not_as_shown')),
  comment     text check (char_length(comment) <= 600),
  created_at  timestamptz not null default now()
);
create index champion_checks_project_idx on public.champion_checks (project_id, created_at desc);
alter table public.champion_checks enable row level security;
create policy "champion checks: public read" on public.champion_checks for select to anon, authenticated using (true);
create policy "champion checks: active champions in the project's ward" on public.champion_checks for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.ward_champions w join public.projects p on p.id = project_id
     where w.user_id = (select auth.uid()) and w.status = 'active' and w.ward_id = p.ward_id and p.published));
revoke all on public.champion_checks from anon, authenticated;
grant select (id, project_id, verdict, comment, created_at) on public.champion_checks to anon, authenticated;
grant insert (project_id, verdict, comment) on public.champion_checks to authenticated;

create function private.champion_checks_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.projects;
begin
  if (select count(*) from public.champion_checks c where c.user_id = new.user_id and c.project_id = new.project_id and c.created_at > now() - interval '7 days') > 1 then
    raise exception 'One check per project per week' using errcode = '54000';
  end if;
  if new.verdict = 'not_as_shown' then
    select * into v_p from public.projects where id = new.project_id;
    insert into public.notifications (user_id, title, message, kind, link)
    select distinct r.user_id, 'A ward champion questions a project', '"' || v_p.title || '" does not look as published, says a ward champion.', 'warning', null
      from public.staff_roles r where r.active and (r.expires_at is null or r.expires_at > now())
       and (r.role in ('super_admin', 'admin', 'chief_officer') or (r.role in ('sub_county_admin', 'ward_admin') and r.ward_id = v_p.ward_id));
  end if;
  return new;
end;
$$;
create trigger champion_checks_notify after insert on public.champion_checks
  for each row execute function private.champion_checks_notify();

create function internal.champion_checks(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('verdict', c.verdict, 'comment', c.comment, 'at', c.created_at, 'champion', w.display_name) order by c.created_at desc), '[]'::jsonb)
    from public.champion_checks c
    join public.projects p on p.id = c.project_id and p.published
    join public.ward_champions w on w.user_id = c.user_id
   where p.slug = p_slug;
$$;
create function public.champion_checks_for(p_slug text)
returns jsonb language sql stable security invoker set search_path = ''
as $$ select internal.champion_checks(p_slug => p_slug) $$;
revoke all on function public.champion_checks_for(text) from public;
grant execute on function public.champion_checks_for(text) to anon, authenticated, service_role;
grant execute on function internal.champion_checks(text) to anon, authenticated, service_role;

-- ===================================================================================================================
-- 5. Procurement concerns
-- ===================================================================================================================
create table public.tender_concerns (
  id           uuid primary key default gen_random_uuid(),
  reference    text not null unique default private.new_reference('C'),
  tender_id    uuid not null references public.tenders (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade default auth.uid(),
  kind         text not null check (kind in ('specs_tailored', 'short_deadline', 'single_bid', 'price_inflated', 'conflict_of_interest', 'not_delivered', 'other')),
  body         text not null check (char_length(body) between 20 and 3000),
  status       text not null default 'submitted' check (status in ('submitted', 'answered', 'fixed', 'dismissed', 'escalated')),
  response     text check (char_length(response) <= 4000),
  escalated_to text check (escalated_to in ('PPRA', 'EACC', 'Auditor-General')),
  due_at       timestamptz not null default now() + interval '14 days',
  answered_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index tender_concerns_tender_idx on public.tender_concerns (tender_id);
alter table public.tender_concerns enable row level security;
create policy "concerns: public read" on public.tender_concerns for select to anon, authenticated using (true);
create policy "concerns: residents file" on public.tender_concerns for insert to authenticated with check (user_id = (select auth.uid()));
create policy "concerns: county answers" on public.tender_concerns for update to authenticated
  using (private.has_role(array['super_admin', 'admin', 'chief_officer']) or user_id = (select auth.uid()))
  with check (private.has_role(array['super_admin', 'admin', 'chief_officer']) or user_id = (select auth.uid()));
revoke all on public.tender_concerns from anon, authenticated;
grant select (id, reference, tender_id, kind, body, status, response, escalated_to, due_at, answered_at, created_at) on public.tender_concerns to anon, authenticated;
grant insert (tender_id, kind, body) on public.tender_concerns to authenticated;
grant update (status, response, escalated_to) on public.tender_concerns to authenticated;
create trigger audit_tender_concerns after insert or update or delete on public.tender_concerns
  for each row execute function private.audit_row();

create function private.concerns_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff boolean := private.has_role(array['super_admin', 'admin', 'chief_officer']);
  v_title text;
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.tender_concerns c where c.user_id = new.user_id and c.created_at > now() - interval '1 day') >= 5 then
      raise exception 'You can raise up to 5 concerns a day' using errcode = '54000';
    end if;
    new.status := 'submitted'; new.response := null; new.escalated_to := null; new.answered_at := null;
    new.created_at := now(); new.due_at := now() + interval '14 days';
    select t.reference || ': ' || t.title into v_title from public.tenders t where t.id = new.tender_id;
    insert into public.notifications (user_id, title, message, kind, link)
    select distinct r.user_id, 'Procurement concern ' || new.reference, coalesce(v_title, 'A tender') || '. Answer by ' || to_char(new.due_at at time zone 'Africa/Nairobi', 'DD Mon YYYY') || '.', 'warning', '/console/concerns'
      from public.staff_roles r where r.active and (r.expires_at is null or r.expires_at > now()) and r.role in ('super_admin', 'admin', 'chief_officer');
    return new;
  end if;
  -- the person who raised it may only escalate, and only once the county is late or has dismissed it
  if not v_staff then
    if new.response is distinct from old.response or new.status not in (old.status, 'escalated') then
      raise exception 'Only the county can answer a concern' using errcode = '42501';
    end if;
    if new.status = 'escalated' and old.status <> 'escalated' then
      if not (old.status = 'dismissed' or (old.status = 'submitted' and old.due_at < now())) then
        raise exception 'You can escalate once the county is late or has dismissed the concern' using errcode = '22023';
      end if;
      if new.escalated_to is null then raise exception 'Say where it was escalated' using errcode = '22023'; end if;
    end if;
    return new;
  end if;
  if new.status in ('answered', 'fixed', 'dismissed') and coalesce(trim(new.response), '') = '' then
    raise exception 'Give the answer in public' using errcode = '22023';
  end if;
  if new.status <> old.status and new.status in ('answered', 'fixed', 'dismissed') then
    new.answered_at := now();
    insert into public.notifications (user_id, title, message, kind, link)
    values (new.user_id, 'Your procurement concern was answered', new.reference || ': ' || left(new.response, 200), case when new.status = 'fixed' then 'success' else 'info' end, '/open#concerns');
  end if;
  new.due_at := old.due_at;
  return new;
end;
$$;
create trigger tender_concerns_rules before insert or update on public.tender_concerns
  for each row execute function private.concerns_rules();

-- ===================================================================================================================
-- 6. County finance and audit, all 47 counties
-- ===================================================================================================================
-- Entered by the county (or a researcher with an admin role) from the Controller of Budget's budget implementation
-- reviews and the Auditor-General's county reports. Every row carries its source.
create table public.county_finance (
  county_code      int not null check (county_code between 1 and 47),
  fiscal_year      text not null check (fiscal_year ~ '^20[0-9]{2}/[0-9]{2}$'),
  dev_budget       numeric(16, 2) check (dev_budget >= 0),
  dev_spent        numeric(16, 2) check (dev_spent >= 0),
  rec_budget       numeric(16, 2) check (rec_budget >= 0),
  rec_spent        numeric(16, 2) check (rec_spent >= 0),
  osr_target       numeric(16, 2) check (osr_target >= 0),
  osr_actual       numeric(16, 2) check (osr_actual >= 0),
  pending_bills    numeric(16, 2) check (pending_bills >= 0),
  audit_opinion    text check (audit_opinion in ('unqualified', 'qualified', 'adverse', 'disclaimer')),
  source           text not null check (char_length(source) between 3 and 300),
  source_url       text check (source_url ~ '^https://'),
  updated_at       timestamptz not null default now(),
  primary key (county_code, fiscal_year)
);
alter table public.county_finance enable row level security;
create policy "finance: public read" on public.county_finance for select to anon, authenticated using (true);
create policy "finance: admins write" on public.county_finance for insert to authenticated with check (private.is_admin());
create policy "finance: admins update" on public.county_finance for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "finance: admins delete" on public.county_finance for delete to authenticated using (private.is_admin());
grant select on public.county_finance to anon, authenticated;
grant insert, update, delete on public.county_finance to authenticated;
create trigger audit_county_finance after insert or update or delete on public.county_finance
  for each row execute function private.audit_row();
create trigger county_finance_touch before update on public.county_finance
  for each row execute function private.touch_updated_at();

-- ===================================================================================================================
-- 7. Agree / disagree statements on consultations
-- ===================================================================================================================
create table public.consultation_statements (
  id              bigint generated always as identity primary key,
  consultation_id uuid not null references public.consultations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade default auth.uid(),
  body            text not null check (char_length(body) between 10 and 160),
  hidden          boolean not null default false,
  created_at      timestamptz not null default now()
);
create index consultation_statements_idx on public.consultation_statements (consultation_id);
alter table public.consultation_statements enable row level security;
create policy "statements: public read" on public.consultation_statements for select to anon using (not hidden);
create policy "statements: read, admins see hidden" on public.consultation_statements for select to authenticated using (not hidden or private.is_admin());
create policy "statements: residents while open" on public.consultation_statements for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.consultations c where c.id = consultation_id and now() between c.opens_at and c.closes_at));
create policy "statements: admins moderate" on public.consultation_statements for update to authenticated using (private.is_admin()) with check (private.is_admin());
revoke all on public.consultation_statements from anon, authenticated;
grant select (id, consultation_id, body, hidden, created_at) on public.consultation_statements to anon, authenticated;
grant insert (consultation_id, body) on public.consultation_statements to authenticated;
grant update (hidden) on public.consultation_statements to authenticated;

create table public.statement_votes (
  statement_id bigint not null references public.consultation_statements (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade default auth.uid(),
  vote         smallint not null check (vote in (-1, 0, 1)),
  created_at   timestamptz not null default now(),
  primary key (statement_id, user_id)
);
alter table public.statement_votes enable row level security;
create policy "votes: own" on public.statement_votes for select to authenticated using (user_id = (select auth.uid()));
create policy "votes: cast while open" on public.statement_votes for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.consultation_statements s join public.consultations c on c.id = s.consultation_id
     where s.id = statement_id and not s.hidden and now() between c.opens_at and c.closes_at));
create policy "votes: change own while open" on public.statement_votes for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update on public.statement_votes to authenticated;

create function private.statements_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.consultation_statements s where s.user_id = new.user_id and s.consultation_id = new.consultation_id) >= 3 then
    raise exception 'You can add up to 3 statements to one consultation' using errcode = '54000';
  end if;
  new.created_at := now();
  return new;
end;
$$;
create trigger consultation_statements_limit before insert on public.consultation_statements
  for each row execute function private.statements_limit();

-- Totals per statement, and a pseudonymous vote matrix (participant numbers, not people) so the page can find
-- opinion groups the way Pol.is does.
create function internal.statement_results(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with c as (select id from public.consultations where slug = p_slug),
  s as (select st.* from public.consultation_statements st join c on c.id = st.consultation_id where not st.hidden),
  v as (select sv.* from public.statement_votes sv join s on s.id = sv.statement_id),
  p as (select user_id, row_number() over (order by min(created_at)) as n from v group by user_id)
  select jsonb_build_object(
    'statements', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'body', s.body, 'created_at', s.created_at,
        'agree', (select count(*) from v where v.statement_id = s.id and v.vote = 1),
        'disagree', (select count(*) from v where v.statement_id = s.id and v.vote = -1),
        'pass', (select count(*) from v where v.statement_id = s.id and v.vote = 0)) order by s.id) from s), '[]'::jsonb),
    'participants', (select count(*) from p),
    'votes', coalesce((select jsonb_agg(jsonb_build_array(p.n, v.statement_id, v.vote)) from v join p on p.user_id = v.user_id), '[]'::jsonb));
$$;
create function public.statement_results(p_slug text)
returns jsonb language sql stable security invoker set search_path = ''
as $$ select internal.statement_results(p_slug => p_slug) $$;
revoke all on function public.statement_results(text) from public;
grant execute on function public.statement_results(text) to anon, authenticated, service_role;
grant execute on function internal.statement_results(text) to anon, authenticated, service_role;

-- ===================================================================================================================
-- 8. Quick polls
-- ===================================================================================================================
create table public.polls (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,78}$'),
  question    text not null check (char_length(question) between 8 and 200),
  question_sw text check (char_length(question_sw) <= 200),
  options     jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 6),
  ward_id     text references public.wards (id),
  opens_at    timestamptz not null default now(),
  closes_at   timestamptz not null,
  created_by  uuid references auth.users (id) default auth.uid(),
  created_at  timestamptz not null default now(),
  check (closes_at > opens_at)
);
alter table public.polls enable row level security;
create policy "polls: public read" on public.polls for select to anon, authenticated using (true);
create policy "polls: publishers create" on public.polls for insert to authenticated
  with check (private.has_role(array['super_admin', 'admin', 'chief_officer', 'sub_county_admin', 'ward_admin']));
create policy "polls: publishers update" on public.polls for update to authenticated
  using (private.has_role(array['super_admin', 'admin', 'chief_officer', 'sub_county_admin', 'ward_admin']))
  with check (private.has_role(array['super_admin', 'admin', 'chief_officer', 'sub_county_admin', 'ward_admin']));
grant select on public.polls to anon, authenticated;
grant insert, update on public.polls to authenticated;

create table public.poll_votes (
  poll_id    uuid not null references public.polls (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  option_id  text not null check (char_length(option_id) between 1 and 40),
  ward_id    text references public.wards (id),
  channel    text not null default 'web' check (channel in ('web', 'sms', 'ussd')),
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);
alter table public.poll_votes enable row level security;
create policy "poll votes: own" on public.poll_votes for select to authenticated using (user_id = (select auth.uid()));
create policy "poll votes: once while open" on public.poll_votes for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.polls p where p.id = poll_id and now() between p.opens_at and p.closes_at
       and exists (select 1 from jsonb_array_elements(p.options) o where o ->> 'id' = option_id)));
grant select, insert on public.poll_votes to authenticated;

create function internal.poll_results(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('total', count(v.*),
    'by_option', coalesce((select jsonb_object_agg(x.option_id, x.n) from (select v2.option_id, count(*) n from public.poll_votes v2 where v2.poll_id = p.id group by v2.option_id) x), '{}'::jsonb),
    'by_ward', coalesce((select jsonb_agg(jsonb_build_object('ward_id', x.ward_id, 'option_id', x.option_id, 'n', x.n)) from (
        select v3.ward_id, v3.option_id, count(*) n from public.poll_votes v3 where v3.poll_id = p.id and v3.ward_id is not null group by 1, 2) x), '[]'::jsonb))
  from public.polls p left join public.poll_votes v on v.poll_id = p.id
  where p.slug = p_slug
  group by p.id;
$$;
create function public.poll_results(p_slug text)
returns jsonb language sql stable security invoker set search_path = ''
as $$ select internal.poll_results(p_slug => p_slug) $$;
revoke all on function public.poll_results(text) from public;
grant execute on function public.poll_results(text) to anon, authenticated, service_role;
grant execute on function internal.poll_results(text) to anon, authenticated, service_role;

-- ===================================================================================================================
-- 9. Flagging abusive public content
-- ===================================================================================================================
alter table public.consultation_comments add column hidden boolean not null default false;
drop policy "comments: public read" on public.consultation_comments;
create policy "comments: public read" on public.consultation_comments for select to anon using (not hidden);
create policy "comments: read, admins see hidden" on public.consultation_comments for select to authenticated using (not hidden or private.is_admin());
create policy "comments: admins moderate" on public.consultation_comments for update to authenticated using (private.is_admin()) with check (private.is_admin());
grant select (hidden) on public.consultation_comments to anon, authenticated;
grant update (hidden) on public.consultation_comments to authenticated;

create table public.content_flags (
  id          bigint generated always as identity primary key,
  kind        text not null check (kind in ('consultation_comment', 'statement', 'champion_check', 'concern')),
  target_id   text not null check (char_length(target_id) between 1 and 60),
  reason      text not null check (reason in ('abuse', 'personal_details', 'false', 'spam', 'other')),
  user_id     uuid not null references auth.users (id) on delete cascade default auth.uid(),
  status      text not null default 'open' check (status in ('open', 'kept', 'removed')),
  created_at  timestamptz not null default now(),
  unique (kind, target_id, user_id)
);
alter table public.content_flags enable row level security;
create policy "flags: anyone signed in" on public.content_flags for insert to authenticated with check (user_id = (select auth.uid()));
create policy "flags: admins read" on public.content_flags for select to authenticated using (private.is_admin());
create policy "flags: admins decide" on public.content_flags for update to authenticated using (private.is_admin()) with check (private.is_admin());
revoke all on public.content_flags from anon, authenticated;
grant insert (kind, target_id, reason) on public.content_flags to authenticated;
grant select, update (status) on public.content_flags to authenticated;

-- Three different people flagging the same thing hides it until an administrator decides.
create function private.flags_autohide()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.content_flags f where f.kind = new.kind and f.target_id = new.target_id and f.status = 'open') >= 3 then
    if new.kind = 'consultation_comment' then update public.consultation_comments set hidden = true where id::text = new.target_id;
    elsif new.kind = 'statement' then update public.consultation_statements set hidden = true where id::text = new.target_id;
    end if;
  end if;
  return new;
end;
$$;
create trigger content_flags_autohide after insert on public.content_flags
  for each row execute function private.flags_autohide();

-- The moderation queue: what was flagged, why, and what it says.
create function internal.moderation_queue()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.is_admin() then coalesce(jsonb_agg(x order by x ->> 'last' desc), '[]'::jsonb) else '[]'::jsonb end from (
    select jsonb_build_object('kind', f.kind, 'target_id', f.target_id, 'flags', count(*), 'reasons', jsonb_agg(distinct f.reason), 'last', max(f.created_at),
      'text', case f.kind
        when 'consultation_comment' then (select c.body from public.consultation_comments c where c.id::text = f.target_id)
        when 'statement' then (select s.body from public.consultation_statements s where s.id::text = f.target_id)
        when 'champion_check' then (select c.comment from public.champion_checks c where c.id::text = f.target_id)
        when 'concern' then (select c.body from public.tender_concerns c where c.id::text = f.target_id) end,
      'hidden', case f.kind
        when 'consultation_comment' then (select c.hidden from public.consultation_comments c where c.id::text = f.target_id)
        when 'statement' then (select s.hidden from public.consultation_statements s where s.id::text = f.target_id) end) as x
      from public.content_flags f where f.status = 'open' group by f.kind, f.target_id
  ) t;
$$;
create function public.moderation_queue()
returns jsonb language sql stable security invoker set search_path = ''
as $$ select internal.moderation_queue() $$;

create function internal.moderate(p_kind text, p_target text, p_remove boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then raise exception 'Only administrators can do this' using errcode = '42501'; end if;
  if p_kind = 'consultation_comment' then update public.consultation_comments set hidden = p_remove where id::text = p_target;
  elsif p_kind = 'statement' then update public.consultation_statements set hidden = p_remove where id::text = p_target;
  elsif p_kind = 'champion_check' and p_remove then delete from public.champion_checks where id::text = p_target;
  end if;
  update public.content_flags set status = case when p_remove then 'removed' else 'kept' end where kind = p_kind and target_id = p_target and status = 'open';
end;
$$;
create function public.moderate(p_kind text, p_target text, p_remove boolean)
returns void language sql volatile security invoker set search_path = ''
as $$ select internal.moderate(p_kind => p_kind, p_target => p_target, p_remove => p_remove) $$;
revoke all on function public.moderation_queue() from public, anon;
revoke all on function internal.moderation_queue() from public, anon;
revoke all on function public.moderate(text, text, boolean) from public, anon;
revoke all on function internal.moderate(text, text, boolean) from public, anon;
grant execute on function public.moderation_queue() to authenticated, service_role;
grant execute on function internal.moderation_queue() to authenticated, service_role;
grant execute on function public.moderate(text, text, boolean) to authenticated, service_role;
grant execute on function internal.moderate(text, text, boolean) to authenticated, service_role;

-- ===================================================================================================================
-- 10. The deadline scoreboard counts procurement concerns too
-- ===================================================================================================================
create or replace function internal.legal_deadlines()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'generated_at', now(),
    'info', (select jsonb_build_object(
        'decided', count(*) filter (where i.answered_at is not null),
        'on_time', count(*) filter (where i.answered_at is not null and i.answered_at <= coalesce(i.extended_to, i.due_at)),
        'waiting', count(*) filter (where i.status in ('submitted', 'extended')),
        'late_now', count(*) filter (where i.status in ('submitted', 'extended') and coalesce(i.extended_to, i.due_at) < now()))
      from public.info_requests i),
    'petitions', (select jsonb_build_object(
        'due', count(*) filter (where p.response_due_at is not null),
        'answered_on_time', count(*) filter (where p.responded_at is not null and p.responded_at <= p.response_due_at),
        'answered_late', count(*) filter (where p.responded_at > p.response_due_at),
        'late_now', count(*) filter (where p.responded_at is null and p.response_due_at < now()))
      from public.proposals p where p.kind = 'petition'),
    'consultations', (select jsonb_build_object(
        'closed', count(*) filter (where c.closes_at < now()),
        'reported', count(*) filter (where c.closes_at < now() and c.report_at is not null),
        'report_owed', count(*) filter (where c.closes_at < now() - interval '30 days' and c.report_at is null))
      from public.consultations c),
    'erasure', (select jsonb_build_object(
        'done', count(*) filter (where e.done_at is not null),
        'on_time', count(*) filter (where e.done_at is not null and e.done_at <= e.due_at),
        'late_now', count(*) filter (where e.done_at is null and e.due_at < now()))
      from private.erasure_requests e),
    'concerns', (select jsonb_build_object(
        'answered', count(*) filter (where t.answered_at is not null),
        'on_time', count(*) filter (where t.answered_at is not null and t.answered_at <= t.due_at),
        'fixed', count(*) filter (where t.status = 'fixed'),
        'late_now', count(*) filter (where t.answered_at is null and t.status = 'submitted' and t.due_at < now()))
      from public.tender_concerns t),
    'promises', (select jsonb_build_object(
        'total', count(*),
        'delivered', count(*) filter (where m.status = 'delivered'),
        'past_due', count(*) filter (where m.due_on < current_date and m.status not in ('delivered', 'dropped')))
      from public.commitments m)
  );
$$;

-- ===================================================================================================================
-- 11. A new ward poll reaches the ward's followers
-- ===================================================================================================================
create function private.polls_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.ward_id is not null then
    perform private.tell_followers('ward_tenders', new.ward_id, 'Quick poll: ' || left(new.question, 120),
      'Closes ' || to_char(new.closes_at at time zone 'Africa/Nairobi', 'DD Mon') || '.', '/polls#' || new.slug);
  end if;
  return new;
end;
$$;
create trigger polls_notify after insert on public.polls for each row execute function private.polls_notify();

-- 0020  Rights residents already have in law, made usable:
--   * information requests under the Access to Information Act, 2016 (21 days, one 14-day extension, 48 hours when a
--     life or liberty is at stake), published with their answers so each answer serves everyone;
--   * "have your say" on draft bills, budgets and policies (Constitution art. 196, County Governments Act s. 87), with a
--     published report of what was heard;
--   * a guaranteed answer for petitions that reach a support threshold (after Taiwan's Join and Democracy Seoul);
--   * the Data Protection Act, 2019: a copy of my data on demand and an erasure request with a 14-day deadline.

-- ---- information requests ------------------------------------------------------------------------------------------
create table public.info_requests (
  id              uuid primary key default gen_random_uuid(),
  reference       text not null unique default private.new_reference('I'),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  requester_name  text check (char_length(requester_name) <= 80),         -- shown publicly; blank shows "A resident"
  department_id   uuid references public.departments (id),
  title           text not null check (char_length(title) between 8 and 160),
  body            text not null check (char_length(body) between 20 and 4000),
  is_public       boolean not null default true,
  urgent          boolean not null default false,                         -- life or liberty: 48 hours
  urgent_reason   text check (char_length(urgent_reason) <= 500),
  status          text not null default 'submitted' check (status in ('submitted', 'extended', 'answered', 'partly_answered', 'refused', 'withdrawn')),
  due_at          timestamptz not null default now(),                     -- set by trigger, never by the client
  extended_to     timestamptz,
  extension_reason text check (char_length(extension_reason) <= 1000),
  response        text check (char_length(response) <= 10000),
  response_url    text check (response_url ~ '^https://'),
  refusal_reason  text check (char_length(refusal_reason) <= 2000),
  answered_by     uuid references auth.users (id),
  answered_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (not urgent or urgent_reason is not null)
);
create index info_requests_status_idx on public.info_requests (status, due_at);
create index info_requests_user_idx on public.info_requests (user_id);
alter table public.info_requests enable row level security;
create policy "info requests: public read" on public.info_requests for select to anon using (is_public);
create policy "info requests: read public, own and staff" on public.info_requests for select to authenticated
  using (is_public or user_id = (select auth.uid()) or private.is_staff());
create policy "info requests: residents file their own" on public.info_requests for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "info requests: officers answer" on public.info_requests for update to authenticated
  using (private.has_role(array['super_admin', 'admin', 'chief_officer', 'sub_county_admin', 'ward_admin', 'officer']))
  with check (private.has_role(array['super_admin', 'admin', 'chief_officer', 'sub_county_admin', 'ward_admin', 'officer']));
-- Who asked stays private: the public never sees user_id.
revoke all on public.info_requests from anon, authenticated;
grant select (id, reference, requester_name, department_id, title, body, is_public, urgent, status, due_at, extended_to,
              extension_reason, response, response_url, refusal_reason, answered_at, created_at, updated_at)
  on public.info_requests to anon, authenticated;
grant insert (requester_name, department_id, title, body, is_public, urgent, urgent_reason) on public.info_requests to authenticated;
grant update (status, extended_to, extension_reason, response, response_url, refusal_reason) on public.info_requests to authenticated;
create trigger audit_info_requests after insert or update or delete on public.info_requests
  for each row execute function private.audit_row();
create trigger info_requests_touch before update on public.info_requests
  for each row execute function private.touch_updated_at();

-- The clock and its rules live here, so no form or officer can bend them.
create function private.info_requests_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.info_requests r where r.user_id = new.user_id and r.created_at > now() - interval '1 day') >= 5 then
      raise exception 'You can file up to 5 requests a day' using errcode = '54000';
    end if;
    new.status := 'submitted';
    new.created_at := now();
    new.due_at := now() + case when new.urgent then interval '48 hours' else interval '21 days' end;
    new.extended_to := null; new.extension_reason := null; new.response := null; new.refusal_reason := null;
    new.answered_at := null; new.answered_by := null;
    return new;
  end if;
  if old.status in ('answered', 'partly_answered', 'refused', 'withdrawn') and new.status is distinct from old.status then
    raise exception 'This request is closed' using errcode = '22023';
  end if;
  if new.status = 'extended' and old.status <> 'extended' then
    if old.extended_to is not null then raise exception 'A request can be extended only once' using errcode = '22023'; end if;
    if old.urgent then raise exception 'Urgent requests cannot be extended' using errcode = '22023'; end if;
    if coalesce(trim(new.extension_reason), '') = '' then raise exception 'Give the reason for the extension' using errcode = '22023'; end if;
    new.extended_to := old.due_at + interval '14 days';
  else
    new.extended_to := old.extended_to;
    if new.extension_reason is distinct from old.extension_reason and old.status <> 'submitted' then new.extension_reason := old.extension_reason; end if;
  end if;
  if new.status in ('answered', 'partly_answered') and coalesce(trim(new.response), '') = '' and new.response_url is null then
    raise exception 'Add the answer or a link to the documents' using errcode = '22023';
  end if;
  if new.status = 'refused' and coalesce(trim(new.refusal_reason), '') = '' then
    raise exception 'A refusal must give the reason and the section of the Act relied on' using errcode = '22023';
  end if;
  if new.status in ('answered', 'partly_answered', 'refused') and old.status not in ('answered', 'partly_answered', 'refused') then
    new.answered_at := now();
    new.answered_by := auth.uid();
  end if;
  new.due_at := old.due_at;
  return new;
end;
$$;
create trigger info_requests_rules before insert or update on public.info_requests
  for each row execute function private.info_requests_rules();

create function private.info_requests_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, title, message, kind, link)
    select distinct r.user_id, 'New information request ' || new.reference,
           new.title || '. Decision due ' || to_char(new.due_at at time zone 'Africa/Nairobi', 'DD Mon YYYY HH24:MI') || '.',
           case when new.urgent then 'warning' else 'info' end, '/console/information'
      from public.staff_roles r
     where r.active and (r.expires_at is null or r.expires_at > now()) and r.role in ('super_admin', 'admin', 'chief_officer');
  elsif new.status is distinct from old.status and new.status in ('extended', 'answered', 'partly_answered', 'refused') then
    insert into public.notifications (user_id, title, message, kind, link)
    values (new.user_id,
            case new.status when 'extended' then 'More time taken on ' when 'refused' then 'Request refused: ' else 'Your request was answered: ' end || new.reference,
            case new.status when 'extended' then 'The county extended the deadline by 14 days: ' || coalesce(new.extension_reason, '')
                            when 'refused' then 'You can ask the Commission on Administrative Justice to review this decision.'
                            else new.title end,
            case new.status when 'refused' then 'warning' when 'extended' then 'info' else 'success' end,
            '/information/' || new.reference);
  end if;
  return new;
end;
$$;
create trigger info_requests_notify after insert or update of status on public.info_requests
  for each row execute function private.info_requests_notify();

-- A resident's own requests, including private ones (the table hides user_id from everyone).
create function internal.my_info_requests()
returns setof public.info_requests
language sql
stable
security definer
set search_path = ''
as $$ select * from public.info_requests r where r.user_id = (select auth.uid()) order by r.created_at desc $$;
create function public.my_info_requests()
returns setof public.info_requests language sql stable security invoker set search_path = ''
as $$ select * from internal.my_info_requests() $$;
revoke all on function public.my_info_requests() from public, anon;
revoke all on function internal.my_info_requests() from public, anon;
grant execute on function public.my_info_requests() to authenticated, service_role;
grant execute on function internal.my_info_requests() to authenticated, service_role;

-- ---- consultations: have your say on a draft -----------------------------------------------------------------------
create table public.consultations (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,78}$'),
  kind         text not null default 'policy' check (kind in ('bill', 'budget', 'policy', 'plan', 'other')),
  title        text not null check (char_length(title) between 5 and 200),
  title_sw     text check (char_length(title_sw) <= 200),
  summary      text not null check (char_length(summary) between 20 and 4000),   -- plain-language summary
  summary_sw   text check (char_length(summary_sw) <= 4000),
  document_url text check (document_url ~ '^https://'),
  questions    text[] not null default '{}',                                    -- sections or questions residents answer
  ward_id      text references public.wards (id),
  opens_at     timestamptz not null default now(),
  closes_at    timestamptz not null,
  report       text check (char_length(report) <= 20000),                       -- what was heard and what changed
  report_url   text check (report_url ~ '^https://'),
  report_at    timestamptz,
  created_by   uuid references auth.users (id) default auth.uid(),
  created_at   timestamptz not null default now(),
  -- residents need reasonable time to read and respond: at least seven days of comments
  check (closes_at >= opens_at + interval '7 days')
);
alter table public.consultations enable row level security;
create policy "consultations: public read" on public.consultations for select to anon, authenticated using (true);
create policy "consultations: publishers insert" on public.consultations for insert to authenticated
  with check (private.has_role(array['super_admin', 'admin', 'chief_officer']));
create policy "consultations: publishers update" on public.consultations for update to authenticated
  using (private.has_role(array['super_admin', 'admin', 'chief_officer']))
  with check (private.has_role(array['super_admin', 'admin', 'chief_officer']));
create policy "consultations: admins delete" on public.consultations for delete to authenticated using (private.is_admin());
grant select on public.consultations to anon, authenticated;
grant insert, update, delete on public.consultations to authenticated;
create trigger audit_consultations after insert or update or delete on public.consultations
  for each row execute function private.audit_row();

create table public.consultation_comments (
  id              bigint generated always as identity primary key,
  consultation_id uuid not null references public.consultations (id) on delete cascade,
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  author_name     text check (char_length(author_name) <= 80),
  ward_id         text references public.wards (id),
  question        int check (question >= 0),                          -- index into consultations.questions
  stance          text not null default 'comment' check (stance in ('support', 'oppose', 'amend', 'comment')),
  body            text not null check (char_length(body) between 5 and 2000),
  created_at      timestamptz not null default now()
);
create index consultation_comments_idx on public.consultation_comments (consultation_id, created_at);
alter table public.consultation_comments enable row level security;
create policy "comments: public read" on public.consultation_comments for select to anon, authenticated using (true);
create policy "comments: residents while open" on public.consultation_comments for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.consultations c where c.id = consultation_id and now() between c.opens_at and c.closes_at));
create policy "comments: admins remove abuse" on public.consultation_comments for delete to authenticated using (private.is_admin());
revoke all on public.consultation_comments from anon, authenticated;
grant select (id, consultation_id, author_name, ward_id, question, stance, body, created_at) on public.consultation_comments to anon, authenticated;
grant insert (consultation_id, author_name, ward_id, question, stance, body) on public.consultation_comments to authenticated;
grant delete on public.consultation_comments to authenticated;
create trigger audit_consultation_comments after insert or delete on public.consultation_comments
  for each row execute function private.audit_row();

create function private.consultation_comments_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.created_at := now();
  if (select count(*) from public.consultation_comments c where c.user_id = new.user_id and c.consultation_id = new.consultation_id) >= 20 then
    raise exception 'You can leave up to 20 comments on one consultation' using errcode = '54000';
  end if;
  if new.question is not null and new.question >= (select coalesce(array_length(c.questions, 1), 0) from public.consultations c where c.id = new.consultation_id) then
    new.question := null;
  end if;
  return new;
end;
$$;
create trigger consultation_comments_limit before insert on public.consultation_comments
  for each row execute function private.consultation_comments_limit();

-- Opening reaches the ward's followers; the report reaches everyone who commented.
create function private.consultations_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.ward_id is not null then
    perform private.tell_followers('ward_tenders', new.ward_id, 'Have your say: ' || left(new.title, 120),
      'Comments close ' || to_char(new.closes_at at time zone 'Africa/Nairobi', 'DD Mon YYYY') || '.', '/have-your-say/' || new.slug);
  end if;
  if new.report is not null and (tg_op = 'INSERT' or old.report is null) then
    new.report_at := now();
    insert into public.notifications (user_id, title, message, kind, link)
    select distinct c.user_id, 'What the county heard: ' || left(new.title, 120),
           'The report on the consultation you took part in is published.', 'success', '/have-your-say/' || new.slug
      from public.consultation_comments c where c.consultation_id = new.id;
  end if;
  return new;
end;
$$;
create trigger consultations_notify before insert or update of report on public.consultations
  for each row execute function private.consultations_notify();

-- Totals by stance and question, for the public page and the report.
create function internal.consultation_tally(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'comments', count(cc.id),
    'people', count(distinct cc.user_id),
    'wards', count(distinct cc.ward_id),
    'by_stance', coalesce((select jsonb_object_agg(s.stance, s.n) from (
        select c2.stance, count(*) n from public.consultation_comments c2 where c2.consultation_id = c.id group by c2.stance) s), '{}'::jsonb))
  from public.consultations c
  left join public.consultation_comments cc on cc.consultation_id = c.id
  where c.slug = p_slug
  group by c.id;
$$;
create function public.consultation_tally(p_slug text)
returns jsonb language sql stable security invoker set search_path = ''
as $$ select internal.consultation_tally(p_slug => p_slug) $$;
revoke all on function public.consultation_tally(text) from public;
grant execute on function public.consultation_tally(text) to anon, authenticated, service_role;
grant execute on function internal.consultation_tally(text) to anon, authenticated, service_role;

-- ---- petitions: enough support earns an answer ---------------------------------------------------------------------
-- 200 supporters for a ward petition, 1,000 for a county-wide one; the county then has 30 days to answer in public.
alter table public.proposals add column response_due_at timestamptz;
alter table public.proposals add column threshold_reached_at timestamptz;

create function private.petition_threshold()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_goal int := case when new.ward_id is null then 1000 else 200 end;
begin
  if new.kind = 'petition' and new.threshold_reached_at is null and new.supporters >= v_goal then
    new.threshold_reached_at := now();
    new.response_due_at := now() + interval '30 days';
    insert into public.notifications (user_id, title, message, kind, link)
    select distinct r.user_id, 'A petition needs an answer within 30 days',
           '"' || left(new.title, 120) || '" reached ' || v_goal || ' supporters.', 'warning', '/console/ideas'
      from public.staff_roles r
     where r.active and (r.expires_at is null or r.expires_at > now())
       and (r.role in ('super_admin', 'admin', 'chief_officer') or (r.role in ('sub_county_admin', 'ward_admin') and r.ward_id = new.ward_id));
  end if;
  return new;
end;
$$;
create trigger proposals_petition_threshold before update of supporters on public.proposals
  for each row execute function private.petition_threshold();

-- ---- Data Protection Act: my data, and erasure -------------------------------------------------------------------
create table private.erasure_requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  email        text,
  reason       text check (char_length(reason) <= 1000),
  due_at       timestamptz not null default now() + interval '14 days',
  done_at      timestamptz,
  created_at   timestamptz not null default now()
);
create unique index erasure_requests_open_idx on private.erasure_requests (user_id) where done_at is null;

-- Everything the county holds about the signed-in person, as one JSON document they can save.
create function internal.my_data()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'generated_at', now(),
    'law', 'Data Protection Act, 2019, section 26',
    'profile', (select to_jsonb(p) from public.profiles p where p.id = (select auth.uid())),
    'staff_roles', coalesce((select jsonb_agg(jsonb_build_object('role', r.role, 'ward_id', r.ward_id, 'active', r.active, 'created_at', r.created_at)) from public.staff_roles r where r.user_id = (select auth.uid())), '[]'::jsonb),
    'applications', coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at) from public.applications a where a.applicant_id = (select auth.uid())), '[]'::jsonb),
    'follows', coalesce((select jsonb_agg(jsonb_build_object('kind', f.kind, 'key', f.key, 'label', f.label, 'created_at', f.created_at)) from public.follows f where f.user_id = (select auth.uid())), '[]'::jsonb),
    'notifications', coalesce((select jsonb_agg(jsonb_build_object('title', n.title, 'message', n.message, 'created_at', n.created_at) order by n.created_at desc) from public.notifications n where n.user_id = (select auth.uid())), '[]'::jsonb),
    'information_requests', coalesce((select jsonb_agg(to_jsonb(i) - 'user_id' order by i.created_at) from public.info_requests i where i.user_id = (select auth.uid())), '[]'::jsonb),
    'consultation_comments', coalesce((select jsonb_agg(to_jsonb(c) - 'user_id' order by c.created_at) from public.consultation_comments c where c.user_id = (select auth.uid())), '[]'::jsonb),
    'erasure_requests', coalesce((select jsonb_agg(jsonb_build_object('created_at', e.created_at, 'due_at', e.due_at, 'done_at', e.done_at)) from private.erasure_requests e where e.user_id = (select auth.uid())), '[]'::jsonb),
    'not_linked_to_you', 'Reports, votes, "me too" and petition support are stored without your account, as keyed hashes or anonymous records, so they cannot be listed here.'
  )
  where (select auth.uid()) is not null;
$$;
create function public.my_data()
returns jsonb language sql stable security invoker set search_path = ''
as $$ select internal.my_data() $$;
revoke all on function public.my_data() from public, anon;
revoke all on function internal.my_data() from public, anon;
grant execute on function public.my_data() to authenticated, service_role;
grant execute on function internal.my_data() to authenticated, service_role;

-- Ask for the account to be erased. Admins are told and have 14 days; records the law requires the county to keep
-- (payments, permits issued) are kept and the reply says so.
create function internal.request_erasure(p_reason text default null)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_due timestamptz;
begin
  if v_uid is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  select e.due_at into v_due from private.erasure_requests e where e.user_id = v_uid and e.done_at is null;
  if found then return v_due; end if;
  insert into private.erasure_requests (user_id, email, reason)
  values (v_uid, (select u.email from auth.users u where u.id = v_uid), left(p_reason, 1000))
  returning due_at into v_due;
  insert into public.notifications (user_id, title, message, kind, link)
  select distinct r.user_id, 'Account erasure request', 'A resident asked for their account to be erased. Due ' || to_char(v_due at time zone 'Africa/Nairobi', 'DD Mon YYYY') || '.', 'warning', '/console/admin'
    from public.staff_roles r where r.active and r.role in ('super_admin', 'admin');
  return v_due;
end;
$$;
create function public.request_erasure(p_reason text default null)
returns timestamptz language sql volatile security invoker set search_path = ''
as $$ select internal.request_erasure(p_reason => p_reason) $$;
revoke all on function public.request_erasure(text) from public, anon;
revoke all on function internal.request_erasure(text) from public, anon;
grant execute on function public.request_erasure(text) to authenticated, service_role;
grant execute on function internal.request_erasure(text) to authenticated, service_role;

-- For admins: open erasure requests, and carrying one out. Erasure removes the profile details, follows, notifications
-- and the resident's comments; the auth account itself is deleted from the dashboard (Authentication, Users).
create function internal.erasure_queue()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.is_admin() then coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'email', e.email, 'reason', e.reason,
    'created_at', e.created_at, 'due_at', e.due_at) order by e.due_at), '[]'::jsonb) else '[]'::jsonb end
  from private.erasure_requests e where e.done_at is null;
$$;
create function public.erasure_queue()
returns jsonb language sql stable security invoker set search_path = ''
as $$ select internal.erasure_queue() $$;
revoke all on function public.erasure_queue() from public, anon;
revoke all on function internal.erasure_queue() from public, anon;
grant execute on function public.erasure_queue() to authenticated, service_role;
grant execute on function internal.erasure_queue() to authenticated, service_role;

create function internal.carry_out_erasure(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
begin
  if not private.is_admin() then raise exception 'Only administrators can do this' using errcode = '42501'; end if;
  select e.user_id into v_uid from private.erasure_requests e where e.id = p_id and e.done_at is null;
  if not found then raise exception 'No open request' using errcode = 'P0002'; end if;
  update public.profiles set name = '', email = null, phone = null, national_id = null, address = null, avatar_url = null where id = v_uid;
  delete from public.follows where user_id = v_uid;
  delete from public.notifications where user_id = v_uid;
  delete from public.consultation_comments where user_id = v_uid;
  update public.info_requests set requester_name = null where user_id = v_uid;
  update private.erasure_requests set done_at = now(), email = null where id = p_id;
end;
$$;
create function public.carry_out_erasure(p_id uuid)
returns void language sql volatile security invoker set search_path = ''
as $$ select internal.carry_out_erasure(p_id => p_id) $$;
revoke all on function public.carry_out_erasure(uuid) from public, anon;
revoke all on function internal.carry_out_erasure(uuid) from public, anon;
grant execute on function public.carry_out_erasure(uuid) to authenticated, service_role;
grant execute on function internal.carry_out_erasure(uuid) to authenticated, service_role;

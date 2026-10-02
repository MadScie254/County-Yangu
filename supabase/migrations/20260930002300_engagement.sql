-- Migration 0023: things that bring residents back, built on outcomes rather than volume.
--   1. "It's fixed" SMS says how many days it took and points to the before and after photos
--   2. Ward league: wards (never people) ranked on fixing on time, answering on time and taking part
--   3. A public live feed of what is happening (no descriptions, no reporters, no sensitive categories)
--   4. Community clean-ups: champions and ward staff post them, residents say they are going
--   5. Ask your MCA: public questions, upvotes, answers and an answer rate per ward
--   6. Promise deadlines: followers are told when a promise passes its due date
--   7. The weekly ward SMS becomes three lines: fixed, late, one thing you can do

-- ===================================================================================================================
-- 1. "It's fixed" message
-- ===================================================================================================================
create or replace function private.notify_report_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text;
  v_r public.reports;
  v_url text;
  v_line text;
  v_days int;
begin
  if not new.is_public or new.kind not in ('status', 'public_message', 'reopened') then return new; end if;
  select c.phone_e164 into v_phone from private.report_contacts c where c.report_id = new.report_id;
  if v_phone is null then return new; end if;
  select * into v_r from public.reports r where r.id = new.report_id;
  select c.settings ->> 'web_url' into v_url from public.county c limit 1;
  if new.kind = 'status' and new.data ->> 'status' = 'resolved' then
    v_days := greatest(0, floor(extract(epoch from (coalesce(v_r.resolved_at, now()) - v_r.created_at)) / 86400)::int);
    insert into private.outbox (channel, recipient, body, related)
    values ('sms', v_phone,
            left('Fixed! ' || v_r.reference || ' was fixed ' || case when v_days = 0 then 'the same day.' when v_days = 1 then 'in 1 day.' else 'in ' || v_days || ' days.' end
              || coalesce(' ' || new.message, '')
              || case when v_url is not null then ' See the before and after, and tell us if it is really fixed: ' || v_url || '/case/' || v_r.reference else '' end, 480),
            jsonb_build_object('report_id', new.report_id, 'event', 'fixed'));
    return new;
  end if;
  v_line := case when new.kind = 'status' then initcap(replace(coalesce(new.data ->> 'status', 'updated'), '_', ' ')) else null end;
  insert into private.outbox (channel, recipient, body, related)
  values ('sms', v_phone,
          'County update ' || v_r.reference || ': ' || coalesce(v_line, '') || case when v_line is not null and new.message is not null then ' - ' else '' end
            || coalesce(new.message, '') || case when v_url is not null then ' ' || v_url || '/case/' || v_r.reference else '' end,
          jsonb_build_object('report_id', new.report_id, 'event', new.kind));
  return new;
end;
$$;

-- ===================================================================================================================
-- 2. Ward league
-- ===================================================================================================================
-- Score 0 to 100 for a window of p_days, and the same for the window before it so "most improved" is fair:
--   45% problems fixed on time (of those due in the window), 30% acknowledged on time, 25% residents taking part
--   (reports, budget votes, poll answers and consultation comments per 1,000 residents; 5 per 1,000 counts as full).
-- A ward needs at least 3 reports in a window to be scored, so one lucky fix cannot top the table.
create function internal.ward_league(p_days int default 30)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with win as (
    select 0 as w, now() - make_interval(days => p_days) as a, now() as b
    union all select 1, now() - make_interval(days => 2 * p_days), now() - make_interval(days => p_days)
  ), rep as (
    select win.w, r.ward_id,
           count(*) filter (where r.created_at >= win.a and r.created_at < win.b) as reports,
           count(*) filter (where r.created_at >= win.a and r.created_at < win.b and r.acknowledged_at is not null and r.acknowledged_at <= r.ack_due_at) as acked_on_time,
           count(*) filter (where r.resolve_due_at >= win.a and r.resolve_due_at < win.b) as due,
           count(*) filter (where r.resolve_due_at >= win.a and r.resolve_due_at < win.b and r.resolved_at is not null and r.resolved_at <= r.resolve_due_at) as fixed_on_time,
           count(*) filter (where r.resolved_at >= win.a and r.resolved_at < win.b) as fixed,
           percentile_cont(0.5) within group (order by extract(epoch from r.resolved_at - r.created_at) / 86400)
             filter (where r.resolved_at >= win.a and r.resolved_at < win.b) as median_days
      from win cross join public.reports r
     where r.status <> 'rejected'
     group by win.w, r.ward_id
  ), part as (
    select win.w, x.ward_id, count(*) as n
      from win cross join lateral (
        select v.ward_id, v.created_at from public.votes v
        union all select p.ward_id, p.created_at from public.poll_votes p where p.ward_id is not null
        union all select c.ward_id, c.created_at from public.consultation_comments c where c.ward_id is not null
        union all select r.ward_id, r.created_at from public.reports r
      ) x
     where x.created_at >= win.a and x.created_at < win.b
     group by win.w, x.ward_id
  ), scored as (
    select wd.id as ward_id, wd.name, wd.population, win.w,
           coalesce(rep.reports, 0) as reports, coalesce(rep.fixed, 0) as fixed, coalesce(rep.due, 0) as due,
           coalesce(rep.fixed_on_time, 0) as fixed_on_time, coalesce(rep.acked_on_time, 0) as acked_on_time,
           rep.median_days, coalesce(part.n, 0) as taking_part,
           case when coalesce(rep.reports, 0) < 3 then null else round(100 * (
               0.45 * case when coalesce(rep.due, 0) = 0 then 0.5 else rep.fixed_on_time::numeric / rep.due end
             + 0.30 * rep.acked_on_time::numeric / rep.reports
             + 0.25 * least(1, coalesce(part.n, 0) * 1000.0 / greatest(coalesce(wd.population, 30000), 1) / 5)), 1) end as score
      from public.wards wd cross join win
      left join rep on rep.ward_id = wd.id and rep.w = win.w
      left join part on part.ward_id = wd.id and part.w = win.w
  )
  select jsonb_build_object('days', p_days, 'generated_at', now(), 'wards', coalesce(jsonb_agg(jsonb_build_object(
      'ward_id', c.ward_id, 'name', c.name, 'score', c.score, 'previous', p.score,
      'change', case when c.score is not null and p.score is not null then round(c.score - p.score, 1) end,
      'reports', c.reports, 'fixed', c.fixed, 'due', c.due, 'fixed_on_time', c.fixed_on_time, 'acked_on_time', c.acked_on_time,
      'median_days', round(c.median_days::numeric, 1), 'taking_part', c.taking_part)
      order by c.score desc nulls last, c.name), '[]'::jsonb))
    from scored c join scored p on p.ward_id = c.ward_id and p.w = 1
   where c.w = 0;
$$;
create function public.ward_league(p_days int default 30)
returns jsonb language sql stable security invoker set search_path = ''
as $$ select internal.ward_league(p_days => least(greatest(coalesce(p_days, 30), 7), 365)) $$;
revoke all on function public.ward_league(int) from public;
revoke all on function internal.ward_league(int) from public;
grant execute on function public.ward_league(int) to anon, authenticated, service_role;
grant execute on function internal.ward_league(int) to anon, authenticated, service_role;

-- ===================================================================================================================
-- 3. Live public feed
-- ===================================================================================================================
create function internal.live_activity(p_limit int default 30)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(x order by (x ->> 'at') desc), '[]'::jsonb) from (
    select * from (
      select jsonb_build_object('kind', 'report', 'ward', w.name, 'ward_id', w.id, 'category', c.name, 'category_sw', c.name_sw, 'at', r.created_at) as x
        from public.reports r join public.wards w on w.id = r.ward_id join public.report_categories c on c.id = r.category_id
       where not c.sensitive and r.status <> 'rejected' and r.created_at > now() - interval '14 days'
      union all
      select jsonb_build_object('kind', 'resolved', 'ward', w.name, 'ward_id', w.id, 'category', c.name, 'category_sw', c.name_sw, 'at', r.resolved_at,
                                'reference', r.reference, 'days', greatest(0, floor(extract(epoch from r.resolved_at - r.created_at) / 86400))::int)
        from public.reports r join public.wards w on w.id = r.ward_id join public.report_categories c on c.id = r.category_id
       where not c.sensitive and r.resolved_at > now() - interval '14 days' and r.status in ('resolved', 'closed')
      union all
      select jsonb_build_object('kind', 'milestone', 'ward', w.name, 'ward_id', w.id, 'title', m.title, 'project', p.title, 'slug', p.slug, 'at', m.completed_at::timestamptz)
        from public.project_milestones m join public.projects p on p.id = m.project_id join public.wards w on w.id = p.ward_id
       where p.published and m.completed_at > now() - interval '30 days'
      union all
      select jsonb_build_object('kind', 'poll', 'title', p.question, 'slug', p.slug, 'at', p.opens_at)
        from public.polls p where p.opens_at <= now() and p.opens_at > now() - interval '30 days'
      union all
      select jsonb_build_object('kind', 'notice', 'ward', w.name, 'title', n.title, 'at', n.starts_at)
        from public.service_notices n left join public.wards w on w.id = n.ward_id
       where n.status = 'active' and n.starts_at <= now() and n.starts_at > now() - interval '14 days'
    ) y order by (x ->> 'at') desc limit least(greatest(coalesce(p_limit, 30), 1), 100)
  ) z;
$$;
create function public.live_activity(p_limit int default 30)
returns jsonb language sql stable security invoker set search_path = ''
as $$ select internal.live_activity(p_limit => p_limit) $$;
revoke all on function public.live_activity(int) from public;
revoke all on function internal.live_activity(int) from public;
grant execute on function public.live_activity(int) to anon, authenticated, service_role;
grant execute on function internal.live_activity(int) to anon, authenticated, service_role;

-- ===================================================================================================================
-- 4. Community clean-ups and other neighbourhood events
-- ===================================================================================================================
create table public.community_events (
  id          uuid primary key default gen_random_uuid(),
  ward_id     text not null references public.wards (id),
  kind        text not null default 'cleanup' check (kind in ('cleanup', 'tree_planting', 'drainage', 'other')),
  title       text not null check (char_length(title) between 5 and 120),
  details     text check (char_length(details) <= 1000),
  meet_at     text not null check (char_length(meet_at) between 3 and 200),
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  status      text not null default 'scheduled' check (status in ('scheduled', 'cancelled', 'held')),
  going       int not null default 0,
  attended    int check (attended >= 0),
  outcome     text check (char_length(outcome) <= 1000),
  created_by  uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at  timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index community_events_when_idx on public.community_events (starts_at);
alter table public.community_events enable row level security;
create policy "events: public read" on public.community_events for select to anon, authenticated using (true);
create policy "events: champions and ward staff post" on public.community_events for insert to authenticated
  with check (created_by = (select auth.uid()) and (
    exists (select 1 from public.ward_champions c where c.user_id = (select auth.uid()) and c.ward_id = community_events.ward_id and c.status = 'active')
    or private.can_manage_ward(ward_id)));
create policy "events: organiser and ward staff update" on public.community_events for update to authenticated
  using (created_by = (select auth.uid()) or private.can_manage_ward(ward_id))
  with check (created_by = (select auth.uid()) or private.can_manage_ward(ward_id));
revoke all on public.community_events from anon, authenticated;
grant select (id, ward_id, kind, title, details, meet_at, starts_at, ends_at, status, going, attended, outcome, created_at) on public.community_events to anon, authenticated;
grant insert (ward_id, kind, title, details, meet_at, starts_at, ends_at) on public.community_events to authenticated;
grant update (title, details, meet_at, starts_at, ends_at, status, attended, outcome) on public.community_events to authenticated;

create table public.event_rsvps (
  event_id   uuid not null references public.community_events (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
alter table public.event_rsvps enable row level security;
create policy "rsvps: own" on public.event_rsvps for select to authenticated using (user_id = (select auth.uid()));
create policy "rsvps: say you are going" on public.event_rsvps for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.community_events e where e.id = event_id and e.status = 'scheduled' and e.ends_at > now()));
create policy "rsvps: change your mind" on public.event_rsvps for delete to authenticated using (user_id = (select auth.uid()));
grant select, insert, delete on public.event_rsvps to authenticated;

create function private.events_going()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.community_events e set going = (select count(*) from public.event_rsvps r where r.event_id = e.id)
   where e.id = coalesce(new.event_id, old.event_id);
  return null;
end;
$$;
create trigger event_rsvps_count after insert or delete on public.event_rsvps for each row execute function private.events_going();

create function private.events_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.tell_followers('ward_tenders', new.ward_id, 'Neighbourhood event: ' || left(new.title, 100),
      to_char(new.starts_at at time zone 'Africa/Nairobi', 'Dy DD Mon HH24:MI') || ', ' || left(new.meet_at, 80) || '.', '/events#' || new.id);
  elsif new.status = 'cancelled' and old.status <> 'cancelled' then
    insert into public.notifications (user_id, title, message, kind, link)
    select r.user_id, 'Event cancelled: ' || left(new.title, 100), 'The organiser cancelled it.', 'warning', '/events#' || new.id
      from public.event_rsvps r where r.event_id = new.id;
  end if;
  return new;
end;
$$;
create trigger community_events_notify after insert or update of status on public.community_events
  for each row execute function private.events_notify();

-- ===================================================================================================================
-- 5. Ask your MCA
-- ===================================================================================================================
create table public.mca_questions (
  id          uuid primary key default gen_random_uuid(),
  ward_id     text not null references public.wards (id),
  user_id     uuid not null references auth.users (id) on delete cascade default auth.uid(),
  body        text not null check (char_length(body) between 10 and 600),
  votes       int not null default 0,
  status      text not null default 'open' check (status in ('open', 'answered')),
  hidden      boolean not null default false,
  answer      text check (char_length(answer) <= 3000),
  answered_by uuid references auth.users (id),
  answered_at timestamptz,
  created_at  timestamptz not null default now()
);
create index mca_questions_ward_idx on public.mca_questions (ward_id, created_at desc);
alter table public.mca_questions enable row level security;
create policy "mca questions: public" on public.mca_questions for select to anon using (not hidden);
create policy "mca questions: signed in" on public.mca_questions for select to authenticated
  using (not hidden or user_id = (select auth.uid()) or private.is_admin());
create policy "mca questions: residents ask" on public.mca_questions for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'open' and answer is null);
create policy "mca questions: the ward's MCA answers" on public.mca_questions for update to authenticated
  using (exists (select 1 from public.staff_roles s where s.user_id = (select auth.uid()) and s.active and s.role = 'assembly_member' and s.ward_id = mca_questions.ward_id)
         or private.is_admin())
  with check (exists (select 1 from public.staff_roles s where s.user_id = (select auth.uid()) and s.active and s.role = 'assembly_member' and s.ward_id = mca_questions.ward_id)
         or private.is_admin());
revoke all on public.mca_questions from anon, authenticated;
grant select (id, ward_id, body, votes, status, hidden, answer, answered_at, created_at) on public.mca_questions to anon, authenticated;
grant insert (ward_id, body) on public.mca_questions to authenticated;
grant update (answer, hidden) on public.mca_questions to authenticated;

create table public.mca_question_votes (
  question_id uuid not null references public.mca_questions (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at  timestamptz not null default now(),
  primary key (question_id, user_id)
);
alter table public.mca_question_votes enable row level security;
create policy "mca votes: own" on public.mca_question_votes for select to authenticated using (user_id = (select auth.uid()));
create policy "mca votes: one each" on public.mca_question_votes for insert to authenticated with check (user_id = (select auth.uid()));
create policy "mca votes: take back" on public.mca_question_votes for delete to authenticated using (user_id = (select auth.uid()));
grant select, insert, delete on public.mca_question_votes to authenticated;

create function private.mca_votes_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.mca_questions q set votes = (select count(*) from public.mca_question_votes v where v.question_id = q.id)
   where q.id = coalesce(new.question_id, old.question_id);
  return null;
end;
$$;
create trigger mca_question_votes_count after insert or delete on public.mca_question_votes for each row execute function private.mca_votes_count();

create function private.mca_questions_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.mca_questions q where q.user_id = new.user_id and q.created_at > now() - interval '1 day') >= 3 then
      raise exception 'You can ask up to 3 questions a day' using errcode = '54000';
    end if;
    new.votes := 0;
    insert into public.notifications (user_id, title, message, kind, link)
    select s.user_id, 'New question from a resident', left(new.body, 140), 'info', '/console/questions'
      from public.staff_roles s where s.active and s.role = 'assembly_member' and s.ward_id = new.ward_id;
    return new;
  end if;
  if new.answer is distinct from old.answer then
    if coalesce(btrim(new.answer), '') = '' then raise exception 'An answer cannot be empty' using errcode = '22023'; end if;
    if old.answered_at is null then
      new.answered_at := now();
      insert into public.notifications (user_id, title, message, kind, link)
      values (new.user_id, 'Your MCA answered', left(new.answer, 140), 'success', '/ask#' || new.id);
    end if;
    new.answered_by := (select auth.uid());
    new.status := 'answered';
  end if;
  new.body := old.body; new.ward_id := old.ward_id; new.user_id := old.user_id; new.created_at := old.created_at;
  return new;
end;
$$;
create trigger mca_questions_rules before insert or update on public.mca_questions for each row execute function private.mca_questions_rules();

-- Hiding is for administrators (or the three-flag rule, which runs with owner rights). This guard runs with the
-- caller's rights so it can tell a direct update by a signed-in user from the automatic one.
create function private.mca_hide_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.hidden is distinct from old.hidden and current_user = 'authenticated' and not private.is_admin() then
    raise exception 'Only administrators can hide a question' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger mca_questions_hide_guard before update of hidden on public.mca_questions for each row execute function private.mca_hide_guard();

-- Answer rate per ward: asked, answered, answered within 14 days, waiting.
create function internal.mca_scoreboard()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('ward_id', x.ward_id, 'asked', x.asked, 'answered', x.answered, 'on_time', x.on_time, 'waiting', x.waiting)
         order by x.asked desc), '[]'::jsonb)
    from (select q.ward_id, count(*) asked, count(*) filter (where q.answered_at is not null) answered,
                 count(*) filter (where q.answered_at is not null and q.answered_at <= q.created_at + interval '14 days') on_time,
                 count(*) filter (where q.answered_at is null) waiting
            from public.mca_questions q where not q.hidden group by q.ward_id) x;
$$;
create function public.mca_scoreboard()
returns jsonb language sql stable security invoker set search_path = ''
as $$ select internal.mca_scoreboard() $$;
revoke all on function public.mca_scoreboard() from public;
revoke all on function internal.mca_scoreboard() from public;
grant execute on function public.mca_scoreboard() to anon, authenticated, service_role;
grant execute on function internal.mca_scoreboard() to anon, authenticated, service_role;

-- Questions can be flagged like comments; three flags hide one until an administrator decides.
alter table public.content_flags drop constraint content_flags_kind_check;
alter table public.content_flags add constraint content_flags_kind_check
  check (kind in ('consultation_comment', 'statement', 'champion_check', 'concern', 'mca_question'));

create or replace function private.flags_autohide()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.content_flags f where f.kind = new.kind and f.target_id = new.target_id and f.status = 'open') >= 3 then
    if new.kind = 'consultation_comment' then update public.consultation_comments set hidden = true where id::text = new.target_id;
    elsif new.kind = 'statement' then update public.consultation_statements set hidden = true where id::text = new.target_id;
    elsif new.kind = 'mca_question' then update public.mca_questions set hidden = true where id::text = new.target_id;
    end if;
  end if;
  return new;
end;
$$;

create or replace function internal.moderation_queue()
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
        when 'concern' then (select c.body from public.tender_concerns c where c.id::text = f.target_id)
        when 'mca_question' then (select q.body from public.mca_questions q where q.id::text = f.target_id) end,
      'hidden', case f.kind
        when 'consultation_comment' then (select c.hidden from public.consultation_comments c where c.id::text = f.target_id)
        when 'statement' then (select s.hidden from public.consultation_statements s where s.id::text = f.target_id)
        when 'mca_question' then (select q.hidden from public.mca_questions q where q.id::text = f.target_id) end) as x
      from public.content_flags f where f.status = 'open' group by f.kind, f.target_id
  ) t;
$$;

create or replace function internal.moderate(p_kind text, p_target text, p_remove boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then raise exception 'Only administrators can do this' using errcode = '42501'; end if;
  if p_kind = 'consultation_comment' then update public.consultation_comments set hidden = p_remove where id::text = p_target;
  elsif p_kind = 'statement' then update public.consultation_statements set hidden = p_remove where id::text = p_target;
  elsif p_kind = 'mca_question' then update public.mca_questions set hidden = p_remove where id::text = p_target;
  elsif p_kind = 'champion_check' and p_remove then delete from public.champion_checks where id::text = p_target;
  end if;
  update public.content_flags set status = case when p_remove then 'removed' else 'kept' end where kind = p_kind and target_id = p_target and status = 'open';
end;
$$;

-- ===================================================================================================================
-- 6. Promise deadlines
-- ===================================================================================================================
alter table public.commitments add column deadline_told_on date;

create function public.svc_promise_deadlines()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
  n int := 0;
begin
  for c in
    select * from public.commitments
     where due_on < (now() at time zone 'Africa/Nairobi')::date and status in ('not_started', 'in_progress', 'delayed')
       and (deadline_told_on is null or deadline_told_on < due_on)
  loop
    perform private.tell_followers('commitment', c.slug, 'Promise deadline passed: ' || left(c.title, 100),
      'It was due on ' || to_char(c.due_on, 'DD Mon YYYY') || ' and is not delivered.', '/promises#' || c.slug, 'warning');
    update public.commitments set deadline_told_on = (now() at time zone 'Africa/Nairobi')::date where id = c.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke all on function public.svc_promise_deadlines() from public, anon, authenticated;
grant execute on function public.svc_promise_deadlines() to service_role;

-- ===================================================================================================================
-- 7. The weekly ward SMS: fixed, late, one thing to do
-- ===================================================================================================================
create or replace function public.svc_ward_updates(p_frequency text)
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
  v_do text;
  n int;
  total int := 0;
begin
  if v_days is null then return 0; end if;
  select c.name, c.settings ->> 'web_url' into v_name, v_url from public.county c limit 1;
  for w in
    select ward.id, ward.name,
           (select count(*) from public.reports r where r.ward_id = ward.id and r.resolved_at >= now() - make_interval(days => v_days)) as fixed,
           (select count(*) from public.reports r where r.ward_id = ward.id and r.status not in ('resolved', 'closed', 'rejected')) as open_now,
           (select count(*) from public.reports r where r.ward_id = ward.id and r.status not in ('resolved', 'closed', 'rejected') and r.resolve_due_at < now()) as late
      from public.wards ward
     where exists (select 1 from private.subscribers s
                    where s.ward_id = ward.id and s.frequency = p_frequency and s.verified_at is not null and s.opted_out_at is null)
  loop
    -- one thing to do, the most useful first
    select coalesce(
      (select 'Clean-up ' || to_char(e.starts_at at time zone 'Africa/Nairobi', 'Dy DD Mon') || ' at ' || left(e.meet_at, 40) || '.'
         from public.community_events e where e.ward_id = w.id and e.status = 'scheduled' and e.starts_at > now() order by e.starts_at limit 1),
      (select 'Meeting ' || to_char(m.starts_at at time zone 'Africa/Nairobi', 'Dy DD Mon') || ': ' || left(m.title, 50) || '.'
         from public.public_meetings m where (m.ward_id = w.id or m.ward_id is null) and m.status = 'scheduled' and m.starts_at > now() order by m.starts_at limit 1),
      (select 'Answer the poll: ' || left(p.question, 60) from public.polls p
        where (p.ward_id = w.id or p.ward_id is null) and now() between p.opens_at and p.closes_at order by p.closes_at limit 1),
      (select 'Have your say on ' || left(c.title, 50) || ' by ' || to_char(c.closes_at, 'DD Mon') || '.' from public.consultations c
        where (c.ward_id = w.id or c.ward_id is null) and now() between c.opens_at and c.closes_at order by c.closes_at limit 1),
      'Report a problem: dial the county code or visit the site.') into v_do;
    insert into private.outbox (channel, recipient, body, related)
    select 'sms', s.phone_e164,
           left(format(E'%s %s:\nFixed: %s. Late: %s of %s open.\nDo: %s%s Reply STOP to opt out.',
                       w.name, case p_frequency when 'daily' then 'today' else 'this week' end,
                       w.fixed, w.late, w.open_now, v_do,
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

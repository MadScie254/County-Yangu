-- 0014  Ward budget results and quarterly rounds, and following a supplier, a project or a place.

-- ---- what the ward decided ----------------------------------------------------------------------------------------
-- Every option in a round with its votes, and a running total in vote order within its ward: an option is funded while
-- the running total stays inside the ward's envelope.
create function private.option_tally(p_cycle text)
returns table (ward_id text, id text, title text, sector text, amount numeric, votes bigint, running numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select x.ward_id, x.id, x.title, x.sector, x.amount, x.votes,
         sum(x.amount) over (partition by x.ward_id order by x.votes desc, x.title, x.id) as running
    from (
      select o.ward_id, o.id, o.title, o.sector, o.amount,
             (select count(*) from public.votes v where v.option_id = o.id) as votes
        from public.project_options o where o.cycle_id = p_cycle
    ) x;
$$;

create function private.published_cycles()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title) order by c.ends_at desc), '[]'::jsonb)
    from public.budget_cycles c where c.published_results and c.status <> 'draft';
$$;

-- Published results for one round (the latest one when none is named). Only rounds staff have published are visible.
create function public.budget_results(p_cycle text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_c public.budget_cycles;
begin
  if p_cycle is null then
    select c.* into v_c from public.budget_cycles c where c.published_results and c.status <> 'draft' order by c.ends_at desc limit 1;
  else
    select c.* into v_c from public.budget_cycles c where c.id = p_cycle and c.published_results and c.status <> 'draft';
  end if;
  if not found then return jsonb_build_object('cycle', null, 'wards', '[]'::jsonb, 'cycles', private.published_cycles()); end if;

  return jsonb_build_object(
    'cycle', jsonb_build_object('id', v_c.id, 'title', v_c.title, 'starts_at', v_c.starts_at, 'ends_at', v_c.ends_at, 'status', v_c.status),
    'cycles', private.published_cycles(),
    'total_votes', (select count(*) from public.votes v where v.cycle_id = v_c.id),
    'wards', coalesce((
      select jsonb_agg(jsonb_build_object(
               'ward_id', w.id, 'ward', w.name,
               'envelope', coalesce(e.amount, 0),
               'votes', (select coalesce(sum(t.votes), 0) from private.option_tally(v_c.id) t where t.ward_id = w.id),
               'options', (select jsonb_agg(jsonb_build_object(
                             'id', t.id, 'title', t.title, 'sector', t.sector, 'amount', t.amount, 'votes', t.votes,
                             'funded', t.running <= coalesce(e.amount, 0)) order by t.votes desc, t.title)
                           from private.option_tally(v_c.id) t where t.ward_id = w.id))
             order by w.name)
      from public.wards w
      left join public.ward_budget_envelopes e on e.cycle_id = v_c.id and e.ward_id = w.id
      where exists (select 1 from public.project_options o where o.cycle_id = v_c.id and o.ward_id = w.id)
    ), '[]'::jsonb));
end;
$$;
grant execute on function public.budget_results(text) to anon, authenticated;

-- ---- a round every quarter ----------------------------------------------------------------------------------------
-- Draft the next quarter's round: same ward envelopes as the latest round, no options yet (wards propose those), voting
-- for the first two weeks of the quarter. Idempotent per quarter. Returns the round id, or null if it already exists.
create function private.draft_quarterly_round()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start date := (date_trunc('quarter', now() + interval '3 months'))::date;
  v_id text := to_char(v_start, 'YYYY') || '-q' || to_char(v_start, 'Q');
  v_prev text;
begin
  if exists (select 1 from public.budget_cycles c where c.id = v_id) then return null; end if;
  select c.id into v_prev from public.budget_cycles c
   where exists (select 1 from public.ward_budget_envelopes e where e.cycle_id = c.id) order by c.ends_at desc limit 1;
  insert into public.budget_cycles (id, title, status, starts_at, ends_at, published_results)
  values (v_id, 'Ward budget, ' || to_char(v_start, 'YYYY') || ' quarter ' || to_char(v_start, 'Q'), 'draft',
          v_start::timestamptz, (v_start + 14)::timestamptz, false);
  if v_prev is not null then
    insert into public.ward_budget_envelopes (cycle_id, ward_id, amount)
    select v_id, e.ward_id, e.amount from public.ward_budget_envelopes e where e.cycle_id = v_prev;
  end if;
  return v_id;
end;
$$;

-- Daily: rounds open on their start date and close on their end date; the next quarter's draft appears in the last
-- month of a quarter. Publishing results stays a human decision.
create function public.svc_round_scheduler()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_opened int;
  v_closed int;
  v_drafted text;
begin
  update public.budget_cycles set status = 'closed' where status = 'open' and ends_at < now();
  get diagnostics v_closed = row_count;
  update public.budget_cycles set status = 'open' where status = 'draft' and starts_at <= now() and ends_at > now()
     and exists (select 1 from public.project_options o where o.cycle_id = budget_cycles.id);
  get diagnostics v_opened = row_count;
  if extract(month from now())::int % 3 = 0 then v_drafted := private.draft_quarterly_round(); end if;
  return jsonb_build_object('opened', v_opened, 'closed', v_closed, 'drafted', v_drafted);
end;
$$;
revoke all on function public.svc_round_scheduler() from public, anon, authenticated;
grant execute on function public.svc_round_scheduler() to service_role;

-- The same drafting, on demand, for an administrator.
create function public.draft_next_round()
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then raise exception 'Only an administrator can schedule a round' using errcode = '42501'; end if;
  return private.draft_quarterly_round();
end;
$$;
grant execute on function public.draft_next_round() to authenticated;

-- ---- follow a supplier, a project or a place -----------------------------------------------------------------------
create table public.follows (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  kind       text not null check (kind in ('supplier', 'project', 'ward_tenders', 'sector')),
  key        text not null check (char_length(key) between 1 and 80),
  label      text not null check (char_length(label) between 1 and 160),
  created_at timestamptz not null default now(),
  unique (user_id, kind, key)
);
create index follows_lookup_idx on public.follows (kind, key);
alter table public.follows enable row level security;
create policy "follows: own" on public.follows for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, delete on public.follows to authenticated;

create function private.follows_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.follows f where f.user_id = new.user_id) >= 40 then
    raise exception 'You can follow up to 40 things' using errcode = '54000';
  end if;
  return new;
end;
$$;
create trigger follows_limit before insert on public.follows for each row execute function private.follows_limit();

create function private.tell_followers(p_kind text, p_key text, p_title text, p_message text, p_link text, p_tone text default 'info')
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, title, message, kind, link)
  select f.user_id, p_title, p_message, p_tone, p_link from public.follows f where f.kind = p_kind and f.key = p_key;
$$;

-- New tenders, awards and status changes reach the people who follow that place, sector or supplier.
create function private.follows_on_tender()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link text := '/tenders';
  v_name text;
begin
  if new.status = 'open' and (tg_op = 'INSERT' or old.status is distinct from 'open') then
    if new.ward_id is not null then
      perform private.tell_followers('ward_tenders', new.ward_id, 'New tender in your ward', new.reference || ': ' || new.title, v_link);
    end if;
    perform private.tell_followers('sector', lower(new.sector), 'New ' || new.sector || ' tender', new.reference || ': ' || new.title, v_link);
  elsif new.status = 'awarded' and (tg_op = 'INSERT' or old.status is distinct from 'awarded') then
    select c.name into v_name from public.contractors c where c.id = new.awarded_contractor_id;
    if new.awarded_contractor_id is not null then
      perform private.tell_followers('supplier', new.awarded_contractor_id::text, coalesce(v_name, 'A supplier you follow') || ' won a tender',
                                     new.reference || ': ' || new.title, v_link);
    end if;
    if new.ward_id is not null then
      perform private.tell_followers('ward_tenders', new.ward_id, 'Tender awarded in your ward',
                                     new.reference || ' went to ' || coalesce(v_name, 'a supplier'), v_link);
    end if;
  end if;
  return new;
end;
$$;
create trigger tenders_follows after insert or update of status on public.tenders
  for each row execute function private.follows_on_tender();

create function private.follows_on_project()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.published and (old.status is distinct from new.status or old.spent is distinct from new.spent and new.spent > old.spent) then
    perform private.tell_followers('project', new.id::text, new.title,
      case when old.status is distinct from new.status then 'Now ' || replace(new.status, '_', ' ') || '.' else 'Spending updated.' end,
      '/projects/' || new.slug,
      case when new.status = 'stalled' then 'warning' when new.status = 'completed' then 'success' else 'info' end);
  end if;
  return new;
end;
$$;
create trigger projects_follows after update on public.projects
  for each row execute function private.follows_on_project();

-- A new red flag reaches followers of the supplier or project it names.
create function private.follows_on_flag()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.severity = 'info' then return new; end if;
  if new.subject_kind = 'contractor' then
    perform private.tell_followers('supplier', split_part(new.subject_key, ':', 1), 'New flag on ' || new.subject_label, new.title, '/open', 'warning');
  elsif new.subject_kind = 'project' then
    perform private.tell_followers('project', new.subject_key, 'New flag on ' || new.subject_label, new.title, '/open', 'warning');
  end if;
  return new;
end;
$$;
create trigger flags_follows after insert on public.procurement_flags
  for each row execute function private.follows_on_flag();

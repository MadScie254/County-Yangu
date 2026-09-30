-- 0012  Procurement watch: who wins county money, how, and which patterns deserve a closer look.
--
-- Based on the open-contracting "red flag" approach (open-contracting.org/redflags) and Ukraine's Prozorro risk indicators:
-- rules over public procurement data that point at patterns, never at people. A flag is a prompt for scrutiny, not a finding.
-- Everything here reads data that is already public (tenders, projects, contractor names). Reviewing a flag is a staff action
-- and the response is published next to it.

-- ---- what a tender record needs so it can be analysed ----------------------------------------------------------------
alter table public.tenders
  add column procurement_method text not null default 'open_tender'
    check (procurement_method in ('open_tender', 'restricted', 'request_for_quotation', 'direct', 'framework')),
  add column award_amount numeric(16, 2) check (award_amount is null or award_amount >= 0),
  add column awarded_at timestamptz;

create or replace view public.public_tenders as
select t.id, t.reference, t.title, t.ward_id, w.name as ward_name, t.sector, t.status,
       t.estimated_budget, t.applicants_count, c.name as awarded_to, t.published_at, t.closes_at,
       t.procurement_method, t.award_amount, t.awarded_at, t.awarded_contractor_id as contractor_id
  from public.tenders t
  left join public.wards w on w.id = t.ward_id
  left join public.contractors c on c.id = t.awarded_contractor_id
 where t.status <> 'draft';

-- ---- flags that have been seen, and what the county said about them -----------------------------------------------------
create table public.procurement_flags (
  id            uuid primary key default gen_random_uuid(),
  code          text not null,
  subject_key   text not null,
  severity      text not null check (severity in ('info', 'watch', 'high')),
  subject_kind  text not null check (subject_kind in ('county', 'contractor', 'tender', 'project')),
  subject_label text not null,
  title         text not null,
  detail        text not null,
  metrics       jsonb not null default '{}'::jsonb,
  status        text not null default 'open' check (status in ('open', 'reviewing', 'explained', 'referred', 'cleared')),
  response      text,                                -- published beside the flag
  reviewed_by   uuid references auth.users (id),
  reviewed_at   timestamptz,
  first_seen    timestamptz not null default now(),
  last_seen     timestamptz not null default now(),
  unique (code, subject_key)
);
alter table public.procurement_flags enable row level security;
create policy "flags: staff read" on public.procurement_flags for select to authenticated using (private.is_staff());
grant select on public.procurement_flags to authenticated;
create trigger audit_procurement_flags after insert or update or delete on public.procurement_flags
  for each row execute function private.audit_row();

-- ---- the awarded tenders, one row each ------------------------------------------------------------------------------------
create function private.awards()
returns table (id uuid, reference text, title text, ward_id text, sector text, method text, bids int, estimate numeric,
               amount numeric, at timestamptz, published_at timestamptz, closes_at timestamptz,
               cid uuid, cname text, kra_compliant boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.reference, t.title, t.ward_id, t.sector, t.procurement_method, t.applicants_count, t.estimated_budget,
         coalesce(t.award_amount, t.estimated_budget), coalesce(t.awarded_at, t.published_at, t.created_at),
         t.published_at, t.closes_at, c.id, c.name, c.kra_compliant
    from public.tenders t
    join public.contractors c on c.id = t.awarded_contractor_id
   where t.status = 'awarded';
$$;

-- ---- the rules ------------------------------------------------------------------------------------------------------------------
-- Thresholds are deliberately plain and published on the Open County page. Money shown as whole shillings.
create function private.procurement_flags_now()
returns table (code text, severity text, subject_kind text, subject_key text, subject_label text, title text, detail text, metrics jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  with aw as (select * from private.awards()),
  tot as (
    select count(*)::numeric as n, coalesce(sum(amount), 0) as v, count(distinct cid)::int as suppliers,
           coalesce(sum(amount) filter (where method in ('direct', 'restricted')), 0) as nc_value,
           count(*) filter (where bids <= 1) as single,
           count(*) filter (where published_at is not null and closes_at is not null and closes_at - published_at < interval '7 days') as short
      from aw
  ),
  per as (
    select cid, cname, count(*) as wins, sum(amount) as value,
           count(*) filter (where method in ('direct', 'restricted')) as non_open,
           count(*) filter (where bids <= 1) as single_bid,
           coalesce(bool_or(kra_compliant is false), false) as kra_bad
      from aw group by cid, cname
  ),
  shares as (
    select per.*, case when tot.v > 0 then round(100 * per.value / tot.v, 1) else 0 end as share_value,
           round(100 * per.wins / tot.n, 1) as share_count
      from per cross join tot
  ),
  ranked as (select s.*, row_number() over (order by s.value desc, s.cname) as rk from shares s),
  top3 as (select coalesce(sum(share_value), 0) as share from ranked where rk <= 3),
  anchor as (
    select a.id, a.cid, a.cname, a.ward_id, a.sector, count(b.id) as n
      from aw a
      join aw b on b.cid = a.cid and b.ward_id is not distinct from a.ward_id and b.sector = a.sector
               and b.at >= a.at and b.at < a.at + interval '30 days'
     group by a.id, a.cid, a.cname, a.ward_id, a.sector
  ),
  split as (select cid, cname, ward_id, sector, max(n) as n from anchor where n >= 3 group by cid, cname, ward_id, sector)

  select 'dominant_supplier', case when r.share_value >= 40 then 'high' else 'watch' end, 'contractor', r.cid::text, r.cname,
         format('%s holds %s%% of awarded value', r.cname, r.share_value),
         format('%s of %s awards, worth KES %s of the KES %s awarded in total. One supplier holding more than a quarter of awarded value is a common reason to look at how work is being shared.',
                r.wins, tot.n, to_char(r.value, 'FM999,999,999,990'), to_char(tot.v, 'FM999,999,999,990')),
         jsonb_build_object('wins', r.wins, 'value', r.value, 'share_value', r.share_value)
    from ranked r cross join tot where r.share_value >= 25 and r.wins >= 2
  union all
  select 'repeat_winner', 'watch', 'contractor', r.cid::text, r.cname,
         format('%s won %s awards, %s%% of all', r.cname, r.wins, r.share_count),
         'Winning four or more awards and a fifth of all awards can be entirely legitimate, and is also what repeated favouritism looks like. Worth checking that the tenders were genuinely competitive.',
         jsonb_build_object('wins', r.wins, 'share_count', r.share_count)
    from ranked r where r.wins >= 4 and r.share_count >= 20
  union all
  select 'top3_concentration', case when top3.share >= 75 then 'high' else 'watch' end, 'county', 'county', 'County procurement',
         format('Three suppliers hold %s%% of awarded value', top3.share),
         format('Across %s suppliers and KES %s awarded, the top three received %s%%. A market this concentrated leaves little competitive pressure on price and quality.',
                tot.suppliers, to_char(tot.v, 'FM999,999,999,990'), top3.share),
         jsonb_build_object('top3_share', top3.share, 'suppliers', tot.suppliers)
    from top3 cross join tot where tot.suppliers >= 4 and top3.share >= 60
  union all
  select 'non_competitive_share', case when tot.nc_value * 2 >= tot.v then 'high' else 'watch' end, 'county', 'county', 'County procurement',
         format('%s%% of awarded value skipped open tendering', round(100 * tot.nc_value / tot.v, 1)),
         format('KES %s was awarded by direct or restricted procurement. These methods have legitimate uses, such as emergencies, and should stay a small share.',
                to_char(tot.nc_value, 'FM999,999,999,990')),
         jsonb_build_object('non_competitive_value', tot.nc_value, 'share', round(100 * tot.nc_value / tot.v, 1))
    from tot where tot.v > 0 and tot.n >= 4 and tot.nc_value * 10 >= tot.v * 3
  union all
  select 'contractor_direct_reliance', 'watch', 'contractor', r.cid::text, r.cname,
         format('%s: %s of %s awards were not openly tendered', r.cname, r.non_open, r.wins),
         'Most of this supplier''s awards came through direct or restricted procurement rather than open competition.',
         jsonb_build_object('wins', r.wins, 'non_open', r.non_open)
    from ranked r where r.wins >= 2 and r.non_open * 10 >= r.wins * 6
  union all
  select 'single_bidder_share', 'watch', 'county', 'county', 'County procurement',
         format('%s%% of awarded tenders had one bidder or none', round(100 * tot.single / tot.n, 1)),
         'Tenders with a single bidder cannot show that the price was tested. Few bids is one of the most widely used procurement warning signs.',
         jsonb_build_object('single_bid', tot.single, 'awarded', tot.n)
    from tot where tot.n >= 4 and tot.single * 4 >= tot.n
  union all
  select 'contractor_single_bid', 'watch', 'contractor', r.cid::text, r.cname,
         format('%s won %s tenders with a single bidder', r.cname, r.single_bid),
         'Winning several tenders where nobody else bid deserves a look at how the tender was advertised and who could realistically apply.',
         jsonb_build_object('single_bid', r.single_bid)
    from ranked r where r.single_bid >= 2
  union all
  select 'short_tender_period', 'watch', 'county', 'county', 'County procurement',
         format('%s awarded tenders were open for under a week', tot.short),
         'Very short tendering periods limit who can respond in time and are a standard procurement warning sign.',
         jsonb_build_object('short_tenders', tot.short)
    from tot where tot.short >= 3 and tot.short * 5 >= tot.n
  union all
  select 'award_above_estimate', case when a.amount >= a.estimate * 1.3 then 'high' else 'watch' end, 'tender', a.id::text, a.reference || ' ' || a.title,
         format('%s was awarded at %s%% of its estimate', a.reference, round(100 * a.amount / a.estimate)),
         format('Estimate KES %s, award KES %s to %s. A large gap between estimate and award can mean a poor estimate or a price that was not tested.',
                to_char(a.estimate, 'FM999,999,999,990'), to_char(a.amount, 'FM999,999,999,990'), a.cname),
         jsonb_build_object('estimate', a.estimate, 'award', a.amount)
    from aw a where a.estimate > 0 and a.amount > a.estimate * 1.15
  union all
  select 'split_awards', 'watch', 'contractor', s.cid::text || ':' || coalesce(s.ward_id, '-') || ':' || s.sector, s.cname,
         format('%s received %s %s awards within 30 days%s', s.cname, s.n, s.sector, coalesce(' in ' || (select w.name from public.wards w where w.id = s.ward_id), '')),
         'Several awards to one supplier for the same kind of work in the same place in a short time can indicate a larger job split up to stay under a tendering threshold.',
         jsonb_build_object('awards', s.n)
    from split s
  union all
  select 'kra_noncompliant', 'watch', 'contractor', r.cid::text, r.cname,
         format('%s failed its last tax compliance check', r.cname),
         'The supplier holds county awards while its most recent KRA tax compliance check was negative. Public bodies are expected to award only to compliant suppliers.',
         jsonb_build_object('wins', r.wins)
    from ranked r where r.kra_bad
  union all
  select 'project_overrun', case when p.spent > p.budget * 1.25 then 'high' else 'watch' end, 'project', p.id::text, p.title,
         format('%s has spent %s%% of its budget', p.title, round(100 * p.spent / p.budget)),
         format('Budget KES %s, spent KES %s. Spending above budget should come with an approved variation and a public explanation.',
                to_char(p.budget, 'FM999,999,999,990'), to_char(p.spent, 'FM999,999,999,990')),
         jsonb_build_object('budget', p.budget, 'spent', p.spent)
    from public.projects p where p.published and p.budget > 0 and p.spent > p.budget * 1.1
  union all
  select 'stalled_after_spend', 'watch', 'project', p.id::text, p.title,
         format('%s is stalled after %s%% of its budget was spent', p.title, round(100 * p.spent / p.budget)),
         'Money has left but the work has stopped. Residents should be told why and when it will resume.',
         jsonb_build_object('budget', p.budget, 'spent', p.spent)
    from public.projects p where p.published and p.status = 'stalled' and p.budget > 0 and p.spent >= p.budget * 0.5
  union all
  select 'project_late', 'info', 'project', p.id::text, p.title,
         format('%s is %s days past its expected date', p.title, current_date - p.expected_at),
         'The project has not reached completion by the date the county published.',
         jsonb_build_object('expected_at', p.expected_at)
    from public.projects p where p.published and p.status in ('procurement', 'in_progress') and p.expected_at is not null and p.expected_at < current_date - 60;
$$;

-- ---- what the public page reads ------------------------------------------------------------------------------------------------
create function public.procurement_watch()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_summary jsonb;
  v_contractors jsonb;
  v_methods jsonb;
  v_flags jsonb;
begin
  with aw as (select * from private.awards()),
  tot as (select count(*)::numeric as n, coalesce(sum(amount), 0) as v, count(distinct cid)::int as suppliers,
                 coalesce(sum(amount) filter (where method in ('direct', 'restricted')), 0) as nc_value,
                 count(*) filter (where bids <= 1) as single,
                 round(avg(bids), 1) as avg_bids,
                 round(avg(extract(epoch from (closes_at - published_at)) / 86400) filter (where published_at is not null and closes_at is not null)::numeric, 1) as avg_days
            from aw),
  per as (select cid, sum(amount) as value from aw group by cid),
  sh as (select cid, case when tot.v > 0 then 100 * value / tot.v else 0 end as s from per cross join tot),
  rk as (select s, row_number() over (order by s desc) as r from sh)
  select jsonb_build_object(
           'awarded_count', tot.n, 'awarded_value', tot.v, 'suppliers', tot.suppliers,
           'hhi', (select coalesce(round(sum(s * s)), 0) from sh),
           'hhi_band', case when (select coalesce(sum(s * s), 0) from sh) >= 2500 then 'high'
                            when (select coalesce(sum(s * s), 0) from sh) >= 1500 then 'moderate' else 'low' end,
           'top1_share', (select coalesce(round(sum(s), 1), 0) from rk where r <= 1),
           'top3_share', (select coalesce(round(sum(s), 1), 0) from rk where r <= 3),
           'top5_share', (select coalesce(round(sum(s), 1), 0) from rk where r <= 5),
           'non_competitive_share', case when tot.v > 0 then round(100 * tot.nc_value / tot.v, 1) else 0 end,
           'single_bid_share', case when tot.n > 0 then round(100 * tot.single / tot.n, 1) else 0 end,
           'avg_bids', tot.avg_bids, 'avg_tender_days', tot.avg_days)
    into v_summary from tot;

  select coalesce(jsonb_agg(x order by (x ->> 'value')::numeric desc), '[]'::jsonb) into v_contractors from (
    select jsonb_build_object('id', a.cid, 'name', a.cname, 'wins', count(*), 'value', sum(a.amount),
             'share_value', case when t.v > 0 then round(100 * sum(a.amount) / t.v, 1) else 0 end,
             'share_count', round(100 * count(*)::numeric / t.n, 1),
             'non_open', count(*) filter (where a.method in ('direct', 'restricted')),
             'single_bid', count(*) filter (where a.bids <= 1),
             'last_award', max(a.at)) as x
      from private.awards() a
      cross join (select count(*)::numeric as n, coalesce(sum(amount), 0) as v from private.awards()) t
     group by a.cid, a.cname, t.n, t.v
     order by sum(a.amount) desc limit 15) q;

  select coalesce(jsonb_agg(jsonb_build_object('method', m.method, 'awards', m.awards, 'value', m.value) order by m.value desc), '[]'::jsonb) into v_methods from (
    select method, count(*) as awards, sum(amount) as value from private.awards() group by method) m;

  select coalesce(jsonb_agg(jsonb_build_object(
           'code', f.code, 'severity', f.severity, 'subject_kind', f.subject_kind, 'subject_key', f.subject_key,
           'subject_label', f.subject_label, 'title', f.title, 'detail', f.detail, 'metrics', f.metrics,
           'status', coalesce(s.status, 'open'), 'response', s.response, 'first_seen', s.first_seen)
           order by case f.severity when 'high' then 0 when 'watch' then 1 else 2 end, f.title), '[]'::jsonb)
    into v_flags
    from private.procurement_flags_now() f
    left join public.procurement_flags s on s.code = f.code and s.subject_key = f.subject_key;

  return jsonb_build_object('generated_at', now(), 'summary', v_summary, 'contractors', v_contractors, 'methods', v_methods, 'flags', v_flags);
end;
$$;
grant execute on function public.procurement_watch() to anon, authenticated;

-- ---- staff review: the response is public -----------------------------------------------------------------------------------
create function public.flag_review(p_code text, p_key text, p_status text, p_response text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_role(array['super_admin', 'admin']) then
    raise exception 'Only a county administrator can review a flag' using errcode = '42501';
  end if;
  if p_status not in ('open', 'reviewing', 'explained', 'referred') then
    raise exception 'Unknown status' using errcode = '22023';
  end if;
  if p_status in ('explained', 'referred') and length(trim(coalesce(p_response, ''))) < 10 then
    raise exception 'Write a short public response first' using errcode = '22023';
  end if;
  insert into public.procurement_flags (code, subject_key, severity, subject_kind, subject_label, title, detail, metrics)
  select f.code, f.subject_key, f.severity, f.subject_kind, f.subject_label, f.title, f.detail, f.metrics
    from private.procurement_flags_now() f where f.code = p_code and f.subject_key = p_key
  on conflict (code, subject_key) do nothing;
  update public.procurement_flags
     set status = p_status, response = nullif(trim(coalesce(p_response, '')), ''), reviewed_by = (select auth.uid()), reviewed_at = now()
   where code = p_code and subject_key = p_key;
  if not found then raise exception 'That flag no longer applies' using errcode = 'P0002'; end if;
end;
$$;
revoke all on function public.flag_review(text, text, text, text) from public, anon;
grant execute on function public.flag_review(text, text, text, text) to authenticated;

-- ---- the daily scan: remember flags, tell the right people about new serious ones -------------------------------------------
create function public.svc_procurement_scan()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  fl record;
  n_new int := 0;
  v_name text;
  v_url text;
begin
  select c.name, c.settings ->> 'console_url' into v_name, v_url from public.county c limit 1;
  for fl in select * from private.procurement_flags_now() loop
    if exists (select 1 from public.procurement_flags s where s.code = fl.code and s.subject_key = fl.subject_key) then
      update public.procurement_flags s
         set severity = fl.severity, title = fl.title, detail = fl.detail, metrics = fl.metrics, subject_label = fl.subject_label, last_seen = now(),
             status = case when s.status = 'cleared' then 'open' else s.status end
       where s.code = fl.code and s.subject_key = fl.subject_key;
    else
      insert into public.procurement_flags (code, subject_key, severity, subject_kind, subject_label, title, detail, metrics)
      values (fl.code, fl.subject_key, fl.severity, fl.subject_kind, fl.subject_label, fl.title, fl.detail, fl.metrics);
      n_new := n_new + 1;
      if fl.severity = 'high' then
        insert into private.outbox (channel, recipient, subject, body, related)
        select 'email', u.email, format('[%s] New procurement flag: %s', coalesce(v_name, 'County'), fl.title),
               format(E'A new high-priority pattern was found in county procurement:\n\n%s\n\n%s\n\nThis is a prompt for review, not a finding. Review it and publish a response: %s',
                      fl.title, fl.detail, coalesce(v_url, '') || '/procurement'),
               jsonb_build_object('flag', fl.code, 'subject', fl.subject_key)
          from (select distinct r.user_id from public.staff_roles r
                 where r.active and (r.expires_at is null or r.expires_at > now()) and r.role in ('super_admin', 'admin', 'auditor')) x
          join auth.users u on u.id = x.user_id and u.email is not null;
      end if;
    end if;
  end loop;
  -- a flag whose condition no longer holds is closed, unless someone has already reviewed it
  update public.procurement_flags s set status = 'cleared'
   where s.status = 'open'
     and not exists (select 1 from private.procurement_flags_now() f where f.code = s.code and f.subject_key = s.subject_key);
  return n_new;
end;
$$;
revoke all on function public.svc_procurement_scan() from public, anon, authenticated;
grant execute on function public.svc_procurement_scan() to service_role;

-- ---- the staff assistant can ask about it (runs as the person asking) ---------------------------------------------------------
create function public.ai_procurement_flags(p_min_severity text default 'watch')
returns table (severity text, subject text, title text, status text)
language sql
stable
set search_path = ''
as $$
  select f ->> 'severity', f ->> 'subject_label', f ->> 'title', f ->> 'status'
    from jsonb_array_elements(public.procurement_watch() -> 'flags') f
   where (f ->> 'severity') = any (case when p_min_severity = 'high' then array['high']
                                        when p_min_severity = 'info' then array['high', 'watch', 'info']
                                        else array['high', 'watch'] end)
   limit 50;
$$;
revoke all on function public.ai_procurement_flags(text) from public, anon;
grant execute on function public.ai_procurement_flags(text) to authenticated;

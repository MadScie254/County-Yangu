-- 0015  Views for County Assembly committees and ward scorecards, and open contracting data for researchers.
-- All of it is aggregate or already-public information; nothing here exposes a resident.

-- ---- committees ---------------------------------------------------------------------------------------------------
-- A committee oversees departments (for cases) and sectors (for projects and tenders). Editable by administrators.
create table public.assembly_committees (
  code         text primary key,
  name         text not null,
  name_sw      text,
  departments  text[] not null default '{}',   -- departments.code
  sectors      text[] not null default '{}',   -- lower-case sector names used on projects and tenders
  sort         int not null default 0
);
alter table public.assembly_committees enable row level security;
create policy "committees: public read" on public.assembly_committees for select to anon, authenticated using (true);
create policy "committees: admin write" on public.assembly_committees for all to authenticated using (private.is_admin()) with check (private.is_admin());
grant select on public.assembly_committees to anon, authenticated;
grant insert, update, delete on public.assembly_committees to authenticated;
create trigger audit_assembly_committees after insert or update or delete on public.assembly_committees
  for each row execute function private.audit_row();

insert into public.assembly_committees (code, name, name_sw, departments, sectors, sort) values
  ('roads',       'Roads, Transport and Public Works',   'Barabara, Uchukuzi na Kazi za Umma',   '{roads}',                 '{roads,transport,public works}', 1),
  ('water',       'Water, Environment and Sanitation',   'Maji, Mazingira na Usafi',             '{water,environment}',     '{water,sanitation,drainage,environment,waste}', 2),
  ('health',      'Health',                              'Afya',                                 '{health}',                '{health}', 3),
  ('education',   'Education and Social Services',       'Elimu na Huduma za Jamii',             '{education}',             '{education,social}', 4),
  ('trade',       'Trade, Markets and Licensing',        'Biashara, Masoko na Leseni',           '{trade}',                 '{markets,trade}', 5),
  ('planning',    'Planning, Lands and Housing',         'Mipango, Ardhi na Makazi',             '{planning}',              '{planning,housing,lands}', 6),
  ('safety',      'Public Safety and Disaster',          'Usalama wa Umma na Maafa',             '{safety}',                '{safety,disaster}', 7),
  ('finance',     'Finance and Budget',                  'Fedha na Bajeti',                      '{finance,integrity}',     '{finance}', 8);

-- One payload for every committee: what residents reported in its area and how the county responded, the projects and
-- tenders in its sectors, and open procurement flags on them. Last 90 days for cases.
create function public.assembly_dashboard()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'code', c.code, 'name', c.name, 'name_sw', c.name_sw,
    'cases', (
      select jsonb_build_object(
        'received_90d', count(*) filter (where r.created_at >= now() - interval '90 days'),
        'open', count(*) filter (where r.status not in ('resolved', 'closed', 'rejected')),
        'overdue', count(*) filter (where r.status not in ('resolved', 'closed', 'rejected') and r.resolve_due_at < now()),
        'resolved_90d', count(*) filter (where r.status in ('resolved', 'closed') and r.resolved_at >= now() - interval '90 days'),
        'reopened', coalesce(sum(r.reopened_count), 0),
        'median_days', round((percentile_cont(0.5) within group (order by extract(epoch from (r.resolved_at - r.created_at)) / 86400)
                              filter (where r.resolved_at >= now() - interval '90 days'))::numeric, 1))
      from public.reports r join public.departments d on d.id = r.department_id where d.code = any (c.departments)),
    'projects', (
      select jsonb_build_object('count', count(*), 'budget', coalesce(sum(p.budget), 0), 'spent', coalesce(sum(p.spent), 0),
                                'stalled', count(*) filter (where p.status = 'stalled'),
                                'completed', count(*) filter (where p.status = 'completed'))
      from public.projects p where p.published and lower(p.sector) = any (c.sectors)),
    'tenders', (
      select jsonb_build_object('open', count(*) filter (where t.status = 'open'),
                                'awarded', count(*) filter (where t.status = 'awarded'),
                                'awarded_value', coalesce(sum(coalesce(t.award_amount, t.estimated_budget)) filter (where t.status = 'awarded'), 0))
      from public.tenders t where lower(t.sector) = any (c.sectors)),
    'flags', (
      select count(*) from public.procurement_flags f
       where f.status <> 'cleared' and f.severity <> 'info'
         and ((f.subject_kind = 'project' and exists (select 1 from public.projects p where p.id::text = f.subject_key and lower(p.sector) = any (c.sectors)))
           or (f.subject_kind = 'tender' and exists (select 1 from public.tenders t where t.id::text = f.subject_key and lower(t.sector) = any (c.sectors))))),
    'attention', (
      select coalesce(jsonb_agg(jsonb_build_object('slug', p.slug, 'title', p.title, 'status', p.status, 'budget', p.budget, 'spent', p.spent) order by p.spent desc), '[]'::jsonb)
      from (select * from public.projects p2 where p2.published and lower(p2.sector) = any (c.sectors) and (p2.status = 'stalled' or p2.spent > p2.budget)
             order by p2.spent desc limit 5) p)
  ) order by c.sort), '[]'::jsonb)
  from public.assembly_committees c;
$$;
grant execute on function public.assembly_dashboard() to anon, authenticated;

-- ---- ward scorecard -----------------------------------------------------------------------------------------------
-- What one ward can hold its representatives to: how quickly problems are fixed and whether residents agree they were
-- fixed, what is being built and spent, what was tendered, and how many people took part in the budget vote.
create function public.ward_scorecard(p_ward text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'ward_id', w.id, 'ward', w.name, 'constituency', w.constituency, 'population', w.population,
    'sub_county', (select s.name from public.sub_counties s where s.id = w.sub_county_id),
    'generated_at', now(),
    'cases', (
      select jsonb_build_object(
        'received_90d', count(*) filter (where r.created_at >= now() - interval '90 days'),
        'resolved_90d', count(*) filter (where r.status in ('resolved', 'closed') and r.resolved_at >= now() - interval '90 days'),
        'open', count(*) filter (where r.status not in ('resolved', 'closed', 'rejected')),
        'overdue', count(*) filter (where r.status not in ('resolved', 'closed', 'rejected') and r.resolve_due_at < now()),
        'median_days', round((percentile_cont(0.5) within group (order by extract(epoch from (r.resolved_at - r.created_at)) / 86400)
                              filter (where r.resolved_at >= now() - interval '90 days'))::numeric, 1),
        'reopened', coalesce(sum(r.reopened_count), 0))
      from public.reports r where r.ward_id = w.id),
    'confirmed', (
      select jsonb_build_object('responses', count(*), 'fixed', count(*) filter (where f.fixed))
      from public.case_feedback f join public.reports r on r.id = f.report_id where r.ward_id = w.id),
    'top_categories', (
      select coalesce(jsonb_agg(x order by (x ->> 'count')::int desc), '[]'::jsonb) from (
        select jsonb_build_object('category', coalesce(c.name, 'Other'), 'category_sw', c.name_sw, 'count', count(*)) as x
          from public.reports r left join public.report_categories c on c.id = r.category_id
         where r.ward_id = w.id and r.created_at >= now() - interval '90 days'
         group by c.name, c.name_sw order by count(*) desc limit 4) t),
    'projects', (
      select jsonb_build_object('count', count(*), 'budget', coalesce(sum(p.budget), 0), 'spent', coalesce(sum(p.spent), 0),
                                'stalled', count(*) filter (where p.status = 'stalled'),
                                'completed', count(*) filter (where p.status = 'completed'))
      from public.projects p where p.ward_id = w.id and p.published),
    'tenders', (
      select jsonb_build_object('open', count(*) filter (where t.status = 'open'), 'awarded', count(*) filter (where t.status = 'awarded'),
                                'awarded_value', coalesce(sum(coalesce(t.award_amount, t.estimated_budget)) filter (where t.status = 'awarded'), 0))
      from public.tenders t where t.ward_id = w.id and t.status <> 'draft'),
    'budget', (
      select jsonb_build_object('cycle', c.title, 'votes', (select count(*) from public.votes v where v.cycle_id = c.id and v.ward_id = w.id),
                                'envelope', (select e.amount from public.ward_budget_envelopes e where e.cycle_id = c.id and e.ward_id = w.id))
      from public.budget_cycles c where c.status <> 'draft' order by c.ends_at desc limit 1)
  )
  from public.wards w where w.id = p_ward;
$$;
grant execute on function public.ward_scorecard(text) to anon, authenticated;

-- ---- open contracting data ----------------------------------------------------------------------------------------
-- Tenders and awards as an Open Contracting Data Standard release package (https://standard.open-contracting.org),
-- so journalists and researchers can load the county's data into the same tools used for other governments.
create function public.ocds_releases(p_limit int default 100, p_offset int default 0)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'uri', coalesce((select c.settings ->> 'web_url' from public.county c limit 1), '') || '/open/api',
    'version', '1.1',
    'publishedDate', now(),
    'publisher', jsonb_build_object('name', coalesce((select c.name from public.county c limit 1), 'County') || ' County Government'),
    'license', 'https://creativecommons.org/licenses/by/4.0/',
    'releases', coalesce((
      select jsonb_agg(r order by r ->> 'date' desc) from (
        select jsonb_strip_nulls(jsonb_build_object(
          'ocid', 'ocds-ke-' || lower(coalesce((select c.slug from public.county c limit 1), 'county')) || '-' || lower(t.reference),
          'id', t.id::text || '-' || t.status,
          'date', coalesce(t.awarded_at, t.published_at, t.created_at),
          'tag', jsonb_build_array(case t.status when 'awarded' then 'award' when 'cancelled' then 'tenderCancellation' else 'tender' end),
          'initiationType', 'tender',
          'language', 'en',
          'buyer', jsonb_build_object('name', coalesce((select c.name from public.county c limit 1), 'County') || ' County Government'),
          'tender', jsonb_build_object(
            'id', t.reference, 'title', t.title,
            'status', case t.status when 'open' then 'active' when 'evaluating' then 'active' when 'awarded' then 'complete' when 'cancelled' then 'cancelled' else 'planned' end,
            'value', jsonb_build_object('amount', t.estimated_budget, 'currency', 'KES'),
            'procurementMethod', case t.procurement_method when 'open_tender' then 'open' when 'restricted' then 'selective' else 'limited' end,
            'procurementMethodDetails', t.procurement_method,
            'mainProcurementCategory', lower(t.sector),
            'numberOfTenderers', t.applicants_count,
            'tenderPeriod', jsonb_build_object('startDate', t.published_at, 'endDate', t.closes_at),
            'deliveryAddresses', case when t.ward_id is null then null else jsonb_build_array(jsonb_build_object('region', t.ward_id)) end),
          'awards', case when t.status = 'awarded' and t.awarded_contractor_id is not null then jsonb_build_array(jsonb_build_object(
            'id', t.reference || '-award', 'status', 'active', 'date', t.awarded_at,
            'value', jsonb_build_object('amount', coalesce(t.award_amount, t.estimated_budget), 'currency', 'KES'),
            'suppliers', jsonb_build_array(jsonb_build_object('id', t.awarded_contractor_id::text, 'name', c.name)))) else null end
        )) as r
        from public.tenders t
        left join public.contractors c on c.id = t.awarded_contractor_id
        where t.status <> 'draft'
        order by coalesce(t.awarded_at, t.published_at, t.created_at) desc
        limit least(greatest(coalesce(p_limit, 100), 1), 500) offset greatest(coalesce(p_offset, 0), 0)
      ) x), '[]'::jsonb));
$$;
grant execute on function public.ocds_releases(int, int) to anon, authenticated;

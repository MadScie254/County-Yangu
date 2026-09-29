-- 0006  Row-level security for civic + services tables, and the public read views.
-- Default is deny. Anonymous visitors see reference data, published projects, open tenders
-- and the aggregate views below. They never see a report row, a voter hash or a phone number.

-- ---- extra helpers -------------------------------------------------------------

-- May the signed-in user manage things in this ward (admin, its sub-county admin, its ward admin)?
create function private.can_manage_ward(p_ward text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_roles r
    left join public.wards w on w.id = p_ward
    where r.user_id = (select auth.uid())
      and r.active
      and (r.expires_at is null or r.expires_at > now())
      and (
        r.role in ('super_admin', 'admin', 'chief_officer')
        or (r.role = 'sub_county_admin' and r.sub_county_id = w.sub_county_id)
        or (r.role = 'ward_admin'       and r.ward_id = p_ward)
      )
  );
$$;

-- May the signed-in user review applications for this service (admin, or officer/chief officer of its department)?
create function private.can_review_service(p_service uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_roles r
    left join public.services s on s.id = p_service
    where r.user_id = (select auth.uid())
      and r.active
      and (r.expires_at is null or r.expires_at > now())
      and (
        r.role in ('super_admin', 'admin')
        or (r.role in ('chief_officer', 'officer') and r.department_id = s.department_id)
      )
  );
$$;

-- ---- enable RLS everywhere ------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'contractors', 'tenders', 'projects', 'project_milestones', 'project_photos',
    'budget_cycles', 'ward_budget_envelopes', 'project_options', 'votes',
    'reports', 'report_photos', 'report_events', 'routing_rules',
    'proposals', 'proposal_supports', 'alerts',
    'services', 'applications', 'application_documents', 'payments', 'revenue_entries', 'notifications'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- ---- projects, tenders, contractors -----------------------------------------------

create policy "projects: public reads published" on public.projects for select to anon, authenticated
  using (published or private.is_staff());
create policy "projects: staff write" on public.projects for all to authenticated
  using (private.can_manage_ward(ward_id)) with check (private.can_manage_ward(ward_id));
grant select on public.projects to anon, authenticated;
grant insert, update, delete on public.projects to authenticated;

create policy "milestones: read with project" on public.project_milestones for select to anon, authenticated
  using (exists (select 1 from public.projects p where p.id = project_id));
create policy "milestones: staff write" on public.project_milestones for all to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and private.can_manage_ward(p.ward_id)))
  with check (exists (select 1 from public.projects p where p.id = project_id and private.can_manage_ward(p.ward_id)));
grant select on public.project_milestones to anon, authenticated;
grant insert, update, delete on public.project_milestones to authenticated;

create policy "photos: read with project" on public.project_photos for select to anon, authenticated
  using (exists (select 1 from public.projects p where p.id = project_id));
create policy "photos: staff write" on public.project_photos for all to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and private.can_manage_ward(p.ward_id)))
  with check (exists (select 1 from public.projects p where p.id = project_id and private.can_manage_ward(p.ward_id)));
grant select on public.project_photos to anon, authenticated;
grant insert, update, delete on public.project_photos to authenticated;

create policy "tenders: public reads non-draft" on public.tenders for select to anon, authenticated
  using (status <> 'draft' or private.is_staff());
create policy "tenders: staff write" on public.tenders for all to authenticated
  using (private.has_role(array['super_admin', 'admin', 'chief_officer']))
  with check (private.has_role(array['super_admin', 'admin', 'chief_officer']));
grant select on public.tenders to anon, authenticated;
grant insert, update, delete on public.tenders to authenticated;

create policy "contractors: staff read" on public.contractors for select to authenticated using (private.is_staff());
create policy "contractors: staff write" on public.contractors for all to authenticated
  using (private.has_role(array['super_admin', 'admin', 'chief_officer']))
  with check (private.has_role(array['super_admin', 'admin', 'chief_officer']));
grant select, insert, update, delete on public.contractors to authenticated;

-- ---- participatory budget -----------------------------------------------------------

create policy "budget: public read" on public.budget_cycles for select to anon, authenticated using (status <> 'draft' or private.is_staff());
create policy "budget: admin write" on public.budget_cycles for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "envelopes: public read" on public.ward_budget_envelopes for select to anon, authenticated using (true);
create policy "envelopes: admin write" on public.ward_budget_envelopes for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "options: public read" on public.project_options for select to anon, authenticated using (true);
create policy "options: admin write" on public.project_options for all to authenticated using (private.is_admin()) with check (private.is_admin());
grant select on public.budget_cycles, public.ward_budget_envelopes, public.project_options to anon, authenticated;
grant insert, update, delete on public.budget_cycles, public.ward_budget_envelopes, public.project_options to authenticated;
-- votes: no policies at all. Written only by the vote Edge Function; read only as the aggregate view.

-- ---- cases -----------------------------------------------------------------------------

create policy "cases: staff read" on public.reports for select to authenticated
  using (private.can_work_case(ward_id, department_id, assigned_to));
grant select on public.reports to authenticated;   -- writes only through case_* RPCs / the intake function

create policy "case photos: staff read" on public.report_photos for select to authenticated
  using (exists (select 1 from public.reports r where r.id = report_id));
grant select on public.report_photos to authenticated;

create policy "case events: staff read" on public.report_events for select to authenticated
  using (exists (select 1 from public.reports r where r.id = report_id));
grant select on public.report_events to authenticated;

create policy "routing: staff read" on public.routing_rules for select to authenticated using (private.is_staff());
create policy "routing: admin write" on public.routing_rules for all to authenticated using (private.is_admin()) with check (private.is_admin());
grant select, insert, update, delete on public.routing_rules to authenticated;

-- ---- proposals & petitions ----------------------------------------------------------------

create policy "proposals: public read" on public.proposals for select to anon, authenticated using (true);
create policy "proposals: staff respond" on public.proposals for update to authenticated
  using (private.has_role(array['super_admin', 'admin', 'chief_officer', 'sub_county_admin', 'ward_admin', 'officer']))
  with check (private.has_role(array['super_admin', 'admin', 'chief_officer', 'sub_county_admin', 'ward_admin', 'officer']));
grant select on public.proposals to anon, authenticated;
grant update (status, response, responded_by, cluster_id) on public.proposals to authenticated;
-- proposal_supports: no policies (Edge Function only).

-- ---- alerts --------------------------------------------------------------------------------

create policy "alerts: staff read" on public.alerts for select to authenticated using (private.is_staff());
create policy "alerts: staff draft" on public.alerts for insert to authenticated
  with check (created_by = (select auth.uid())
              and status = 'draft'
              and private.has_role(array['super_admin', 'admin', 'chief_officer', 'sub_county_admin', 'ward_admin', 'officer']));
create policy "alerts: edit own draft" on public.alerts for update to authenticated
  using (created_by = (select auth.uid()) and status = 'draft')
  with check (created_by = (select auth.uid()) and status = 'draft');
grant select on public.alerts to authenticated;
grant insert (ward_id, title, body, status, created_by) on public.alerts to authenticated;
grant update (ward_id, title, body) on public.alerts to authenticated;

-- ---- services -------------------------------------------------------------------------------

create policy "services: public reads active" on public.services for select to anon, authenticated
  using (status = 'active' or private.is_staff());
create policy "services: staff write" on public.services for all to authenticated
  using (private.is_admin() or private.has_role(array['chief_officer']))
  with check (private.is_admin() or private.has_role(array['chief_officer']));
grant select on public.services to anon, authenticated;
grant insert, update, delete on public.services to authenticated;

create policy "applications: own read"  on public.applications for select to authenticated
  using (applicant_id = (select auth.uid()) or private.can_review_service(service_id));
create policy "applications: own draft" on public.applications for insert to authenticated
  with check (applicant_id = (select auth.uid()) and status = 'draft');
create policy "applications: own update" on public.applications for update to authenticated
  using (applicant_id = (select auth.uid())) with check (applicant_id = (select auth.uid()));
grant select on public.applications to authenticated;
grant insert (service_id, applicant_id, ward_id, business_name, kra_pin, form_data) on public.applications to authenticated;
grant update (ward_id, business_name, kra_pin, form_data, status) on public.applications to authenticated;

create policy "app documents: read" on public.application_documents for select to authenticated
  using (exists (select 1 from public.applications a where a.id = application_id));
create policy "app documents: own add" on public.application_documents for insert to authenticated
  with check (exists (select 1 from public.applications a where a.id = application_id and a.applicant_id = (select auth.uid())));
grant select, insert on public.application_documents to authenticated;

create policy "payments: own or finance read" on public.payments for select to authenticated
  using (payer_id = (select auth.uid())
         or private.has_role(array['super_admin', 'admin', 'chief_officer'])
         or exists (select 1 from public.applications a where a.id = application_id and private.can_review_service(a.service_id)));
grant select on public.payments to authenticated;

create policy "revenue: finance read" on public.revenue_entries for select to authenticated
  using (private.has_role(array['super_admin', 'admin', 'chief_officer', 'auditor']));
grant select on public.revenue_entries to authenticated;

create policy "notifications: own" on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy "notifications: mark read" on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select on public.notifications to authenticated;
grant update (read) on public.notifications to authenticated;

-- ---- public views (owner-rights: they expose only curated columns) -----------------------------

create view public.public_projects as
select p.id, p.slug, p.ward_id, w.name as ward_name, p.title, p.sector, p.description, p.status,
       p.budget, p.spent, c.name as contractor, p.lat, p.lng, p.started_at, p.expected_at, p.completed_at,
       coalesce((select jsonb_agg(jsonb_build_object('title', m.title, 'due', m.due_date, 'done', m.completed_at is not null) order by m.sort, m.due_date)
                   from public.project_milestones m where m.project_id = p.id), '[]'::jsonb) as milestones,
       coalesce((select jsonb_agg(jsonb_build_object('path', ph.storage_path, 'caption', ph.caption) order by ph.created_at)
                   from public.project_photos ph where ph.project_id = p.id), '[]'::jsonb) as photos
  from public.projects p
  join public.wards w on w.id = p.ward_id
  left join public.contractors c on c.id = p.contractor_id
 where p.published;

create view public.public_tenders as
select t.id, t.reference, t.title, t.ward_id, w.name as ward_name, t.sector, t.status,
       t.estimated_budget, t.applicants_count, c.name as awarded_to, t.published_at, t.closes_at
  from public.tenders t
  left join public.wards w on w.id = t.ward_id
  left join public.contractors c on c.id = t.awarded_contractor_id
 where t.status <> 'draft';

create view public.public_vote_tally as
select v.cycle_id, v.ward_id, v.option_id, v.channel, count(*)::int as vote_count
  from public.votes v
 group by v.cycle_id, v.ward_id, v.option_id, v.channel;

create view public.public_report_aggregates as
select r.ward_id, r.category_id, r.status, r.channel,
       date_trunc('day', r.created_at)::date as day,
       count(*)::int as report_count
  from public.reports r
 group by r.ward_id, r.category_id, r.status, r.channel, date_trunc('day', r.created_at)::date;

-- Overdue counters per ward and department. Never names a person.
create view public.public_overdue_counts as
select r.ward_id, r.department_id,
       count(*) filter (where r.status not in ('resolved', 'closed', 'rejected'))::int as open_count,
       count(*) filter (where r.status not in ('resolved', 'closed', 'rejected') and r.resolve_due_at < now())::int as overdue_count
  from public.reports r
 group by r.ward_id, r.department_id;

-- Per-ward numbers behind the map. Ward Trust Index =
--   40% report response speed + 35% project completion rate + 25% budget variance discipline.
create view public.public_ward_stats as
with rp as (
  select ward_id,
         count(*) filter (where status not in ('resolved', 'closed', 'rejected'))::int as open_reports,
         count(*) filter (where status not in ('resolved', 'closed', 'rejected') and resolve_due_at < now())::int as overdue_reports,
         count(*) filter (where status in ('resolved', 'closed') and resolved_at > now() - interval '90 days')::int as resolved_90d,
         count(*) filter (where created_at > now() - interval '90 days')::int as reports_90d,
         count(*) filter (where created_at > now() - interval '90 days' and acknowledged_at is not null and acknowledged_at <= ack_due_at)::int as acked_on_time_90d
    from public.reports group by ward_id
), pj as (
  select ward_id,
         count(*)::int as projects,
         count(*) filter (where status = 'completed')::int as completed,
         count(*) filter (where status <> 'planned')::int as started,
         avg(1 - least(1, greatest(0, spent - budget) / nullif(budget, 0))) filter (where status in ('in_progress', 'completed')) as discipline
    from public.projects where published group by ward_id
), vt as (
  select ward_id, count(*)::int as votes from public.votes group by ward_id
)
select w.id as ward_id, w.name, w.sub_county_id, w.constituency, w.population,
       coalesce(rp.open_reports, 0) as open_reports,
       coalesce(rp.overdue_reports, 0) as overdue_reports,
       coalesce(rp.resolved_90d, 0) as resolved_90d,
       coalesce(pj.projects, 0) as projects,
       coalesce(pj.completed, 0) as projects_completed,
       coalesce(vt.votes, 0) as votes_cast,
       case when coalesce(rp.reports_90d, 0) = 0 and coalesce(pj.started, 0) = 0 then null
            else round(100 * (
                   0.40 * case when coalesce(rp.reports_90d, 0) = 0 then 0.5 else rp.acked_on_time_90d::numeric / rp.reports_90d end
                 + 0.35 * case when coalesce(pj.started, 0) = 0 then 0.5 else pj.completed::numeric / pj.started end
                 + 0.25 * coalesce(pj.discipline, 0.5)), 1)
       end as trust_index
  from public.wards w
  left join rp on rp.ward_id = w.id
  left join pj on pj.ward_id = w.id
  left join vt on vt.ward_id = w.id;

create view public.public_county_summary as
select (select count(*) from public.votes)::int as votes_cast,
       (select count(*) from public.reports)::int as reports_filed,
       (select count(*) from public.reports where status in ('resolved', 'closed'))::int as reports_resolved,
       (select count(*) from public.reports where status not in ('resolved', 'closed', 'rejected') and resolve_due_at < now())::int as reports_overdue,
       (select count(*) from public.project_milestones where completed_at is not null)::int as milestones_hit,
       (select count(*) from public.projects where published)::int as projects_published;

grant select on public.public_projects, public.public_tenders, public.public_vote_tally,
                public.public_report_aggregates, public.public_overdue_counts,
                public.public_ward_stats, public.public_county_summary to anon, authenticated;

grant execute on function public.case_status(text) to anon, authenticated;

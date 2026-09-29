-- 0011  Administration: services scoped to their department, a guard on the two-factor switch, AI spend for administrators.

-- ---- services: a chief officer edits their own department's services, not everyone's ------------------------------------------
drop policy "services: staff write" on public.services;
create policy "services: staff write" on public.services for all to authenticated
  using (private.is_admin()
         or exists (select 1 from public.staff_roles r
                     where r.user_id = (select auth.uid()) and private.mfa_ok() and r.active
                       and (r.expires_at is null or r.expires_at > now())
                       and r.role = 'chief_officer' and r.department_id = services.department_id))
  with check (private.is_admin()
         or exists (select 1 from public.staff_roles r
                     where r.user_id = (select auth.uid()) and private.mfa_ok() and r.active
                       and (r.expires_at is null or r.expires_at > now())
                       and r.role = 'chief_officer' and r.department_id = services.department_id));

-- ---- the two-factor switch cannot lock the county out --------------------------------------------------------------------------
-- Turning "require_staff_mfa" on makes every staff permission need a second factor. The person turning it on must
-- therefore be signed in with one, otherwise they would lock themselves out in the same click.
-- (The SQL editor and the service role have no signed-in user and are not affected.)
create function private.guard_mfa_switch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.settings ->> 'require_staff_mfa', 'false') = 'true'
     and coalesce(old.settings ->> 'require_staff_mfa', 'false') <> 'true'
     and (select auth.uid()) is not null
     and coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'aal', '') <> 'aal2' then
    raise exception 'Sign in with your authenticator app before turning on two-factor for everyone' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger county_mfa_switch before update on public.county
  for each row execute function private.guard_mfa_switch();

-- ---- AI spend, for administrators ----------------------------------------------------------------------------------------------------
-- Per department for the current month: what was spent, the cap that applies, and the number of calls.
-- Runs as the caller, so it returns nothing to anyone who may not read ai_calls / ai_budgets.
create function public.ai_usage()
returns table (department_id uuid, department text, spent_kes numeric, cap_kes numeric, calls bigint)
language sql
stable
set search_path = ''
as $$
  with m as (select date_trunc('month', now())::date as month),
  base as (select null::uuid as id, 'County-wide pool'::text as name
           union all select d.id, d.name from public.departments d),
  spend as (select c.department_id as id, sum(c.cost_kes) as spent, count(*) as calls
              from public.ai_calls c where c.side = 'county' and c.at >= (select month from m) group by c.department_id)
  select b.id, b.name, coalesce(s.spent, 0), coalesce(
           (select x.cap_kes from public.ai_budgets x where x.department_id is not distinct from b.id and x.month = (select month from m)),
           (select x.cap_kes from public.ai_budgets x where x.department_id is null and x.month = (select month from m)),
           (select (c.settings ->> 'ai_default_cap_kes')::numeric from public.county c limit 1), 0),
         coalesce(s.calls, 0)
    from base b left join spend s on s.id is not distinct from b.id
   where private.has_role(array['super_admin', 'admin', 'auditor'])
   order by (b.id is not null), b.name;
$$;

-- Set (or clear, with null) this month's cap for one department, or for the county-wide pool when p_department is null.
create function public.set_ai_budget(p_department uuid, p_cap numeric)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', now())::date;
begin
  if p_cap is null then
    delete from public.ai_budgets where department_id is not distinct from p_department and month = v_month;
  else
    if p_cap < 0 or p_cap > 10000000 then raise exception 'Cap out of range' using errcode = '22023'; end if;
    insert into public.ai_budgets (department_id, month, cap_kes) values (p_department, v_month, p_cap)
    on conflict (department_id, month) do update set cap_kes = excluded.cap_kes;
  end if;
end;
$$;

revoke all on function public.ai_usage(), public.set_ai_budget(uuid, numeric) from public, anon;
grant execute on function public.ai_usage(), public.set_ai_budget(uuid, numeric) to authenticated;

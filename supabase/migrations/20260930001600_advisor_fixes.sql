-- 0016  Clear the Supabase security and performance advisor findings, without changing who can see or do what.
--
-- 1. The public statistics views (public_ward_stats and friends) deliberately run with their owner's rights: they show
--    counts and totals from tables residents cannot read row by row. They now live in the `internal` schema, which the
--    API does not expose, and `public` keeps a thin SECURITY INVOKER view of the same name on top. Same data, same
--    names for the app, and no owner-rights view in the exposed schema.
-- 2. The same for the API functions that run as their owner (case_status, decide_application, grant_staff_role ...):
--    each body moves to `internal` unchanged, with every permission check it had, and `public` keeps a SECURITY INVOKER
--    wrapper with the same name, arguments and grants. auth.uid() still identifies the caller inside.
-- 3. Tables that nobody reads directly (votes, case_feedback, ...) get an explicit "no direct access" policy.
-- 4. Write policies that also covered SELECT are split into insert / update / delete, so each read is checked once.
-- 5. private.audit_immutable gets a fixed search_path; pg_net moves out of the public schema.

create schema if not exists internal;
revoke all on schema internal from public;
grant usage on schema internal to anon, authenticated, service_role;

-- ---- 1. statistics views ------------------------------------------------------------------------------------------
do $$
declare
  v text;
begin
  foreach v in array array['public_county_summary', 'public_overdue_counts', 'public_projects', 'public_report_aggregates',
                           'public_tenders', 'public_vote_tally', 'public_ward_stats'] loop
    if exists (select 1 from pg_views where schemaname = 'public' and viewname = v) then
      execute format('alter view public.%I set schema internal', v);
      execute format('create view public.%I with (security_invoker = true) as select * from internal.%I', v, v);
      execute format('grant select on internal.%I to anon, authenticated', v);
      execute format('grant select on public.%I to anon, authenticated', v);
    end if;
  end loop;
end;
$$;

-- ---- 2. owner-rights API functions --------------------------------------------------------------------------------
do $$
declare
  f record;
  call_args text;
  body text;
  role_name text;
begin
  for f in
    select p.oid, p.proname, p.provolatile, p.proretset, p.prorettype,
           pg_get_function_arguments(p.oid) as args,
           pg_get_function_identity_arguments(p.oid) as ident,
           pg_get_function_result(p.oid) as result,
           p.proargnames, p.proargmodes, p.pronargs
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prosecdef
       and p.prokind = 'f'
       and p.prorettype <> 'trigger'::regtype
       and p.proname not like 'svc\_%'
       and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))
  loop
    -- named arguments, so defaults keep working through the wrapper
    select coalesce(string_agg(format('%1$I => %1$I', a.name), ', ' order by a.i), '')
      into call_args
      from unnest(f.proargnames[1:f.pronargs]) with ordinality as a(name, i);

    execute format('alter function public.%I(%s) set schema internal', f.proname, f.ident);

    body := case
      when f.prorettype = 'void'::regtype then format('select internal.%I(%s)', f.proname, call_args)
      when f.proretset then format('select * from internal.%I(%s)', f.proname, call_args)
      else format('select internal.%I(%s)', f.proname, call_args)
    end;

    execute format(
      'create function public.%I(%s) returns %s language sql %s security invoker set search_path = '''' as %L',
      f.proname, f.args, f.result,
      case f.provolatile when 's' then 'stable' when 'i' then 'immutable' else 'volatile' end,
      body);

    execute format('revoke all on function public.%I(%s) from public', f.proname, f.ident);
    foreach role_name in array array['anon', 'authenticated'] loop
      if has_function_privilege(role_name, f.oid, 'execute') then  -- the moved function keeps its oid and grants
        execute format('grant execute on function public.%I(%s) to %I', f.proname, f.ident, role_name);
      end if;
    end loop;
    execute format('grant execute on function public.%I(%s) to service_role', f.proname, f.ident);
  end loop;
end;
$$;

-- ---- 3. tables only the database itself touches -------------------------------------------------------------------
do $$
declare
  t text;
begin
  for t in
    select c.relname
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
       and not exists (select 1 from pg_policy p where p.polrelid = c.oid)
  loop
    execute format('create policy "no direct access" on public.%I for select to anon, authenticated using (false)', t);
  end loop;
end;
$$;

-- ---- 4. one policy per action ---------------------------------------------------------------------------------------
-- A FOR ALL write policy also applies to SELECT, so tables with a separate read policy evaluated two policies on
-- every read. Each FOR ALL policy on such a table becomes insert / update / delete with the same conditions.
do $$
declare
  p record;
  roles text;
begin
  for p in
    select pol.tablename, pol.policyname, pol.roles, pol.qual, pol.with_check
      from pg_policies pol
     where pol.schemaname = 'public' and pol.cmd = 'ALL'
       and exists (select 1 from pg_policies r
                    where r.schemaname = 'public' and r.tablename = pol.tablename
                      and r.cmd = 'SELECT' and r.roles && pol.roles)
  loop
    select string_agg(quote_ident(r), ', ') into roles from unnest(p.roles) r;
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
    execute format('create policy %I on public.%I for insert to %s with check (%s)',
                   p.policyname || ' (insert)', p.tablename, roles, coalesce(p.with_check, p.qual));
    execute format('create policy %I on public.%I for update to %s using (%s) with check (%s)',
                   p.policyname || ' (update)', p.tablename, roles, p.qual, coalesce(p.with_check, p.qual));
    execute format('create policy %I on public.%I for delete to %s using (%s)',
                   p.policyname || ' (delete)', p.tablename, roles, p.qual);
  end loop;
end;
$$;

-- ---- 5. small ones ----------------------------------------------------------------------------------------------------
alter function private.audit_immutable() set search_path = '';

-- pg_net keeps its functions in the `net` schema wherever the extension itself is registered, so moving the
-- registration changes nothing for the scheduled jobs. Only on a live project (tests have no pg_net).
do $$
begin
  if exists (select 1 from pg_extension e join pg_namespace n on n.oid = e.extnamespace
              where e.extname = 'pg_net' and n.nspname = 'public') then
    drop extension pg_net;
    create extension pg_net with schema extensions;
  end if;
end;
$$;

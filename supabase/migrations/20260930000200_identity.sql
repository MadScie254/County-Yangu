-- 0002  Identity: profiles, scoped staff roles, auditor invites, role helpers.
--
-- Roles are NOT stored on the profile and can never come from signup metadata.
-- A role is a row in staff_roles, created only by an admin through grant_staff_role()
-- (or by a trusted database session when bootstrapping the first super admin).

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text not null default '',
  email      text,
  phone      text,
  national_id text,
  address    text,
  avatar_url text,
  ward_id    text references public.wards (id),
  locale     text not null default 'en' check (locale in ('en', 'sw')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Every new auth user gets a resident profile. Nothing in raw_user_meta_data can grant power.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name, email, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    new.email,
    coalesce(new.phone, new.raw_user_meta_data ->> 'phone_number')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create table public.staff_roles (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  role          text not null check (role in (
                  'super_admin', 'admin', 'chief_officer', 'sub_county_admin',
                  'ward_admin', 'officer', 'assembly_member', 'auditor')),
  department_id uuid references public.departments (id),
  sub_county_id text references public.sub_counties (id),
  ward_id       text references public.wards (id),
  active        boolean not null default true,
  expires_at    timestamptz,                 -- auditors get time-limited access
  granted_by    uuid references auth.users (id),
  created_at    timestamptz not null default now(),
  -- scope must match the role
  constraint staff_roles_scope check (
    case role
      when 'chief_officer'     then department_id is not null
      when 'sub_county_admin'  then sub_county_id is not null
      when 'ward_admin'        then ward_id is not null
      else true
    end),
  unique nulls not distinct (user_id, role, department_id, sub_county_id, ward_id)
);
create index staff_roles_user_idx on public.staff_roles (user_id) where active;

create table public.auditor_invites (
  id          uuid primary key default gen_random_uuid(),
  token_hash  bytea not null unique,        -- sha-256 of the emailed token; the token itself is never stored
  email       text not null,
  organisation text,                        -- e.g. OAG, Controller of Budget
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_by  uuid references auth.users (id),
  created_at  timestamptz not null default now()
);

-- ---- helpers (private schema; not exposed through the API) -----------------

grant usage on schema private to authenticated, service_role;

-- Does the signed-in user hold any active, unexpired role from the list?
create function private.has_role(p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff_roles r
    where r.user_id = (select auth.uid())
      and r.active
      and (r.expires_at is null or r.expires_at > now())
      and r.role = any (p_roles)
  );
$$;

create function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_role(array['super_admin','admin','chief_officer','sub_county_admin',
                                'ward_admin','officer','assembly_member','auditor']);
$$;

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_role(array['super_admin','admin']);
$$;

-- Can the signed-in staff member act on a case in this ward / department / assignment?
-- Assembly members and auditors deliberately get NO row access here: they use the
-- oversight functions, which return summaries.
create function private.can_work_case(p_ward text, p_dept uuid, p_assignee uuid)
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
        r.role in ('super_admin', 'admin')
        or (r.role = 'chief_officer'    and r.department_id = p_dept)
        or (r.role = 'sub_county_admin' and r.sub_county_id = w.sub_county_id)
        or (r.role = 'ward_admin'       and r.ward_id = p_ward)
        or (r.role = 'officer'          and (p_assignee = r.user_id
                                             or (p_assignee is null and r.department_id = p_dept)))
      )
  );
$$;

-- ---- RLS + grants -----------------------------------------------------------

alter table public.profiles        enable row level security;
alter table public.staff_roles     enable row level security;
alter table public.auditor_invites enable row level security;

create policy "own profile: read"   on public.profiles for select to authenticated
  using ((select auth.uid()) = id or private.is_admin());
create policy "own profile: update" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Users may edit personal details only. Nothing here can grant a role.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (name, phone, national_id, address, avatar_url, ward_id, locale, updated_at)
  on public.profiles to authenticated;

-- staff_roles: read your own rows (the app needs them to route you); admins read all.
-- No INSERT/UPDATE/DELETE grants: use grant_staff_role() / revoke_staff_role().
create policy "own roles: read" on public.staff_roles for select to authenticated
  using ((select auth.uid()) = user_id or private.is_admin());
revoke all on public.staff_roles from anon, authenticated;
grant select on public.staff_roles to authenticated;

-- auditor_invites: admin only, via functions.
revoke all on public.auditor_invites from anon, authenticated;

-- Reference data is maintained by admins (edited through the console).
create policy "admins write" on public.county            for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "admins write" on public.wards             for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "admins write" on public.departments       for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "admins write" on public.report_categories for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "admins write" on public.holidays          for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "admins write" on public.sub_counties      for all to authenticated using (private.is_admin()) with check (private.is_admin());
grant insert, update, delete on public.county, public.wards, public.departments,
  public.report_categories, public.holidays, public.sub_counties to authenticated;

-- ---- role administration -----------------------------------------------------

-- Only a super admin can create another admin/super admin; an admin can grant operational roles.
create function public.grant_staff_role(
  p_user uuid,
  p_role text,
  p_department uuid default null,
  p_sub_county text default null,
  p_ward text default null,
  p_expires_at timestamptz default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_actor uuid := (select auth.uid());
begin
  -- v_actor is null for trusted sessions (SQL editor / service role bootstrap).
  if v_actor is not null then
    if p_role in ('super_admin', 'admin') then
      if not private.has_role(array['super_admin']) then
        raise exception 'Only a super admin can grant %', p_role using errcode = '42501';
      end if;
    elsif not private.is_admin() then
      raise exception 'Only an admin can grant staff roles' using errcode = '42501';
    end if;
  end if;

  insert into public.staff_roles (user_id, role, department_id, sub_county_id, ward_id, expires_at, granted_by)
  values (p_user, p_role, p_department, p_sub_county, p_ward, p_expires_at, v_actor)
  on conflict (user_id, role, department_id, sub_county_id, ward_id)
    do update set active = true, expires_at = excluded.expires_at, granted_by = excluded.granted_by
  returning id into v_id;
  return v_id;
end;
$$;

create function public.revoke_staff_role(p_role_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
begin
  select role into v_role from public.staff_roles where id = p_role_id;
  if v_role is null then return; end if;
  if (select auth.uid()) is not null then
    if v_role in ('super_admin', 'admin') then
      if not private.has_role(array['super_admin']) then
        raise exception 'Only a super admin can revoke %', v_role using errcode = '42501';
      end if;
    elsif not private.is_admin() then
      raise exception 'Only an admin can revoke staff roles' using errcode = '42501';
    end if;
  end if;
  update public.staff_roles set active = false where id = p_role_id;
end;
$$;

grant execute on function public.grant_staff_role(uuid, text, uuid, text, text, timestamptz) to authenticated, service_role;
grant execute on function public.revoke_staff_role(uuid) to authenticated, service_role;

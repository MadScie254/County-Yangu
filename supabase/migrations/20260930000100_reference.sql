-- County Yangu + CountyConnect: one database per county.
-- 0001  Reference data: county config, wards, departments, report categories, holidays.
--
-- Conventions used throughout the schema:
--  * RLS is enabled on every table. Anonymous visitors read curated views/reference
--    tables only. Every public write (report, vote, alert signup) goes through an
--    Edge Function that validates, rate-limits, hashes and then writes with the
--    service role. There are deliberately no anon/authenticated INSERT policies.
--  * Helper functions live in the `private` schema, which PostgREST does not expose.
--  * Every SECURITY DEFINER function pins search_path to '' and qualifies names.

create schema if not exists private;
revoke all on schema private from public;

-- Supabase grants every new table/function in `public` to anon and authenticated by default.
-- Turn that off: in this schema every privilege is granted explicitly, next to the object it is for.
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;
-- The service role (used only by Edge Functions and the SQL editor) keeps full access to everything created from here on.
-- Stated explicitly so it holds even in a project whose `public` schema was dropped and recreated.
alter default privileges in schema public grant all on tables    to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on functions to service_role;
alter default privileges revoke execute on functions from public;
-- Helpers in `private` are needed by RLS policies evaluated as the caller; the schema is not exposed by the API.
alter default privileges in schema private grant execute on functions to authenticated, service_role;

-- One row: the county this database serves.
create table public.county (
  id             smallint primary key default 1 check (id = 1),
  slug           text not null,
  name           text not null,
  code           int  not null,
  centroid_lat   numeric(9,6),
  centroid_lng   numeric(9,6),
  bbox           numeric[],                 -- {minLng,minLat,maxLng,maxLat}
  paybill        text,
  ussd_code      text,
  sender_id      text,
  timezone       text not null default 'Africa/Nairobi',
  default_locale text not null default 'en' check (default_locale in ('en', 'sw')),
  settings       jsonb not null default '{}'::jsonb
);

create table public.sub_counties (
  id           text primary key,
  name         text not null unique,
  centroid_lat numeric(9,6),
  centroid_lng numeric(9,6),
  area_km2     numeric(10,2)
);

create table public.wards (
  id            text primary key,           -- slug, e.g. 'kileleshwa'
  code          int unique,                 -- IEBC/KNBS ward code
  name          text not null,
  sub_county_id text references public.sub_counties (id),
  constituency  text not null,
  geojson       jsonb,                      -- Polygon / MultiPolygon geometry (WGS84), null until boundaries are loaded
  centroid_lat  numeric(9,6),
  centroid_lng  numeric(9,6),
  bbox          numeric[],                  -- {minLng,minLat,maxLng,maxLat}
  population    int
);
create index wards_sub_county_idx on public.wards (sub_county_id);

create table public.departments (
  id      uuid primary key default gen_random_uuid(),
  code    text not null unique,
  name    text not null,
  name_sw text
);

-- Two timers per category: time to acknowledge and time to resolve.
-- Working-day timers skip weekends and rows in public.holidays.
create table public.report_categories (
  id                text primary key,
  name              text not null,
  name_sw           text,
  department_id     uuid references public.departments (id),
  ack_value         int  not null default 2,
  ack_unit          text not null default 'working_days' check (ack_unit in ('hours', 'working_days')),
  resolve_value     int  not null default 21,
  resolve_unit      text not null default 'working_days' check (resolve_unit in ('hours', 'working_days')),
  default_priority  text not null default 'normal' check (default_priority in ('low', 'normal', 'high', 'urgent')),
  sensitive         boolean not null default false,   -- integrity/finance: routed around the implicated department
  active            boolean not null default true,
  sort              int not null default 0
);

create table public.holidays (
  day  date primary key,
  name text not null
);

-- Adds n working days (Mon-Fri, not a holiday) to a timestamp, in the county timezone.
create function private.add_working_days(p_from timestamptz, p_days int)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
declare
  tz  text := coalesce((select c.timezone from public.county c limit 1), 'Africa/Nairobi');
  d   timestamp := p_from at time zone tz;
  n   int := p_days;
begin
  while n > 0 loop
    d := d + interval '1 day';
    if extract(isodow from d) < 6
       and not exists (select 1 from public.holidays h where h.day = d::date) then
      n := n - 1;
    end if;
  end loop;
  return d at time zone tz;
end;
$$;

create function private.add_sla(p_from timestamptz, p_value int, p_unit text)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select case p_unit
    when 'hours' then p_from + make_interval(hours => p_value)
    else private.add_working_days(p_from, p_value)
  end;
$$;

alter table public.county            enable row level security;
alter table public.sub_counties      enable row level security;
alter table public.wards             enable row level security;
alter table public.departments       enable row level security;
alter table public.report_categories enable row level security;
alter table public.holidays          enable row level security;

-- Reference data is public to read; only privileged staff write it (policies added in the identity migration).
create policy "reference is public" on public.county            for select to anon, authenticated using (true);
create policy "reference is public" on public.sub_counties      for select to anon, authenticated using (true);
create policy "reference is public" on public.wards             for select to anon, authenticated using (true);
create policy "reference is public" on public.departments       for select to anon, authenticated using (true);
create policy "reference is public" on public.report_categories for select to anon, authenticated using (active);
create policy "reference is public" on public.holidays          for select to anon, authenticated using (true);

grant select on public.county, public.sub_counties, public.wards, public.departments,
                public.report_categories, public.holidays to anon, authenticated;

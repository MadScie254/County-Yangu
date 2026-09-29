-- DESTRUCTIVE. Run once, in the SQL editor of the OLD County-Connect Supabase project, BEFORE setup.sql.
--
-- It removes everything the original CountyConnect app created in this project (its demo tables, functions, policies and
-- storage rules) so the new schema can be installed cleanly. It does not touch Supabase's own schemas, and it keeps the
-- accounts in auth.users (so you can still sign in). The data it removes is demo data.
--
-- After this: run supabase/ops/setup.sql, then supabase/ops/after-setup.sql.
-- Also delete the three old Edge Functions in the dashboard (Edge Functions > mpesa-stk-push, mpesa-webhook, ussd-gateway):
-- the old versions are replaced by the ones in supabase/functions and must not stay reachable.

begin;

-- 1. the old application schema (tables, functions, views, types; the trigger it put on auth.users goes with its function)
drop schema if exists public cascade;
create schema public;
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, service_role;
-- dropping the schema also dropped Supabase's default grants for it; put the standard ones back
-- (setup.sql then narrows what anon and authenticated get, table by table)
alter default privileges for role postgres in schema public grant all on tables    to postgres, anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on sequences to postgres, anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on functions to postgres, anon, authenticated, service_role;

-- 2. helpers from an earlier attempt, if present
drop schema if exists private cascade;

-- 3. the old storage rules (the new ones are created by setup.sql)
drop policy if exists "Avatar images are publicly accessible" on storage.objects;
drop policy if exists "Users can upload their own avatars" on storage.objects;
drop policy if exists "Users can update their own avatars" on storage.objects;
drop policy if exists "Users can delete their own avatars" on storage.objects;
drop policy if exists "Users can upload their own documents" on storage.objects;
drop policy if exists "Users can read own documents" on storage.objects;
drop policy if exists "Admins can read all documents" on storage.objects;
-- the old private bucket is replaced by "application-docs". If it holds only demo files you can delete it in the dashboard
-- (Storage > applications-documents > delete); SQL cannot remove a bucket that still contains files.

commit;

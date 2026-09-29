-- Scheduled jobs for one county. Run ONCE in the SQL editor after the functions are deployed. Not a migration: it needs
-- this project's URL and the CRON_SECRET you set as a function secret, and neither belongs in git.
--
--   1. Replace the two values below.
--   2. Requires the pg_cron and pg_net extensions (Database > Extensions).
--
-- All times are UTC; Nairobi is UTC+3.

select vault.create_secret('https://YOUR-PROJECT-REF.supabase.co', 'project_url');
select vault.create_secret('THE-SAME-VALUE-AS-CRON_SECRET', 'cron_secret');

-- helper: POST to a function with the shared secret
create or replace function private.call_function(p_path text)
returns bigint
language sql
security definer
set search_path = ''
as $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/' || p_path,
    headers := jsonb_build_object(
                 'content-type', 'application/json',
                 'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body    := '{}'::jsonb,
    timeout_milliseconds := 55000);
$$;
revoke all on function private.call_function(text) from public, anon, authenticated;

select cron.schedule('outbox-worker',        '* * * * *',   $$ select private.call_function('outbox-worker') $$);                                   -- every minute: approved alerts out, messages sent
select cron.schedule('escalation-runner',    '5 * * * *',   $$ select private.call_function('escalation-runner') $$);                               -- hourly
select cron.schedule('digest-monthly',       '0 5 1 * *',   $$ select private.call_function('digest-builder?job=monthly') $$);                      -- 08:00 on the 1st
select cron.schedule('ward-updates-daily',   '30 5 * * *',  $$ select private.call_function('digest-builder?job=ward-updates&frequency=daily') $$); -- 08:30 daily
select cron.schedule('ward-updates-weekly',  '30 5 * * 1',  $$ select private.call_function('digest-builder?job=ward-updates&frequency=weekly') $$);-- 08:30 Mondays

-- To see what ran:   select * from cron.job_run_details order by start_time desc limit 20;
-- To stop one:       select cron.unschedule('ward-updates-daily');

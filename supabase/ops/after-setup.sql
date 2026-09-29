-- Run once, in the SQL editor, AFTER setup.sql.

-- 1. People who already had an account before the reset need a profile row (new sign-ups get one automatically).
insert into public.profiles (id, name, email, phone)
select u.id, coalesce(u.raw_user_meta_data ->> 'name', ''), u.email, u.phone
  from auth.users u
on conflict (id) do nothing;

-- 2. Make yourself the first super administrator. Replace the address with the email you sign in with.
--    (The SQL editor is a trusted session, so this is the one place a super admin can be created directly.
--     After this, super admins and admins are managed from Administration > People & roles in the console.)
select public.grant_staff_role((select id from auth.users where email = 'YOU@EXAMPLE.COM'), 'super_admin');

-- 3. Tell the system who it serves. Fill in the address of each site once they exist (used inside SMS and email links).
update public.county
   set settings = settings || jsonb_build_object(
         'web_url',      'https://YOUR-PUBLIC-SITE',
         'console_url',  'https://YOUR-CONSOLE-SITE',
         'ai_default_cap_kes', 500);

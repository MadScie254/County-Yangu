-- Lock down role assignment.
--
-- Before this migration two paths let any visitor become an admin:
--   1. handle_new_user() copied `role` from client-supplied signup metadata
--      (supabase.auth.signUp({ options: { data: { role: 'super_admin' } } })).
--   2. authenticated held a table-wide UPDATE grant on public.profiles and the
--      "Users can update own profile" policy only checks the row id, so a user
--      could `update profiles set role = 'super_admin'` on their own row.
--
-- After this migration a role can only be changed by a super_admin (through
-- set_user_role) or by a trusted database session (SQL editor / service role).

-- 1. New profiles are always citizens. Nothing in raw_user_meta_data can
--    grant a role, and no email address is special-cased any more.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, national_id, phone_number, role, county_slug)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', ''),
    new.email,
    new.raw_user_meta_data->>'national_id',
    new.raw_user_meta_data->>'phone_number',
    'citizen',
    new.raw_user_meta_data->>'county_slug'
  );
  RETURN new;
END;
$$;

-- 2. Signed-in users may edit only their own profile details, never `role`.
REVOKE UPDATE ON TABLE public.profiles FROM authenticated;
GRANT UPDATE (name, phone_number, national_id, address, avatar_url, county_slug, updated_at)
  ON TABLE public.profiles TO authenticated;

-- 3. Defence in depth: even if a future grant or policy re-opens the column,
--    a role change is rejected unless a super_admin or a trusted session makes it.
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid()) AND role = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.guard_profile_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND (SELECT auth.uid()) IS NOT NULL
     AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only a super admin can change a user role'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_role_change ON public.profiles;
CREATE TRIGGER guard_profile_role_change
  BEFORE UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_role_change();

-- 4. Only known roles may be stored (NOT VALID: existing rows are not re-checked).
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('citizen', 'business', 'admin', 'super_admin')) NOT VALID;

-- 5. The supported way to change a role. Callable by super admins only.
CREATE OR REPLACE FUNCTION public.set_user_role(target_user UUID, new_role TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NOT NULL AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only a super admin can change a user role'
      USING ERRCODE = '42501';
  END IF;
  IF new_role NOT IN ('citizen', 'business', 'admin', 'super_admin') THEN
    RAISE EXCEPTION 'Unknown role: %', new_role;
  END IF;
  UPDATE public.profiles SET role = new_role WHERE id = target_user;
END;
$$;

REVOKE ALL ON FUNCTION public.set_user_role(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_user_role(UUID, TEXT) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, service_role;

-- Bootstrapping the first admin on a fresh project (run in the SQL editor,
-- which has no auth.uid()):
--   select public.set_user_role('<auth user uuid>', 'super_admin');
-- Existing admin profiles keep their role; nothing here demotes anyone.

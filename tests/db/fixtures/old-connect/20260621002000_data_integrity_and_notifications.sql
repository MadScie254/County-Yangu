-- County on profile, role constraint, tighter petition + notification policies.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS county_slug TEXT;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('citizen', 'admin', 'business', 'super_admin'));

-- Petitions: require authentication to vote.
DROP POLICY IF EXISTS "Anyone can vote on petitions" ON public.petitions;

CREATE POLICY "Authenticated users can vote on petitions" ON public.petitions
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

REVOKE UPDATE ON TABLE public.petitions FROM anon;

-- Notifications: users may only mark their own notifications read.
DROP POLICY IF EXISTS "Users can update their notifications" ON public.notifications;

CREATE POLICY "Users can update their notifications" ON public.notifications
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Admins may insert notifications for citizens (status updates, alerts).
DROP POLICY IF EXISTS "Admins can insert notifications" ON public.notifications;

CREATE POLICY "Admins can insert notifications" ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND role IN ('admin', 'super_admin')
    )
  );

-- Persist county on signup.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, national_id, phone_number, role, county_slug)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'name',
    new.email,
    new.raw_user_meta_data->>'national_id',
    new.raw_user_meta_data->>'phone_number',
    COALESCE(new.raw_user_meta_data->>'role', 'citizen'),
    new.raw_user_meta_data->>'county_slug'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

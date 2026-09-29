-- Add metadata columns that the frontend already reads and writes.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS address TEXT;

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS documents JSONB;

-- Replace email-keyed admin policies with role-based checks against public.profiles.
DROP POLICY IF EXISTS "Admins can manage services" ON public.services;
DROP POLICY IF EXISTS "Admins can update all applications" ON public.applications;
DROP POLICY IF EXISTS "Admins can view all applications" ON public.applications;
DROP POLICY IF EXISTS "Admins manage tenders" ON public.tenders;
DROP POLICY IF EXISTS "Admins manage departments" ON public.departments;
DROP POLICY IF EXISTS "Admins manage notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins manage revenue" ON public.revenue;
DROP POLICY IF EXISTS "Admins manage health_drugs" ON public.health_drugs;
DROP POLICY IF EXISTS "Admins manage welfare" ON public.welfare;
DROP POLICY IF EXISTS "Admins manage petitions" ON public.petitions;
DROP POLICY IF EXISTS "Admins manage land_records" ON public.land_records;
DROP POLICY IF EXISTS "Admins manage anomalies" ON public.anomalies;
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their notifications" ON public.notifications;

CREATE POLICY "Admins can manage services" ON public.services
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can update all applications" ON public.applications
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can view all applications" ON public.applications
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can read all profiles" ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY "Users can update their notifications" ON public.notifications
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Admins manage tenders" ON public.tenders FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'super_admin'))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'super_admin'))
);
CREATE POLICY "Admins manage departments" ON public.departments FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'super_admin'))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'super_admin'))
);
CREATE POLICY "Admins manage notifications" ON public.notifications FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'super_admin'))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'super_admin'))
);
CREATE POLICY "Admins manage revenue" ON public.revenue FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'super_admin'))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'super_admin'))
);
CREATE POLICY "Admins manage health_drugs" ON public.health_drugs FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'super_admin'))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'super_admin'))
);
CREATE POLICY "Admins manage welfare" ON public.welfare FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'super_admin'))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'super_admin'))
);
CREATE POLICY "Admins manage petitions" ON public.petitions FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'super_admin'))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'super_admin'))
);
CREATE POLICY "Admins manage land_records" ON public.land_records FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'super_admin'))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'super_admin'))
);
CREATE POLICY "Admins manage anomalies" ON public.anomalies FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'super_admin'))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'super_admin'))
);

-- Explicit Data API grants for Supabase projects that do not expose public tables by default.
GRANT SELECT ON TABLE public.services TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.services TO authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.applications TO authenticated;
GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT ON TABLE public.tenders, public.departments, public.health_drugs, public.welfare, public.petitions, public.land_records TO anon, authenticated;
GRANT UPDATE ON TABLE public.petitions TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tenders, public.departments, public.notifications, public.revenue, public.health_drugs, public.welfare, public.petitions, public.land_records, public.anomalies TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

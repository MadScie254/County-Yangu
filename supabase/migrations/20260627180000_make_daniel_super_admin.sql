-- Update trigger to assign super_admin to specific emails
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  assigned_role TEXT;
BEGIN
  IF new.email IN ('danielwanjalamachimbo@gmail.com', 'danieleinstein1998@gmail.com') THEN
    assigned_role := 'super_admin';
  ELSE
    assigned_role := COALESCE(new.raw_user_meta_data->>'role', 'citizen');
  END IF;

  INSERT INTO public.profiles (id, name, email, national_id, phone_number, role, county_slug)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'name',
    new.email,
    new.raw_user_meta_data->>'national_id',
    new.raw_user_meta_data->>'phone_number',
    assigned_role,
    new.raw_user_meta_data->>'county_slug'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update existing profiles just in case they were already created
UPDATE public.profiles
SET role = 'super_admin'
WHERE email IN ('danielwanjalamachimbo@gmail.com', 'danieleinstein1998@gmail.com');

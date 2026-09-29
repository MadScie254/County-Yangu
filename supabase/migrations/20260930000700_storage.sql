-- 0007  Storage buckets and policies (Supabase only; requires the `storage` schema).
--   report-photos     private   written by the intake function after EXIF stripping; staff read via signed URL
--   project-photos    public    staff write, everyone reads
--   application-docs  private   applicant writes to  <uid>/..., staff with review rights read
--   avatars           public    owner writes to  <uid>/...

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('report-photos',    'report-photos',    false, 2097152,  array['image/webp', 'image/jpeg', 'image/png']),
  ('project-photos',   'project-photos',   true,  4194304,  array['image/webp', 'image/jpeg', 'image/png']),
  ('application-docs', 'application-docs', false, 8388608,  array['application/pdf', 'image/webp', 'image/jpeg', 'image/png']),
  ('avatars',          'avatars',          true,  1048576,  array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- report-photos: staff only (uploads come from the service role, which bypasses RLS)
create policy "report photos: staff read" on storage.objects for select to authenticated
  using (bucket_id = 'report-photos' and private.is_staff());

-- project-photos: public read is implied by the public bucket; staff write
create policy "project photos: staff write" on storage.objects for insert to authenticated
  with check (bucket_id = 'project-photos' and private.has_role(array['super_admin', 'admin', 'chief_officer', 'sub_county_admin', 'ward_admin']));
create policy "project photos: staff delete" on storage.objects for delete to authenticated
  using (bucket_id = 'project-photos' and private.has_role(array['super_admin', 'admin', 'chief_officer', 'sub_county_admin', 'ward_admin']));

-- application-docs: first path segment is the applicant's user id
create policy "app docs: owner write" on storage.objects for insert to authenticated
  with check (bucket_id = 'application-docs' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "app docs: owner or staff read" on storage.objects for select to authenticated
  using (bucket_id = 'application-docs'
         and ((storage.foldername(name))[1] = (select auth.uid())::text or private.is_staff()));

-- avatars
create policy "avatars: owner write" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars: owner update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

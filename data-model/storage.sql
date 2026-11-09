-- =====================================================================
-- Scan files (Supabase Storage). Bucket "scans" is public: the archive
-- documents are public. Only admins can upload, replace or delete.
-- media.storage_path is "<bucket>/<file>", e.g. scans/david-stemmer.pdf
-- =====================================================================
insert into storage.buckets (id, name, public) values ('scans', 'scans', true)
  on conflict (id) do nothing;

create policy "admins add scans" on storage.objects for insert to authenticated
  with check (bucket_id = 'scans' and public.is_admin());
create policy "admins replace scans" on storage.objects for update to authenticated
  using (bucket_id = 'scans' and public.is_admin());
create policy "admins delete scans" on storage.objects for delete to authenticated
  using (bucket_id = 'scans' and public.is_admin());
create policy "admins list scans" on storage.objects for select to authenticated
  using (bucket_id = 'scans' and public.is_admin());

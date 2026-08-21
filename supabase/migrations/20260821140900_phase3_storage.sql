-- Private storage for FM Request and Work Order evidence. Mirrors the Phase 2
-- asset-attachments bucket (20MB, MIME whitelist). Object paths are
-- {organization_id}/{parent_id}/{filename}; storage RLS extracts the parent id
-- from the path and defers to the same can_read_/can_write_ helpers as the tables.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('fm-request-attachments','fm-request-attachments', false, 20971520, array[
    'image/png','image/jpeg','image/webp','image/gif','application/pdf',
    'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain','text/csv']),
  ('work-order-attachments','work-order-attachments', false, 20971520, array[
    'image/png','image/jpeg','image/webp','image/gif','application/pdf',
    'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain','text/csv'])
on conflict (id) do nothing;

-- FM request attachment objects
create policy "Read fm-request objects" on storage.objects for select to authenticated
using (
  bucket_id = 'fm-request-attachments'
  and (storage.foldername(name))[1] = public.current_user_organization_id()::text
  and public.can_read_fm_request(((storage.foldername(name))[2])::uuid)
);
create policy "Insert fm-request objects" on storage.objects for insert to authenticated
with check (
  bucket_id = 'fm-request-attachments'
  and (storage.foldername(name))[1] = public.current_user_organization_id()::text
  and public.can_write_fm_request(((storage.foldername(name))[2])::uuid)
);
create policy "Delete fm-request objects" on storage.objects for delete to authenticated
using (
  bucket_id = 'fm-request-attachments'
  and (storage.foldername(name))[1] = public.current_user_organization_id()::text
  and (public.can_manage_facility() or owner = auth.uid())
);

-- Work order attachment objects
create policy "Read work-order objects" on storage.objects for select to authenticated
using (
  bucket_id = 'work-order-attachments'
  and (storage.foldername(name))[1] = public.current_user_organization_id()::text
  and public.can_read_work_order(((storage.foldername(name))[2])::uuid)
);
create policy "Insert work-order objects" on storage.objects for insert to authenticated
with check (
  bucket_id = 'work-order-attachments'
  and (storage.foldername(name))[1] = public.current_user_organization_id()::text
  and public.can_write_work_order(((storage.foldername(name))[2])::uuid)
);
create policy "Delete work-order objects" on storage.objects for delete to authenticated
using (
  bucket_id = 'work-order-attachments'
  and (storage.foldername(name))[1] = public.current_user_organization_id()::text
  and (public.can_manage_facility() or owner = auth.uid())
);

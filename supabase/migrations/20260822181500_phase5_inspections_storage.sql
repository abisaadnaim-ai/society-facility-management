-- ============================================================================
-- PHASE 5: private storage for inspection photo evidence.
-- Object path: {organization_id}/inspections/{inspection_id}/{response_id}/{filename}
-- foldername(name): [1]=org, [2]='inspections', [3]=inspection_id, [4]=response_id.
-- Read/Insert defer to the same visibility helpers as the tables; Delete allows
-- managers or the uploading owner.
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('inspection-attachments','inspection-attachments', false, 20971520, array[
    'image/png','image/jpeg','image/webp','image/gif','application/pdf',
    'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain','text/csv'])
on conflict (id) do nothing;

create policy "Read inspection objects" on storage.objects for select to authenticated
using (
  bucket_id = 'inspection-attachments'
  and (storage.foldername(name))[1] = public.current_user_organization_id()::text
  and public.can_read_inspection(((storage.foldername(name))[3])::uuid)
);
create policy "Insert inspection objects" on storage.objects for insert to authenticated
with check (
  bucket_id = 'inspection-attachments'
  and (storage.foldername(name))[1] = public.current_user_organization_id()::text
  and public.can_write_inspection(((storage.foldername(name))[3])::uuid)
);
create policy "Delete inspection objects" on storage.objects for delete to authenticated
using (
  bucket_id = 'inspection-attachments'
  and (storage.foldername(name))[1] = public.current_user_organization_id()::text
  and (public.can_manage_facility() or owner = auth.uid())
);

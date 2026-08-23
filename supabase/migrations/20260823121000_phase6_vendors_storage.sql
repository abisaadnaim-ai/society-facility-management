-- ============================================================================
-- PHASE 6 STORAGE: private bucket for vendor & service-contract documents.
-- Object paths:
--   {organization_id}/vendors/{vendor_id}/{filename}
--   {organization_id}/contracts/{contract_id}/{filename}
-- foldername(name): [1]=org, [2]='vendors'|'contracts', [3]=entity id.
-- Access is org-scoped and role-based; downloads use signed URLs. Never public.
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vendor-documents','vendor-documents', false, 20971520, array[
    'image/png','image/jpeg','image/webp','image/gif','application/pdf',
    'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain','text/csv'])
on conflict (id) do nothing;

create policy "Read vendor documents" on storage.objects for select to authenticated
using (
  bucket_id = 'vendor-documents'
  and (storage.foldername(name))[1] = public.current_user_organization_id()::text
  and public.can_read_vendor()
);
create policy "Insert vendor documents" on storage.objects for insert to authenticated
with check (
  bucket_id = 'vendor-documents'
  and (storage.foldername(name))[1] = public.current_user_organization_id()::text
  and public.can_manage_facility()
);
create policy "Delete vendor documents" on storage.objects for delete to authenticated
using (
  bucket_id = 'vendor-documents'
  and (storage.foldername(name))[1] = public.current_user_organization_id()::text
  and public.can_manage_facility()
);

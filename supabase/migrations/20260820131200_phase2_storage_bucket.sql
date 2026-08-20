insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('asset-attachments','asset-attachments',false,20971520,
  array['image/png','image/jpeg','image/webp','image/gif','application/pdf',
    'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain','text/csv'])
on conflict (id) do nothing;

create policy "Read asset attachments in own org" on storage.objects for select to authenticated
  using (bucket_id='asset-attachments' and (storage.foldername(name))[1]=public.current_user_organization_id()::text and public.can_read_facility());
create policy "Managers upload asset attachments in own org" on storage.objects for insert to authenticated
  with check (bucket_id='asset-attachments' and (storage.foldername(name))[1]=public.current_user_organization_id()::text and public.can_manage_facility());
create policy "Managers delete asset attachments in own org" on storage.objects for delete to authenticated
  using (bucket_id='asset-attachments' and (storage.foldername(name))[1]=public.current_user_organization_id()::text and public.can_manage_facility());

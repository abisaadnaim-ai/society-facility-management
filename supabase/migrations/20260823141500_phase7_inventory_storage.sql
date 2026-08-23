-- =====================================================================
-- Phase 7: Inventory item documents (private storage; optional per §17)
-- =====================================================================

create table public.inventory_item_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  inventory_item_id uuid not null,
  document_type text,
  document_name text not null,
  file_name text not null,
  file_path text not null,
  file_type text,
  file_size bigint,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (inventory_item_id, organization_id)
    references public.inventory_items (id, organization_id) on delete cascade
);
alter table public.inventory_item_documents enable row level security;
create index inventory_item_documents_item_idx on public.inventory_item_documents (inventory_item_id);

create policy inv_item_docs_select on public.inventory_item_documents for select
  using (organization_id = public.current_user_organization_id() and public.can_read_inventory());
create policy inv_item_docs_insert on public.inventory_item_documents for insert
  with check (organization_id = public.current_user_organization_id() and public.can_manage_inventory());
create policy inv_item_docs_delete on public.inventory_item_documents for delete
  using (organization_id = public.current_user_organization_id() and public.can_manage_inventory());

-- Private bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('inventory-documents','inventory-documents', false, 20971520, array[
  'image/png','image/jpeg','image/jpg','image/webp','image/gif',
  'application/pdf',
  'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain','text/csv'
])
on conflict (id) do nothing;

-- Paths: {organization_id}/items/{inventory_item_id}/{file}
create policy "inventory docs read" on storage.objects for select
  using (bucket_id = 'inventory-documents'
    and (storage.foldername(name))[1] = public.current_user_organization_id()::text
    and public.can_read_inventory());
create policy "inventory docs insert" on storage.objects for insert
  with check (bucket_id = 'inventory-documents'
    and (storage.foldername(name))[1] = public.current_user_organization_id()::text
    and public.can_manage_inventory());
create policy "inventory docs delete" on storage.objects for delete
  using (bucket_id = 'inventory-documents'
    and (storage.foldername(name))[1] = public.current_user_organization_id()::text
    and public.can_manage_inventory());

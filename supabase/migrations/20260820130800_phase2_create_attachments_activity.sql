create table public.asset_attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  asset_id uuid not null references public.assets(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_type text,
  file_size bigint,
  attachment_type text,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
comment on table public.asset_attachments is 'Metadata for asset documents/photos stored in Supabase Storage. Rows cascade-delete with their asset.';
comment on column public.asset_attachments.file_path is 'Storage object path: {organization_id}/assets/{asset_id}/{filename}';
create index asset_attachments_asset_id_idx on public.asset_attachments (asset_id);
create index asset_attachments_organization_id_idx on public.asset_attachments (organization_id);
alter table public.asset_attachments enable row level security;

create table public.asset_activity (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  asset_id uuid not null references public.assets(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  action text not null,
  field_name text,
  old_value text,
  new_value text,
  created_at timestamptz not null default now()
);
comment on table public.asset_activity is 'Lightweight audit log of significant asset events.';
create index asset_activity_asset_id_idx on public.asset_activity (asset_id, created_at desc);
create index asset_activity_organization_id_idx on public.asset_activity (organization_id);
alter table public.asset_activity enable row level security;

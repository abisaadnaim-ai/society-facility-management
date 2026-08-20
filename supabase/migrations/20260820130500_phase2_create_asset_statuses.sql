create table public.asset_statuses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null,
  code text not null,
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.asset_statuses is 'Configurable asset lifecycle statuses (Operational, Under Maintenance, etc). Not an enum.';
create unique index asset_statuses_org_code_key on public.asset_statuses (organization_id, code);
create index asset_statuses_organization_id_idx on public.asset_statuses (organization_id);
create trigger set_asset_statuses_updated_at before update on public.asset_statuses for each row execute function public.set_updated_at();
alter table public.asset_statuses enable row level security;

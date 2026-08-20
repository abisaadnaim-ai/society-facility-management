create table public.assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  location_id uuid not null references public.locations(id) on delete restrict,
  area_id uuid not null references public.areas(id) on delete restrict,
  category_id uuid not null references public.asset_categories(id) on delete restrict,
  status_id uuid not null references public.asset_statuses(id) on delete restrict,
  asset_code text,
  name text not null,
  description text,
  manufacturer text,
  model text,
  serial_number text,
  purchase_date date,
  installation_date date,
  warranty_expiry date,
  supplier_name text,
  expected_life_years integer,
  notes text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.assets is 'The Asset Register. Fourth level of the facility hierarchy; references location, area, category, status.';
create unique index assets_org_code_active_key on public.assets (organization_id, lower(asset_code)) where asset_code is not null and is_active;
create index assets_organization_id_idx on public.assets (organization_id);
create index assets_location_id_idx on public.assets (location_id);
create index assets_area_id_idx on public.assets (area_id);
create index assets_category_id_idx on public.assets (category_id);
create index assets_status_id_idx on public.assets (status_id);
create trigger set_assets_updated_at before update on public.assets for each row execute function public.set_updated_at();
alter table public.assets enable row level security;

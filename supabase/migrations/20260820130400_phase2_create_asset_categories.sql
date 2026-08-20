create table public.asset_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null,
  code text,
  description text,
  parent_category_id uuid references public.asset_categories(id) on delete restrict,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.asset_categories is 'Configurable asset categories with optional parent/subcategory nesting. Not an enum.';
create unique index asset_categories_org_name_active_key on public.asset_categories (organization_id, lower(name)) where is_active;
create index asset_categories_organization_id_idx on public.asset_categories (organization_id);
create index asset_categories_parent_id_idx on public.asset_categories (parent_category_id);
create trigger set_asset_categories_updated_at before update on public.asset_categories for each row execute function public.set_updated_at();
alter table public.asset_categories enable row level security;

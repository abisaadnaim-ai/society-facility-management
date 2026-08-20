create table public.areas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  location_id uuid not null references public.locations(id) on delete restrict,
  name text not null,
  code text,
  description text,
  floor_or_level text,
  area_type text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.areas is 'Areas within a Location (e.g. Reception, Men''s Gym). Third level of the facility hierarchy.';
create unique index areas_location_name_active_key on public.areas (location_id, lower(name)) where is_active;
create index areas_organization_id_idx on public.areas (organization_id);
create index areas_location_id_idx on public.areas (location_id);
create trigger set_areas_updated_at before update on public.areas for each row execute function public.set_updated_at();
alter table public.areas enable row level security;

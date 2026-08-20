create table public.locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null,
  code text,
  location_type text,
  is_active boolean not null default true,
  is_protected boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.locations is 'Physical Society locations. Second level of the Organization -> Location -> Area -> Asset hierarchy.';
comment on column public.locations.is_protected is 'When true, the location is a core Society site and cannot be deleted; only a super_admin may rename or deactivate it.';
create unique index locations_org_code_active_key on public.locations (organization_id, code) where code is not null and is_active;
create index locations_organization_id_idx on public.locations (organization_id);
create trigger set_locations_updated_at before update on public.locations for each row execute function public.set_updated_at();
alter table public.locations enable row level security;

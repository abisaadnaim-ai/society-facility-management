create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.organizations is 'Top-level tenant. Facility Management hierarchy starts here: Organization -> Location -> Area -> Asset.';

create trigger set_organizations_updated_at
  before update on public.organizations
  for each row
  execute function public.set_updated_at();

alter table public.organizations enable row level security;

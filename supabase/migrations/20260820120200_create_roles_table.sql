create table public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  description text,
  permissions jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.roles is 'Application roles. permissions is a flexible JSONB map for future permission-based access checks.';
comment on column public.roles.code is 'Stable machine-readable identifier, e.g. super_admin, facility_manager.';

create trigger set_roles_updated_at
  before update on public.roles
  for each row
  execute function public.set_updated_at();

alter table public.roles enable row level security;

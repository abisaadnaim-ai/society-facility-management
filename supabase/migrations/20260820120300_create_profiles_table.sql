create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  full_name text,
  email text,
  role_id uuid references public.roles(id),
  avatar_url text,
  phone text,
  job_title text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'One row per auth.users user. Created automatically via trigger on signup.';

create index profiles_organization_id_idx on public.profiles (organization_id);
create index profiles_role_id_idx on public.profiles (role_id);

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

alter table public.profiles enable row level security;

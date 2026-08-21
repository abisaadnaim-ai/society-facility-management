-- ============================================================================
-- Super Admin Back Office: User Management
-- Adds primary_location_id, hardens profiles RLS (org read + column-immutable
-- self-update + last-super-admin protection), adds a user_activity audit table,
-- and SECURITY DEFINER read functions for the admin user table/detail.
-- ============================================================================

-- 1) Primary location on profiles (single-location for now; multi-location later)
alter table public.profiles
  add column if not exists primary_location_id uuid references public.locations(id) on delete set null;
create index if not exists profiles_primary_location_id_idx on public.profiles (primary_location_id);

-- 2) profiles RLS: allow active members to read profiles in their own org
--    (needed for the user table, technician/requester dropdowns, and name
--    displays). Cross-org reads stay blocked. Self-update stays, but is now
--    constrained by the trigger below so users cannot escalate themselves.
drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Read profiles in own org" on public.profiles for select to authenticated
using (organization_id = public.current_user_organization_id());

-- 3) Column-immutability + self-protection trigger on profiles updates.
create or replace function public.enforce_profile_update_rules()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  actor_role text;
  sa_role uuid;
  other_active_sa int;
begin
  select id into sa_role from public.roles where code = 'super_admin';

  if uid is not null then
    actor_role := public.current_user_role_code();
    if actor_role is distinct from 'super_admin' then
      if new.role_id is distinct from old.role_id
         or new.organization_id is distinct from old.organization_id
         or new.is_active is distinct from old.is_active
         or new.primary_location_id is distinct from old.primary_location_id
         or new.email is distinct from old.email then
        raise exception 'You are not allowed to change these account fields.' using errcode = '42501';
      end if;
    end if;
  end if;

  if new.organization_id is distinct from old.organization_id then
    raise exception 'Organization cannot be changed.' using errcode = '42501';
  end if;

  if old.role_id = sa_role and old.is_active = true
     and ((new.role_id is distinct from old.role_id) or (new.is_active = false)) then
    select count(*) into other_active_sa
    from public.profiles p
    where p.organization_id = old.organization_id
      and p.role_id = sa_role and p.is_active = true and p.id <> old.id;
    if other_active_sa = 0 then
      raise exception 'You cannot remove or deactivate the last active Super Admin.' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;
revoke execute on function public.enforce_profile_update_rules() from public, anon, authenticated;
drop trigger if exists enforce_profile_update_rules on public.profiles;
create trigger enforce_profile_update_rules before update on public.profiles
  for each row execute function public.enforce_profile_update_rules();

-- 4) Administrative audit trail for User Management actions.
create table if not exists public.user_activity (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  target_user_id uuid references public.profiles(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  field_name text,
  old_value text,
  new_value text,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index if not exists user_activity_org_idx on public.user_activity (organization_id, created_at desc);
create index if not exists user_activity_target_idx on public.user_activity (target_user_id, created_at desc);
alter table public.user_activity enable row level security;
create policy "Super admin reads user_activity in own org" on public.user_activity for select to authenticated
using (organization_id = public.current_user_organization_id() and public.current_user_role_code() = 'super_admin');

-- 5) Admin read functions (Super Admin only; include auth.users.last_sign_in_at).
create or replace function public.admin_list_users()
returns table (
  id uuid, full_name text, email text, phone text, job_title text,
  role_id uuid, role_code text, role_name text,
  primary_location_id uuid, location_name text,
  is_active boolean, created_at timestamptz, last_sign_in_at timestamptz
) language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  if public.current_user_role_code() is distinct from 'super_admin' then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;
  v_org := public.current_user_organization_id();
  return query
    select p.id, p.full_name, p.email, p.phone, p.job_title,
           p.role_id, r.code, r.name,
           p.primary_location_id, l.name,
           p.is_active, p.created_at, u.last_sign_in_at
    from public.profiles p
    left join public.roles r on r.id = p.role_id
    left join public.locations l on l.id = p.primary_location_id
    left join auth.users u on u.id = p.id
    where p.organization_id = v_org
    order by (p.full_name is null), p.full_name, p.email;
end;
$$;

create or replace function public.admin_get_user(p_id uuid)
returns table (
  id uuid, full_name text, email text, phone text, job_title text,
  role_id uuid, role_code text, role_name text,
  primary_location_id uuid, location_name text,
  is_active boolean, created_at timestamptz, last_sign_in_at timestamptz,
  fm_requests_submitted bigint, work_orders_assigned bigint
) language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  if public.current_user_role_code() is distinct from 'super_admin' then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;
  v_org := public.current_user_organization_id();
  return query
    select p.id, p.full_name, p.email, p.phone, p.job_title,
           p.role_id, r.code, r.name, p.primary_location_id, l.name,
           p.is_active, p.created_at, u.last_sign_in_at,
           (select count(*) from public.fm_requests fr where fr.requested_by = p.id),
           (select count(*) from public.work_orders wo where wo.assigned_to = p.id)
    from public.profiles p
    left join public.roles r on r.id = p.role_id
    left join public.locations l on l.id = p.primary_location_id
    left join auth.users u on u.id = p.id
    where p.id = p_id and p.organization_id = v_org;
end;
$$;

revoke execute on function public.admin_list_users() from public, anon;
revoke execute on function public.admin_get_user(uuid) from public, anon;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_get_user(uuid) to authenticated;

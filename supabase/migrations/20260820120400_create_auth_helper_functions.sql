-- SECURITY DEFINER: these run with the privileges of the function owner, which lets them
-- read public.profiles without triggering the profiles RLS policies recursively.
-- search_path is pinned to prevent search-path hijacking.

create or replace function public.current_user_organization_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select organization_id from public.profiles where id = auth.uid();
$$;

create or replace function public.current_user_role_code()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select r.code
  from public.profiles p
  join public.roles r on r.id = p.role_id
  where p.id = auth.uid();
$$;

create or replace function public.current_user_is_active()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(is_active, false) from public.profiles where id = auth.uid();
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.current_user_role_code() = 'super_admin';
$$;

comment on function public.current_user_organization_id() is 'Organization of the currently authenticated user. Use in RLS policies to scope rows by tenant.';
comment on function public.current_user_role_code() is 'Role code (e.g. super_admin) of the currently authenticated user.';
comment on function public.current_user_is_active() is 'Whether the currently authenticated user profile is active.';
comment on function public.is_super_admin() is 'True if the currently authenticated user has the super_admin role.';

-- Read-only session-introspection helpers: signed-in users may call these directly
-- (e.g. from the frontend to check their own role); anon may not.
revoke execute on function public.current_user_organization_id() from public;
revoke execute on function public.current_user_role_code() from public;
revoke execute on function public.current_user_is_active() from public;
revoke execute on function public.is_super_admin() from public;

grant execute on function public.current_user_organization_id() to authenticated;
grant execute on function public.current_user_role_code() to authenticated;
grant execute on function public.current_user_is_active() to authenticated;
grant execute on function public.is_super_admin() to authenticated;

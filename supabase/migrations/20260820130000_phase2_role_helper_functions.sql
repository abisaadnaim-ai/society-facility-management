-- Reusable authorization predicates built on the Phase 1 helpers.
create or replace function public.can_manage_facility()
returns boolean language sql security definer stable set search_path = public as $$
  select public.current_user_is_active()
     and public.current_user_role_code() in ('super_admin', 'facility_manager');
$$;

create or replace function public.can_manage_configuration()
returns boolean language sql security definer stable set search_path = public as $$
  select public.current_user_is_active()
     and public.current_user_role_code() = 'super_admin';
$$;

create or replace function public.can_read_facility()
returns boolean language sql security definer stable set search_path = public as $$
  select public.current_user_is_active();
$$;

revoke execute on function public.can_manage_facility() from public, anon;
revoke execute on function public.can_manage_configuration() from public, anon;
revoke execute on function public.can_read_facility() from public, anon;
grant execute on function public.can_manage_facility() to authenticated;
grant execute on function public.can_manage_configuration() to authenticated;
grant execute on function public.can_read_facility() to authenticated;

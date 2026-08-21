-- Concurrency-safe reference numbering. Postgres sequences are atomic, so
-- nextval() never hands the same value to two concurrent inserts. Numbers are
-- assigned by BEFORE INSERT triggers (defined with each table), never by the client.
create sequence if not exists public.fm_request_number_seq;
create sequence if not exists public.work_order_number_seq;

-- Small role predicates for readable RLS policies. All are SECURITY DEFINER and
-- build on the Phase 1 helpers; UI convenience mirrors these but is not the boundary.
create or replace function public.is_technician()
returns boolean language sql security definer stable set search_path = public as $$
  select public.current_user_is_active() and public.current_user_role_code() = 'technician';
$$;

create or replace function public.is_requester()
returns boolean language sql security definer stable set search_path = public as $$
  select public.current_user_is_active() and public.current_user_role_code() = 'requester';
$$;

-- Can this user READ every operational record in the org (FM Manager / Admin / Viewer)?
create or replace function public.can_read_all_operational()
returns boolean language sql security definer stable set search_path = public as $$
  select public.current_user_is_active()
     and public.current_user_role_code() in ('super_admin','facility_manager','viewer');
$$;

revoke execute on function public.is_technician() from public, anon;
revoke execute on function public.is_requester() from public, anon;
revoke execute on function public.can_read_all_operational() from public, anon;
grant execute on function public.is_technician() to authenticated;
grant execute on function public.is_requester() to authenticated;
grant execute on function public.can_read_all_operational() to authenticated;

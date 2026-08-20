-- Automatically creates a profile row for every new auth.users row.
-- New users are assigned to the single seeded "Society" organization and the
-- lowest-privilege "viewer" role by default. Elevating the first Super Admin
-- is a deliberate manual step (see README / bootstrap docs), never automatic.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  default_org_id uuid;
  default_role_id uuid;
begin
  select id into default_org_id from public.organizations where code = 'SOCIETY' limit 1;
  select id into default_role_id from public.roles where code = 'viewer' limit 1;

  insert into public.profiles (id, organization_id, full_name, email, role_id)
  values (
    new.id,
    default_org_id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.email,
    default_role_id
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Never callable directly via RPC -- only ever runs in trigger context.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

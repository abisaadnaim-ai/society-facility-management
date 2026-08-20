-- Even though the UPDATE policy lets a user update their own profile row, this trigger
-- stops that same user from changing their own role, organization, or active status
-- through a normal profile update. Only a super_admin (checked via the SECURITY DEFINER
-- helper, evaluated server-side and unforgeable from the client) may change them --
-- a service-role connection bypasses RLS and triggers entirely and is unaffected.
create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.role_id is distinct from old.role_id
      or new.organization_id is distinct from old.organization_id
      or new.is_active is distinct from old.is_active)
     and not public.is_super_admin() then
    raise exception 'Not permitted to change role_id, organization_id, or is_active on your own profile.'
      using errcode = '42501'; -- insufficient_privilege
  end if;
  return new;
end;
$$;

create trigger prevent_profile_privilege_escalation
  before update on public.profiles
  for each row
  execute function public.prevent_profile_privilege_escalation();

-- Never callable directly via RPC -- only ever runs in trigger context.
revoke execute on function public.prevent_profile_privilege_escalation() from public, anon, authenticated;

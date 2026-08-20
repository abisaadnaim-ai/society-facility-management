-- organizations: a user may read their own organization only.
create policy "Users can view their own organization"
  on public.organizations
  for select
  to authenticated
  using (id = public.current_user_organization_id());

-- roles: any authenticated user may read active roles (needed to display role names/badges).
-- No client-side insert/update/delete policy exists, so writes are denied by default.
create policy "Authenticated users can view active roles"
  on public.roles
  for select
  to authenticated
  using (is_active = true);

-- LOCATIONS
create policy "Read locations in own org" on public.locations for select to authenticated
  using (organization_id = public.current_user_organization_id() and public.can_read_facility());
create policy "Managers insert locations in own org" on public.locations for insert to authenticated
  with check (organization_id = public.current_user_organization_id() and public.can_manage_facility());
create policy "Managers update locations in own org" on public.locations for update to authenticated
  using (organization_id = public.current_user_organization_id() and public.can_manage_facility())
  with check (organization_id = public.current_user_organization_id() and public.can_manage_facility());

-- AREAS
create policy "Read areas in own org" on public.areas for select to authenticated
  using (organization_id = public.current_user_organization_id() and public.can_read_facility());
create policy "Managers insert areas in own org" on public.areas for insert to authenticated
  with check (organization_id = public.current_user_organization_id() and public.can_manage_facility());
create policy "Managers update areas in own org" on public.areas for update to authenticated
  using (organization_id = public.current_user_organization_id() and public.can_manage_facility())
  with check (organization_id = public.current_user_organization_id() and public.can_manage_facility());

-- ASSET CATEGORIES (config: super_admin write)
create policy "Read categories in own org" on public.asset_categories for select to authenticated
  using (organization_id = public.current_user_organization_id() and public.can_read_facility());
create policy "Admins insert categories in own org" on public.asset_categories for insert to authenticated
  with check (organization_id = public.current_user_organization_id() and public.can_manage_configuration());
create policy "Admins update categories in own org" on public.asset_categories for update to authenticated
  using (organization_id = public.current_user_organization_id() and public.can_manage_configuration())
  with check (organization_id = public.current_user_organization_id() and public.can_manage_configuration());

-- ASSET STATUSES (config: super_admin write)
create policy "Read statuses in own org" on public.asset_statuses for select to authenticated
  using (organization_id = public.current_user_organization_id() and public.can_read_facility());
create policy "Admins insert statuses in own org" on public.asset_statuses for insert to authenticated
  with check (organization_id = public.current_user_organization_id() and public.can_manage_configuration());
create policy "Admins update statuses in own org" on public.asset_statuses for update to authenticated
  using (organization_id = public.current_user_organization_id() and public.can_manage_configuration())
  with check (organization_id = public.current_user_organization_id() and public.can_manage_configuration());

-- ASSETS
create policy "Read assets in own org" on public.assets for select to authenticated
  using (organization_id = public.current_user_organization_id() and public.can_read_facility());
create policy "Managers insert assets in own org" on public.assets for insert to authenticated
  with check (organization_id = public.current_user_organization_id() and public.can_manage_facility());
create policy "Managers update assets in own org" on public.assets for update to authenticated
  using (organization_id = public.current_user_organization_id() and public.can_manage_facility())
  with check (organization_id = public.current_user_organization_id() and public.can_manage_facility());

-- ASSET ATTACHMENTS
create policy "Read attachments in own org" on public.asset_attachments for select to authenticated
  using (organization_id = public.current_user_organization_id() and public.can_read_facility());
create policy "Managers insert attachments in own org" on public.asset_attachments for insert to authenticated
  with check (organization_id = public.current_user_organization_id() and public.can_manage_facility());
create policy "Managers delete attachments in own org" on public.asset_attachments for delete to authenticated
  using (organization_id = public.current_user_organization_id() and public.can_manage_facility());

-- ASSET ACTIVITY (read-only from client; inserts via log_asset_activity)
create policy "Read asset activity in own org" on public.asset_activity for select to authenticated
  using (organization_id = public.current_user_organization_id() and public.can_read_facility());

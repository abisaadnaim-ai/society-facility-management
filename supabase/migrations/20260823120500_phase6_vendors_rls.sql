-- ============================================================================
-- PHASE 6 RLS: organization-scoped policies for all vendor / contract tables.
--   Read  = can_read_vendor()      -> super_admin, facility_manager, viewer,
--                                      technician (NOT requester)
--   Write = can_manage_facility()  -> super_admin, facility_manager
--   Categories write = can_manage_configuration() -> super_admin
--   vendor_activity is written only by SECURITY DEFINER triggers (no client write)
-- ============================================================================

create or replace function public.can_read_vendor()
returns boolean language sql security definer stable set search_path = public as $$
  select public.current_user_is_active()
     and public.current_user_role_code() in ('super_admin','facility_manager','viewer','technician');
$$;
revoke execute on function public.can_read_vendor() from public, anon;
grant execute on function public.can_read_vendor() to authenticated;

-- ---------------------------------------------------------------------------
-- Vendor service categories: read for vendor-capable roles; write super admin.
-- ---------------------------------------------------------------------------
create policy "vendor_categories_select" on public.vendor_service_categories
  for select to authenticated
  using (organization_id = public.current_user_organization_id() and public.can_read_vendor());
create policy "vendor_categories_insert" on public.vendor_service_categories
  for insert to authenticated
  with check (organization_id = public.current_user_organization_id() and public.can_manage_configuration());
create policy "vendor_categories_update" on public.vendor_service_categories
  for update to authenticated
  using (organization_id = public.current_user_organization_id() and public.can_manage_configuration())
  with check (organization_id = public.current_user_organization_id() and public.can_manage_configuration());

-- ---------------------------------------------------------------------------
-- Vendors
-- ---------------------------------------------------------------------------
create policy "vendors_select" on public.vendors
  for select to authenticated
  using (organization_id = public.current_user_organization_id() and public.can_read_vendor());
create policy "vendors_insert" on public.vendors
  for insert to authenticated
  with check (organization_id = public.current_user_organization_id() and public.can_manage_facility());
create policy "vendors_update" on public.vendors
  for update to authenticated
  using (organization_id = public.current_user_organization_id() and public.can_manage_facility())
  with check (organization_id = public.current_user_organization_id() and public.can_manage_facility());

-- ---------------------------------------------------------------------------
-- Vendor contacts
-- ---------------------------------------------------------------------------
create policy "vendor_contacts_select" on public.vendor_contacts
  for select to authenticated
  using (organization_id = public.current_user_organization_id() and public.can_read_vendor());
create policy "vendor_contacts_write" on public.vendor_contacts
  for all to authenticated
  using (organization_id = public.current_user_organization_id() and public.can_manage_facility())
  with check (organization_id = public.current_user_organization_id() and public.can_manage_facility());

-- ---------------------------------------------------------------------------
-- Vendor documents (metadata)
-- ---------------------------------------------------------------------------
create policy "vendor_documents_select" on public.vendor_documents
  for select to authenticated
  using (organization_id = public.current_user_organization_id() and public.can_read_vendor());
create policy "vendor_documents_write" on public.vendor_documents
  for all to authenticated
  using (organization_id = public.current_user_organization_id() and public.can_manage_facility())
  with check (organization_id = public.current_user_organization_id() and public.can_manage_facility());

-- ---------------------------------------------------------------------------
-- Service contracts
-- ---------------------------------------------------------------------------
create policy "service_contracts_select" on public.service_contracts
  for select to authenticated
  using (organization_id = public.current_user_organization_id() and public.can_read_vendor());
create policy "service_contracts_write" on public.service_contracts
  for all to authenticated
  using (organization_id = public.current_user_organization_id() and public.can_manage_facility())
  with check (organization_id = public.current_user_organization_id() and public.can_manage_facility());

-- ---------------------------------------------------------------------------
-- Service contract documents (metadata)
-- ---------------------------------------------------------------------------
create policy "service_contract_documents_select" on public.service_contract_documents
  for select to authenticated
  using (organization_id = public.current_user_organization_id() and public.can_read_vendor());
create policy "service_contract_documents_write" on public.service_contract_documents
  for all to authenticated
  using (organization_id = public.current_user_organization_id() and public.can_manage_facility())
  with check (organization_id = public.current_user_organization_id() and public.can_manage_facility());

-- ---------------------------------------------------------------------------
-- Mapping tables (vendor/contract <-> location/asset)
-- ---------------------------------------------------------------------------
create policy "vendor_locations_select" on public.vendor_locations
  for select to authenticated
  using (organization_id = public.current_user_organization_id() and public.can_read_vendor());
create policy "vendor_locations_write" on public.vendor_locations
  for all to authenticated
  using (organization_id = public.current_user_organization_id() and public.can_manage_facility())
  with check (organization_id = public.current_user_organization_id() and public.can_manage_facility());

create policy "service_contract_locations_select" on public.service_contract_locations
  for select to authenticated
  using (organization_id = public.current_user_organization_id() and public.can_read_vendor());
create policy "service_contract_locations_write" on public.service_contract_locations
  for all to authenticated
  using (organization_id = public.current_user_organization_id() and public.can_manage_facility())
  with check (organization_id = public.current_user_organization_id() and public.can_manage_facility());

create policy "vendor_assets_select" on public.vendor_assets
  for select to authenticated
  using (organization_id = public.current_user_organization_id() and public.can_read_vendor());
create policy "vendor_assets_write" on public.vendor_assets
  for all to authenticated
  using (organization_id = public.current_user_organization_id() and public.can_manage_facility())
  with check (organization_id = public.current_user_organization_id() and public.can_manage_facility());

create policy "service_contract_assets_select" on public.service_contract_assets
  for select to authenticated
  using (organization_id = public.current_user_organization_id() and public.can_read_vendor());
create policy "service_contract_assets_write" on public.service_contract_assets
  for all to authenticated
  using (organization_id = public.current_user_organization_id() and public.can_manage_facility())
  with check (organization_id = public.current_user_organization_id() and public.can_manage_facility());

-- ---------------------------------------------------------------------------
-- Vendor activity: managers may read the audit trail. No client write policy
-- exists, so only the SECURITY DEFINER logger can insert (cannot be forged).
-- ---------------------------------------------------------------------------
create policy "vendor_activity_select" on public.vendor_activity
  for select to authenticated
  using (organization_id = public.current_user_organization_id() and public.can_manage_facility());

-- ---------------------------------------------------------------------------
-- Work Order vendor notes: readable by anyone who can read the work order
-- except requesters; writable by whoever can write the work order.
-- ---------------------------------------------------------------------------
create policy "wo_vendor_notes_select" on public.work_order_vendor_notes
  for select to authenticated
  using (
    organization_id = public.current_user_organization_id()
    and not public.is_requester()
    and public.can_read_work_order(work_order_id)
  );
create policy "wo_vendor_notes_insert" on public.work_order_vendor_notes
  for insert to authenticated
  with check (
    organization_id = public.current_user_organization_id()
    and public.can_write_work_order(work_order_id)
  );

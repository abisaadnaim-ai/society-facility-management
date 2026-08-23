-- =====================================================================
-- Phase 7: Inventory RLS
-- Read: super_admin, facility_manager, technician, viewer (NOT requester)
-- Item/location/asset-link writes: super_admin + facility_manager
-- Category/unit config: super_admin only
-- Balances/movements: NO direct writes (only SECURITY DEFINER RPCs)
-- Activity: read for managers only; never client-writable
-- =====================================================================

create or replace function public.can_read_inventory()
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_user_is_active()
     and public.current_user_role_code() in ('super_admin','facility_manager','technician','viewer');
$$;

-- ---- categories (config: super_admin manages) ----
create policy inv_categories_select on public.inventory_categories for select
  using (organization_id = public.current_user_organization_id() and public.can_read_inventory());
create policy inv_categories_insert on public.inventory_categories for insert
  with check (organization_id = public.current_user_organization_id() and public.can_manage_configuration());
create policy inv_categories_update on public.inventory_categories for update
  using (organization_id = public.current_user_organization_id() and public.can_manage_configuration())
  with check (organization_id = public.current_user_organization_id() and public.can_manage_configuration());

-- ---- units of measure (config: super_admin manages) ----
create policy uom_select on public.units_of_measure for select
  using (organization_id = public.current_user_organization_id() and public.can_read_inventory());
create policy uom_insert on public.units_of_measure for insert
  with check (organization_id = public.current_user_organization_id() and public.can_manage_configuration());
create policy uom_update on public.units_of_measure for update
  using (organization_id = public.current_user_organization_id() and public.can_manage_configuration())
  with check (organization_id = public.current_user_organization_id() and public.can_manage_configuration());

-- ---- stock locations (FM + super_admin manage) ----
create policy stock_locations_select on public.stock_locations for select
  using (organization_id = public.current_user_organization_id() and public.can_read_inventory());
create policy stock_locations_insert on public.stock_locations for insert
  with check (organization_id = public.current_user_organization_id() and public.can_manage_inventory());
create policy stock_locations_update on public.stock_locations for update
  using (organization_id = public.current_user_organization_id() and public.can_manage_inventory())
  with check (organization_id = public.current_user_organization_id() and public.can_manage_inventory());

-- ---- inventory items (FM + super_admin manage; no delete) ----
create policy inventory_items_select on public.inventory_items for select
  using (organization_id = public.current_user_organization_id() and public.can_read_inventory());
create policy inventory_items_insert on public.inventory_items for insert
  with check (organization_id = public.current_user_organization_id() and public.can_manage_inventory());
create policy inventory_items_update on public.inventory_items for update
  using (organization_id = public.current_user_organization_id() and public.can_manage_inventory())
  with check (organization_id = public.current_user_organization_id() and public.can_manage_inventory());

-- ---- balances (read only; writes exclusively via RPC/definer) ----
create policy inventory_balances_select on public.inventory_balances for select
  using (organization_id = public.current_user_organization_id() and public.can_read_inventory());

-- ---- movements (read only; writes exclusively via RPC/definer) ----
create policy inventory_movements_select on public.inventory_movements for select
  using (organization_id = public.current_user_organization_id() and public.can_read_inventory());

-- ---- asset <-> spare part links (FM + super_admin manage) ----
create policy asset_spare_parts_select on public.asset_spare_parts for select
  using (organization_id = public.current_user_organization_id() and public.can_read_inventory());
create policy asset_spare_parts_insert on public.asset_spare_parts for insert
  with check (organization_id = public.current_user_organization_id() and public.can_manage_inventory());
create policy asset_spare_parts_update on public.asset_spare_parts for update
  using (organization_id = public.current_user_organization_id() and public.can_manage_inventory())
  with check (organization_id = public.current_user_organization_id() and public.can_manage_inventory());
create policy asset_spare_parts_delete on public.asset_spare_parts for delete
  using (organization_id = public.current_user_organization_id() and public.can_manage_inventory());

-- ---- audit (managers read; never client-writable) ----
create policy inventory_activity_select on public.inventory_activity for select
  using (organization_id = public.current_user_organization_id() and public.can_manage_inventory());

-- =====================================================================
-- Phase 7: Inventory ENGINE — transactional stock RPCs + audit triggers
-- =====================================================================

create or replace function public.can_manage_inventory()
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_user_is_active()
     and public.current_user_role_code() in ('super_admin','facility_manager');
$$;

-- ---------------------------------------------------------------------
-- Internal validators
-- ---------------------------------------------------------------------
create or replace function public._inv_validate_item(p_org uuid, p_item uuid, p_require_active boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_active boolean;
begin
  select is_active into v_active from public.inventory_items where id = p_item and organization_id = p_org;
  if not found then raise exception 'Inventory item not found.'; end if;
  if p_require_active and not v_active then
    raise exception 'This item is inactive and cannot be used for new stock transactions.';
  end if;
end $$;

create or replace function public._inv_validate_location(p_org uuid, p_location uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_active boolean;
begin
  select is_active into v_active from public.stock_locations where id = p_location and organization_id = p_org;
  if not found then raise exception 'Stock location not found.'; end if;
  if not v_active then raise exception 'Stock location is inactive.'; end if;
end $$;

-- ---------------------------------------------------------------------
-- Core: apply one movement + balance change atomically, row-locked.
-- Enforces non-negative stock. Returns the movement id.
-- ---------------------------------------------------------------------
create or replace function public._inv_apply_movement(
  p_org uuid, p_item uuid, p_location uuid, p_type text, p_qty numeric,
  p_wo uuid, p_tech uuid, p_transfer_group uuid,
  p_reference text, p_reason text, p_notes text, p_actor uuid
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_delta numeric; v_onhand numeric; v_new numeric; v_move uuid;
begin
  if p_qty is null or p_qty <= 0 then raise exception 'Quantity must be greater than zero.'; end if;
  v_delta := case p_type
    when 'issue' then -p_qty
    when 'adjustment_decrease' then -p_qty
    when 'transfer_out' then -p_qty
    else p_qty end;

  -- lock the balance row (create a zero row first if absent), serialising concurrent writers
  select quantity_on_hand into v_onhand
    from public.inventory_balances
    where inventory_item_id = p_item and stock_location_id = p_location
    for update;
  if not found then
    insert into public.inventory_balances (organization_id, inventory_item_id, stock_location_id, quantity_on_hand)
      values (p_org, p_item, p_location, 0)
      on conflict (inventory_item_id, stock_location_id) do nothing;
    select quantity_on_hand into v_onhand
      from public.inventory_balances
      where inventory_item_id = p_item and stock_location_id = p_location
      for update;
  end if;

  v_new := v_onhand + v_delta;
  if v_new < 0 then raise exception 'Insufficient stock available.'; end if;

  insert into public.inventory_movements
    (organization_id, inventory_item_id, stock_location_id, movement_type, quantity,
     work_order_id, technician_id, transfer_group_id, reference, reason, notes, created_by)
    values (p_org, p_item, p_location, p_type, p_qty, p_wo, p_tech, p_transfer_group,
            p_reference, p_reason, p_notes, p_actor)
    returning id into v_move;

  update public.inventory_balances set quantity_on_hand = v_new, updated_at = now()
    where inventory_item_id = p_item and stock_location_id = p_location;
  return v_move;
end $$;

-- ---------------------------------------------------------------------
-- Public RPCs (the only sanctioned way to change stock)
-- ---------------------------------------------------------------------
create or replace function public.inv_set_opening_balance(
  p_item uuid, p_location uuid, p_qty numeric, p_reference text default null, p_notes text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  if not public.can_manage_inventory() then raise exception 'Not authorized to manage inventory.'; end if;
  v_org := public.current_user_organization_id();
  perform public._inv_validate_item(v_org, p_item, true);
  perform public._inv_validate_location(v_org, p_location);
  return public._inv_apply_movement(v_org, p_item, p_location, 'opening_balance', p_qty,
    null, null, null, p_reference, null, p_notes, auth.uid());
end $$;

create or replace function public.inv_stock_in(
  p_item uuid, p_location uuid, p_qty numeric, p_reference text default null, p_notes text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  if not public.can_manage_inventory() then raise exception 'Not authorized to manage inventory.'; end if;
  v_org := public.current_user_organization_id();
  perform public._inv_validate_item(v_org, p_item, true);
  perform public._inv_validate_location(v_org, p_location);
  return public._inv_apply_movement(v_org, p_item, p_location, 'stock_in', p_qty,
    null, null, null, p_reference, null, p_notes, auth.uid());
end $$;

create or replace function public.inv_issue_part(
  p_item uuid, p_location uuid, p_qty numeric, p_work_order uuid,
  p_technician uuid default null, p_notes text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_assigned uuid; v_uid uuid;
begin
  v_org := public.current_user_organization_id();
  v_uid := auth.uid();
  if p_work_order is null then raise exception 'A work order is required to issue parts.'; end if;
  select assigned_to into v_assigned from public.work_orders where id = p_work_order and organization_id = v_org;
  if not found then raise exception 'Work order not found.'; end if;
  if not (public.can_manage_inventory() or (public.is_technician() and v_assigned = v_uid)) then
    raise exception 'Not authorized to issue parts for this work order.';
  end if;
  perform public._inv_validate_item(v_org, p_item, true);
  perform public._inv_validate_location(v_org, p_location);
  return public._inv_apply_movement(v_org, p_item, p_location, 'issue', p_qty,
    p_work_order, p_technician, null, null, null, p_notes, v_uid);
end $$;

create or replace function public.inv_return_part(
  p_item uuid, p_location uuid, p_qty numeric, p_work_order uuid, p_notes text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_assigned uuid; v_uid uuid; v_net numeric;
begin
  v_org := public.current_user_organization_id();
  v_uid := auth.uid();
  if p_work_order is null then raise exception 'A work order is required to return parts.'; end if;
  select assigned_to into v_assigned from public.work_orders where id = p_work_order and organization_id = v_org;
  if not found then raise exception 'Work order not found.'; end if;
  if not (public.can_manage_inventory() or (public.is_technician() and v_assigned = v_uid)) then
    raise exception 'Not authorized to return parts for this work order.';
  end if;
  select coalesce(sum(case when movement_type='issue' then quantity
                           when movement_type='return' then -quantity else 0 end), 0)
    into v_net
    from public.inventory_movements
    where work_order_id = p_work_order and inventory_item_id = p_item and organization_id = v_org;
  if p_qty > v_net then
    raise exception 'Cannot return more than the net issued quantity (% available).', v_net;
  end if;
  perform public._inv_validate_location(v_org, p_location);
  return public._inv_apply_movement(v_org, p_item, p_location, 'return', p_qty,
    p_work_order, null, null, null, null, p_notes, v_uid);
end $$;

create or replace function public.inv_adjust(
  p_item uuid, p_location uuid, p_direction text, p_qty numeric, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_type text;
begin
  if not public.can_manage_inventory() then raise exception 'Not authorized to adjust inventory.'; end if;
  if p_reason is null or btrim(p_reason) = '' then raise exception 'A reason is required for stock adjustments.'; end if;
  if p_direction = 'increase' then v_type := 'adjustment_increase';
  elsif p_direction = 'decrease' then v_type := 'adjustment_decrease';
  else raise exception 'Invalid adjustment direction.'; end if;
  v_org := public.current_user_organization_id();
  perform public._inv_validate_item(v_org, p_item, true);
  perform public._inv_validate_location(v_org, p_location);
  return public._inv_apply_movement(v_org, p_item, p_location, v_type, p_qty,
    null, null, null, null, p_reason, null, auth.uid());
end $$;

create or replace function public.inv_transfer(
  p_item uuid, p_source uuid, p_dest uuid, p_qty numeric, p_notes text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_group uuid; v_uid uuid;
begin
  if not public.can_manage_inventory() then raise exception 'Not authorized to transfer inventory.'; end if;
  if p_source = p_dest then raise exception 'Source and destination stock locations must differ.'; end if;
  v_org := public.current_user_organization_id();
  v_uid := auth.uid();
  perform public._inv_validate_item(v_org, p_item, true);
  perform public._inv_validate_location(v_org, p_source);
  perform public._inv_validate_location(v_org, p_dest);
  v_group := gen_random_uuid();
  -- both legs in one transaction => atomic; out first so insufficient stock aborts the whole transfer
  perform public._inv_apply_movement(v_org, p_item, p_source, 'transfer_out', p_qty,
    null, null, v_group, null, null, p_notes, v_uid);
  perform public._inv_apply_movement(v_org, p_item, p_dest, 'transfer_in', p_qty,
    null, null, v_group, null, null, p_notes, v_uid);
  return v_group;
end $$;

-- ---------------------------------------------------------------------
-- Audit triggers (immutable; actor captured server-side)
-- ---------------------------------------------------------------------
create or replace function public.inv_current_actor_id()
returns uuid language sql stable set search_path = public as $$
  select nullif(current_setting('request.jwt.claims', true)::json->>'sub','')::uuid;
$$;

create or replace function public.trg_inventory_movement_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.inventory_activity
    (organization_id, inventory_item_id, stock_location_id, movement_id, action, detail, actor_id)
  values (new.organization_id, new.inventory_item_id, new.stock_location_id, new.id, new.movement_type,
    new.movement_number || ' qty ' || new.quantity ||
      coalesce(' · WO ' || (select work_order_number from public.work_orders where id = new.work_order_id), ''),
    new.created_by);
  return new;
end $$;
create trigger trg_inv_movement_activity after insert on public.inventory_movements
  for each row execute function public.trg_inventory_movement_activity();

create or replace function public.trg_inventory_item_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.inventory_activity (organization_id, inventory_item_id, action, detail, actor_id)
    values (new.organization_id, new.id, 'item_created', new.item_code || ' · ' || new.name, new.created_by);
  elsif TG_OP = 'UPDATE' then
    if new.is_active is distinct from old.is_active then
      insert into public.inventory_activity (organization_id, inventory_item_id, action, detail, actor_id)
      values (new.organization_id, new.id,
        case when new.is_active then 'item_reactivated' else 'item_deactivated' end,
        new.item_code, public.inv_current_actor_id());
    end if;
    if new.minimum_stock_level is distinct from old.minimum_stock_level then
      insert into public.inventory_activity (organization_id, inventory_item_id, action, detail, actor_id)
      values (new.organization_id, new.id, 'min_level_changed',
        'min ' || coalesce(old.minimum_stock_level::text,'—') || ' -> ' || coalesce(new.minimum_stock_level::text,'—'),
        public.inv_current_actor_id());
    end if;
    if (new.name, coalesce(new.description,''), coalesce(new.part_number,''), coalesce(new.manufacturer,''), new.category_id, new.unit_of_measure_id)
       is distinct from
       (old.name, coalesce(old.description,''), coalesce(old.part_number,''), coalesce(old.manufacturer,''), old.category_id, old.unit_of_measure_id) then
      insert into public.inventory_activity (organization_id, inventory_item_id, action, detail, actor_id)
      values (new.organization_id, new.id, 'item_updated', new.item_code, public.inv_current_actor_id());
    end if;
  end if;
  return new;
end $$;
create trigger trg_inv_item_activity after insert or update on public.inventory_items
  for each row execute function public.trg_inventory_item_activity();

create or replace function public.trg_asset_spare_part_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.inventory_activity (organization_id, inventory_item_id, action, detail, actor_id)
  values (new.organization_id, new.inventory_item_id, 'asset_link_added',
    (select asset_code from public.assets where id = new.asset_id), new.created_by);
  return new;
end $$;
create trigger trg_asset_spare_part_activity after insert on public.asset_spare_parts
  for each row execute function public.trg_asset_spare_part_activity();

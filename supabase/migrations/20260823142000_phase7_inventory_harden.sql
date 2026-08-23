-- =====================================================================
-- Phase 7: Harden — lock down internal/trigger functions.
-- Clients may only call the inv_* RPCs; RLS helpers remain callable.
-- =====================================================================
do $$
declare fn text;
begin
  foreach fn in array array[
    'public.set_inventory_item_number()',
    'public.set_inventory_movement_number()',
    'public.phase7_assert_stock_location_org()',
    'public._inv_validate_item(uuid,uuid,boolean)',
    'public._inv_validate_location(uuid,uuid)',
    'public._inv_apply_movement(uuid,uuid,uuid,text,numeric,uuid,uuid,uuid,text,text,text,uuid)',
    'public.inv_current_actor_id()',
    'public.trg_inventory_movement_activity()',
    'public.trg_inventory_item_activity()',
    'public.trg_asset_spare_part_activity()'
  ]
  loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
  end loop;
end $$;

-- Ensure the sanctioned RPCs + RLS helpers are callable by authenticated users
grant execute on function
  public.inv_set_opening_balance(uuid,uuid,numeric,text,text),
  public.inv_stock_in(uuid,uuid,numeric,text,text),
  public.inv_issue_part(uuid,uuid,numeric,uuid,uuid,text),
  public.inv_return_part(uuid,uuid,numeric,uuid,text),
  public.inv_adjust(uuid,uuid,text,numeric,text),
  public.inv_transfer(uuid,uuid,uuid,numeric,text),
  public.can_read_inventory(),
  public.can_manage_inventory()
to authenticated;

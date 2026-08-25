-- Phase 10 hardening: inventory mutation RPCs must not be callable by unauthenticated (anon) or PUBLIC.
-- These are SECURITY DEFINER action endpoints (each already enforces can_manage_inventory internally);
-- removing anon/PUBLIC EXECUTE is defense-in-depth and clears the anon security-advisor findings.
-- Predicate helpers can_read_inventory()/can_manage_inventory() are intentionally left executable as they
-- are evaluated inside RLS policies and only return the caller's own role.

revoke execute on function public.inv_adjust(uuid, uuid, text, numeric, text) from anon, public;
revoke execute on function public.inv_issue_part(uuid, uuid, numeric, uuid, uuid, text) from anon, public;
revoke execute on function public.inv_return_part(uuid, uuid, numeric, uuid, text) from anon, public;
revoke execute on function public.inv_set_opening_balance(uuid, uuid, numeric, text, text) from anon, public;
revoke execute on function public.inv_stock_in(uuid, uuid, numeric, text, text) from anon, public;
revoke execute on function public.inv_transfer(uuid, uuid, uuid, numeric, text) from anon, public;

-- Guarantee authenticated retains EXECUTE (explicit grant, independent of PUBLIC).
grant execute on function public.inv_adjust(uuid, uuid, text, numeric, text) to authenticated;
grant execute on function public.inv_issue_part(uuid, uuid, numeric, uuid, uuid, text) to authenticated;
grant execute on function public.inv_return_part(uuid, uuid, numeric, uuid, text) to authenticated;
grant execute on function public.inv_set_opening_balance(uuid, uuid, numeric, text, text) to authenticated;
grant execute on function public.inv_stock_in(uuid, uuid, numeric, text, text) to authenticated;
grant execute on function public.inv_transfer(uuid, uuid, uuid, numeric, text) to authenticated;

-- Phase 3 bug fix: break mutual RLS recursion between the fm_requests and
-- work_orders SELECT policies. Each policy previously inlined an EXISTS against
-- the other RLS-protected table, so evaluating either read caused Postgres to
-- recurse infinitely ("infinite recursion detected in policy for relation
-- fm_requests"). This blocked the .insert().select() read-back in createFmRequest,
-- so no FM request could be created (the insert passed its WITH CHECK, then the
-- returning-row SELECT recursed and rolled the whole statement back).
--
-- Fix: delegate the entire read decision to the existing SECURITY DEFINER helpers
-- can_read_fm_request(uuid) / can_read_work_order(uuid). Because these functions
-- run as the owner and the tables are not FORCE ROW LEVEL SECURITY, their internal
-- cross-table lookups bypass RLS and cannot recurse. The visibility rules are
-- unchanged -- they are exactly what these helpers already encapsulate.

drop policy "Read fm_requests" on public.fm_requests;
create policy "Read fm_requests" on public.fm_requests for select to authenticated
using ( public.can_read_fm_request(id) );

drop policy "Read work_orders" on public.work_orders;
create policy "Read work_orders" on public.work_orders for select to authenticated
using ( public.can_read_work_order(id) );

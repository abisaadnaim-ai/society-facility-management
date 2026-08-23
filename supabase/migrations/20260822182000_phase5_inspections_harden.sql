-- ============================================================================
-- PHASE 5: hardening -- ensure trigger-only functions are not RPC-callable.
-- (search_path is already pinned to public on every Phase 5 function at creation.)
-- ============================================================================
revoke execute on function public.assign_inspection_template_number() from public, anon, authenticated;
revoke execute on function public.assign_inspection_schedule_number() from public, anon, authenticated;
revoke execute on function public.assign_inspection_number() from public, anon, authenticated;
revoke execute on function public.enforce_inspection_hierarchy() from public, anon, authenticated;
revoke execute on function public.set_fm_request_source() from public, anon, authenticated;
revoke execute on function public.set_work_order_source() from public, anon, authenticated;
revoke execute on function public.inspection_after_schedule_insert() from public, anon, authenticated;
revoke execute on function public.inspection_response_before_write() from public, anon, authenticated;

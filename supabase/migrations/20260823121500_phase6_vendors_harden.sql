-- ============================================================================
-- PHASE 6 HARDENING: the numbering, integrity, and audit-logging functions run
-- only from triggers (SECURITY DEFINER). Revoke direct EXECUTE from all client
-- roles so they cannot be called ad hoc. All functions already pin
-- search_path = public (advisor-clean). can_read_vendor() intentionally remains
-- granted to authenticated for use inside RLS policies.
-- ============================================================================
do $$
declare fn text;
begin
  foreach fn in array array[
    'public.set_vendor_number()',
    'public.set_service_contract_number()',
    'public.phase6_assert_location_org()',
    'public.phase6_assert_asset_org()',
    'public.phase6_wo_vendor_check()',
    'public.log_vendor_activity(uuid, uuid, uuid, text, text)',
    'public.trg_vendor_activity()',
    'public.trg_vendor_contact_activity()',
    'public.trg_vendor_document_activity()',
    'public.trg_contract_activity()',
    'public.trg_vendor_asset_activity()',
    'public.trg_vendor_location_activity()'
  ]
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', fn);
  end loop;
end $$;

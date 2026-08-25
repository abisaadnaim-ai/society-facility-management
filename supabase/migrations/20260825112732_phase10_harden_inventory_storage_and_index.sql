-- Phase 10 hardening (part 2):
-- (a) Scope the inventory-documents storage policies to `authenticated` (they were TO public).
--     The USING/WITH CHECK already require org membership + inventory role, so anon was effectively
--     denied; this aligns them with the other 15 storage policies and removes public-role evaluation.
alter policy "inventory docs read"   on storage.objects to authenticated;
alter policy "inventory docs insert" on storage.objects to authenticated;
alter policy "inventory docs delete" on storage.objects to authenticated;

-- (b) Add the missing index on inspection_findings.work_order_id (used to resolve a finding when its
--     corrective work order is closed). Partial index: most findings have a null work_order_id.
create index if not exists inspection_findings_work_order_id_idx
  on public.inspection_findings(work_order_id)
  where work_order_id is not null;

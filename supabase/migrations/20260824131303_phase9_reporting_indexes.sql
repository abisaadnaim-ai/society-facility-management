-- Phase 9 reporting: targeted indexes only where existing coverage is absent
-- and a documented reporting query pattern needs them (spec §35).
-- Existing phases already cover: WO/FM created_at, status_id, location_id, assigned_to,
-- source, vendor_id, asset_id; occurrences scheduled_date/status; contracts end_date/status.

-- Resolution-time & "closed in period" scans filter WOs by closed_at (partial: only closed rows).
create index if not exists work_orders_closed_at_idx
  on public.work_orders (organization_id, closed_at)
  where closed_at is not null;

-- Parts-usage report groups movements by type within org+period.
create index if not exists inventory_movements_type_idx
  on public.inventory_movements (organization_id, movement_type);

-- Inspection reporting breaks down by template.
create index if not exists inspection_occurrences_template_idx
  on public.inspection_occurrences (template_id);

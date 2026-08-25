-- ============================================================================
-- Phase 9 — Management Dashboard overview + Needs Attention
-- SECURITY INVOKER: inherits existing RLS (org isolation + per-role visibility).
-- All timestamps stored UTC; "today" computed in Asia/Qatar for date-column compares.
-- Dashboard cards are CURRENT-STATE (right now), honoring location/priority/category
-- filters; the Reports modules apply full date-range filtering.
-- ============================================================================

create or replace function public.report_dashboard_overview(
  p_location uuid default null,
  p_priority uuid default null,
  p_category uuid default null
) returns jsonb
language plpgsql
stable
security invoker
set search_path to 'public'
as $$
declare
  l_today date := (now() at time zone 'Asia/Qatar')::date;
  j jsonb;
begin
  with wo as (
    select w.id, w.status_id, w.priority_id, w.assigned_to, w.due_date,
           w.resolution_sla_status, s.code as status_code, pr.code as priority_code
    from public.work_orders w
    join public.work_order_statuses s on s.id = w.status_id
    left join public.fm_priorities pr on pr.id = w.priority_id
    where (p_location is null or w.location_id = p_location)
      and (p_priority is null or w.priority_id = p_priority)
      and (p_category is null or w.category_id = p_category)
  ),
  fm as (
    select f.id, f.status_id, f.response_sla_status, s.code as status_code, pr.code as priority_code
    from public.fm_requests f
    join public.fm_request_statuses s on s.id = f.status_id
    left join public.fm_priorities pr on pr.id = f.priority_id
    where (p_location is null or f.location_id = p_location)
      and (p_priority is null or f.priority_id = p_priority)
      and (p_category is null or f.category_id = p_category)
  ),
  esc as (
    select e.id
    from public.fm_escalations e
    where e.resolved_at is null
  ),
  ppm as (
    select o.id, o.status, o.due_date
    from public.ppm_occurrences o
    join public.ppm_plans pl on pl.id = o.ppm_plan_id
    left join public.assets a on a.id = pl.asset_id
    where (p_location is null or a.location_id = p_location)
  ),
  insp as (
    select o.id, o.status, o.overall_result, o.scheduled_date, o.closed_at
    from public.inspection_occurrences o
    where (p_location is null or o.location_id = p_location)
  ),
  finding as (
    select fd.id, fd.status
    from public.inspection_findings fd
    where (p_location is null or fd.location_id = p_location)
      and (p_priority is null or fd.priority_id = p_priority)
      and (p_category is null or fd.category_id = p_category)
  ),
  contracts as (
    select c.id, c.status, c.end_date
    from public.service_contracts c
  ),
  inv as (
    select i.id, i.minimum_stock_level,
           coalesce(sum(b.quantity_on_hand), 0) as on_hand
    from public.inventory_items i
    left join public.inventory_balances b on b.inventory_item_id = i.id
    left join public.stock_locations sl on sl.id = b.stock_location_id
    where i.is_active
      and (p_location is null or sl.location_id = p_location or b.stock_location_id is null)
    group by i.id, i.minimum_stock_level
  )
  select jsonb_build_object(
    'as_of', now(),
    'today_qatar', l_today,
    'current_ops', jsonb_build_object(
      'open_fm_requests', (select count(*) from fm where status_code in ('new','under_review','work_order_created')),
      'open_work_orders', (select count(*) from wo where status_code not in ('closed','cancelled')),
      'critical_open',
        (select count(*) from wo where status_code not in ('closed','cancelled') and priority_code='critical')
        + (select count(*) from fm where status_code in ('new','under_review') and priority_code='critical'),
      'sla_breached',
        (select count(*) from wo where status_code not in ('closed','cancelled') and resolution_sla_status='breached')
        + (select count(*) from fm where status_code in ('new','under_review') and response_sla_status='breached'),
      'overdue_work_orders', (select count(*) from wo where status_code not in ('closed','cancelled') and due_date is not null and due_date < l_today),
      'awaiting_verification', (select count(*) from wo where status_code='completed'),
      'unassigned_work_orders', (select count(*) from wo where status_code not in ('closed','cancelled') and assigned_to is null),
      'open_escalations', (select count(*) from esc)
    ),
    'preventive', jsonb_build_object(
      'ppm_due_today', (select count(*) from ppm where status in ('upcoming','due') and due_date = l_today),
      'ppm_due_7d', (select count(*) from ppm where status in ('upcoming','due') and due_date >= l_today and due_date <= l_today + 7),
      'ppm_overdue', (select count(*) from ppm where status in ('upcoming','due') and due_date < l_today),
      'ppm_open_wo', (select count(*) from ppm where status = 'work_order_created')
    ),
    'inspections', jsonb_build_object(
      'due_today', (select count(*) from insp where status in ('scheduled','due') and scheduled_date = l_today),
      'overdue', (select count(*) from insp where status in ('scheduled','due') and scheduled_date < l_today),
      'failed_open', (select count(*) from insp where overall_result='fail' and closed_at is null),
      'open_findings', (select count(*) from finding where status in ('open','action_required'))
    ),
    'vendors', jsonb_build_object(
      'wo_waiting_vendor', (select count(*) from wo where status_code='waiting_vendor'),
      'contracts_expiring_90d', (select count(*) from contracts where status='active' and end_date >= l_today and end_date <= l_today + 90),
      'contracts_expired', (select count(*) from contracts where status='active' and end_date < l_today)
    ),
    'inventory', jsonb_build_object(
      'low_stock', (select count(*) from inv where minimum_stock_level is not null and on_hand > 0 and on_hand <= minimum_stock_level),
      'out_of_stock', (select count(*) from inv where on_hand <= 0)
    )
  ) into j;

  return j;
end;
$$;

comment on function public.report_dashboard_overview(uuid,uuid,uuid) is
'Phase 9 management overview KPIs (current-state). SECURITY INVOKER -> RLS-scoped. '
'Open FM = status new/under_review/work_order_created; Open WO = not closed/cancelled; '
'Critical/SLA-breached counted on open WOs + pre-conversion FM requests; overdue = manual due_date < Qatar-today.';

revoke all on function public.report_dashboard_overview(uuid,uuid,uuid) from public;
grant execute on function public.report_dashboard_overview(uuid,uuid,uuid) to authenticated;

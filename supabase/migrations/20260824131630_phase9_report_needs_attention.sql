create or replace function public.report_needs_attention(
  p_location uuid default null,
  p_priority uuid default null,
  p_category uuid default null,
  p_limit int default 60
) returns table(
  rank int, category text, entity_type text, entity_id uuid, ref text, title text,
  detail text, priority_code text, occurred_at timestamptz, link text
)
language sql stable security invoker
set search_path to 'public'
as $$
  with l_today as (select (now() at time zone 'Asia/Qatar')::date d),
  rows(rank, category, entity_type, entity_id, ref, title, detail, priority_code, occurred_at, link) as (
    select 1, 'Critical issue', 'work_order', w.id, w.work_order_number, w.title,
           'Critical priority, open', pr.code, w.created_at, '/work-orders/'||w.id
    from work_orders w
    join work_order_statuses s on s.id=w.status_id
    join fm_priorities pr on pr.id=w.priority_id and pr.code='critical'
    where s.code not in ('closed','cancelled')
      and (p_location is null or w.location_id=p_location)
      and (p_category is null or w.category_id=p_category)
    union all
    select 1, 'Critical issue', 'fm_request', f.id, f.request_number, f.title,
           'Critical priority, awaiting action', pr.code, f.created_at, '/fm-requests/'||f.id
    from fm_requests f
    join fm_request_statuses s on s.id=f.status_id
    join fm_priorities pr on pr.id=f.priority_id and pr.code='critical'
    where s.code in ('new','under_review')
      and (p_location is null or f.location_id=p_location)
      and (p_category is null or f.category_id=p_category)
    union all
    select 2, 'SLA breach', 'work_order', w.id, w.work_order_number, w.title,
           'Resolution SLA breached', pr.code, coalesce(w.breached_at, w.created_at), '/work-orders/'||w.id
    from work_orders w
    join work_order_statuses s on s.id=w.status_id
    left join fm_priorities pr on pr.id=w.priority_id
    where s.code not in ('closed','cancelled') and w.resolution_sla_status='breached'
      and (p_location is null or w.location_id=p_location)
      and (p_priority is null or w.priority_id=p_priority)
      and (p_category is null or w.category_id=p_category)
    union all
    select 2, 'SLA breach', 'fm_request', f.id, f.request_number, f.title,
           'Response SLA breached', pr.code, f.created_at, '/fm-requests/'||f.id
    from fm_requests f
    join fm_request_statuses s on s.id=f.status_id
    left join fm_priorities pr on pr.id=f.priority_id
    where s.code in ('new','under_review') and f.response_sla_status='breached'
      and (p_location is null or f.location_id=p_location)
      and (p_priority is null or f.priority_id=p_priority)
      and (p_category is null or f.category_id=p_category)
    union all
    select 3, 'Escalated', e.entity_type, e.entity_id,
           case when e.entity_type='work_order' then (select work_order_number from work_orders where id=e.entity_id)
                else (select request_number from fm_requests where id=e.entity_id) end,
           case when e.entity_type='work_order' then (select title from work_orders where id=e.entity_id)
                else (select title from fm_requests where id=e.entity_id) end,
           'Escalation level '||e.escalation_level||coalesce(' - '||e.reason,''),
           null::text, e.triggered_at,
           case when e.entity_type='work_order' then '/work-orders/'||e.entity_id else '/fm-requests/'||e.entity_id end
    from fm_escalations e
    where e.resolved_at is null
      and (p_location is null or
           (e.entity_type='work_order' and exists(select 1 from work_orders w where w.id=e.entity_id and w.location_id=p_location)) or
           (e.entity_type='fm_request' and exists(select 1 from fm_requests f where f.id=e.entity_id and f.location_id=p_location)))
    union all
    select 4, 'Overdue', 'work_order', w.id, w.work_order_number, w.title,
           'Past due date '||to_char(w.due_date,'YYYY-MM-DD'), pr.code, w.created_at, '/work-orders/'||w.id
    from work_orders w
    join work_order_statuses s on s.id=w.status_id
    left join fm_priorities pr on pr.id=w.priority_id
    where s.code not in ('closed','cancelled') and w.due_date is not null and w.due_date < (select d from l_today)
      and (p_location is null or w.location_id=p_location)
      and (p_priority is null or w.priority_id=p_priority)
      and (p_category is null or w.category_id=p_category)
    union all
    select 5, 'Failed inspection', 'inspection', o.id, o.inspection_number,
           coalesce((select name from inspection_templates t where t.id=o.template_id), 'Inspection'),
           'Result: fail', null::text, coalesce(o.submitted_at, o.created_at), '/inspections/'||o.id
    from inspection_occurrences o
    where o.overall_result='fail' and o.closed_at is null
      and (p_location is null or o.location_id=p_location)
    union all
    select 5, 'Open finding', 'finding', fd.id,
           coalesce((select inspection_number from inspection_occurrences io where io.id=fd.inspection_id), '-'),
           left(coalesce(fd.description,'Finding'), 80),
           'Finding '||replace(fd.status,'_',' '), pr.code, fd.created_at,
           '/inspections/'||fd.inspection_id
    from inspection_findings fd
    left join fm_priorities pr on pr.id=fd.priority_id
    where fd.status in ('open','action_required')
      and (p_location is null or fd.location_id=p_location)
      and (p_priority is null or fd.priority_id=p_priority)
      and (p_category is null or fd.category_id=p_category)
    union all
    select 6, 'Overdue PPM', 'ppm', o.id,
           coalesce((select ppm_number from ppm_plans pp where pp.id=o.ppm_plan_id),'-'),
           coalesce((select name from ppm_plans pp where pp.id=o.ppm_plan_id),'PPM'),
           'Due '||to_char(o.due_date,'YYYY-MM-DD'), null::text, o.created_at,
           '/preventive-maintenance/'||o.ppm_plan_id
    from ppm_occurrences o
    join ppm_plans pl on pl.id=o.ppm_plan_id
    left join assets a on a.id=pl.asset_id
    where o.status in ('upcoming','due') and o.due_date < (select d from l_today)
      and (p_location is null or a.location_id=p_location)
    union all
    select 7, 'Awaiting verification', 'work_order', w.id, w.work_order_number, w.title,
           'Completed, awaiting verification', pr.code, w.completed_at, '/work-orders/'||w.id
    from work_orders w
    join work_order_statuses s on s.id=w.status_id
    left join fm_priorities pr on pr.id=w.priority_id
    where s.code='completed'
      and (p_location is null or w.location_id=p_location)
      and (p_priority is null or w.priority_id=p_priority)
      and (p_category is null or w.category_id=p_category)
    union all
    select 8, 'Contract', 'contract', c.id, c.contract_number, c.name,
           case when c.end_date < (select d from l_today) then 'Expired '||to_char(c.end_date,'YYYY-MM-DD')
                else 'Expires '||to_char(c.end_date,'YYYY-MM-DD') end,
           null::text, c.created_at, '/vendors/contracts/'||c.id
    from service_contracts c
    where c.status='active' and c.end_date is not null and c.end_date <= (select d from l_today) + 30
    union all
    select 9, 'Out of stock', 'inventory_item', i.id, i.item_code, i.name,
           'Out of stock', null::text, i.updated_at, '/inventory/'||i.id
    from inventory_items i
    where i.is_active
      and coalesce((select sum(b.quantity_on_hand) from inventory_balances b where b.inventory_item_id=i.id),0) <= 0
  )
  select r.rank, r.category, r.entity_type, r.entity_id, r.ref, r.title, r.detail, r.priority_code, r.occurred_at, r.link
  from (
    select * from rows
    order by rank asc, occurred_at asc nulls last
    limit p_limit
  ) r
  order by r.rank asc, r.occurred_at asc nulls last;
$$;

comment on function public.report_needs_attention(uuid,uuid,uuid,int) is
'Phase 9 Needs Attention feed: ranked union (1 critical .. 9 out-of-stock). SECURITY INVOKER -> RLS-scoped; each row carries a drill-down link.';

revoke all on function public.report_needs_attention(uuid,uuid,uuid,int) from public;
grant execute on function public.report_needs_attention(uuid,uuid,uuid,int) to authenticated;

-- ============================================================================
-- Phase 9 — FM Request report + Work Order report
-- Period filter: half-open [p_from, p_to) on created_at (UTC boundaries supplied
-- by the app from a Qatar-local day range). SECURITY INVOKER -> RLS-scoped.
-- ============================================================================

create or replace function public.report_fm_requests(
  p_from timestamptz, p_to timestamptz,
  p_location uuid default null, p_priority uuid default null, p_category uuid default null
) returns jsonb
language plpgsql stable security invoker set search_path to 'public'
as $$
declare j jsonb;
begin
  with base as (
    select f.*, s.code status_code, pr.code priority_code, pr.name priority_name
    from fm_requests f
    join fm_request_statuses s on s.id=f.status_id
    left join fm_priorities pr on pr.id=f.priority_id
    where f.created_at >= p_from and f.created_at < p_to
      and (p_location is null or f.location_id=p_location)
      and (p_priority is null or f.priority_id=p_priority)
      and (p_category is null or f.category_id=p_category)
  )
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'total', (select count(*) from base),
      'open', (select count(*) from base where status_code in ('new','under_review','work_order_created')),
      'closed', (select count(*) from base where status_code='closed'),
      'rejected', (select count(*) from base where status_code='rejected'),
      'cancelled', (select count(*) from base where status_code='cancelled'),
      'critical', (select count(*) from base where priority_code='critical')
    ),
    'avg_response_seconds', (select avg(extract(epoch from (first_responded_at - created_at)))
                              from base where first_responded_at is not null),
    'response_sample', (select count(*) from base where first_responded_at is not null),
    'by_priority', coalesce((select jsonb_agg(jsonb_build_object('code',priority_code,'label',coalesce(priority_name,'—'),'count',c) order by c desc)
        from (select priority_code, coalesce(priority_name,'—') priority_name, count(*) c from base group by priority_code, priority_name) t), '[]'::jsonb),
    'by_category', coalesce((select jsonb_agg(jsonb_build_object('id',cid,'label',cname,'count',c) order by c desc)
        from (select f.category_id cid, coalesce(cat.name,'Uncategorised') cname, count(*) c
              from base f left join fm_categories cat on cat.id=f.category_id group by f.category_id, cat.name) t), '[]'::jsonb),
    'by_location', coalesce((select jsonb_agg(jsonb_build_object('id',lid,'label',lname,'count',c) order by c desc)
        from (select f.location_id lid, coalesce(loc.name,'—') lname, count(*) c
              from base f left join locations loc on loc.id=f.location_id group by f.location_id, loc.name) t), '[]'::jsonb),
    'by_area', coalesce((select jsonb_agg(jsonb_build_object('id',aid,'label',aname,'count',c) order by c desc)
        from (select f.area_id aid, coalesce(ar.name,'—') aname, count(*) c
              from base f left join areas ar on ar.id=f.area_id group by f.area_id, ar.name) t), '[]'::jsonb)
  ) into j;
  return j;
end $$;

comment on function public.report_fm_requests(timestamptz,timestamptz,uuid,uuid,uuid) is
'Phase 9 FM request report. Cohort = requests created in [from,to). Avg Response = mean(first_responded_at - created_at) over requests with a response (Phase 8 timestamp). SECURITY INVOKER.';
revoke all on function public.report_fm_requests(timestamptz,timestamptz,uuid,uuid,uuid) from public;
grant execute on function public.report_fm_requests(timestamptz,timestamptz,uuid,uuid,uuid) to authenticated;


create or replace function public.report_work_orders(
  p_from timestamptz, p_to timestamptz,
  p_location uuid default null, p_priority uuid default null, p_category uuid default null
) returns jsonb
language plpgsql stable security invoker set search_path to 'public'
as $$
declare j jsonb; l_today date := (now() at time zone 'Asia/Qatar')::date;
begin
  with base as (
    select w.*, s.code status_code, pr.code priority_code, pr.name priority_name
    from work_orders w
    join work_order_statuses s on s.id=w.status_id
    left join fm_priorities pr on pr.id=w.priority_id
    where w.created_at >= p_from and w.created_at < p_to
      and (p_location is null or w.location_id=p_location)
      and (p_priority is null or w.priority_id=p_priority)
      and (p_category is null or w.category_id=p_category)
  )
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'total', (select count(*) from base),
      'new', (select count(*) from base where status_code='new'),
      'assigned', (select count(*) from base where status_code='assigned'),
      'in_progress', (select count(*) from base where status_code='in_progress'),
      'waiting', (select count(*) from base where status_code in ('on_hold','waiting_parts','waiting_vendor','waiting_procurement','waiting_approval')),
      'completed', (select count(*) from base where status_code='completed'),
      'verified', (select count(*) from base where status_code='verified'),
      'closed', (select count(*) from base where status_code='closed'),
      'cancelled', (select count(*) from base where status_code='cancelled'),
      'open', (select count(*) from base where status_code not in ('closed','cancelled')),
      'overdue', (select count(*) from base where status_code not in ('closed','cancelled') and due_date is not null and due_date < l_today),
      'sla_breached', (select count(*) from base where resolution_sla_status='breached'),
      'escalated', (select count(*) from base where coalesce(escalation_level,0) > 0)
    ),
    'by_status', coalesce((select jsonb_agg(jsonb_build_object('code',status_code,'count',c) order by c desc)
        from (select status_code, count(*) c from base group by status_code) t), '[]'::jsonb),
    'by_priority', coalesce((select jsonb_agg(jsonb_build_object('code',priority_code,'label',coalesce(priority_name,'—'),'count',c) order by c desc)
        from (select priority_code, priority_name, count(*) c from base group by priority_code, priority_name) t), '[]'::jsonb),
    'by_source', coalesce((select jsonb_agg(jsonb_build_object('code',source,'count',c) order by c desc)
        from (select source, count(*) c from base group by source) t), '[]'::jsonb),
    'by_location', coalesce((select jsonb_agg(jsonb_build_object('id',lid,'label',lname,'count',c) order by c desc)
        from (select w.location_id lid, coalesce(loc.name,'—') lname, count(*) c from base w left join locations loc on loc.id=w.location_id group by w.location_id, loc.name) t), '[]'::jsonb),
    'by_area', coalesce((select jsonb_agg(jsonb_build_object('id',aid,'label',aname,'count',c) order by c desc)
        from (select w.area_id aid, coalesce(ar.name,'—') aname, count(*) c from base w left join areas ar on ar.id=w.area_id group by w.area_id, ar.name) t), '[]'::jsonb),
    'by_category', coalesce((select jsonb_agg(jsonb_build_object('id',cid,'label',cname,'count',c) order by c desc)
        from (select w.category_id cid, coalesce(cat.name,'Uncategorised') cname, count(*) c from base w left join fm_categories cat on cat.id=w.category_id group by w.category_id, cat.name) t), '[]'::jsonb),
    'by_technician', coalesce((select jsonb_agg(jsonb_build_object('id',tid,'label',tname,'count',c) order by c desc)
        from (select w.assigned_to tid, coalesce(p.full_name,'Unassigned') tname, count(*) c from base w left join profiles p on p.id=w.assigned_to group by w.assigned_to, p.full_name) t), '[]'::jsonb)
  ) into j;
  return j;
end $$;

comment on function public.report_work_orders(timestamptz,timestamptz,uuid,uuid,uuid) is
'Phase 9 work order report. Cohort = WOs created in [from,to). Overdue = open & manual due_date < Qatar-today; sla_breached = resolution_sla_status=breached; escalated = escalation_level>0. SECURITY INVOKER.';
revoke all on function public.report_work_orders(timestamptz,timestamptz,uuid,uuid,uuid) from public;
grant execute on function public.report_work_orders(timestamptz,timestamptz,uuid,uuid,uuid) to authenticated;

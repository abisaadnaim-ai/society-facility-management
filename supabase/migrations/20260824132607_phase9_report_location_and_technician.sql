-- Location comparison: factual per-location operational metrics (spec §6, no scoring).
create or replace function public.report_location_comparison(
  p_from timestamptz, p_to timestamptz
) returns table(
  location_id uuid, location text,
  fm_requests int, work_orders int, critical int, overdue_wo int,
  sla_met int, sla_breached int, sla_compliance_pct numeric, avg_resolution_seconds numeric,
  ppm_applicable int, ppm_on_time int, ppm_compliance_pct numeric,
  insp_completed int, insp_overdue int, insp_compliance_pct numeric,
  findings int
)
language sql stable security invoker set search_path to 'public'
as $$
  with l_today as (select (now() at time zone 'Asia/Qatar')::date d),
       lf as (select (p_from at time zone 'Asia/Qatar')::date d),
       lt as (select (p_to at time zone 'Asia/Qatar')::date d),
  fm as (
    select location_id, count(*)::int c
    from fm_requests where created_at>=p_from and created_at<p_to group by location_id
  ),
  wo as (
    select w.location_id,
      count(*)::int c,
      count(*) filter (where pr.code='critical')::int crit,
      count(*) filter (where s.code not in ('closed','cancelled') and w.due_date is not null and w.due_date < (select d from l_today))::int overdue,
      count(*) filter (where w.resolution_sla_status='met')::int met,
      count(*) filter (where w.resolution_sla_status='breached')::int breached
    from work_orders w
    join work_order_statuses s on s.id=w.status_id
    left join fm_priorities pr on pr.id=w.priority_id
    where w.created_at>=p_from and w.created_at<p_to
    group by w.location_id
  ),
  res as (
    select location_id, avg(extract(epoch from (closed_at-created_at))) a
    from work_orders where closed_at is not null and closed_at>=p_from and closed_at<p_to group by location_id
  ),
  ppm as (
    select a.location_id,
      count(*) filter (where o.status='completed')::int completed_total,
      count(*) filter (where o.status='completed' and (o.completed_at at time zone 'Asia/Qatar')::date <= o.due_date)::int on_time,
      count(*) filter (where o.status in ('upcoming','due') and o.due_date < (select d from l_today))::int overdue_missed
    from ppm_occurrences o join ppm_plans pl on pl.id=o.ppm_plan_id left join assets a on a.id=pl.asset_id
    where o.scheduled_date >= (select d from lf) and o.scheduled_date < (select d from lt)
    group by a.location_id
  ),
  insp as (
    select location_id,
      count(*) filter (where status in ('submitted','reviewed','closed'))::int completed,
      count(*) filter (where status in ('scheduled','due') and scheduled_date < (select d from l_today))::int overdue
    from inspection_occurrences
    where scheduled_date >= (select d from lf) and scheduled_date < (select d from lt)
    group by location_id
  ),
  fnd as (
    select location_id, count(*)::int c from inspection_findings
    where created_at>=p_from and created_at<p_to group by location_id
  )
  select loc.id, loc.name,
    coalesce(fm.c,0), coalesce(wo.c,0), coalesce(wo.crit,0), coalesce(wo.overdue,0),
    coalesce(wo.met,0), coalesce(wo.breached,0),
    case when coalesce(wo.met,0)+coalesce(wo.breached,0)>0 then round((wo.met::numeric/(wo.met+wo.breached))*100,1) else null end,
    round(res.a::numeric,0),
    coalesce(ppm.completed_total,0)+coalesce(ppm.overdue_missed,0), coalesce(ppm.on_time,0),
    case when coalesce(ppm.completed_total,0)+coalesce(ppm.overdue_missed,0)>0 then round((ppm.on_time::numeric/(ppm.completed_total+ppm.overdue_missed))*100,1) else null end,
    coalesce(insp.completed,0), coalesce(insp.overdue,0),
    case when coalesce(insp.completed,0)+coalesce(insp.overdue,0)>0 then round((insp.completed::numeric/(insp.completed+insp.overdue))*100,1) else null end,
    coalesce(fnd.c,0)
  from locations loc
  left join fm on fm.location_id=loc.id
  left join wo on wo.location_id=loc.id
  left join res on res.location_id=loc.id
  left join ppm on ppm.location_id=loc.id
  left join insp on insp.location_id=loc.id
  left join fnd on fnd.location_id=loc.id
  order by loc.name;
$$;
comment on function public.report_location_comparison(timestamptz,timestamptz) is
'Phase 9 location comparison: factual per-location metrics (spec §6, no subjective scoring). SECURITY INVOKER.';
revoke all on function public.report_location_comparison(timestamptz,timestamptz) from public;
grant execute on function public.report_location_comparison(timestamptz,timestamptz) to authenticated;


-- Technician workload: factual (spec §11/§12, no ratings). Current-state + period completions.
create or replace function public.report_technician_workload(
  p_from timestamptz, p_to timestamptz, p_location uuid default null
) returns table(
  technician_id uuid, technician text,
  new_assigned int, in_progress int, waiting int, awaiting_verification int, open_total int,
  completed_period int, closed_period int, overdue int, avg_resolution_seconds numeric,
  ppm_open int, inspections_assigned int, inspections_completed int
)
language sql stable security invoker set search_path to 'public'
as $$
  with l_today as (select (now() at time zone 'Asia/Qatar')::date d),
       lf as (select (p_from at time zone 'Asia/Qatar')::date d),
       lt as (select (p_to at time zone 'Asia/Qatar')::date d),
  techs as (
    select p.id, p.full_name from profiles p join roles r on r.id=p.role_id
    where r.code='technician' and p.is_active is not false
  ),
  wo as (
    select w.assigned_to,
      count(*) filter (where s.code in ('new','assigned'))::int new_assigned,
      count(*) filter (where s.code='in_progress')::int in_progress,
      count(*) filter (where s.code in ('on_hold','waiting_parts','waiting_vendor','waiting_procurement','waiting_approval'))::int waiting,
      count(*) filter (where s.code='completed')::int awaiting_verification,
      count(*) filter (where s.code not in ('closed','cancelled'))::int open_total,
      count(*) filter (where s.code not in ('closed','cancelled') and w.due_date is not null and w.due_date < (select d from l_today))::int overdue,
      count(*) filter (where s.code not in ('closed','cancelled') and w.source='ppm')::int ppm_open
    from work_orders w join work_order_statuses s on s.id=w.status_id
    where (p_location is null or w.location_id=p_location)
    group by w.assigned_to
  ),
  period as (
    select assigned_to,
      count(*) filter (where completed_at>=p_from and completed_at<p_to)::int completed_period,
      count(*) filter (where closed_at>=p_from and closed_at<p_to)::int closed_period,
      avg(extract(epoch from (closed_at-created_at))) filter (where closed_at>=p_from and closed_at<p_to) avg_res
    from work_orders
    where (p_location is null or location_id=p_location)
    group by assigned_to
  ),
  insp as (
    select assigned_to,
      count(*)::int assigned,
      count(*) filter (where status in ('submitted','reviewed','closed'))::int completed
    from inspection_occurrences
    where scheduled_date >= (select d from lf) and scheduled_date < (select d from lt)
      and (p_location is null or location_id=p_location)
    group by assigned_to
  )
  select t.id, t.full_name,
    coalesce(wo.new_assigned,0), coalesce(wo.in_progress,0), coalesce(wo.waiting,0), coalesce(wo.awaiting_verification,0), coalesce(wo.open_total,0),
    coalesce(period.completed_period,0), coalesce(period.closed_period,0), coalesce(wo.overdue,0), round(period.avg_res::numeric,0),
    coalesce(wo.ppm_open,0), coalesce(insp.assigned,0), coalesce(insp.completed,0)
  from techs t
  left join wo on wo.assigned_to=t.id
  left join period on period.assigned_to=t.id
  left join insp on insp.assigned_to=t.id
  order by t.full_name;
$$;
comment on function public.report_technician_workload(timestamptz,timestamptz,uuid) is
'Phase 9 technician workload: factual current-state (new/assigned, in_progress, waiting, awaiting verification, overdue, open PPM) + period completions and avg resolution. No subjective ratings (spec §11/§12). SECURITY INVOKER -> a technician only sees their own rows via RLS.';
revoke all on function public.report_technician_workload(timestamptz,timestamptz,uuid) from public;
grant execute on function public.report_technician_workload(timestamptz,timestamptz,uuid) to authenticated;

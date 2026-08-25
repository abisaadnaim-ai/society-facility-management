-- PPM report. Occurrences filtered by scheduled_date within the Qatar-local day range.
create or replace function public.report_ppm(
  p_from timestamptz, p_to timestamptz, p_location uuid default null
) returns jsonb
language plpgsql stable security invoker set search_path to 'public'
as $$
declare
  j jsonb;
  l_from date := (p_from at time zone 'Asia/Qatar')::date;
  l_to   date := (p_to   at time zone 'Asia/Qatar')::date;  -- exclusive
  l_today date := (now() at time zone 'Asia/Qatar')::date;
begin
  with base as (
    select o.*, pl.category_id plan_category, pl.default_assigned_to, a.location_id asset_location,
           ((o.completed_at at time zone 'Asia/Qatar')::date) completed_local
    from ppm_occurrences o
    join ppm_plans pl on pl.id=o.ppm_plan_id
    left join assets a on a.id=pl.asset_id
    where o.scheduled_date >= l_from and o.scheduled_date < l_to
      and (p_location is null or a.location_id = p_location)
  ),
  agg as (
    select
      count(*) scheduled,
      count(*) filter (where status='completed') completed_total,
      count(*) filter (where status='completed' and completed_local <= due_date) completed_on_time,
      count(*) filter (where status in ('upcoming','due') and due_date < l_today) overdue_missed,
      count(*) filter (where status='skipped') skipped,
      count(*) filter (where status='work_order_created') open_wo
    from base
  )
  select jsonb_build_object(
    'active_plans', (select count(*) from ppm_plans where status='active'
                       and (p_location is null or asset_id in (select id from assets where location_id=p_location))),
    'scheduled', (select scheduled from agg),
    'completed', (select completed_total from agg),
    'completed_on_time', (select completed_on_time from agg),
    'overdue', (select overdue_missed from agg),
    'skipped', (select skipped from agg),
    'open_wo', (select open_wo from agg),
    'compliance_pct', (select case when (completed_total+overdue_missed)>0
                        then round((completed_on_time::numeric/(completed_total+overdue_missed))*100,1) else null end from agg),
    'by_location', coalesce((select jsonb_agg(jsonb_build_object('label',lname,'scheduled',sc,'completed',cp,'overdue',ov,'skipped',sk,
          'compliance_pct', case when (cp+ov)>0 then round((cot::numeric/(cp+ov))*100,1) else null end) order by sc desc)
        from (select coalesce(loc.name,'—') lname,
                     count(*) sc,
                     count(*) filter (where status='completed') cp,
                     count(*) filter (where status='completed' and completed_local<=due_date) cot,
                     count(*) filter (where status in ('upcoming','due') and due_date<l_today) ov,
                     count(*) filter (where status='skipped') sk
              from base b left join locations loc on loc.id=b.asset_location group by loc.name) t), '[]'::jsonb),
    'by_category', coalesce((select jsonb_agg(jsonb_build_object('label',cname,'scheduled',sc,'completed',cp,'overdue',ov) order by sc desc)
        from (select coalesce(cat.name,'Uncategorised') cname, count(*) sc,
                     count(*) filter (where status='completed') cp,
                     count(*) filter (where status in ('upcoming','due') and due_date<l_today) ov
              from base b left join fm_categories cat on cat.id=b.plan_category group by cat.name) t), '[]'::jsonb),
    'by_technician', coalesce((select jsonb_agg(jsonb_build_object('label',tname,'scheduled',sc,'completed',cp) order by sc desc)
        from (select coalesce(p.full_name,'Unassigned') tname, count(*) sc,
                     count(*) filter (where status='completed') cp
              from base b left join profiles p on p.id=b.default_assigned_to group by p.full_name) t), '[]'::jsonb)
  ) into j;
  return j;
end $$;
comment on function public.report_ppm(timestamptz,timestamptz,uuid) is
'Phase 9 PPM report. Cohort = occurrences scheduled in the Qatar-local period. Compliance% = completed-on-time / (completed + overdue-missed). On-time = completed_at(Qatar date) <= due_date. Skipped shown separately (never hidden). SECURITY INVOKER.';
revoke all on function public.report_ppm(timestamptz,timestamptz,uuid) from public;
grant execute on function public.report_ppm(timestamptz,timestamptz,uuid) to authenticated;


-- Inspections report. Occurrences filtered by scheduled_date within Qatar-local range.
create or replace function public.report_inspections(
  p_from timestamptz, p_to timestamptz, p_location uuid default null
) returns jsonb
language plpgsql stable security invoker set search_path to 'public'
as $$
declare
  j jsonb;
  l_from date := (p_from at time zone 'Asia/Qatar')::date;
  l_to   date := (p_to   at time zone 'Asia/Qatar')::date;
  l_today date := (now() at time zone 'Asia/Qatar')::date;
begin
  with base as (
    select o.* from inspection_occurrences o
    where o.scheduled_date >= l_from and o.scheduled_date < l_to
      and (p_location is null or o.location_id=p_location)
  ),
  agg as (
    select count(*) scheduled,
      count(*) filter (where status in ('submitted','reviewed','closed')) completed,
      count(*) filter (where overall_result='pass') passed,
      count(*) filter (where overall_result='fail') failed,
      count(*) filter (where status in ('scheduled','due') and scheduled_date < l_today) overdue,
      count(*) filter (where status='skipped') skipped,
      count(*) filter (where status='submitted') awaiting_review
    from base
  )
  select jsonb_build_object(
    'scheduled',(select scheduled from agg),
    'completed',(select completed from agg),
    'passed',(select passed from agg),
    'failed',(select failed from agg),
    'overdue',(select overdue from agg),
    'skipped',(select skipped from agg),
    'awaiting_review',(select awaiting_review from agg),
    'compliance_pct',(select case when (completed+overdue)>0 then round((completed::numeric/(completed+overdue))*100,1) else null end from agg),
    'by_location', coalesce((select jsonb_agg(jsonb_build_object('label',lname,'scheduled',sc,'completed',cp,'failed',fl) order by sc desc)
        from (select coalesce(loc.name,'—') lname, count(*) sc, count(*) filter (where status in ('submitted','reviewed','closed')) cp, count(*) filter (where overall_result='fail') fl
              from base b left join locations loc on loc.id=b.location_id group by loc.name) t), '[]'::jsonb),
    'by_area', coalesce((select jsonb_agg(jsonb_build_object('label',aname,'scheduled',sc) order by sc desc)
        from (select coalesce(ar.name,'—') aname, count(*) sc from base b left join areas ar on ar.id=b.area_id group by ar.name) t), '[]'::jsonb),
    'by_template', coalesce((select jsonb_agg(jsonb_build_object('label',tname,'scheduled',sc,'passed',ps,'failed',fl) order by sc desc)
        from (select coalesce(tp.name,'—') tname, count(*) sc, count(*) filter (where overall_result='pass') ps, count(*) filter (where overall_result='fail') fl
              from base b left join inspection_templates tp on tp.id=b.template_id group by tp.name) t), '[]'::jsonb),
    'by_inspector', coalesce((select jsonb_agg(jsonb_build_object('label',iname,'scheduled',sc,'completed',cp) order by sc desc)
        from (select coalesce(p.full_name,'Unassigned') iname, count(*) sc, count(*) filter (where status in ('submitted','reviewed','closed')) cp
              from base b left join profiles p on p.id=b.assigned_to group by p.full_name) t), '[]'::jsonb)
  ) into j;
  return j;
end $$;
comment on function public.report_inspections(timestamptz,timestamptz,uuid) is
'Phase 9 inspection report. Cohort = occurrences scheduled in Qatar-local period. Compliance% = completed / (completed + overdue). Completed = submitted/reviewed/closed. SECURITY INVOKER.';
revoke all on function public.report_inspections(timestamptz,timestamptz,uuid) from public;
grant execute on function public.report_inspections(timestamptz,timestamptz,uuid) to authenticated;


-- Findings report. Cohort = findings created in [from,to).
create or replace function public.report_findings(
  p_from timestamptz, p_to timestamptz,
  p_location uuid default null, p_priority uuid default null, p_category uuid default null
) returns jsonb
language plpgsql stable security invoker set search_path to 'public'
as $$
declare j jsonb;
begin
  with base as (
    select fd.* from inspection_findings fd
    where fd.created_at >= p_from and fd.created_at < p_to
      and (p_location is null or fd.location_id=p_location)
      and (p_priority is null or fd.priority_id=p_priority)
      and (p_category is null or fd.category_id=p_category)
  )
  select jsonb_build_object(
    'total',(select count(*) from base),
    'open',(select count(*) from base where status='open'),
    'action_required',(select count(*) from base where status='action_required'),
    'fm_request_created',(select count(*) from base where status='fm_request_created'),
    'work_order_created',(select count(*) from base where status='work_order_created'),
    'resolved',(select count(*) from base where status='resolved'),
    'dismissed',(select count(*) from base where status='dismissed'),
    'by_location', coalesce((select jsonb_agg(jsonb_build_object('label',lname,'count',c) order by c desc)
        from (select coalesce(loc.name,'—') lname, count(*) c from base b left join locations loc on loc.id=b.location_id group by loc.name) t), '[]'::jsonb),
    'by_priority', coalesce((select jsonb_agg(jsonb_build_object('label',pname,'count',c) order by c desc)
        from (select coalesce(pr.name,'—') pname, count(*) c from base b left join fm_priorities pr on pr.id=b.priority_id group by pr.name) t), '[]'::jsonb),
    'by_category', coalesce((select jsonb_agg(jsonb_build_object('label',cname,'count',c) order by c desc)
        from (select coalesce(cat.name,'Uncategorised') cname, count(*) c from base b left join fm_categories cat on cat.id=b.category_id group by cat.name) t), '[]'::jsonb),
    'by_template', coalesce((select jsonb_agg(jsonb_build_object('label',tname,'count',c) order by c desc)
        from (select coalesce(tp.name,'—') tname, count(*) c
              from base b left join inspection_occurrences io on io.id=b.inspection_id left join inspection_templates tp on tp.id=io.template_id group by tp.name) t), '[]'::jsonb),
    'by_asset', coalesce((select jsonb_agg(jsonb_build_object('label',aname,'count',c) order by c desc)
        from (select coalesce(a.name,'—') aname, count(*) c from base b left join assets a on a.id=b.asset_id group by a.name) t), '[]'::jsonb)
  ) into j;
  return j;
end $$;
comment on function public.report_findings(timestamptz,timestamptz,uuid,uuid,uuid) is
'Phase 9 findings report. Cohort = findings created in [from,to). SECURITY INVOKER.';
revoke all on function public.report_findings(timestamptz,timestamptz,uuid,uuid,uuid) from public;
grant execute on function public.report_findings(timestamptz,timestamptz,uuid,uuid,uuid) to authenticated;

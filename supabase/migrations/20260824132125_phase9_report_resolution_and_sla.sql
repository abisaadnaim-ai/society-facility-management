-- Resolution time: WOs CLOSED in [from,to). Resolution = closed_at - created_at.
-- Open WOs excluded entirely (spec §9).
create or replace function public.report_resolution_time(
  p_from timestamptz, p_to timestamptz,
  p_location uuid default null, p_priority uuid default null, p_category uuid default null
) returns jsonb
language plpgsql stable security invoker set search_path to 'public'
as $$
declare j jsonb;
begin
  with base as (
    select w.id, w.location_id, w.category_id, w.priority_id,
           pr.code priority_code, pr.name priority_name,
           extract(epoch from (w.closed_at - w.created_at)) secs
    from work_orders w
    left join fm_priorities pr on pr.id=w.priority_id
    where w.closed_at is not null
      and w.closed_at >= p_from and w.closed_at < p_to
      and (p_location is null or w.location_id=p_location)
      and (p_priority is null or w.priority_id=p_priority)
      and (p_category is null or w.category_id=p_category)
  )
  select jsonb_build_object(
    'resolved_count', (select count(*) from base),
    'avg_seconds', (select avg(secs) from base),
    'median_seconds', (select percentile_cont(0.5) within group (order by secs) from base),
    'min_seconds', (select min(secs) from base),
    'max_seconds', (select max(secs) from base),
    'by_priority', coalesce((select jsonb_agg(jsonb_build_object('code',priority_code,'label',coalesce(priority_name,'—'),'count',c,'avg_seconds',a) order by c desc)
        from (select priority_code, priority_name, count(*) c, avg(secs) a from base group by priority_code, priority_name) t), '[]'::jsonb),
    'by_location', coalesce((select jsonb_agg(jsonb_build_object('id',lid,'label',lname,'count',c,'avg_seconds',a) order by c desc)
        from (select b.location_id lid, coalesce(loc.name,'—') lname, count(*) c, avg(secs) a from base b left join locations loc on loc.id=b.location_id group by b.location_id, loc.name) t), '[]'::jsonb),
    'by_category', coalesce((select jsonb_agg(jsonb_build_object('id',cid,'label',cname,'count',c,'avg_seconds',a) order by c desc)
        from (select b.category_id cid, coalesce(cat.name,'Uncategorised') cname, count(*) c, avg(secs) a from base b left join fm_categories cat on cat.id=b.category_id group by b.category_id, cat.name) t), '[]'::jsonb)
  ) into j;
  return j;
end $$;

comment on function public.report_resolution_time(timestamptz,timestamptz,uuid,uuid,uuid) is
'Phase 9 resolution time. Resolution = closed_at - created_at, over WOs closed in [from,to). Open WOs excluded. Median via percentile_cont(0.5). SECURITY INVOKER.';
revoke all on function public.report_resolution_time(timestamptz,timestamptz,uuid,uuid,uuid) from public;
grant execute on function public.report_resolution_time(timestamptz,timestamptz,uuid,uuid,uuid) to authenticated;


-- SLA report: compliance = Met / (Met + Breached) * 100. Excludes not_applicable + pending.
create or replace function public.report_sla(
  p_from timestamptz, p_to timestamptz,
  p_location uuid default null, p_priority uuid default null, p_category uuid default null
) returns jsonb
language plpgsql stable security invoker set search_path to 'public'
as $$
declare
  j jsonb;
  resp_met int; resp_br int; res_met int; res_br int;
begin
  select
    count(*) filter (where response_sla_status='met'),
    count(*) filter (where response_sla_status='breached')
  into resp_met, resp_br
  from fm_requests f
  where f.created_at >= p_from and f.created_at < p_to
    and (p_location is null or f.location_id=p_location)
    and (p_priority is null or f.priority_id=p_priority)
    and (p_category is null or f.category_id=p_category);

  select
    count(*) filter (where resolution_sla_status='met'),
    count(*) filter (where resolution_sla_status='breached')
  into res_met, res_br
  from work_orders w
  where w.created_at >= p_from and w.created_at < p_to
    and (p_location is null or w.location_id=p_location)
    and (p_priority is null or w.priority_id=p_priority)
    and (p_category is null or w.category_id=p_category);

  with breaches as (
    select 'response' kind, f.location_id, f.priority_id, f.category_id
    from fm_requests f
    where f.response_sla_status='breached' and f.created_at >= p_from and f.created_at < p_to
      and (p_location is null or f.location_id=p_location)
      and (p_priority is null or f.priority_id=p_priority)
      and (p_category is null or f.category_id=p_category)
    union all
    select 'resolution', w.location_id, w.priority_id, w.category_id
    from work_orders w
    where w.resolution_sla_status='breached' and w.created_at >= p_from and w.created_at < p_to
      and (p_location is null or w.location_id=p_location)
      and (p_priority is null or w.priority_id=p_priority)
      and (p_category is null or w.category_id=p_category)
  )
  select jsonb_build_object(
    'response', jsonb_build_object('met',resp_met,'breached',resp_br,'applicable',resp_met+resp_br,
        'compliance_pct', case when resp_met+resp_br>0 then round((resp_met::numeric/(resp_met+resp_br))*100,1) else null end),
    'resolution', jsonb_build_object('met',res_met,'breached',res_br,'applicable',res_met+res_br,
        'compliance_pct', case when res_met+res_br>0 then round((res_met::numeric/(res_met+res_br))*100,1) else null end),
    'overall', jsonb_build_object('met',resp_met+res_met,'breached',resp_br+res_br,'applicable',resp_met+resp_br+res_met+res_br,
        'compliance_pct', case when (resp_met+res_met+resp_br+res_br)>0 then round(((resp_met+res_met)::numeric/(resp_met+res_met+resp_br+res_br))*100,1) else null end),
    'breaches_by_priority', coalesce((select jsonb_agg(jsonb_build_object('label',lbl,'count',c) order by c desc)
        from (select coalesce(pr.name,'—') lbl, count(*) c from breaches b left join fm_priorities pr on pr.id=b.priority_id group by pr.name) t), '[]'::jsonb),
    'breaches_by_location', coalesce((select jsonb_agg(jsonb_build_object('label',lbl,'count',c) order by c desc)
        from (select coalesce(loc.name,'—') lbl, count(*) c from breaches b left join locations loc on loc.id=b.location_id group by loc.name) t), '[]'::jsonb),
    'breaches_by_category', coalesce((select jsonb_agg(jsonb_build_object('label',lbl,'count',c) order by c desc)
        from (select coalesce(cat.name,'Uncategorised') lbl, count(*) c from breaches b left join fm_categories cat on cat.id=b.category_id group by cat.name) t), '[]'::jsonb)
  ) into j;
  return j;
end $$;

comment on function public.report_sla(timestamptz,timestamptz,uuid,uuid,uuid) is
'Phase 9 SLA report. Compliance% = Met/(Met+Breached)*100. Response cohort = FM requests created in period with final response SLA status; Resolution cohort = WOs created in period with final resolution SLA status. Excludes not_applicable and pending (still-open). SECURITY INVOKER.';
revoke all on function public.report_sla(timestamptz,timestamptz,uuid,uuid,uuid) from public;
grant execute on function public.report_sla(timestamptz,timestamptz,uuid,uuid,uuid) to authenticated;

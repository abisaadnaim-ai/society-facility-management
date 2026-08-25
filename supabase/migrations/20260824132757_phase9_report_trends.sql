-- Count trends: FM created, WO created, WO closed per bucket (day/week/month), zero-filled.
create or replace function public.report_trend_counts(
  p_from timestamptz, p_to timestamptz, p_location uuid default null, p_bucket text default 'day'
) returns table(bucket date, fm_created int, wo_created int, wo_closed int)
language plpgsql stable security invoker set search_path to 'public'
as $$
declare
  b text := case when p_bucket in ('day','week','month') then p_bucket else 'day' end;
  b_from date := (date_trunc(b, (p_from at time zone 'Asia/Qatar')))::date;
  b_to   date := (date_trunc(b, (p_to   at time zone 'Asia/Qatar')))::date;
begin
  return query
  with series as (
    select generate_series(b_from, b_to, ('1 '||b)::interval)::date d
  ),
  fm as (
    select (date_trunc(b, (created_at at time zone 'Asia/Qatar')))::date d, count(*)::int c
    from fm_requests where created_at>=p_from and created_at<p_to and (p_location is null or location_id=p_location)
    group by 1
  ),
  woc as (
    select (date_trunc(b, (created_at at time zone 'Asia/Qatar')))::date d, count(*)::int c
    from work_orders where created_at>=p_from and created_at<p_to and (p_location is null or location_id=p_location)
    group by 1
  ),
  wcl as (
    select (date_trunc(b, (closed_at at time zone 'Asia/Qatar')))::date d, count(*)::int c
    from work_orders where closed_at is not null and closed_at>=p_from and closed_at<p_to and (p_location is null or location_id=p_location)
    group by 1
  )
  select s.d, coalesce(fm.c,0), coalesce(woc.c,0), coalesce(wcl.c,0)
  from series s
  left join fm on fm.d=s.d
  left join woc on woc.d=s.d
  left join wcl on wcl.d=s.d
  order by s.d;
end $$;
comment on function public.report_trend_counts(timestamptz,timestamptz,uuid,text) is
'Phase 9 count trends (fm_created, wo_created, wo_closed) per day/week/month bucket, zero-filled across the range. Buckets computed in Asia/Qatar. SECURITY INVOKER.';
revoke all on function public.report_trend_counts(timestamptz,timestamptz,uuid,text) from public;
grant execute on function public.report_trend_counts(timestamptz,timestamptz,uuid,text) to authenticated;


-- SLA compliance trend per bucket. Compliance = met/(met+breached)*100 within bucket.
create or replace function public.report_trend_sla(
  p_from timestamptz, p_to timestamptz, p_location uuid default null, p_bucket text default 'week'
) returns table(bucket date, response_pct numeric, resolution_pct numeric)
language plpgsql stable security invoker set search_path to 'public'
as $$
declare
  b text := case when p_bucket in ('day','week','month') then p_bucket else 'week' end;
  b_from date := (date_trunc(b, (p_from at time zone 'Asia/Qatar')))::date;
  b_to   date := (date_trunc(b, (p_to   at time zone 'Asia/Qatar')))::date;
begin
  return query
  with series as (select generate_series(b_from, b_to, ('1 '||b)::interval)::date d),
  resp as (
    select (date_trunc(b,(created_at at time zone 'Asia/Qatar')))::date d,
           count(*) filter (where response_sla_status='met') m,
           count(*) filter (where response_sla_status='breached') br
    from fm_requests where created_at>=p_from and created_at<p_to and (p_location is null or location_id=p_location)
    group by 1
  ),
  res as (
    select (date_trunc(b,(created_at at time zone 'Asia/Qatar')))::date d,
           count(*) filter (where resolution_sla_status='met') m,
           count(*) filter (where resolution_sla_status='breached') br
    from work_orders where created_at>=p_from and created_at<p_to and (p_location is null or location_id=p_location)
    group by 1
  )
  select s.d,
    case when coalesce(resp.m,0)+coalesce(resp.br,0)>0 then round((resp.m::numeric/(resp.m+resp.br))*100,1) else null end,
    case when coalesce(res.m,0)+coalesce(res.br,0)>0 then round((res.m::numeric/(res.m+res.br))*100,1) else null end
  from series s left join resp on resp.d=s.d left join res on res.d=s.d
  order by s.d;
end $$;
comment on function public.report_trend_sla(timestamptz,timestamptz,uuid,text) is
'Phase 9 SLA compliance trend (response + resolution) per bucket. NULL where no applicable records in a bucket. SECURITY INVOKER.';
revoke all on function public.report_trend_sla(timestamptz,timestamptz,uuid,text) from public;
grant execute on function public.report_trend_sla(timestamptz,timestamptz,uuid,text) to authenticated;

-- Assets reliability + recurring issues (spec §13, §23). Factual, no invented thresholds.
create or replace function public.report_assets(
  p_from timestamptz, p_to timestamptz, p_location uuid default null, p_category uuid default null
) returns jsonb
language plpgsql stable security invoker set search_path to 'public'
as $$
declare j jsonb;
begin
  with wo as (
    select w.asset_id, w.location_id, w.category_id, w.area_id
    from work_orders w
    where w.created_at>=p_from and w.created_at<p_to and w.asset_id is not null
      and (p_location is null or w.location_id=p_location)
      and (p_category is null or w.category_id=p_category)
  ),
  per_asset as (
    select asset_id, count(*)::int c from wo group by asset_id
  ),
  fnd as (
    select asset_id, count(*)::int c from inspection_findings
    where created_at>=p_from and created_at<p_to and asset_id is not null
      and (p_location is null or location_id=p_location)
    group by asset_id
  )
  select jsonb_build_object(
    'most_wo', coalesce((select jsonb_agg(jsonb_build_object('code',a.asset_code,'label',a.name,'count',pa.c) order by pa.c desc)
        from (select * from per_asset order by c desc limit 15) pa join assets a on a.id=pa.asset_id), '[]'::jsonb),
    'repeat_failure_count', (select count(*) from per_asset where c>=2),
    'repeat_failures', coalesce((select jsonb_agg(jsonb_build_object('code',a.asset_code,'label',a.name,'count',pa.c) order by pa.c desc)
        from (select * from per_asset where c>=2 order by c desc limit 25) pa join assets a on a.id=pa.asset_id), '[]'::jsonb),
    'out_of_service', (select count(*) from assets a join asset_statuses s on s.id=a.status_id where s.code='out_of_service' and a.is_active and (p_location is null or a.location_id=p_location)),
    'under_maintenance', (select count(*) from assets a join asset_statuses s on s.id=a.status_id where s.code='under_maintenance' and a.is_active and (p_location is null or a.location_id=p_location)),
    'out_of_service_list', coalesce((select jsonb_agg(jsonb_build_object('code',a.asset_code,'label',a.name) order by a.name)
        from assets a join asset_statuses s on s.id=a.status_id where s.code='out_of_service' and a.is_active and (p_location is null or a.location_id=p_location)), '[]'::jsonb),
    'findings_by_asset', coalesce((select jsonb_agg(jsonb_build_object('code',a.asset_code,'label',a.name,'count',f.c) order by f.c desc)
        from (select * from fnd order by c desc limit 15) f join assets a on a.id=f.asset_id), '[]'::jsonb),
    'recurring_categories', coalesce((select jsonb_agg(jsonb_build_object('label',cname,'count',c) order by c desc)
        from (select coalesce(cat.name,'Uncategorised') cname, count(*)::int c from wo left join fm_categories cat on cat.id=wo.category_id group by cat.name having count(*)>=2) t), '[]'::jsonb),
    'recurring_areas', coalesce((select jsonb_agg(jsonb_build_object('label',aname,'count',c) order by c desc)
        from (select coalesce(ar.name,'—') aname, count(*)::int c from wo left join areas ar on ar.id=wo.area_id group by ar.name having count(*)>=2) t), '[]'::jsonb),
    'downtime_supported', false,
    'downtime_note', 'Downtime tracking requires additional asset lifecycle timestamps; not fabricated for historical records.'
  ) into j;
  return j;
end $$;
comment on function public.report_assets(timestamptz,timestamptz,uuid,uuid) is
'Phase 9 asset reliability + recurring. Repeat failure = >=2 WOs against an asset within the selected period (factual, no invented threshold). Downtime flagged as unsupported (spec §14). SECURITY INVOKER.';
revoke all on function public.report_assets(timestamptz,timestamptz,uuid,uuid) from public;
grant execute on function public.report_assets(timestamptz,timestamptz,uuid,uuid) to authenticated;


-- Vendor report (spec §19). Factual, no vendor scoring.
create or replace function public.report_vendors(
  p_from timestamptz, p_to timestamptz
) returns jsonb
language plpgsql stable security invoker set search_path to 'public'
as $$
declare j jsonb; l_today date := (now() at time zone 'Asia/Qatar')::date;
begin
  select jsonb_build_object(
    'active_vendors', (select count(*) from vendors where status='active'),
    'active_contracts', (select count(*) from service_contracts where status='active'),
    'expiring_90d', (select count(*) from service_contracts where status='active' and end_date>=l_today and end_date<=l_today+90),
    'expiring_30d', (select count(*) from service_contracts where status='active' and end_date>=l_today and end_date<=l_today+30),
    'expired', (select count(*) from service_contracts where status='active' and end_date<l_today),
    'wo_waiting_vendor', (select count(*) from work_orders w join work_order_statuses s on s.id=w.status_id where s.code='waiting_vendor'),
    'completed_vendor_wo', (select count(*) from work_orders w join work_order_statuses s on s.id=w.status_id
                             where w.vendor_id is not null and s.code in ('completed','verified','closed') and w.closed_at>=p_from and w.closed_at<p_to),
    'avg_resolution_seconds', (select avg(extract(epoch from (closed_at-created_at))) from work_orders
                                where vendor_id is not null and closed_at is not null and closed_at>=p_from and closed_at<p_to),
    'wo_by_vendor', coalesce((select jsonb_agg(jsonb_build_object('label',vname,'count',c) order by c desc)
        from (select coalesce(v.company_name,'—') vname, count(*)::int c
              from work_orders w left join vendors v on v.id=w.vendor_id
              where w.vendor_id is not null and w.created_at>=p_from and w.created_at<p_to
              group by v.company_name order by count(*) desc limit 15) t), '[]'::jsonb)
  ) into j;
  return j;
end $$;
comment on function public.report_vendors(timestamptz,timestamptz) is
'Phase 9 vendor report (spec §19). Factual only, no subjective scoring. SECURITY INVOKER.';
revoke all on function public.report_vendors(timestamptz,timestamptz) from public;
grant execute on function public.report_vendors(timestamptz,timestamptz) to authenticated;


-- Inventory report (spec §21). FM stock reporting only, no valuation.
create or replace function public.report_inventory(
  p_from timestamptz, p_to timestamptz, p_location uuid default null
) returns jsonb
language plpgsql stable security invoker set search_path to 'public'
as $$
declare j jsonb;
begin
  with inv as (
    select i.id, i.minimum_stock_level, coalesce(sum(b.quantity_on_hand),0) on_hand
    from inventory_items i
    left join inventory_balances b on b.inventory_item_id=i.id
    left join stock_locations sl on sl.id=b.stock_location_id
    where i.is_active and (p_location is null or sl.location_id=p_location or b.stock_location_id is null)
    group by i.id, i.minimum_stock_level
  ),
  mv as (
    select m.movement_type, m.quantity
    from inventory_movements m
    left join stock_locations sl on sl.id=m.stock_location_id
    where m.created_at>=p_from and m.created_at<p_to
      and (p_location is null or sl.location_id=p_location)
  )
  select jsonb_build_object(
    'total_items', (select count(*) from inventory_items where is_active),
    'low_stock', (select count(*) from inv where minimum_stock_level is not null and on_hand>0 and on_hand<=minimum_stock_level),
    'out_of_stock', (select count(*) from inv where on_hand<=0),
    'movements_total', (select count(*) from mv),
    'issued_qty', (select coalesce(sum(quantity),0) from mv where movement_type='issue'),
    'returned_qty', (select coalesce(sum(quantity),0) from mv where movement_type='return'),
    'adjustments', (select count(*) from mv where movement_type in ('adjustment_increase','adjustment_decrease')),
    'transfers', (select count(*) from mv where movement_type in ('transfer_out','transfer_in'))
  ) into j;
  return j;
end $$;
comment on function public.report_inventory(timestamptz,timestamptz,uuid) is
'Phase 9 inventory report (spec §21). FM stock only; no financial valuation (no procurement/cost data). Movements cohort = created in [from,to). SECURITY INVOKER.';
revoke all on function public.report_inventory(timestamptz,timestamptz,uuid) from public;
grant execute on function public.report_inventory(timestamptz,timestamptz,uuid) to authenticated;


-- Parts usage (spec §22). Net Used = Issued - Returned.
create or replace function public.report_parts_usage(
  p_from timestamptz, p_to timestamptz, p_location uuid default null
) returns table(
  item_id uuid, item_code text, item_name text,
  issued_qty numeric, returned_qty numeric, net_used numeric, movement_count int
)
language sql stable security invoker set search_path to 'public'
as $$
  select i.id, i.item_code, i.name,
    coalesce(sum(m.quantity) filter (where m.movement_type='issue'),0),
    coalesce(sum(m.quantity) filter (where m.movement_type='return'),0),
    coalesce(sum(m.quantity) filter (where m.movement_type='issue'),0) - coalesce(sum(m.quantity) filter (where m.movement_type='return'),0),
    count(*)::int
  from inventory_movements m
  join inventory_items i on i.id=m.inventory_item_id
  left join stock_locations sl on sl.id=m.stock_location_id
  where m.created_at>=p_from and m.created_at<p_to
    and m.movement_type in ('issue','return')
    and (p_location is null or sl.location_id=p_location)
  group by i.id, i.item_code, i.name
  having count(*) > 0
  order by (coalesce(sum(m.quantity) filter (where m.movement_type='issue'),0) - coalesce(sum(m.quantity) filter (where m.movement_type='return'),0)) desc;
$$;
comment on function public.report_parts_usage(timestamptz,timestamptz,uuid) is
'Phase 9 parts usage (spec §22). Net Used = Issued - Returned, from Phase 7 movement history. SECURITY INVOKER.';
revoke all on function public.report_parts_usage(timestamptz,timestamptz,uuid) from public;
grant execute on function public.report_parts_usage(timestamptz,timestamptz,uuid) to authenticated;

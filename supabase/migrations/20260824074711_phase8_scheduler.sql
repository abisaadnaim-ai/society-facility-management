-- =====================================================================
-- PHASE 8 (4/6): Scheduler — SLA breach processing + periodic alert checks
-- Hourly SLA checker (§30) + daily alert checks folded into existing daily
-- orchestrator (PPM/inspection generation preserved). All idempotent (§23,§31).
-- Never changes WO status / never auto-closes / never reassigns (§52).
-- =====================================================================

create or replace function public.process_sla_breaches()
returns integer language plpgsql security definer set search_path = public as $$
declare wo record; req record; v_count int := 0; v_live text;
begin
  for wo in
    select w.* from public.work_orders w
    join public.work_order_statuses s on s.id = w.status_id
    where w.closed_at is null and w.resolution_due_at is not null and s.code <> 'cancelled'
  loop
    v_live := public.fm_sla_live_status(wo.sla_resolution_target_minutes, wo.created_at, wo.resolution_due_at, null, false);
    if v_live = 'overdue' then
      if wo.breached_at is null then
        update public.work_orders set breached_at = now() where id = wo.id;
      end if;
      perform public._create_escalation(wo.organization_id,'work_order',wo.id,1,
        'Resolution SLA breached: '||wo.work_order_number, 'res_breach:'||wo.id::text);
      if wo.assigned_to is not null then
        perform public._notify(wo.assigned_to, wo.organization_id,'wo_overdue','Work Order Overdue',
          wo.work_order_number||' has exceeded its resolution target.','work_order',wo.id,'high',
          'wo_overdue:'||wo.id::text,'work_order');
      end if;
      v_count := v_count + 1;
    elsif v_live = 'due_soon' then
      if wo.assigned_to is not null then
        perform public._notify(wo.assigned_to, wo.organization_id,'wo_due_soon','Work Order Due Soon',
          wo.work_order_number||' is approaching its resolution target.','work_order',wo.id,'normal',
          'wo_due_soon:'||wo.id::text,'work_order');
      end if;
    end if;
  end loop;

  for req in
    select r.* from public.fm_requests r
    join public.fm_request_statuses s on s.id = r.status_id
    where r.first_responded_at is null and r.response_due_at is not null
      and s.code in ('new','under_review')
  loop
    v_live := public.fm_sla_live_status(req.sla_response_target_minutes, req.created_at, req.response_due_at, null, false);
    if v_live = 'overdue' then
      perform public._create_escalation(req.organization_id,'fm_request',req.id,1,
        'Response SLA breached: '||req.request_number,'resp_breach:'||req.id::text);
      perform public._notify_roles(req.organization_id, array['facility_manager','super_admin'],
        'response_overdue','Response Overdue',req.request_number||' has no FM response within target.',
        'fm_request',req.id,'high','resp_overdue:'||req.id::text);
      v_count := v_count + 1;
    elsif v_live = 'due_soon' then
      perform public._notify_roles(req.organization_id, array['facility_manager','super_admin'],
        'response_due_soon','Response Due Soon',req.request_number||' is approaching its response target.',
        'fm_request',req.id,'normal','resp_due_soon:'||req.id::text);
    end if;
  end loop;

  return v_count;
end; $$;

create or replace function public.check_contract_expiry()
returns integer language plpgsql security definer set search_path = public as $$
declare c record; v_count int := 0; v_days int; v_thr text; v_pri text;
begin
  for c in select * from public.service_contracts
           where end_date is not null and coalesce(status,'') not in ('cancelled')
  loop
    v_days := c.end_date - current_date; v_thr := null; v_pri := 'normal';
    if v_days < 0 then v_thr := 'expired'; v_pri := 'high';
    elsif v_days <= 30 then v_thr := '30'; v_pri := 'high';
    elsif v_days <= 60 then v_thr := '60';
    elsif v_days <= 90 then v_thr := '90';
    end if;
    if v_thr is not null then
      perform public._notify_roles(c.organization_id, array['facility_manager','super_admin'],
        'contract_expiry',
        case when v_thr='expired' then 'Contract Expired' else 'Contract Expiring Soon' end,
        c.contract_number||' - '||c.name||
          case when v_thr='expired' then ' has expired.' else ' expires in '||v_days||' day(s).' end,
        'service_contract', c.id, v_pri, 'contract_exp:'||c.id::text||':'||v_thr);
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end; $$;

create or replace function public.check_low_stock()
returns integer language plpgsql security definer set search_path = public as $$
declare it record; v_count int := 0; v_total numeric; v_state text;
begin
  for it in select * from public.inventory_items where is_active and coalesce(minimum_stock_level,0) > 0
  loop
    select coalesce(sum(quantity_on_hand),0) into v_total from public.inventory_balances where inventory_item_id = it.id;
    v_state := null;
    if v_total <= 0 then v_state := 'out';
    elsif v_total < it.minimum_stock_level then v_state := 'low';
    end if;
    if v_state is not null then
      perform public._notify_roles(it.organization_id, array['facility_manager','super_admin'],
        case when v_state='out' then 'inventory_out_of_stock' else 'inventory_low_stock' end,
        case when v_state='out' then 'Out of Stock' else 'Low Stock' end,
        it.item_code||' - '||it.name||
          case when v_state='out' then ' is out of stock.'
               else ' is below minimum ('||v_total||'/'||it.minimum_stock_level||').' end,
        'inventory_item', it.id, case when v_state='out' then 'high' else 'normal' end,
        'stock:'||it.id::text||':'||v_state);
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end; $$;

create or replace function public.check_ppm_overdue()
returns integer language plpgsql security definer set search_path = public as $$
declare o record; v_count int := 0;
begin
  for o in select * from public.ppm_occurrences
           where due_date < current_date and work_order_id is null
             and completed_at is null and skipped_at is null
  loop
    perform public._notify_roles(o.organization_id, array['facility_manager','super_admin'],
      'ppm_overdue','PPM Overdue','A preventive maintenance task is overdue.',
      'ppm', o.ppm_plan_id, 'normal', 'ppm_overdue:'||o.id::text);
    v_count := v_count + 1;
  end loop;
  return v_count;
end; $$;

create or replace function public.check_inspection_overdue()
returns integer language plpgsql security definer set search_path = public as $$
declare o record; v_count int := 0;
begin
  for o in select * from public.inspection_occurrences
           where scheduled_date < current_date
             and submitted_at is null and closed_at is null
             and skipped_at is null and cancelled_at is null
  loop
    if o.assigned_to is not null then
      perform public._notify(o.assigned_to, o.organization_id,'inspection_overdue','Inspection Overdue',
        o.inspection_number||' is overdue.','inspection',o.id,'high','insp_overdue:'||o.id::text,'inspection');
    end if;
    perform public._notify_roles(o.organization_id, array['facility_manager','super_admin'],
      'inspection_overdue','Inspection Overdue',o.inspection_number||' is overdue.',
      'inspection',o.id,'normal','insp_overdue_fm:'||o.id::text);
    v_count := v_count + 1;
  end loop;
  return v_count;
end; $$;

create or replace function public.run_hourly_sla_scheduler()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_sla int := 0;
begin
  begin v_sla := public.process_sla_breaches(); exception when others then v_sla := -1; end;
  return jsonb_build_object('sla', v_sla, 'ran_at', now());
end; $$;

create or replace function public.run_daily_maintenance_scheduler()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_ppm int := 0; v_insp int := 0; v_contract int := 0; v_stock int := 0; v_ppmo int := 0; v_inspo int := 0;
begin
  begin v_ppm := public.generate_due_ppm_work_orders(); exception when others then v_ppm := -1; end;
  begin v_insp := public.generate_due_inspections();    exception when others then v_insp := -1; end;
  begin v_contract := public.check_contract_expiry();   exception when others then v_contract := -1; end;
  begin v_stock := public.check_low_stock();            exception when others then v_stock := -1; end;
  begin v_ppmo := public.check_ppm_overdue();           exception when others then v_ppmo := -1; end;
  begin v_inspo := public.check_inspection_overdue();   exception when others then v_inspo := -1; end;
  return jsonb_build_object('ppm', v_ppm, 'inspections', v_insp, 'contract_expiry', v_contract,
    'low_stock', v_stock, 'ppm_overdue', v_ppmo, 'inspection_overdue', v_inspo, 'ran_at', now());
end; $$;

-- Hourly cron job (separate from the daily 02:00 maintenance job) — §30
select cron.schedule('hourly-sla-scheduler', '0 * * * *', 'select public.run_hourly_sla_scheduler();');

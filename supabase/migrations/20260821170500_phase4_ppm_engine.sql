-- ============================================================================
-- PHASE 4: PPM engine -- date math, generation, scheduler, completion sync
-- ============================================================================

-- Calendar-anchored next-date. Always computed from the ORIGINAL start_date so
-- late completion never drifts the schedule; month/year clamp month-end
-- deterministically (Jan 31 -> Feb 28/29 -> Mar 31 ...) and handle leap years.
create or replace function public.ppm_compute_next_due(p_start date, p_unit text, p_interval int, p_after date)
returns date language plpgsql immutable set search_path = public as $$
declare k int := 0; d date;
begin
  if p_interval <= 0 then raise exception 'frequency interval must be positive'; end if;
  if p_start > p_after then return p_start; end if;
  loop
    k := k + 1;
    d := case p_unit
      when 'day'   then p_start + (p_interval * k)
      when 'week'  then p_start + (p_interval * k * 7)
      when 'month' then (p_start + make_interval(months => p_interval * k))::date
      when 'year'  then (p_start + make_interval(years  => p_interval * k))::date
      else null end;
    if d is null then raise exception 'invalid frequency unit: %', p_unit; end if;
    exit when d > p_after;
    if k > 100000 then raise exception 'ppm_compute_next_due exceeded iteration cap'; end if;
  end loop;
  return d;
end; $$;

create or replace function public.ppm_ensure_occurrence(p_plan_id uuid, p_sched date)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_org uuid;
begin
  select organization_id into v_org from public.ppm_plans where id = p_plan_id;
  insert into public.ppm_occurrences (organization_id, ppm_plan_id, scheduled_date, due_date, status)
  values (v_org, p_plan_id, p_sched, p_sched, 'upcoming')
  on conflict (ppm_plan_id, scheduled_date) do nothing;
  select id into v_id from public.ppm_occurrences where ppm_plan_id = p_plan_id and scheduled_date = p_sched;
  return v_id;
end; $$;

create or replace function public.generate_ppm_work_order(p_occurrence_id uuid, p_actor uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare occ public.ppm_occurrences%rowtype; plan public.ppm_plans%rowtype; ast public.assets%rowtype;
        v_status uuid; v_assigned uuid; v_wo uuid; v_new_code text; tech_ok boolean;
begin
  select * into occ from public.ppm_occurrences where id = p_occurrence_id for update;
  if occ.id is null then raise exception 'Occurrence not found.' using errcode='P0002'; end if;
  if occ.work_order_id is not null then return occ.work_order_id; end if;
  if occ.status in ('skipped','cancelled') then
    raise exception 'Cannot generate a work order for a % occurrence.', occ.status using errcode='42501'; end if;
  select * into plan from public.ppm_plans where id = occ.ppm_plan_id;
  if plan.status <> 'active' then
    raise exception 'PPM plan is % and does not generate work orders.', plan.status using errcode='42501'; end if;
  select * into ast from public.assets where id = plan.asset_id;
  if ast.id is null then raise exception 'PPM asset no longer exists.' using errcode='23514'; end if;
  if ast.is_active = false then raise exception 'PPM asset is inactive.' using errcode='23514'; end if;
  v_assigned := null;
  if plan.default_assigned_to is not null then
    select (r.code = 'technician' and p.is_active) into tech_ok
      from public.profiles p join public.roles r on r.id = p.role_id where p.id = plan.default_assigned_to;
    if coalesce(tech_ok, false) then v_assigned := plan.default_assigned_to; end if;
  end if;
  v_new_code := case when v_assigned is not null then 'assigned' else 'new' end;
  select id into v_status from public.work_order_statuses where organization_id = plan.organization_id and code = v_new_code;
  insert into public.work_orders (
    organization_id, location_id, area_id, asset_id, category_id, priority_id, status_id,
    title, description, assigned_to, created_by, due_date, source, ppm_plan_id, ppm_occurrence_id
  ) values (
    plan.organization_id, ast.location_id, ast.area_id, ast.id, plan.category_id, plan.priority_id, v_status,
    plan.name, coalesce(plan.maintenance_instructions, plan.description), v_assigned,
    coalesce(p_actor, plan.created_by), occ.due_date, 'ppm', plan.id, occ.id
  ) returning id into v_wo;
  insert into public.work_order_tasks (organization_id, work_order_id, ppm_plan_task_id, task_description, instructions, is_required, sort_order)
  select plan.organization_id, v_wo, t.id, t.task_description, t.instructions, t.is_required, t.sort_order
  from public.ppm_plan_tasks t where t.ppm_plan_id = plan.id order by t.sort_order;
  update public.ppm_occurrences set work_order_id = v_wo, status = 'work_order_created', generated_at = now() where id = occ.id;
  insert into public.ppm_activity (organization_id, ppm_plan_id, occurrence_id, actor_id, is_system, action, metadata)
  values (plan.organization_id, plan.id, occ.id, p_actor, p_actor is null, 'work_order_generated',
          jsonb_build_object('work_order_id', v_wo, 'assigned', v_assigned is not null));
  return v_wo;
end; $$;

create or replace function public.generate_due_ppm_work_orders()
returns integer language plpgsql security definer set search_path=public as $$
declare r record; v_occ uuid; v_count int := 0; today date := current_date;
begin
  for r in select * from public.ppm_plans
    where status = 'active' and next_due_date is not null and (next_due_date - lead_time_days) <= today
  loop
    begin
      v_occ := public.ppm_ensure_occurrence(r.id, r.next_due_date);
      update public.ppm_occurrences set status = 'due' where id = v_occ and status = 'upcoming' and today >= scheduled_date;
      if (select work_order_id from public.ppm_occurrences where id = v_occ) is null then
        perform public.generate_ppm_work_order(v_occ, null);
        v_count := v_count + 1;
      end if;
    exception when others then
      insert into public.ppm_activity (organization_id, ppm_plan_id, is_system, action, metadata)
      values (r.organization_id, r.id, true, 'generation_failed', jsonb_build_object('error', sqlerrm));
    end;
  end loop;
  return v_count;
end; $$;

create or replace function public.enforce_wo_task_completion()
returns trigger language plpgsql security definer set search_path=public as $$
declare new_code text; incomplete int;
begin
  select code into new_code from public.work_order_statuses where id = new.status_id;
  if new_code = 'completed' then
    select count(*) into incomplete from public.work_order_tasks
      where work_order_id = new.id and is_required = true and is_completed = false;
    if incomplete > 0 then
      raise exception 'All required maintenance tasks must be completed first (% remaining).', incomplete using errcode='23514';
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists enforce_wo_task_completion on public.work_orders;
create trigger enforce_wo_task_completion before update on public.work_orders
  for each row execute function public.enforce_wo_task_completion();

create or replace function public.sync_ppm_on_wo_close()
returns trigger language plpgsql security definer set search_path=public as $$
declare old_code text; new_code text; plan public.ppm_plans%rowtype; occ public.ppm_occurrences%rowtype; v_next date;
begin
  if new.source <> 'ppm' or new.ppm_occurrence_id is null then return new; end if;
  select code into old_code from public.work_order_statuses where id = old.status_id;
  select code into new_code from public.work_order_statuses where id = new.status_id;
  if new_code = 'closed' and old_code is distinct from 'closed' then
    select * into occ from public.ppm_occurrences where id = new.ppm_occurrence_id;
    select * into plan from public.ppm_plans where id = new.ppm_plan_id;
    update public.ppm_occurrences set status = 'completed', completed_at = now() where id = occ.id and status <> 'completed';
    v_next := public.ppm_compute_next_due(plan.start_date, plan.frequency_unit, plan.frequency_interval, occ.scheduled_date);
    update public.ppm_plans set last_completed_at = now(), next_due_date = v_next where id = plan.id;
    perform public.ppm_ensure_occurrence(plan.id, v_next);
    insert into public.ppm_activity (organization_id, ppm_plan_id, occurrence_id, actor_id, action, metadata)
    values (plan.organization_id, plan.id, occ.id, auth.uid(), 'occurrence_completed',
            jsonb_build_object('work_order_id', new.id, 'next_due_date', v_next));
  end if;
  return new;
end; $$;
drop trigger if exists sync_ppm_on_wo_close on public.work_orders;
create trigger sync_ppm_on_wo_close after update on public.work_orders
  for each row execute function public.sync_ppm_on_wo_close();

create or replace function public.ppm_after_plan_insert()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  perform public.ppm_ensure_occurrence(new.id, new.next_due_date);
  insert into public.ppm_activity (organization_id, ppm_plan_id, actor_id, action, metadata)
  values (new.organization_id, new.id, auth.uid(), 'plan_created',
          jsonb_build_object('ppm_number', new.ppm_number, 'frequency', new.frequency_interval || ' ' || new.frequency_unit));
  return new;
end; $$;
drop trigger if exists ppm_after_plan_insert on public.ppm_plans;
create trigger ppm_after_plan_insert after insert on public.ppm_plans
  for each row execute function public.ppm_after_plan_insert();

create or replace function public.ppm_generate_now(p_occurrence_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_org uuid; occ_org uuid;
begin
  if not public.can_manage_facility() then raise exception 'Not authorized.' using errcode='42501'; end if;
  v_org := public.current_user_organization_id();
  select organization_id into occ_org from public.ppm_occurrences where id = p_occurrence_id;
  if occ_org is distinct from v_org then raise exception 'Occurrence not found.' using errcode='P0002'; end if;
  return public.generate_ppm_work_order(p_occurrence_id, auth.uid());
end; $$;

create or replace function public.ppm_skip_occurrence(p_occurrence_id uuid, p_reason text)
returns void language plpgsql security definer set search_path=public as $$
declare occ public.ppm_occurrences%rowtype; plan public.ppm_plans%rowtype; v_next date;
begin
  if not public.can_manage_facility() then raise exception 'Not authorized.' using errcode='42501'; end if;
  if p_reason is null or btrim(p_reason)='' then raise exception 'A reason is required to skip.' using errcode='22000'; end if;
  select * into occ from public.ppm_occurrences where id = p_occurrence_id for update;
  if occ.id is null or occ.organization_id <> public.current_user_organization_id() then
    raise exception 'Occurrence not found.' using errcode='P0002'; end if;
  if occ.work_order_id is not null then raise exception 'This occurrence already has a work order.' using errcode='42501'; end if;
  if occ.status in ('completed','skipped','cancelled') then raise exception 'This occurrence cannot be skipped.' using errcode='42501'; end if;
  update public.ppm_occurrences set status='skipped', skipped_at=now(), skipped_by=auth.uid(), skip_reason=btrim(p_reason) where id=occ.id;
  select * into plan from public.ppm_plans where id = occ.ppm_plan_id;
  v_next := public.ppm_compute_next_due(plan.start_date, plan.frequency_unit, plan.frequency_interval, occ.scheduled_date);
  update public.ppm_plans set next_due_date = v_next where id = plan.id and status='active';
  perform public.ppm_ensure_occurrence(plan.id, v_next);
  insert into public.ppm_activity (organization_id, ppm_plan_id, occurrence_id, actor_id, action, new_value, metadata)
  values (plan.organization_id, plan.id, occ.id, auth.uid(), 'occurrence_skipped', btrim(p_reason),
          jsonb_build_object('next_due_date', v_next));
end; $$;

create or replace function public.ppm_set_plan_status(p_plan_id uuid, p_status text)
returns void language plpgsql security definer set search_path=public as $$
declare plan public.ppm_plans%rowtype;
begin
  if not public.can_manage_facility() then raise exception 'Not authorized.' using errcode='42501'; end if;
  if p_status not in ('active','paused','archived') then raise exception 'Invalid status.' using errcode='22000'; end if;
  select * into plan from public.ppm_plans where id = p_plan_id;
  if plan.id is null or plan.organization_id <> public.current_user_organization_id() then
    raise exception 'Plan not found.' using errcode='P0002'; end if;
  update public.ppm_plans set status = p_status where id = p_plan_id;
  insert into public.ppm_activity (organization_id, ppm_plan_id, actor_id, action, field_name, old_value, new_value)
  values (plan.organization_id, plan.id, auth.uid(),
          case p_status when 'paused' then 'plan_paused' when 'archived' then 'plan_archived' else 'plan_resumed' end,
          'status', plan.status, p_status);
end; $$;

revoke execute on function public.ppm_compute_next_due(date,text,int,date) from public, anon, authenticated;
revoke execute on function public.ppm_ensure_occurrence(uuid,date) from public, anon, authenticated;
revoke execute on function public.generate_ppm_work_order(uuid,uuid) from public, anon, authenticated;
revoke execute on function public.generate_due_ppm_work_orders() from public, anon, authenticated;
revoke execute on function public.ppm_generate_now(uuid) from public, anon;
revoke execute on function public.ppm_skip_occurrence(uuid,text) from public, anon;
revoke execute on function public.ppm_set_plan_status(uuid,text) from public, anon;
grant execute on function public.ppm_generate_now(uuid) to authenticated;
grant execute on function public.ppm_skip_occurrence(uuid,text) to authenticated;
grant execute on function public.ppm_set_plan_status(uuid,text) to authenticated;

-- Daily in-database scheduler (pg_cron). Idempotent; no external secret/service-role key.
select cron.schedule('ppm-daily-generation', '0 2 * * *', $cron$ select public.generate_due_ppm_work_orders(); $cron$);

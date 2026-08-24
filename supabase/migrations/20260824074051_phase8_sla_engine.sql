-- =====================================================================
-- PHASE 8 (2/6): SLA engine — resolver, snapshot triggers, status derivation
-- Response SLA anchor: fm_requests.created_at -> first response (reviewed_at)
-- Resolution SLA anchor: work_orders.created_at -> closed_at (NOT completed)
-- Targets are SNAPSHOT onto the record at insert (§50 historical integrity).
-- Priority change before finalize recalculates from ORIGINAL created_at (§12).
-- Due Soon = 75% of target consumed (§10).
-- NOTE: the fm_request activity column name is corrected in the following
-- migration (phase8_sla_engine_fix_activity_col).
-- =====================================================================

create or replace function public.fm_sla_due_soon_fraction()
returns numeric language sql immutable set search_path = public as $$ select 0.75::numeric $$;

create or replace function public._fm_resolve_sla_rule(p_org uuid, p_priority uuid)
returns public.fm_sla_rules language sql stable security definer set search_path = public as $$
  select r.* from public.fm_sla_rules r
  where r.organization_id = p_org
    and r.priority_id = p_priority
    and r.is_active
    and (r.effective_from is null or r.effective_from <= now())
    and (r.effective_to   is null or r.effective_to   >= now())
  order by r.effective_from desc nulls last
  limit 1;
$$;

create or replace function public.fm_sla_live_status(
  p_target_minutes integer, p_start timestamptz, p_due timestamptz,
  p_done timestamptz, p_cancelled boolean)
returns text language sql stable set search_path = public as $$
  select case
    when p_cancelled then 'not_applicable'
    when p_target_minutes is null or p_due is null then 'not_applicable'
    when p_done is not null then (case when p_done <= p_due then 'met' else 'breached' end)
    when now() > p_due then 'overdue'
    when now() >= (p_start + ((p_due - p_start) * public.fm_sla_due_soon_fraction())) then 'due_soon'
    else 'within'
  end;
$$;

-- ---------------- FM REQUEST: response SLA ----------------
create or replace function public._fm_request_sla_on_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare r public.fm_sla_rules;
begin
  if new.priority_id is not null then
    r := public._fm_resolve_sla_rule(new.organization_id, new.priority_id);
    if r.id is not null and r.applies_to_request then
      new.sla_response_target_minutes := r.response_minutes;
      new.response_due_at := new.created_at + make_interval(mins => r.response_minutes);
      new.response_sla_status := 'pending';
    else
      new.response_sla_status := 'not_applicable';
    end if;
  else
    new.response_sla_status := 'not_applicable';
  end if;
  return new;
end; $$;

create or replace function public._fm_request_sla_on_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare r public.fm_sla_rules; v_first timestamptz;
begin
  if new.priority_id is distinct from old.priority_id and old.first_responded_at is null then
    if new.priority_id is not null then
      r := public._fm_resolve_sla_rule(new.organization_id, new.priority_id);
      if r.id is not null and r.applies_to_request then
        new.sla_response_target_minutes := r.response_minutes;
        new.response_due_at := new.created_at + make_interval(mins => r.response_minutes);
        if new.response_sla_status = 'not_applicable' then new.response_sla_status := 'pending'; end if;
      end if;
    end if;
    insert into public.fm_request_activity(organization_id, fm_request_id, actor_id, action, field_name, old_value, new_value, metadata)
    values (new.organization_id, new.id, auth.uid(), 'sla_recalculated', 'priority_id',
            old.priority_id::text, new.priority_id::text,
            jsonb_build_object('response_due_at', new.response_due_at, 'target_minutes', new.sla_response_target_minutes));
  end if;

  if old.first_responded_at is null then
    v_first := null;
    if new.reviewed_at is not null and old.reviewed_at is null then
      v_first := new.reviewed_at;
    elsif new.status_id is distinct from old.status_id then
      if exists (select 1 from public.fm_request_statuses s where s.id = new.status_id and s.code <> 'new') then
        v_first := now();
      end if;
    end if;
    if v_first is not null then
      new.first_responded_at := v_first;
      if new.response_due_at is not null then
        new.response_sla_status := case when v_first <= new.response_due_at then 'met' else 'breached' end;
      end if;
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists trg_fm_request_sla_ins on public.fm_requests;
create trigger trg_fm_request_sla_ins before insert on public.fm_requests
  for each row execute function public._fm_request_sla_on_insert();
drop trigger if exists trg_fm_request_sla_upd on public.fm_requests;
create trigger trg_fm_request_sla_upd before update on public.fm_requests
  for each row execute function public._fm_request_sla_on_update();

-- ---------------- WORK ORDER: resolution SLA ----------------
create or replace function public._work_order_sla_on_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare r public.fm_sla_rules;
begin
  r := public._fm_resolve_sla_rule(new.organization_id, new.priority_id);
  if r.id is not null and r.applies_to_work_order then
    new.sla_resolution_target_minutes := r.resolution_minutes;
    new.resolution_due_at := new.created_at + make_interval(mins => r.resolution_minutes);
    new.resolution_sla_status := 'pending';
  else
    new.resolution_sla_status := 'not_applicable';
  end if;
  return new;
end; $$;

create or replace function public._work_order_sla_on_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare r public.fm_sla_rules; v_cancelled boolean;
begin
  if new.priority_id is distinct from old.priority_id and old.closed_at is null then
    r := public._fm_resolve_sla_rule(new.organization_id, new.priority_id);
    if r.id is not null and r.applies_to_work_order then
      new.sla_resolution_target_minutes := r.resolution_minutes;
      new.resolution_due_at := new.created_at + make_interval(mins => r.resolution_minutes);
      if new.resolution_sla_status = 'not_applicable' then new.resolution_sla_status := 'pending'; end if;
    end if;
    insert into public.work_order_activity(organization_id, work_order_id, actor_id, action, field_name, old_value, new_value, metadata)
    values (new.organization_id, new.id, auth.uid(), 'sla_recalculated', 'priority_id',
            old.priority_id::text, new.priority_id::text,
            jsonb_build_object('resolution_due_at', new.resolution_due_at, 'target_minutes', new.sla_resolution_target_minutes));
  end if;

  if new.closed_at is not null and old.closed_at is null then
    v_cancelled := exists (select 1 from public.work_order_statuses s where s.id = new.status_id and s.code = 'cancelled');
    if new.resolution_due_at is not null and not v_cancelled then
      new.resolution_sla_status := case when new.closed_at <= new.resolution_due_at then 'met' else 'breached' end;
      if new.closed_at > new.resolution_due_at and new.breached_at is null then
        new.breached_at := new.closed_at;
      end if;
    elsif v_cancelled then
      new.resolution_sla_status := 'not_applicable';
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists trg_work_order_sla_ins on public.work_orders;
create trigger trg_work_order_sla_ins before insert on public.work_orders
  for each row execute function public._work_order_sla_on_insert();
drop trigger if exists trg_work_order_sla_upd on public.work_orders;
create trigger trg_work_order_sla_upd before update on public.work_orders
  for each row execute function public._work_order_sla_on_update();

-- ---------------- Backfill existing records (lateral) ----------------
update public.fm_requests fr
set sla_response_target_minutes = sub.response_minutes,
    response_due_at = fr.created_at + make_interval(mins => sub.response_minutes),
    first_responded_at = coalesce(fr.first_responded_at, fr.reviewed_at),
    response_sla_status = case
      when coalesce(fr.first_responded_at, fr.reviewed_at) is not null then
        case when coalesce(fr.first_responded_at, fr.reviewed_at) <= fr.created_at + make_interval(mins => sub.response_minutes) then 'met' else 'breached' end
      else 'pending' end
from (
  select fr2.id, r.response_minutes
  from public.fm_requests fr2
  cross join lateral public._fm_resolve_sla_rule(fr2.organization_id, fr2.priority_id) r
  where fr2.priority_id is not null and fr2.sla_response_target_minutes is null
    and r.id is not null and r.applies_to_request
) sub
where fr.id = sub.id;

update public.work_orders wo
set sla_resolution_target_minutes = sub.resolution_minutes,
    resolution_due_at = wo.created_at + make_interval(mins => sub.resolution_minutes),
    resolution_sla_status = case
      when wo.closed_at is not null then
        case when wo.closed_at <= wo.created_at + make_interval(mins => sub.resolution_minutes) then 'met' else 'breached' end
      else 'pending' end
from (
  select wo2.id, r.resolution_minutes
  from public.work_orders wo2
  cross join lateral public._fm_resolve_sla_rule(wo2.organization_id, wo2.priority_id) r
  where wo2.sla_resolution_target_minutes is null
    and r.id is not null and r.applies_to_work_order
) sub
where wo.id = sub.id;

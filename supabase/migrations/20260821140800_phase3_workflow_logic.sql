-- Phase 3 workflow logic enforced in the database: audit loggers, technician
-- transition/column guards, and automatic FM Request status sync.

-- ---- Activity loggers (SECURITY DEFINER; activity tables have no client INSERT policy) ----
create or replace function public.log_fm_request_activity(
  p_request_id uuid, p_action text, p_field_name text default null,
  p_old_value text default null, p_new_value text default null, p_metadata jsonb default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare req_org uuid; new_id uuid;
begin
  select organization_id into req_org from public.fm_requests where id = p_request_id;
  if req_org is null then raise exception 'FM request % not found.', p_request_id using errcode = '23503'; end if;
  if public.current_user_organization_id() is distinct from req_org then
    raise exception 'Cannot log activity outside your organization.' using errcode = '42501';
  end if;
  insert into public.fm_request_activity (organization_id, request_id, actor_id, action, field_name, old_value, new_value, metadata)
  values (req_org, p_request_id, auth.uid(), p_action, p_field_name, p_old_value, p_new_value, p_metadata)
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.log_work_order_activity(
  p_work_order_id uuid, p_action text, p_field_name text default null,
  p_old_value text default null, p_new_value text default null, p_metadata jsonb default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare wo_org uuid; new_id uuid;
begin
  select organization_id into wo_org from public.work_orders where id = p_work_order_id;
  if wo_org is null then raise exception 'Work order % not found.', p_work_order_id using errcode = '23503'; end if;
  if public.current_user_organization_id() is distinct from wo_org then
    raise exception 'Cannot log activity outside your organization.' using errcode = '42501';
  end if;
  insert into public.work_order_activity (organization_id, work_order_id, actor_id, action, field_name, old_value, new_value, metadata)
  values (wo_org, p_work_order_id, auth.uid(), p_action, p_field_name, p_old_value, p_new_value, p_metadata)
  returning id into new_id;
  return new_id;
end;
$$;

-- ---- Work Order transition + column guard (BEFORE UPDATE) ----
create or replace function public.enforce_work_order_transition()
returns trigger language plpgsql security definer set search_path = public as $$
declare old_code text; new_code text; role text; me uuid;
begin
  me := auth.uid();
  role := public.current_user_role_code();
  select code into old_code from public.work_order_statuses where id = old.status_id;
  select code into new_code from public.work_order_statuses where id = new.status_id;

  -- Completion always requires notes, regardless of who does it.
  if new_code = 'completed' and (new.completion_notes is null or btrim(new.completion_notes) = '') then
    raise exception 'Completion notes are required to mark a work order completed.' using errcode = '23514';
  end if;

  if role = 'technician' then
    if old.assigned_to is distinct from me then
      raise exception 'You can only update work orders assigned to you.' using errcode = '42501';
    end if;
    if new.assigned_to is distinct from old.assigned_to
       or new.priority_id is distinct from old.priority_id
       or new.category_id is distinct from old.category_id
       or new.location_id is distinct from old.location_id
       or new.area_id is distinct from old.area_id
       or new.asset_id is distinct from old.asset_id
       or new.due_date is distinct from old.due_date
       or new.title is distinct from old.title
       or new.description is distinct from old.description
       or new.fm_request_id is distinct from old.fm_request_id
       or new.verified_by is distinct from old.verified_by
       or new.verified_at is distinct from old.verified_at
       or new.verification_notes is distinct from old.verification_notes
       or new.closed_by is distinct from old.closed_by
       or new.closed_at is distinct from old.closed_at
       or new.cancellation_reason is distinct from old.cancellation_reason then
      raise exception 'Technicians can only change execution status and completion notes.' using errcode = '42501';
    end if;
    if not (
         (old_code = 'assigned' and new_code = 'in_progress')
      or (old_code = 'in_progress' and new_code in ('on_hold','waiting_parts','waiting_vendor','waiting_procurement','waiting_approval','completed','in_progress'))
      or (old_code in ('on_hold','waiting_parts','waiting_vendor','waiting_procurement','waiting_approval') and new_code in ('in_progress', old_code))
      or (old_code = new_code)
    ) then
      raise exception 'That status change is not permitted for a technician.' using errcode = '42501';
    end if;
    if new_code <> old_code and new_code in ('verified','closed','cancelled','new','assigned') then
      raise exception 'Technicians cannot verify, close, cancel, or reassign a work order.' using errcode = '42501';
    end if;
  end if;

  -- Timestamp automation for any authorized actor.
  if new_code = 'in_progress' and new.started_at is null then new.started_at := now(); end if;
  if new_code = 'completed' then new.completed_at := coalesce(new.completed_at, now()); end if;
  if new_code = 'verified' then
    new.verified_at := coalesce(new.verified_at, now());
    new.verified_by := coalesce(new.verified_by, me);
  end if;
  if new_code = 'closed' then
    new.closed_at := coalesce(new.closed_at, now());
    new.closed_by := coalesce(new.closed_by, me);
  end if;

  return new;
end;
$$;
create trigger enforce_work_order_transition before update on public.work_orders for each row execute function public.enforce_work_order_transition();

-- ---- Sync linked FM Request when a Work Order is created ----
create or replace function public.sync_request_on_wo_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare req_code text; target uuid;
begin
  if new.fm_request_id is not null then
    select frs.code into req_code
      from public.fm_requests r join public.fm_request_statuses frs on frs.id = r.status_id
     where r.id = new.fm_request_id;
    if req_code in ('new','under_review') then
      select id into target from public.fm_request_statuses
        where organization_id = new.organization_id and code = 'work_order_created';
      update public.fm_requests set status_id = target where id = new.fm_request_id;
      perform public.log_fm_request_activity(new.fm_request_id, 'work_order_created', 'status', req_code, 'work_order_created',
        jsonb_build_object('work_order_id', new.id, 'work_order_number', new.work_order_number));
    end if;
  end if;
  return new;
end;
$$;
create trigger sync_request_on_wo_insert after insert on public.work_orders for each row execute function public.sync_request_on_wo_insert();

-- ---- Auto-close linked FM Request when its Work Order is closed ----
create or replace function public.sync_request_on_wo_close()
returns trigger language plpgsql security definer set search_path = public as $$
declare old_code text; new_code text; req_code text; target uuid;
begin
  select code into old_code from public.work_order_statuses where id = old.status_id;
  select code into new_code from public.work_order_statuses where id = new.status_id;
  if new_code = 'closed' and old_code is distinct from 'closed' and new.fm_request_id is not null then
    select frs.code into req_code
      from public.fm_requests r join public.fm_request_statuses frs on frs.id = r.status_id
     where r.id = new.fm_request_id;
    if req_code not in ('rejected','cancelled','closed') then
      select id into target from public.fm_request_statuses
        where organization_id = new.organization_id and code = 'closed';
      update public.fm_requests set status_id = target, closed_at = now() where id = new.fm_request_id;
      perform public.log_fm_request_activity(new.fm_request_id, 'closed', 'status', req_code, 'closed',
        jsonb_build_object('work_order_id', new.id, 'work_order_number', new.work_order_number, 'reason', 'linked work order closed'));
    end if;
  end if;
  return new;
end;
$$;
create trigger sync_request_on_wo_close after update on public.work_orders for each row execute function public.sync_request_on_wo_close();

-- Grants
revoke execute on function public.log_fm_request_activity(uuid, text, text, text, text, jsonb) from public, anon;
revoke execute on function public.log_work_order_activity(uuid, text, text, text, text, jsonb) from public, anon;
grant execute on function public.log_fm_request_activity(uuid, text, text, text, text, jsonb) to authenticated;
grant execute on function public.log_work_order_activity(uuid, text, text, text, text, jsonb) to authenticated;
revoke execute on function public.enforce_work_order_transition() from public, anon, authenticated;
revoke execute on function public.sync_request_on_wo_insert() from public, anon, authenticated;
revoke execute on function public.sync_request_on_wo_close() from public, anon, authenticated;

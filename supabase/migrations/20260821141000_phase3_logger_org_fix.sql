-- Harden the activity loggers: only block cross-organization logging when an
-- authenticated org context is actually present. Internal SECURITY DEFINER
-- trigger paths (sync_request_on_wo_insert / _close) always operate within the
-- acting user's org, so the strict equality is unnecessary there and must not
-- break when no JWT org is resolvable. Authenticated cross-org attempts are
-- still rejected.
create or replace function public.log_fm_request_activity(
  p_request_id uuid, p_action text, p_field_name text default null,
  p_old_value text default null, p_new_value text default null, p_metadata jsonb default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare req_org uuid; caller_org uuid; new_id uuid;
begin
  select organization_id into req_org from public.fm_requests where id = p_request_id;
  if req_org is null then raise exception 'FM request % not found.', p_request_id using errcode = '23503'; end if;
  caller_org := public.current_user_organization_id();
  if caller_org is not null and caller_org is distinct from req_org then
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
declare wo_org uuid; caller_org uuid; new_id uuid;
begin
  select organization_id into wo_org from public.work_orders where id = p_work_order_id;
  if wo_org is null then raise exception 'Work order % not found.', p_work_order_id using errcode = '23503'; end if;
  caller_org := public.current_user_organization_id();
  if caller_org is not null and caller_org is distinct from wo_org then
    raise exception 'Cannot log activity outside your organization.' using errcode = '42501';
  end if;
  insert into public.work_order_activity (organization_id, work_order_id, actor_id, action, field_name, old_value, new_value, metadata)
  values (wo_org, p_work_order_id, auth.uid(), p_action, p_field_name, p_old_value, p_new_value, p_metadata)
  returning id into new_id;
  return new_id;
end;
$$;

revoke execute on function public.log_fm_request_activity(uuid, text, text, text, text, jsonb) from public, anon;
revoke execute on function public.log_work_order_activity(uuid, text, text, text, text, jsonb) from public, anon;
grant execute on function public.log_fm_request_activity(uuid, text, text, text, text, jsonb) to authenticated;
grant execute on function public.log_work_order_activity(uuid, text, text, text, text, jsonb) to authenticated;

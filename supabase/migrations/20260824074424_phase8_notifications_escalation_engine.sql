-- =====================================================================
-- PHASE 8 (3/6): Notifications + Escalation engine (in-app only)
-- Reliable DB-trigger creation (§22); idempotent (§23); role-aware (§21);
-- requester-safe (§28); deep links (§25); escalation create/auto-resolve (§32-34).
-- =====================================================================

-- Deep-link builder (§25)
create or replace function public._entity_link(p_type text, p_id uuid)
returns text language sql immutable set search_path = public as $$
  select case p_type
    when 'fm_request'       then '/fm-requests/'          || p_id::text
    when 'work_order'       then '/work-orders/'          || p_id::text
    when 'ppm'              then '/preventive-maintenance/'|| p_id::text
    when 'inspection'       then '/inspections/'          || p_id::text
    when 'service_contract' then '/vendors/contracts/'    || p_id::text
    when 'inventory_item'   then '/inventory/'            || p_id::text
    else null end;
$$;

-- Single-user notification (respects prefs; critical always delivered) — §44
create or replace function public._notify(
  p_user uuid, p_org uuid, p_type text, p_title text, p_msg text,
  p_etype text, p_eid uuid, p_priority text default 'normal',
  p_dedup text default null, p_category text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user is null then return; end if;
  if p_priority <> 'critical' and p_category is not null then
    if exists (select 1 from public.notification_preferences np
               where np.user_id = p_user and np.category = p_category and np.in_app_enabled = false) then
      return;
    end if;
  end if;
  insert into public.notifications(organization_id,user_id,notification_type,title,message,
    entity_type,entity_id,link_url,priority,dedup_key)
  values (p_org,p_user,p_type,p_title,p_msg,p_etype,p_eid,
          public._entity_link(p_etype,p_eid),p_priority,p_dedup)
  on conflict (user_id, dedup_key) where dedup_key is not null do nothing;
end; $$;

-- Broadcast to all active users holding any of the given role codes (§17,§21)
create or replace function public._notify_roles(
  p_org uuid, p_roles text[], p_type text, p_title text, p_msg text,
  p_etype text, p_eid uuid, p_priority text default 'normal', p_dedup text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications(organization_id,user_id,notification_type,title,message,
    entity_type,entity_id,link_url,priority,dedup_key)
  select p_org, pr.id, p_type, p_title, p_msg, p_etype, p_eid,
         public._entity_link(p_etype,p_eid), p_priority, p_dedup
  from public.profiles pr join public.roles ro on ro.id = pr.role_id
  where pr.organization_id = p_org and pr.is_active and ro.code = any(p_roles)
  on conflict (user_id, dedup_key) where dedup_key is not null do nothing;
end; $$;

-- Create an escalation (idempotent per open condition) + notify target role + audit — §32,§33
create or replace function public._create_escalation(
  p_org uuid, p_etype text, p_eid uuid, p_level int, p_reason text,
  p_dedup text, p_rule_id uuid default null, p_target_roles text[] default array['facility_manager','super_admin'])
returns void language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into public.fm_escalations(organization_id,entity_type,entity_id,rule_id,escalation_level,reason,dedup_key)
  values (p_org,p_etype,p_eid,p_rule_id,p_level,p_reason,p_dedup)
  on conflict (organization_id, dedup_key) where resolved_at is null do nothing
  returning id into v_id;

  if v_id is null then return; end if;

  if p_etype = 'work_order' then
    update public.work_orders set escalation_level = greatest(coalesce(escalation_level,0), p_level)
    where id = p_eid;
  end if;

  perform public._notify_roles(p_org, p_target_roles, 'escalation',
    'Escalation (Level ' || p_level || ')', p_reason, p_etype, p_eid, 'high',
    'escalation:' || v_id::text);
end; $$;

-- Auto-resolve open escalations when the underlying condition clears (§34)
create or replace function public._resolve_escalations(p_etype text, p_eid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.fm_escalations
  set resolved_at = now()
  where entity_type = p_etype and entity_id = p_eid and resolved_at is null;
end; $$;

-- ---------------- FM REQUEST triggers ----------------
create or replace function public._fm_request_notify_ins()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_crit boolean;
begin
  v_crit := exists (select 1 from public.fm_priorities p where p.id = new.priority_id and p.code = 'critical');
  perform public._notify_roles(new.organization_id, array['facility_manager','super_admin'],
    'fm_request_new',
    case when v_crit then 'Critical FM Request' else 'New FM Request' end,
    new.request_number || ' - ' || new.title,
    'fm_request', new.id, case when v_crit then 'critical' else 'normal' end,
    'req_new:' || new.id::text);
  if v_crit then
    perform public._create_escalation(new.organization_id, 'fm_request', new.id, 1,
      'Critical FM Request created: ' || new.request_number,
      'crit_req:' || new.id::text);
  end if;
  return null;
end; $$;

create or replace function public._fm_request_notify_upd()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  if new.status_id is distinct from old.status_id then
    select code into v_code from public.fm_request_statuses where id = new.status_id;
    if v_code = 'closed' then
      perform public._notify(new.requested_by, new.organization_id, 'fm_request_closed',
        'Request Closed', new.request_number || ' has been closed.',
        'fm_request', new.id, 'normal', 'req_closed:' || new.id::text, 'fm_request');
      perform public._resolve_escalations('fm_request', new.id);
    elsif v_code in ('under_review','work_order_created','rejected') then
      perform public._notify(new.requested_by, new.organization_id, 'fm_request_update',
        'Request Update', new.request_number || ' status: ' ||
        (select name from public.fm_request_statuses where id=new.status_id),
        'fm_request', new.id, 'normal', 'req_status:' || new.id::text || ':' || v_code, 'fm_request');
    end if;
  end if;
  return null;
end; $$;

drop trigger if exists trg_fm_request_notify_ins on public.fm_requests;
create trigger trg_fm_request_notify_ins after insert on public.fm_requests
  for each row execute function public._fm_request_notify_ins();
drop trigger if exists trg_fm_request_notify_upd on public.fm_requests;
create trigger trg_fm_request_notify_upd after update on public.fm_requests
  for each row execute function public._fm_request_notify_upd();

-- ---------------- WORK ORDER triggers ----------------
create or replace function public._work_order_notify_ins()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_crit boolean;
begin
  if new.assigned_to is not null then
    perform public._notify(new.assigned_to, new.organization_id, 'wo_assigned',
      'Work Order Assigned', new.work_order_number || ' - ' || new.title,
      'work_order', new.id, 'high', 'wo_assigned:' || new.id::text || ':' || new.assigned_to::text, 'work_order');
  end if;
  v_crit := exists (select 1 from public.fm_priorities p where p.id = new.priority_id and p.code = 'critical');
  if v_crit then
    perform public._notify_roles(new.organization_id, array['facility_manager','super_admin'],
      'wo_critical', 'Critical Work Order', new.work_order_number || ' - ' || new.title,
      'work_order', new.id, 'critical', 'wo_crit:' || new.id::text);
    perform public._create_escalation(new.organization_id, 'work_order', new.id, 1,
      'Critical Work Order open: ' || new.work_order_number, 'crit_wo:' || new.id::text);
  end if;
  return null;
end; $$;

create or replace function public._work_order_notify_upd()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_new text; v_old text;
begin
  if new.assigned_to is distinct from old.assigned_to and new.assigned_to is not null then
    perform public._notify(new.assigned_to, new.organization_id, 'wo_reassigned',
      'Work Order Assigned', new.work_order_number || ' - ' || new.title,
      'work_order', new.id, 'high', 'wo_assigned:' || new.id::text || ':' || new.assigned_to::text, 'work_order');
  end if;

  if new.status_id is distinct from old.status_id then
    select code into v_new from public.work_order_statuses where id = new.status_id;
    select code into v_old from public.work_order_statuses where id = old.status_id;

    if v_new = 'completed' then
      perform public._notify_roles(new.organization_id, array['facility_manager','super_admin'],
        'wo_awaiting_verification', 'Work Order Awaiting Verification',
        new.work_order_number || ' completed by technician.',
        'work_order', new.id, 'high', 'wo_await_verif:' || new.id::text);
    elsif v_new = 'closed' then
      perform public._resolve_escalations('work_order', new.id);
    elsif v_old = 'completed' and v_new in ('assigned','in_progress') and new.assigned_to is not null then
      perform public._notify(new.assigned_to, new.organization_id, 'wo_returned',
        'Work Order Returned', new.work_order_number || ' returned for further work.',
        'work_order', new.id, 'high', 'wo_returned:' || new.id::text || ':' || v_new, 'work_order');
    end if;
  end if;
  return null;
end; $$;

drop trigger if exists trg_work_order_notify_ins on public.work_orders;
create trigger trg_work_order_notify_ins after insert on public.work_orders
  for each row execute function public._work_order_notify_ins();
drop trigger if exists trg_work_order_notify_upd on public.work_orders;
create trigger trg_work_order_notify_upd after update on public.work_orders
  for each row execute function public._work_order_notify_upd();

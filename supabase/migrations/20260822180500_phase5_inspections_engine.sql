-- ============================================================================
-- PHASE 5: Inspections engine
--   * occurrence generation + immutable template snapshot (idempotent)
--   * generate_due_inspections() -- modular inspection processing
--   * run_daily_maintenance_scheduler() -- SINGLE daily orchestrator that runs
--     PPM processing then Inspection processing; the one pg_cron job calls this.
--     The PPM processing function itself is unchanged (no regression).
--   * server-side submission validation (required / allow_na / comment / photo)
--   * one Finding per failed response (idempotent via unique(response_id))
--   * lifecycle + corrective-action RPCs
-- Reuses public.ppm_compute_next_due() -- no second recurrence engine.
-- ============================================================================

-- ---------- occurrence generation + immutable snapshot (idempotent) ----------
create or replace function public.inspection_ensure_occurrence(p_schedule_id uuid, p_sched date)
returns uuid language plpgsql security definer set search_path=public as $$
declare s public.inspection_schedules%rowtype; t public.inspection_templates%rowtype; v_id uuid; v_created boolean := false;
begin
  select * into s from public.inspection_schedules where id = p_schedule_id;
  if s.id is null then raise exception 'Schedule not found.' using errcode='P0002'; end if;
  select * into t from public.inspection_templates where id = s.template_id;

  insert into public.inspection_occurrences
    (organization_id, schedule_id, template_id, location_id, area_id, asset_id, assigned_to,
     requires_manager_review, scheduled_date, scheduled_time, status)
  values (s.organization_id, s.id, s.template_id, s.location_id, s.area_id, s.asset_id, s.assigned_to,
     coalesce(t.requires_manager_review, true), p_sched, s.scheduled_time, 'scheduled')
  on conflict (schedule_id, scheduled_date) do nothing;

  select id into v_id from public.inspection_occurrences where schedule_id = p_schedule_id and scheduled_date = p_sched;

  -- Snapshot the template into responses exactly once. Later template edits never
  -- change this historical inspection (immutable snapshot).
  if not exists (select 1 from public.inspection_responses where inspection_id = v_id) then
    insert into public.inspection_responses
      (organization_id, inspection_id, template_item_id, section_name_snapshot, item_text_snapshot,
       instructions_snapshot, is_required, allow_na, require_comment_on_fail, require_photo_on_fail,
       failure_priority_id, failure_category_id, sort_order)
    select s.organization_id, v_id, it.id, sec.name, it.item_text, it.instructions, it.is_required,
       it.allow_na, it.require_comment_on_fail, it.require_photo_on_fail, it.failure_priority_id, it.failure_category_id,
       row_number() over (order by coalesce(sec.sort_order, 2147483647), coalesce(sec.id::text,''), it.sort_order, it.created_at)
    from public.inspection_template_items it
    left join public.inspection_template_sections sec on sec.id = it.section_id
    where it.template_id = s.template_id;
    v_created := true;
  end if;

  if v_created then
    insert into public.inspection_activity (organization_id, schedule_id, occurrence_id, actor_id, is_system, action, metadata)
    values (s.organization_id, s.id, v_id, auth.uid(), auth.uid() is null, 'inspection_generated',
            jsonb_build_object('scheduled_date', p_sched));
  end if;
  return v_id;
end; $$;

-- ---------- inspection processing (modular; called by the orchestrator) ----------
create or replace function public.generate_due_inspections()
returns integer language plpgsql security definer set search_path=public as $$
declare r record; v_occ uuid; v_count int := 0; today date := current_date; v_next date; k int;
begin
  for r in select * from public.inspection_schedules
           where status='active' and next_due_date is not null and next_due_date <= today
  loop
    begin
      k := 0;
      while r.next_due_date <= today and k < 90 loop
        v_occ := public.inspection_ensure_occurrence(r.id, r.next_due_date);
        update public.inspection_occurrences set status='due'
          where id = v_occ and status='scheduled' and today >= scheduled_date;
        v_count := v_count + 1;
        v_next := public.ppm_compute_next_due(r.start_date, r.frequency_unit, r.frequency_interval, r.next_due_date);
        update public.inspection_schedules set next_due_date = v_next where id = r.id;
        r.next_due_date := v_next;
        k := k + 1;
      end loop;
    exception when others then
      insert into public.inspection_activity (organization_id, schedule_id, is_system, action, metadata)
      values (r.organization_id, r.id, true, 'generation_failed', jsonb_build_object('error', sqlerrm));
    end;
  end loop;
  return v_count;
end; $$;

-- ---------- single daily orchestrator (PPM + Inspections; one cron job) ----------
create or replace function public.run_daily_maintenance_scheduler()
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_ppm int := 0; v_insp int := 0;
begin
  begin v_ppm := public.generate_due_ppm_work_orders(); exception when others then v_ppm := -1; end;
  begin v_insp := public.generate_due_inspections();    exception when others then v_insp := -1; end;
  return jsonb_build_object('ppm', v_ppm, 'inspections', v_insp, 'ran_at', now());
end; $$;

-- Seed the first occurrence when an active schedule is created.
create or replace function public.inspection_after_schedule_insert()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.status = 'active' then
    perform public.inspection_ensure_occurrence(new.id, new.next_due_date);
  end if;
  insert into public.inspection_activity (organization_id, schedule_id, actor_id, action, metadata)
  values (new.organization_id, new.id, auth.uid(), 'schedule_created',
          jsonb_build_object('schedule_number', new.schedule_number,
                             'frequency', new.frequency_interval || ' ' || new.frequency_unit));
  return new;
end; $$;
drop trigger if exists inspection_after_schedule_insert on public.inspection_schedules;
create trigger inspection_after_schedule_insert after insert on public.inspection_schedules
  for each row execute function public.inspection_after_schedule_insert();

-- ---------- response write guard: allow_na + in-progress + stamp responder ----------
create or replace function public.inspection_response_before_write()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_status text;
begin
  if new.result = 'na' and new.allow_na = false then
    raise exception 'N/A is not allowed for this item.' using errcode='23514';
  end if;
  if (new.result is distinct from old.result) or (new.comment is distinct from old.comment) then
    select status into v_status from public.inspection_occurrences where id = new.inspection_id;
    if v_status <> 'in_progress' then
      raise exception 'Responses can only be changed while the inspection is in progress.' using errcode='42501';
    end if;
  end if;
  if new.result is not null and (new.result is distinct from old.result) then
    new.responded_by := auth.uid();
    new.responded_at := now();
  end if;
  return new;
end; $$;
drop trigger if exists inspection_response_before_write on public.inspection_responses;
create trigger inspection_response_before_write before update on public.inspection_responses
  for each row execute function public.inspection_response_before_write();

-- ---------- start ----------
create or replace function public.inspection_start(p_occurrence_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare occ public.inspection_occurrences%rowtype;
begin
  select * into occ from public.inspection_occurrences where id = p_occurrence_id for update;
  if occ.id is null or occ.organization_id <> public.current_user_organization_id() then
    raise exception 'Inspection not found.' using errcode='P0002'; end if;
  if not (public.can_manage_facility() or occ.assigned_to = auth.uid()) then
    raise exception 'Not authorized.' using errcode='42501'; end if;
  if occ.status not in ('scheduled','due') then
    raise exception 'This inspection cannot be started (status: %).', occ.status using errcode='42501'; end if;
  update public.inspection_occurrences set status='in_progress', started_at=coalesce(started_at, now()) where id=occ.id;
  insert into public.inspection_activity (organization_id, occurrence_id, actor_id, action)
  values (occ.organization_id, occ.id, auth.uid(), 'inspection_started');
end; $$;

-- ---------- submit (all validation server-side; one finding per failed response) ----------
create or replace function public.inspection_submit(p_occurrence_id uuid)
returns text language plpgsql security definer set search_path=public as $$
declare occ public.inspection_occurrences%rowtype; v_missing int; v_bad_na int; v_fail int;
        v_need_comment int; v_need_photo int; v_overall text; v_auto boolean := false; r record;
begin
  select * into occ from public.inspection_occurrences where id = p_occurrence_id for update;
  if occ.id is null or occ.organization_id <> public.current_user_organization_id() then
    raise exception 'Inspection not found.' using errcode='P0002'; end if;
  if not (public.can_manage_facility() or occ.assigned_to = auth.uid()) then
    raise exception 'Not authorized.' using errcode='42501'; end if;
  if occ.status <> 'in_progress' then
    raise exception 'Only an in-progress inspection can be submitted.' using errcode='42501'; end if;

  select count(*) into v_missing from public.inspection_responses
    where inspection_id=occ.id and is_required=true and result is null;
  if v_missing > 0 then
    raise exception 'All required items must be answered before submitting (% remaining).', v_missing using errcode='23514'; end if;

  select count(*) into v_bad_na from public.inspection_responses
    where inspection_id=occ.id and result='na' and allow_na=false;
  if v_bad_na > 0 then raise exception 'One or more items are marked N/A but N/A is not allowed.' using errcode='23514'; end if;

  select count(*) into v_need_comment from public.inspection_responses
    where inspection_id=occ.id and result='fail' and require_comment_on_fail=true and (comment is null or btrim(comment)='');
  if v_need_comment > 0 then
    raise exception 'A comment is required on each failed item that needs one (% missing).', v_need_comment using errcode='23514'; end if;

  select count(*) into v_need_photo from public.inspection_responses resp
    where resp.inspection_id=occ.id and resp.result='fail' and resp.require_photo_on_fail=true
      and not exists (select 1 from public.inspection_response_attachments a where a.response_id=resp.id);
  if v_need_photo > 0 then
    raise exception 'A photo is required on each failed item that needs one (% missing).', v_need_photo using errcode='23514'; end if;

  select count(*) into v_fail from public.inspection_responses where inspection_id=occ.id and result='fail';
  v_overall := case when v_fail > 0 then 'fail' else 'pass' end;

  for r in select resp.* from public.inspection_responses resp where resp.inspection_id=occ.id and resp.result='fail'
  loop
    insert into public.inspection_findings
      (organization_id, inspection_id, response_id, location_id, area_id, asset_id, category_id, priority_id, description, status)
    values (occ.organization_id, occ.id, r.id, occ.location_id, occ.area_id, occ.asset_id,
            r.failure_category_id, r.failure_priority_id,
            r.item_text_snapshot || case when r.comment is not null and btrim(r.comment)<>'' then ' -- ' || r.comment else '' end,
            'open')
    on conflict (response_id) do nothing;
  end loop;

  if v_overall='pass' and occ.requires_manager_review=false then
    update public.inspection_occurrences
      set status='closed', overall_result='pass', submitted_at=now(), closed_at=now() where id=occ.id;
    v_auto := true;
  else
    update public.inspection_occurrences
      set status='submitted', overall_result=v_overall, submitted_at=now() where id=occ.id;
  end if;

  insert into public.inspection_activity (organization_id, occurrence_id, actor_id, action, new_value, metadata)
  values (occ.organization_id, occ.id, auth.uid(), 'inspection_submitted', v_overall,
          jsonb_build_object('auto_closed', v_auto, 'failed_items', v_fail));
  if v_auto then
    insert into public.inspection_activity (organization_id, occurrence_id, actor_id, action, metadata)
    values (occ.organization_id, occ.id, auth.uid(), 'inspection_auto_closed',
            jsonb_build_object('reason','all pass; manager review not required'));
  end if;
  return v_overall;
end; $$;

-- ---------- review / close / skip / assign ----------
create or replace function public.inspection_review(p_occurrence_id uuid, p_notes text)
returns void language plpgsql security definer set search_path=public as $$
declare occ public.inspection_occurrences%rowtype;
begin
  if not public.can_manage_facility() then raise exception 'Not authorized.' using errcode='42501'; end if;
  select * into occ from public.inspection_occurrences where id=p_occurrence_id for update;
  if occ.id is null or occ.organization_id <> public.current_user_organization_id() then
    raise exception 'Inspection not found.' using errcode='P0002'; end if;
  if occ.status <> 'submitted' then raise exception 'Only a submitted inspection can be reviewed.' using errcode='42501'; end if;
  update public.inspection_occurrences
    set status='reviewed', reviewed_by=auth.uid(), reviewed_at=now(), review_notes=p_notes where id=occ.id;
  insert into public.inspection_activity (organization_id, occurrence_id, actor_id, action, new_value)
  values (occ.organization_id, occ.id, auth.uid(), 'inspection_reviewed', p_notes);
end; $$;

create or replace function public.inspection_close(p_occurrence_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare occ public.inspection_occurrences%rowtype;
begin
  if not public.can_manage_facility() then raise exception 'Not authorized.' using errcode='42501'; end if;
  select * into occ from public.inspection_occurrences where id=p_occurrence_id for update;
  if occ.id is null or occ.organization_id <> public.current_user_organization_id() then
    raise exception 'Inspection not found.' using errcode='P0002'; end if;
  if occ.status <> 'reviewed' then raise exception 'Only a reviewed inspection can be closed.' using errcode='42501'; end if;
  update public.inspection_occurrences set status='closed', closed_at=now() where id=occ.id;
  insert into public.inspection_activity (organization_id, occurrence_id, actor_id, action)
  values (occ.organization_id, occ.id, auth.uid(), 'inspection_closed');
end; $$;

create or replace function public.inspection_skip(p_occurrence_id uuid, p_reason text)
returns void language plpgsql security definer set search_path=public as $$
declare occ public.inspection_occurrences%rowtype;
begin
  if not public.can_manage_facility() then raise exception 'Not authorized.' using errcode='42501'; end if;
  if p_reason is null or btrim(p_reason)='' then raise exception 'A reason is required to skip.' using errcode='22000'; end if;
  select * into occ from public.inspection_occurrences where id=p_occurrence_id for update;
  if occ.id is null or occ.organization_id <> public.current_user_organization_id() then
    raise exception 'Inspection not found.' using errcode='P0002'; end if;
  if occ.status not in ('scheduled','due','in_progress') then
    raise exception 'This inspection can no longer be skipped.' using errcode='42501'; end if;
  update public.inspection_occurrences
    set status='skipped', skipped_by=auth.uid(), skipped_at=now(), skip_reason=btrim(p_reason) where id=occ.id;
  insert into public.inspection_activity (organization_id, occurrence_id, actor_id, action, new_value)
  values (occ.organization_id, occ.id, auth.uid(), 'inspection_skipped', btrim(p_reason));
end; $$;

create or replace function public.inspection_assign(p_occurrence_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare occ public.inspection_occurrences%rowtype; v_ok boolean; v_org uuid;
begin
  if not public.can_manage_facility() then raise exception 'Not authorized.' using errcode='42501'; end if;
  v_org := public.current_user_organization_id();
  select * into occ from public.inspection_occurrences where id=p_occurrence_id for update;
  if occ.id is null or occ.organization_id <> v_org then raise exception 'Inspection not found.' using errcode='P0002'; end if;
  if occ.status in ('closed','cancelled','skipped') then raise exception 'This inspection can no longer be reassigned.' using errcode='42501'; end if;
  if p_user_id is not null then
    select (r.code in ('super_admin','facility_manager','technician') and p.is_active and p.organization_id = v_org)
      into v_ok from public.profiles p join public.roles r on r.id = p.role_id where p.id = p_user_id;
    if not coalesce(v_ok,false) then
      raise exception 'Inspector must be an active Super Admin, Facility Manager, or Technician.' using errcode='23514'; end if;
  end if;
  update public.inspection_occurrences set assigned_to = p_user_id where id = occ.id;
  insert into public.inspection_activity (organization_id, occurrence_id, actor_id, action, metadata)
  values (occ.organization_id, occ.id, auth.uid(), 'inspector_assigned', jsonb_build_object('assigned_to', p_user_id));
end; $$;

create or replace function public.inspection_set_schedule_status(p_schedule_id uuid, p_status text)
returns void language plpgsql security definer set search_path=public as $$
declare sch public.inspection_schedules%rowtype;
begin
  if not public.can_manage_facility() then raise exception 'Not authorized.' using errcode='42501'; end if;
  if p_status not in ('active','paused','archived') then raise exception 'Invalid status.' using errcode='22000'; end if;
  select * into sch from public.inspection_schedules where id=p_schedule_id;
  if sch.id is null or sch.organization_id <> public.current_user_organization_id() then
    raise exception 'Schedule not found.' using errcode='P0002'; end if;
  update public.inspection_schedules set status=p_status where id=p_schedule_id;
  insert into public.inspection_activity (organization_id, schedule_id, actor_id, action, field_name, old_value, new_value)
  values (sch.organization_id, sch.id, auth.uid(),
          case p_status when 'paused' then 'schedule_paused' when 'archived' then 'schedule_archived' else 'schedule_resumed' end,
          'status', sch.status, p_status);
end; $$;

-- ---------- corrective actions from findings ----------
create or replace function public.inspection_finding_create_fm_request(
  p_finding_id uuid, p_title text, p_description text, p_category_id uuid, p_priority_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare f public.inspection_findings%rowtype; v_status uuid; v_cat uuid; v_req uuid;
begin
  if not public.can_manage_facility() then raise exception 'Not authorized.' using errcode='42501'; end if;
  select * into f from public.inspection_findings where id=p_finding_id for update;
  if f.id is null or f.organization_id <> public.current_user_organization_id() then
    raise exception 'Finding not found.' using errcode='P0002'; end if;
  if f.status not in ('open','action_required') then raise exception 'This finding has already been actioned.' using errcode='42501'; end if;
  v_cat := coalesce(p_category_id, f.category_id);
  if v_cat is null then raise exception 'A category is required to create an FM request.' using errcode='23514'; end if;
  select id into v_status from public.fm_request_statuses where organization_id=f.organization_id and code='new';
  insert into public.fm_requests
    (organization_id, location_id, area_id, asset_id, category_id, priority_id, status_id, title, description,
     requested_by, inspection_finding_id)
  values (f.organization_id, f.location_id, f.area_id, f.asset_id, v_cat, coalesce(p_priority_id, f.priority_id), v_status,
     coalesce(nullif(btrim(p_title),''), 'Inspection finding'), p_description, auth.uid(), f.id)
  returning id into v_req;
  update public.inspection_findings set status='fm_request_created', fm_request_id=v_req where id=f.id;
  insert into public.inspection_activity (organization_id, occurrence_id, finding_id, actor_id, action, metadata)
  values (f.organization_id, f.inspection_id, f.id, auth.uid(), 'fm_request_created', jsonb_build_object('fm_request_id', v_req));
  return v_req;
end; $$;

create or replace function public.inspection_finding_create_work_order(
  p_finding_id uuid, p_title text, p_description text, p_category_id uuid, p_priority_id uuid, p_assigned_to uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare f public.inspection_findings%rowtype; v_cat uuid; v_prio uuid; v_status uuid; v_code text; v_assigned uuid; v_ok boolean; v_wo uuid;
begin
  if not public.can_manage_facility() then raise exception 'Not authorized.' using errcode='42501'; end if;
  select * into f from public.inspection_findings where id=p_finding_id for update;
  if f.id is null or f.organization_id <> public.current_user_organization_id() then
    raise exception 'Finding not found.' using errcode='P0002'; end if;
  if f.status not in ('open','action_required') then raise exception 'This finding has already been actioned.' using errcode='42501'; end if;
  v_cat := coalesce(p_category_id, f.category_id);
  if v_cat is null then raise exception 'A category is required to create a work order.' using errcode='23514'; end if;
  v_prio := coalesce(p_priority_id, f.priority_id);
  if v_prio is null then raise exception 'A priority is required to create a work order.' using errcode='23514'; end if;
  v_assigned := null;
  if p_assigned_to is not null then
    select (r.code='technician' and p.is_active and p.organization_id=f.organization_id)
      into v_ok from public.profiles p join public.roles r on r.id=p.role_id where p.id=p_assigned_to;
    if coalesce(v_ok,false) then v_assigned := p_assigned_to; else
      raise exception 'A work order can only be assigned to an active Technician.' using errcode='23514'; end if;
  end if;
  v_code := case when v_assigned is not null then 'assigned' else 'new' end;
  select id into v_status from public.work_order_statuses where organization_id=f.organization_id and code=v_code;
  insert into public.work_orders
    (organization_id, location_id, area_id, asset_id, category_id, priority_id, status_id, title, description,
     assigned_to, created_by, inspection_finding_id)
  values (f.organization_id, f.location_id, f.area_id, f.asset_id, v_cat, v_prio, v_status,
     coalesce(nullif(btrim(p_title),''), 'Inspection finding'), p_description, v_assigned, auth.uid(), f.id)
  returning id into v_wo;
  update public.inspection_findings set status='work_order_created', work_order_id=v_wo where id=f.id;
  insert into public.inspection_activity (organization_id, occurrence_id, finding_id, actor_id, action, metadata)
  values (f.organization_id, f.inspection_id, f.id, auth.uid(), 'work_order_created', jsonb_build_object('work_order_id', v_wo));
  return v_wo;
end; $$;

create or replace function public.inspection_finding_resolve(p_finding_id uuid, p_notes text)
returns void language plpgsql security definer set search_path=public as $$
declare f public.inspection_findings%rowtype;
begin
  if not public.can_manage_facility() then raise exception 'Not authorized.' using errcode='42501'; end if;
  select * into f from public.inspection_findings where id=p_finding_id for update;
  if f.id is null or f.organization_id <> public.current_user_organization_id() then
    raise exception 'Finding not found.' using errcode='P0002'; end if;
  if f.status not in ('open','action_required') then raise exception 'This finding cannot be resolved from its current state.' using errcode='42501'; end if;
  update public.inspection_findings
    set status='resolved', resolution_notes=p_notes, resolved_by=auth.uid(), resolved_at=now() where id=f.id;
  insert into public.inspection_activity (organization_id, occurrence_id, finding_id, actor_id, action, new_value)
  values (f.organization_id, f.inspection_id, f.id, auth.uid(), 'finding_resolved', p_notes);
end; $$;

create or replace function public.inspection_finding_dismiss(p_finding_id uuid, p_reason text)
returns void language plpgsql security definer set search_path=public as $$
declare f public.inspection_findings%rowtype;
begin
  if not public.can_manage_facility() then raise exception 'Not authorized.' using errcode='42501'; end if;
  if p_reason is null or btrim(p_reason)='' then raise exception 'A reason is required to dismiss a finding.' using errcode='22000'; end if;
  select * into f from public.inspection_findings where id=p_finding_id for update;
  if f.id is null or f.organization_id <> public.current_user_organization_id() then
    raise exception 'Finding not found.' using errcode='P0002'; end if;
  if f.status not in ('open','action_required') then raise exception 'This finding cannot be dismissed from its current state.' using errcode='42501'; end if;
  update public.inspection_findings
    set status='dismissed', dismissal_reason=btrim(p_reason), dismissed_by=auth.uid(), dismissed_at=now() where id=f.id;
  insert into public.inspection_activity (organization_id, occurrence_id, finding_id, actor_id, action, new_value)
  values (f.organization_id, f.inspection_id, f.id, auth.uid(), 'finding_dismissed', btrim(p_reason));
end; $$;

-- ---------- grants: RPCs to authenticated; internals/triggers locked down ----------
revoke execute on function public.inspection_ensure_occurrence(uuid,date) from public, anon, authenticated;
revoke execute on function public.generate_due_inspections() from public, anon, authenticated;
revoke execute on function public.run_daily_maintenance_scheduler() from public, anon, authenticated;
revoke execute on function public.inspection_after_schedule_insert() from public, anon, authenticated;
revoke execute on function public.inspection_response_before_write() from public, anon, authenticated;

do $$
declare fn text;
begin
  foreach fn in array array[
    'inspection_start(uuid)','inspection_submit(uuid)','inspection_review(uuid,text)',
    'inspection_close(uuid)','inspection_skip(uuid,text)','inspection_assign(uuid,uuid)',
    'inspection_set_schedule_status(uuid,text)',
    'inspection_finding_create_fm_request(uuid,text,text,uuid,uuid)',
    'inspection_finding_create_work_order(uuid,text,text,uuid,uuid,uuid)',
    'inspection_finding_resolve(uuid,text)','inspection_finding_dismiss(uuid,text)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon;', fn);
    execute format('grant execute on function public.%s to authenticated;', fn);
  end loop;
end $$;

-- ---------- single daily scheduler job (repoint the one existing cron job) ----------
do $$ begin
  if exists (select 1 from cron.job where jobname='ppm-daily-generation') then
    perform cron.unschedule('ppm-daily-generation');
  end if;
  if exists (select 1 from cron.job where jobname='daily-maintenance-scheduler') then
    perform cron.unschedule('daily-maintenance-scheduler');
  end if;
end $$;
select cron.schedule('daily-maintenance-scheduler', '0 2 * * *', $cron$ select public.run_daily_maintenance_scheduler(); $cron$);

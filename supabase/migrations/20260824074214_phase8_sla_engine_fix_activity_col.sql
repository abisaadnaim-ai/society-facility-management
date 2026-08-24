-- =====================================================================
-- PHASE 8 (2b/6): Fix — fm_request_activity uses column `request_id`
-- (work_order_activity uses `work_order_id`; the two audit tables differ).
-- =====================================================================
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
    insert into public.fm_request_activity(organization_id, request_id, actor_id, action, field_name, old_value, new_value, metadata)
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

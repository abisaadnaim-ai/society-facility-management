-- Centralized visibility predicates, reused by table RLS and storage RLS so the
-- rules live in exactly one place. All SECURITY DEFINER and org-scoped.

-- Who may READ a given FM Request:
--  FM Manager / Admin / Viewer -> all; Requester -> own; Technician -> if assigned
--  to a Work Order raised from that request.
create or replace function public.can_read_fm_request(p_request_id uuid)
returns boolean language plpgsql security definer stable set search_path = public as $$
declare r record;
begin
  select organization_id, requested_by into r from public.fm_requests where id = p_request_id;
  if r is null then return false; end if;
  if not public.current_user_is_active() then return false; end if;
  if r.organization_id is distinct from public.current_user_organization_id() then return false; end if;
  if public.can_read_all_operational() then return true; end if;
  if public.is_requester() and r.requested_by = auth.uid() then return true; end if;
  if public.is_technician() and exists (
       select 1 from public.work_orders wo
       where wo.fm_request_id = p_request_id and wo.assigned_to = auth.uid()
     ) then return true; end if;
  return false;
end;
$$;

-- Who may WRITE attachments to a given FM Request: FM/Admin, or the owning Requester.
create or replace function public.can_write_fm_request(p_request_id uuid)
returns boolean language plpgsql security definer stable set search_path = public as $$
declare r record;
begin
  select organization_id, requested_by into r from public.fm_requests where id = p_request_id;
  if r is null then return false; end if;
  if not public.current_user_is_active() then return false; end if;
  if r.organization_id is distinct from public.current_user_organization_id() then return false; end if;
  if public.can_manage_facility() then return true; end if;
  if public.is_requester() and r.requested_by = auth.uid() then return true; end if;
  return false;
end;
$$;

-- Who may READ a given Work Order:
--  FM/Admin/Viewer -> all; Technician -> if assigned; Requester -> if it came from their request.
create or replace function public.can_read_work_order(p_wo_id uuid)
returns boolean language plpgsql security definer stable set search_path = public as $$
declare w record;
begin
  select wo.organization_id, wo.assigned_to, wo.fm_request_id, r.requested_by as req_by
    into w
  from public.work_orders wo
  left join public.fm_requests r on r.id = wo.fm_request_id
  where wo.id = p_wo_id;
  if w is null then return false; end if;
  if not public.current_user_is_active() then return false; end if;
  if w.organization_id is distinct from public.current_user_organization_id() then return false; end if;
  if public.can_read_all_operational() then return true; end if;
  if public.is_technician() and w.assigned_to = auth.uid() then return true; end if;
  if public.is_requester() and w.req_by = auth.uid() then return true; end if;
  return false;
end;
$$;

-- Who may WRITE attachments/comments to a Work Order: FM/Admin, or the assigned Technician.
create or replace function public.can_write_work_order(p_wo_id uuid)
returns boolean language plpgsql security definer stable set search_path = public as $$
declare w record;
begin
  select organization_id, assigned_to into w from public.work_orders where id = p_wo_id;
  if w is null then return false; end if;
  if not public.current_user_is_active() then return false; end if;
  if w.organization_id is distinct from public.current_user_organization_id() then return false; end if;
  if public.can_manage_facility() then return true; end if;
  if public.is_technician() and w.assigned_to = auth.uid() then return true; end if;
  return false;
end;
$$;

do $$
declare fn text;
begin
  foreach fn in array array[
    'can_read_fm_request(uuid)','can_write_fm_request(uuid)',
    'can_read_work_order(uuid)','can_write_work_order(uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon;', fn);
    execute format('grant execute on function public.%s to authenticated;', fn);
  end loop;
end $$;

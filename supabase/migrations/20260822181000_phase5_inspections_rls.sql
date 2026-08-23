-- ============================================================================
-- PHASE 5: RLS -- visibility helpers + policies.
-- Config (templates/sections/items/schedules): read = FM/Admin/Viewer; write = FM/Admin.
-- Occurrences/responses/attachments: reads delegate to SECURITY DEFINER helpers
-- (no cross-table RLS inline -> no recursion). All state changes go through the
-- SECURITY DEFINER RPCs; the only client write path is saving responses (in-progress).
-- Findings + activity are read-only to clients; created/changed only via RPCs.
-- ============================================================================

-- ---------- visibility helpers ----------
create or replace function public.can_read_inspection(p_occurrence_id uuid)
returns boolean language plpgsql security definer stable set search_path=public as $$
declare o record;
begin
  select organization_id, assigned_to into o from public.inspection_occurrences where id = p_occurrence_id;
  if o is null then return false; end if;
  if not public.current_user_is_active() then return false; end if;
  if o.organization_id is distinct from public.current_user_organization_id() then return false; end if;
  if public.can_read_all_operational() then return true; end if;
  if public.is_technician() and o.assigned_to = auth.uid() then return true; end if;
  return false;
end; $$;

create or replace function public.can_write_inspection(p_occurrence_id uuid)
returns boolean language plpgsql security definer stable set search_path=public as $$
declare o record;
begin
  select organization_id, assigned_to into o from public.inspection_occurrences where id = p_occurrence_id;
  if o is null then return false; end if;
  if not public.current_user_is_active() then return false; end if;
  if o.organization_id is distinct from public.current_user_organization_id() then return false; end if;
  if public.can_manage_facility() then return true; end if;
  if public.is_technician() and o.assigned_to = auth.uid() then return true; end if;
  return false;
end; $$;

do $$ declare fn text; begin
  foreach fn in array array['can_read_inspection(uuid)','can_write_inspection(uuid)'] loop
    execute format('revoke execute on function public.%s from public, anon;', fn);
    execute format('grant execute on function public.%s to authenticated;', fn);
  end loop;
end $$;

-- ---------- templates ----------
create policy "Read inspection_templates" on public.inspection_templates for select to authenticated
  using (organization_id = public.current_user_organization_id() and public.can_read_all_operational());
create policy "Insert inspection_templates" on public.inspection_templates for insert to authenticated
  with check (organization_id = public.current_user_organization_id() and public.can_manage_facility() and created_by = auth.uid());
create policy "Update inspection_templates" on public.inspection_templates for update to authenticated
  using (organization_id = public.current_user_organization_id() and public.can_manage_facility())
  with check (organization_id = public.current_user_organization_id() and public.can_manage_facility());
create policy "Delete inspection_templates" on public.inspection_templates for delete to authenticated
  using (organization_id = public.current_user_organization_id() and public.can_manage_facility());

-- ---------- template sections ----------
create policy "Read inspection_template_sections" on public.inspection_template_sections for select to authenticated
  using (organization_id = public.current_user_organization_id() and public.can_read_all_operational());
create policy "Write inspection_template_sections" on public.inspection_template_sections for all to authenticated
  using (organization_id = public.current_user_organization_id() and public.can_manage_facility())
  with check (organization_id = public.current_user_organization_id() and public.can_manage_facility());

-- ---------- template items ----------
create policy "Read inspection_template_items" on public.inspection_template_items for select to authenticated
  using (organization_id = public.current_user_organization_id() and public.can_read_all_operational());
create policy "Write inspection_template_items" on public.inspection_template_items for all to authenticated
  using (organization_id = public.current_user_organization_id() and public.can_manage_facility())
  with check (organization_id = public.current_user_organization_id() and public.can_manage_facility());

-- ---------- schedules ----------
create policy "Read inspection_schedules" on public.inspection_schedules for select to authenticated
  using (organization_id = public.current_user_organization_id() and public.can_read_all_operational());
create policy "Insert inspection_schedules" on public.inspection_schedules for insert to authenticated
  with check (organization_id = public.current_user_organization_id() and public.can_manage_facility() and created_by = auth.uid());
create policy "Update inspection_schedules" on public.inspection_schedules for update to authenticated
  using (organization_id = public.current_user_organization_id() and public.can_manage_facility())
  with check (organization_id = public.current_user_organization_id() and public.can_manage_facility());
-- No DELETE policy: schedules with history are never physically deleted (archive instead).

-- ---------- occurrences (read only to clients; all writes via SECURITY DEFINER RPCs) ----------
create policy "Read inspection_occurrences" on public.inspection_occurrences for select to authenticated
  using (public.can_read_inspection(id));

-- ---------- responses (read + the save-progress update path) ----------
create policy "Read inspection_responses" on public.inspection_responses for select to authenticated
  using (public.can_read_inspection(inspection_id));
create policy "Update inspection_responses" on public.inspection_responses for update to authenticated
  using (public.can_write_inspection(inspection_id))
  with check (public.can_write_inspection(inspection_id));

-- ---------- findings (read only to clients; write via RPCs) ----------
create policy "Read inspection_findings" on public.inspection_findings for select to authenticated
  using (organization_id = public.current_user_organization_id() and public.can_read_all_operational());

-- ---------- response attachments ----------
create policy "Read inspection_response_attachments" on public.inspection_response_attachments for select to authenticated
  using (public.can_read_inspection(inspection_id));
create policy "Insert inspection_response_attachments" on public.inspection_response_attachments for insert to authenticated
  with check (organization_id = public.current_user_organization_id() and public.can_write_inspection(inspection_id));
create policy "Delete inspection_response_attachments" on public.inspection_response_attachments for delete to authenticated
  using (public.can_manage_facility() or public.can_write_inspection(inspection_id));

-- ---------- activity (management-facing audit; read only, never client-written) ----------
create policy "Read inspection_activity" on public.inspection_activity for select to authenticated
  using (organization_id = public.current_user_organization_id() and public.can_manage_facility());

-- Phase 3 RLS. Every policy is org-scoped. Reads/writes are gated by role and,
-- for children, by the centralized can_read_/can_write_ helpers. Requesters never
-- see internal comments; technicians only touch work orders assigned to them.

-- ===== FM REQUESTS =====
create policy "Read fm_requests" on public.fm_requests for select to authenticated
using (
  organization_id = public.current_user_organization_id() and public.current_user_is_active() and (
    public.can_read_all_operational()
    or (public.is_requester() and requested_by = auth.uid())
    or (public.is_technician() and exists (
          select 1 from public.work_orders wo
          where wo.fm_request_id = fm_requests.id and wo.assigned_to = auth.uid()))
  )
);
create policy "Insert fm_requests" on public.fm_requests for insert to authenticated
with check (
  organization_id = public.current_user_organization_id() and public.current_user_is_active()
  and public.current_user_role_code() in ('super_admin','facility_manager','requester')
  and requested_by = auth.uid()
);
create policy "Update fm_requests" on public.fm_requests for update to authenticated
using (organization_id = public.current_user_organization_id() and public.can_manage_facility())
with check (organization_id = public.current_user_organization_id() and public.can_manage_facility());

-- ===== FM REQUEST COMMENTS =====
create policy "Read fm_request_comments" on public.fm_request_comments for select to authenticated
using (
  organization_id = public.current_user_organization_id() and public.current_user_is_active() and (
    public.can_manage_facility()
    or (is_internal = false and public.can_read_fm_request(request_id))
  )
);
create policy "Insert fm_request_comments" on public.fm_request_comments for insert to authenticated
with check (
  organization_id = public.current_user_organization_id() and author_id = auth.uid() and public.current_user_is_active() and (
    public.can_manage_facility()
    or (is_internal = false and public.is_requester()
        and exists (select 1 from public.fm_requests r where r.id = request_id and r.requested_by = auth.uid()))
  )
);

-- ===== FM REQUEST ATTACHMENTS =====
create policy "Read fm_request_attachments" on public.fm_request_attachments for select to authenticated
using (organization_id = public.current_user_organization_id() and public.can_read_fm_request(request_id));
create policy "Insert fm_request_attachments" on public.fm_request_attachments for insert to authenticated
with check (organization_id = public.current_user_organization_id() and uploaded_by = auth.uid() and public.can_write_fm_request(request_id));
create policy "Delete fm_request_attachments" on public.fm_request_attachments for delete to authenticated
using (organization_id = public.current_user_organization_id() and (public.can_manage_facility() or uploaded_by = auth.uid()));

-- ===== FM REQUEST ACTIVITY (read-only from client; inserts via logger) =====
create policy "Read fm_request_activity" on public.fm_request_activity for select to authenticated
using (organization_id = public.current_user_organization_id() and public.can_read_fm_request(request_id));

-- ===== WORK ORDERS =====
create policy "Read work_orders" on public.work_orders for select to authenticated
using (
  organization_id = public.current_user_organization_id() and public.current_user_is_active() and (
    public.can_read_all_operational()
    or (public.is_technician() and assigned_to = auth.uid())
    or (public.is_requester() and exists (
          select 1 from public.fm_requests r where r.id = work_orders.fm_request_id and r.requested_by = auth.uid()))
  )
);
create policy "Insert work_orders" on public.work_orders for insert to authenticated
with check (organization_id = public.current_user_organization_id() and public.can_manage_facility() and created_by = auth.uid());
create policy "Update work_orders" on public.work_orders for update to authenticated
using (
  organization_id = public.current_user_organization_id() and public.current_user_is_active() and (
    public.can_manage_facility() or (public.is_technician() and assigned_to = auth.uid())
  )
)
with check (
  organization_id = public.current_user_organization_id() and public.current_user_is_active() and (
    public.can_manage_facility() or (public.is_technician() and assigned_to = auth.uid())
  )
);

-- ===== WORK ORDER COMMENTS =====
create policy "Read work_order_comments" on public.work_order_comments for select to authenticated
using (
  organization_id = public.current_user_organization_id() and public.current_user_is_active() and (
    public.can_manage_facility()
    or (public.is_technician() and exists (
          select 1 from public.work_orders wo where wo.id = work_order_id and wo.assigned_to = auth.uid()))
    or (is_internal = false and (
          public.current_user_role_code() = 'viewer'
          or (public.is_requester() and exists (
                select 1 from public.work_orders wo join public.fm_requests r on r.id = wo.fm_request_id
                where wo.id = work_order_id and r.requested_by = auth.uid()))))
  )
);
create policy "Insert work_order_comments" on public.work_order_comments for insert to authenticated
with check (
  organization_id = public.current_user_organization_id() and author_id = auth.uid() and public.current_user_is_active() and (
    public.can_manage_facility()
    or (public.is_technician() and exists (
          select 1 from public.work_orders wo where wo.id = work_order_id and wo.assigned_to = auth.uid()))
  )
);

-- ===== WORK ORDER ATTACHMENTS =====
create policy "Read work_order_attachments" on public.work_order_attachments for select to authenticated
using (organization_id = public.current_user_organization_id() and public.can_read_work_order(work_order_id));
create policy "Insert work_order_attachments" on public.work_order_attachments for insert to authenticated
with check (organization_id = public.current_user_organization_id() and uploaded_by = auth.uid() and public.can_write_work_order(work_order_id));
create policy "Delete work_order_attachments" on public.work_order_attachments for delete to authenticated
using (organization_id = public.current_user_organization_id() and (public.can_manage_facility() or uploaded_by = auth.uid()));

-- ===== WORK ORDER ACTIVITY (read-only from client; inserts via logger) =====
create policy "Read work_order_activity" on public.work_order_activity for select to authenticated
using (organization_id = public.current_user_organization_id() and public.can_read_work_order(work_order_id));

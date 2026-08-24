-- =====================================================================
-- PHASE 8 (5/6): RLS policies
-- Notifications strictly per-user (§27,§28). SLA/escalation config + escalation
-- history restricted to FM/SA (§14,§46). Cross-org isolation everywhere.
-- Inserts happen only through SECURITY DEFINER engine functions (no direct
-- authenticated INSERT policies) -> escalation/notification history unforgeable.
-- =====================================================================

-- ---------------- notifications: own rows only ----------------
create policy notifications_select_own on public.notifications
  for select to authenticated using (user_id = auth.uid());
create policy notifications_update_own on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------- notification_preferences: own rows only ----------------
create policy notif_prefs_select_own on public.notification_preferences
  for select to authenticated using (user_id = auth.uid());
create policy notif_prefs_insert_own on public.notification_preferences
  for insert to authenticated with check (user_id = auth.uid() and organization_id = public.current_user_organization_id());
create policy notif_prefs_update_own on public.notification_preferences
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------- fm_sla_rules: FM/SA view + manage (§14,§45) ----------------
create policy fm_sla_rules_select on public.fm_sla_rules
  for select to authenticated using (
    organization_id = public.current_user_organization_id()
    and public.current_user_role_code() in ('super_admin','facility_manager'));
create policy fm_sla_rules_insert on public.fm_sla_rules
  for insert to authenticated with check (
    organization_id = public.current_user_organization_id()
    and public.current_user_role_code() in ('super_admin','facility_manager'));
create policy fm_sla_rules_update on public.fm_sla_rules
  for update to authenticated using (
    organization_id = public.current_user_organization_id()
    and public.current_user_role_code() in ('super_admin','facility_manager'))
  with check (organization_id = public.current_user_organization_id()
    and public.current_user_role_code() in ('super_admin','facility_manager'));
create policy fm_sla_rules_delete on public.fm_sla_rules
  for delete to authenticated using (
    organization_id = public.current_user_organization_id()
    and public.current_user_role_code() in ('super_admin','facility_manager'));

-- ---------------- fm_escalation_rules: FM/SA view + manage ----------------
create policy fm_esc_rules_select on public.fm_escalation_rules
  for select to authenticated using (
    organization_id = public.current_user_organization_id()
    and public.current_user_role_code() in ('super_admin','facility_manager'));
create policy fm_esc_rules_insert on public.fm_escalation_rules
  for insert to authenticated with check (
    organization_id = public.current_user_organization_id()
    and public.current_user_role_code() in ('super_admin','facility_manager'));
create policy fm_esc_rules_update on public.fm_escalation_rules
  for update to authenticated using (
    organization_id = public.current_user_organization_id()
    and public.current_user_role_code() in ('super_admin','facility_manager'))
  with check (organization_id = public.current_user_organization_id()
    and public.current_user_role_code() in ('super_admin','facility_manager'));
create policy fm_esc_rules_delete on public.fm_escalation_rules
  for delete to authenticated using (
    organization_id = public.current_user_organization_id()
    and public.current_user_role_code() in ('super_admin','facility_manager'));

-- ---------------- fm_escalations: FM/SA read + acknowledge only (§46) ----------------
create policy fm_escalations_select on public.fm_escalations
  for select to authenticated using (
    organization_id = public.current_user_organization_id()
    and public.current_user_role_code() in ('super_admin','facility_manager'));
create policy fm_escalations_update_ack on public.fm_escalations
  for update to authenticated using (
    organization_id = public.current_user_organization_id()
    and public.current_user_role_code() in ('super_admin','facility_manager'))
  with check (organization_id = public.current_user_organization_id()
    and public.current_user_role_code() in ('super_admin','facility_manager'));
-- No INSERT/DELETE policies: escalation rows are created only by SECURITY DEFINER
-- engine functions and are never physically removed -> history is unforgeable.

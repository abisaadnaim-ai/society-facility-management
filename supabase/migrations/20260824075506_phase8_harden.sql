-- =====================================================================
-- PHASE 8 (6/6): Hardening — least-privilege on tables & engine functions
-- =====================================================================

-- ---- Table privileges (anon gets nothing; authenticated least-privilege) ----
revoke all on public.notifications from anon;
revoke insert, update, delete, truncate, references, trigger on public.notifications from authenticated;
grant select on public.notifications to authenticated;
grant update (read_at, dismissed_at) on public.notifications to authenticated;  -- mark read / dismiss only

revoke all on public.notification_preferences from anon;
revoke delete, truncate, references, trigger on public.notification_preferences from authenticated;
grant select, insert, update on public.notification_preferences to authenticated;

revoke all on public.fm_sla_rules from anon;
revoke truncate, references, trigger on public.fm_sla_rules from authenticated;
grant select, insert, update, delete on public.fm_sla_rules to authenticated;  -- RLS restricts to FM/SA

revoke all on public.fm_escalation_rules from anon;
revoke truncate, references, trigger on public.fm_escalation_rules from authenticated;
grant select, insert, update, delete on public.fm_escalation_rules to authenticated;

revoke all on public.fm_escalations from anon;
revoke insert, delete, truncate, references, trigger on public.fm_escalations from authenticated;
grant select, update on public.fm_escalations to authenticated;  -- read + acknowledge only

-- ---- Function privileges: strip PUBLIC execute on engine/scheduler internals ----
revoke all on function
  public._notify(uuid,uuid,text,text,text,text,uuid,text,text,text),
  public._notify_roles(uuid,text[],text,text,text,text,uuid,text,text),
  public._create_escalation(uuid,text,uuid,integer,text,text,uuid,text[]),
  public._resolve_escalations(text,uuid),
  public._fm_resolve_sla_rule(uuid,uuid),
  public._fm_request_sla_on_insert(),
  public._fm_request_sla_on_update(),
  public._work_order_sla_on_insert(),
  public._work_order_sla_on_update(),
  public._fm_request_notify_ins(),
  public._fm_request_notify_upd(),
  public._work_order_notify_ins(),
  public._work_order_notify_upd(),
  public.process_sla_breaches(),
  public.check_contract_expiry(),
  public.check_low_stock(),
  public.check_ppm_overdue(),
  public.check_inspection_overdue(),
  public.run_hourly_sla_scheduler(),
  public.run_daily_maintenance_scheduler()
from public, anon, authenticated;

-- ---- Pure read helpers the app/views may legitimately use ----
grant execute on function public.fm_sla_live_status(integer,timestamptz,timestamptz,timestamptz,boolean) to authenticated;
grant execute on function public.fm_sla_due_soon_fraction() to authenticated;
grant execute on function public._entity_link(text,uuid) to authenticated;

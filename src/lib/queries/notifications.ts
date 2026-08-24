import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import {
  ndb,
  type AppNotification,
  type FmEscalation,
  type FmSlaRule,
  type FmSlaRuleRow,
  type EscalationRow,
} from "@/lib/types/notifications";

/** Count of unread, non-dismissed notifications for the header bell badge. */
export async function getUnreadNotificationCount(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<number> {
  const { count } = await ndb(supabase)
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null)
    .is("dismissed_at", null);
  return count ?? 0;
}

/** Recent (non-dismissed) notifications for the bell dropdown. */
export async function getRecentNotifications(
  supabase: SupabaseClient<Database>,
  userId: string,
  limit = 8
): Promise<AppNotification[]> {
  const { data } = await ndb(supabase)
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .is("dismissed_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as AppNotification[];
}

/** Full notification list for the /notifications page (non-dismissed). */
export async function getNotifications(
  supabase: SupabaseClient<Database>,
  userId: string,
  limit = 100
): Promise<AppNotification[]> {
  const { data } = await ndb(supabase)
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .is("dismissed_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as AppNotification[];
}

/**
 * Escalations for FM/SA (RLS restricts visibility). Open first, then recently
 * resolved. Entity number/title and acknowledger name are stitched manually
 * because escalations reference entities polymorphically (no FK to embed).
 */
export async function getEscalations(
  supabase: SupabaseClient<Database>,
  opts: { openOnly?: boolean; limit?: number } = {}
): Promise<EscalationRow[]> {
  const { openOnly = false, limit = 100 } = opts;
  let q = ndb(supabase)
    .from("fm_escalations")
    .select("*")
    .order("resolved_at", { ascending: true, nullsFirst: true })
    .order("triggered_at", { ascending: false })
    .limit(limit);
  if (openOnly) q = q.is("resolved_at", null);
  const { data } = await q;
  const rows = (data ?? []) as FmEscalation[];
  if (rows.length === 0) return [];

  const reqIds = rows.filter((r) => r.entity_type === "fm_request").map((r) => r.entity_id);
  const woIds = rows.filter((r) => r.entity_type === "work_order").map((r) => r.entity_id);
  const ackIds = rows.map((r) => r.acknowledged_by).filter((v): v is string => !!v);

  const [reqRes, woRes, ackRes] = await Promise.all([
    reqIds.length
      ? supabase.from("fm_requests").select("id, request_number, title").in("id", reqIds)
      : Promise.resolve({ data: [] as { id: string; request_number: string; title: string }[] }),
    woIds.length
      ? supabase.from("work_orders").select("id, work_order_number, title").in("id", woIds)
      : Promise.resolve({ data: [] as { id: string; work_order_number: string; title: string }[] }),
    ackIds.length
      ? supabase.from("profiles").select("id, full_name, email").in("id", ackIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null; email: string | null }[] }),
  ]);

  const reqMap = new Map((reqRes.data ?? []).map((r) => [r.id, r]));
  const woMap = new Map((woRes.data ?? []).map((w) => [w.id, w]));
  const ackMap = new Map((ackRes.data ?? []).map((p) => [p.id, p.full_name ?? p.email]));

  return rows.map((r) => {
    const req = r.entity_type === "fm_request" ? reqMap.get(r.entity_id) : undefined;
    const wo = r.entity_type === "work_order" ? woMap.get(r.entity_id) : undefined;
    return {
      ...r,
      entity_number: req?.request_number ?? wo?.work_order_number ?? null,
      entity_title: req?.title ?? wo?.title ?? null,
      acknowledged_by_name: r.acknowledged_by ? ackMap.get(r.acknowledged_by) ?? null : null,
    };
  });
}

/** Count of open (unresolved) escalations — for dashboard widget. */
export async function getOpenEscalationCount(
  supabase: SupabaseClient<Database>
): Promise<number> {
  const { count } = await ndb(supabase)
    .from("fm_escalations")
    .select("id", { count: "exact", head: true })
    .is("resolved_at", null);
  return count ?? 0;
}

/** Escalations for a single entity (WO or request), newest first. */
export async function getEntityEscalations(
  supabase: SupabaseClient<Database>,
  entityType: "fm_request" | "work_order",
  entityId: string
): Promise<EscalationRow[]> {
  const { data } = await ndb(supabase)
    .from("fm_escalations")
    .select("*")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("triggered_at", { ascending: false });
  const rows = (data ?? []) as FmEscalation[];
  if (rows.length === 0) return [];
  const ackIds = rows.map((r) => r.acknowledged_by).filter((v): v is string => !!v);
  const ackRes = ackIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", ackIds)
    : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
  const ackMap = new Map((ackRes.data ?? []).map((p) => [p.id, p.full_name ?? p.email]));
  return rows.map((r) => ({
    ...r,
    entity_number: null,
    entity_title: null,
    acknowledged_by_name: r.acknowledged_by ? ackMap.get(r.acknowledged_by) ?? null : null,
  }));
}

/** SLA rules with priority joined, for Settings → SLA Rules. */
export async function getSlaRules(
  supabase: SupabaseClient<Database>
): Promise<FmSlaRuleRow[]> {
  const { data } = await ndb(supabase)
    .from("fm_sla_rules")
    .select("*, priority:priority_id(id, code, name)")
    .order("is_active", { ascending: false })
    .order("response_minutes", { ascending: true });
  return (data ?? []) as unknown as FmSlaRuleRow[];
}

/** A single SLA rule by id. */
export async function getSlaRule(
  supabase: SupabaseClient<Database>,
  id: string
): Promise<FmSlaRule | null> {
  const { data } = await ndb(supabase).from("fm_sla_rules").select("*").eq("id", id).maybeSingle();
  return (data as FmSlaRule) ?? null;
}

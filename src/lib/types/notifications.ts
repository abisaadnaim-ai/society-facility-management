import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

// The generated database.ts is not regenerated here, so we augment it with the
// Phase 8 SLA / escalation / notification tables via a type intersection and a
// typed client cast (same pattern as inventory.ts / vendors.ts).
type Row<T> = { Row: T; Insert: Partial<T>; Update: Partial<T>; Relationships: [] };

export type NotificationPriority = "normal" | "high" | "critical";
export type SlaStatusPersisted = "pending" | "met" | "breached" | "not_applicable";
export type SlaLiveStatus =
  | "within" | "due_soon" | "overdue" | "met" | "breached" | "not_applicable";
export type EscalationEntityType = "fm_request" | "work_order";

export type FmSlaRule = {
  id: string; organization_id: string; name: string; priority_id: string;
  response_minutes: number; resolution_minutes: number;
  applies_to_request: boolean; applies_to_work_order: boolean;
  is_active: boolean; effective_from: string | null; effective_to: string | null;
  is_sample_default: boolean; created_by: string | null;
  created_at: string; updated_at: string;
};
export type FmEscalationRule = {
  id: string; organization_id: string; name: string; applies_to: EscalationEntityType;
  priority_id: string | null; trigger_type: string; trigger_minutes: number | null;
  escalation_level: number; target_role_id: string | null; is_active: boolean;
  created_at: string; updated_at: string;
};
export type FmEscalation = {
  id: string; organization_id: string; entity_type: EscalationEntityType; entity_id: string;
  rule_id: string | null; escalation_level: number; reason: string; dedup_key: string;
  triggered_at: string; acknowledged_by: string | null; acknowledged_at: string | null;
  resolved_at: string | null; created_at: string;
};
export type AppNotification = {
  id: string; organization_id: string; user_id: string; notification_type: string;
  title: string; message: string | null; entity_type: string | null; entity_id: string | null;
  link_url: string | null; priority: NotificationPriority; dedup_key: string | null;
  read_at: string | null; dismissed_at: string | null; created_at: string;
};
export type NotificationPreference = {
  id: string; organization_id: string; user_id: string; category: string;
  in_app_enabled: boolean; created_at: string; updated_at: string;
};

type NotificationsSchema = {
  Tables: {
    fm_sla_rules: Row<FmSlaRule>;
    fm_escalation_rules: Row<FmEscalationRule>;
    fm_escalations: Row<FmEscalation>;
    notifications: Row<AppNotification>;
    notification_preferences: Row<NotificationPreference>;
  };
};

export type NotificationsDatabase = Database & {
  public: Database["public"] & {
    Tables: Database["public"]["Tables"] & NotificationsSchema["Tables"];
  };
};

export function ndb(supabase: SupabaseClient<Database>): SupabaseClient<NotificationsDatabase> {
  return supabase as unknown as SupabaseClient<NotificationsDatabase>;
}

// ---------------------------------------------------------------------------
// Joined / view shapes
// ---------------------------------------------------------------------------
export type FmSlaRuleRow = FmSlaRule & { priority: { id: string; code: string; name: string } | null };

export type EscalationRow = FmEscalation & {
  acknowledged_by_name: string | null;
  entity_number: string | null;   // request_number or work_order_number
  entity_title: string | null;
};

// ---------------------------------------------------------------------------
// Live SLA status — mirrors the DB fm_sla_live_status() so lists/detail views
// derive the same open-state status without an extra round trip. Due Soon is
// 75% of the target window consumed (§10). Terminal states are trusted as-is.
// ---------------------------------------------------------------------------
export const SLA_DUE_SOON_FRACTION = 0.75;

export function liveSlaStatus(params: {
  targetMinutes: number | null;
  start: string | null;
  due: string | null;
  done: string | null;      // first_responded_at (response) or closed_at (resolution)
  cancelled: boolean;
  now?: Date;
}): SlaLiveStatus {
  const { targetMinutes, start, due, done, cancelled } = params;
  const now = params.now ?? new Date();
  if (cancelled) return "not_applicable";
  if (targetMinutes == null || !due) return "not_applicable";
  const dueMs = new Date(due).getTime();
  if (done) return new Date(done).getTime() <= dueMs ? "met" : "breached";
  if (now.getTime() > dueMs) return "overdue";
  if (start) {
    const startMs = new Date(start).getTime();
    const threshold = startMs + (dueMs - startMs) * SLA_DUE_SOON_FRACTION;
    if (now.getTime() >= threshold) return "due_soon";
  }
  return "within";
}

/** Badge variant for an SLA live status. */
export function slaVariant(
  status: SlaLiveStatus
): "success" | "warning" | "danger" | "neutral" | "info" {
  switch (status) {
    case "met": return "success";
    case "within": return "info";
    case "due_soon": return "warning";
    case "overdue":
    case "breached": return "danger";
    case "not_applicable":
    default: return "neutral";
  }
}

export function slaLabel(status: SlaLiveStatus): string {
  switch (status) {
    case "within": return "Within SLA";
    case "due_soon": return "Due Soon";
    case "overdue": return "Overdue";
    case "met": return "Met";
    case "breached": return "Breached";
    case "not_applicable": return "N/A";
    default: return status;
  }
}

export function notificationPriorityVariant(
  p: NotificationPriority
): "success" | "warning" | "danger" | "neutral" | "info" {
  switch (p) {
    case "critical": return "danger";
    case "high": return "warning";
    case "normal":
    default: return "neutral";
  }
}

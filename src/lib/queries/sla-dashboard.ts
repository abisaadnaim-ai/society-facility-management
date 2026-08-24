import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { ndb, liveSlaStatus, type SlaLiveStatus } from "@/lib/types/notifications";

export type NeedsAttentionItem = {
  entityType: "fm_request" | "work_order";
  id: string;
  number: string;
  title: string;
  priorityCode: string | null;
  statusCode: string | null;
  slaKind: "response" | "resolution";
  liveStatus: SlaLiveStatus;
  escalated: boolean;
  dueAt: string | null;
  rank: number; // lower = more urgent
};

export type SlaDashboard = {
  counts: {
    criticalOpen: number;
    slaBreached: number;
    dueSoon: number;
    escalated: number;
    awaitingVerification: number;
    unassigned: number;
  };
  needsAttention: NeedsAttentionItem[];
};

const REQ_OPEN = ["new", "under_review"];
const WO_CLOSED = ["closed", "cancelled"];

type WoRow = {
  id: string; work_order_number: string; title: string; created_at: string;
  assigned_to: string | null; resolution_due_at: string | null;
  sla_resolution_target_minutes: number | null; escalation_level: number | null;
  closed_at: string | null; breached_at: string | null;
  status: { code: string } | null; priority: { code: string } | null;
};
type ReqRow = {
  id: string; request_number: string; title: string; created_at: string;
  response_due_at: string | null; first_responded_at: string | null;
  sla_response_target_minutes: number | null;
  status: { code: string } | null; priority: { code: string } | null;
};

/**
 * Aggregates the Phase 8 operational picture for the dashboard. Live SLA status
 * is derived in TS from the snapshot columns (same rule as the DB function),
 * so no per-row DB round trips are needed. §38 ranking:
 * Critical -> Breached -> Escalated -> Overdue -> Due Soon.
 */
export async function getSlaDashboard(
  supabase: SupabaseClient<Database>
): Promise<SlaDashboard> {
  const [{ data: woData }, { data: reqData }, { data: escData }] = await Promise.all([
    ndb(supabase)
      .from("work_orders")
      .select(
        "id, work_order_number, title, created_at, assigned_to, resolution_due_at, sla_resolution_target_minutes, escalation_level, closed_at, breached_at, status:status_id(code), priority:priority_id(code)"
      ),
    ndb(supabase)
      .from("fm_requests")
      .select(
        "id, request_number, title, created_at, response_due_at, first_responded_at, sla_response_target_minutes, status:status_id(code), priority:priority_id(code)"
      ),
    ndb(supabase).from("fm_escalations").select("entity_type, entity_id").is("resolved_at", null),
  ]);

  const wos = (woData ?? []) as unknown as WoRow[];
  const reqs = (reqData ?? []) as unknown as ReqRow[];
  const escalatedIds = new Set(
    ((escData ?? []) as { entity_type: string; entity_id: string }[]).map(
      (e) => `${e.entity_type}:${e.entity_id}`
    )
  );

  const counts = {
    criticalOpen: 0, slaBreached: 0, dueSoon: 0, escalated: escalatedIds.size,
    awaitingVerification: 0, unassigned: 0,
  };
  const needs: NeedsAttentionItem[] = [];
  const now = new Date();

  for (const w of wos) {
    const statusCode = w.status?.code ?? null;
    const isOpen = !!statusCode && !WO_CLOSED.includes(statusCode);
    if (!isOpen) continue;
    const priorityCode = w.priority?.code ?? null;
    const escalated = escalatedIds.has(`work_order:${w.id}`) || (w.escalation_level ?? 0) > 0;
    const live = liveSlaStatus({
      targetMinutes: w.sla_resolution_target_minutes,
      start: w.created_at, due: w.resolution_due_at, done: null, cancelled: false, now,
    });

    if (priorityCode === "critical") counts.criticalOpen += 1;
    if (live === "overdue" || live === "breached") counts.slaBreached += 1;
    if (live === "due_soon") counts.dueSoon += 1;
    if (statusCode === "completed") counts.awaitingVerification += 1;
    if (!w.assigned_to) counts.unassigned += 1;

    const rank = attentionRank(priorityCode, live, escalated);
    if (rank != null) {
      needs.push({
        entityType: "work_order", id: w.id, number: w.work_order_number, title: w.title,
        priorityCode, statusCode, slaKind: "resolution", liveStatus: live, escalated,
        dueAt: w.resolution_due_at, rank,
      });
    }
  }

  for (const r of reqs) {
    const statusCode = r.status?.code ?? null;
    const isOpen = !!statusCode && REQ_OPEN.includes(statusCode);
    if (!isOpen) continue;
    const priorityCode = r.priority?.code ?? null;
    const escalated = escalatedIds.has(`fm_request:${r.id}`);
    const live = liveSlaStatus({
      targetMinutes: r.sla_response_target_minutes,
      start: r.created_at, due: r.response_due_at, done: r.first_responded_at, cancelled: false, now,
    });

    if (priorityCode === "critical") counts.criticalOpen += 1;
    if (live === "overdue" || live === "breached") counts.slaBreached += 1;
    if (live === "due_soon") counts.dueSoon += 1;

    const rank = attentionRank(priorityCode, live, escalated);
    if (rank != null) {
      needs.push({
        entityType: "fm_request", id: r.id, number: r.request_number, title: r.title,
        priorityCode, statusCode, slaKind: "response", liveStatus: live, escalated,
        dueAt: r.response_due_at, rank,
      });
    }
  }

  needs.sort((a, b) => (a.rank - b.rank) || ((a.dueAt ?? "") < (b.dueAt ?? "") ? -1 : 1));
  return { counts, needsAttention: needs.slice(0, 12) };
}

// §38 ranking. Returns null when the item needs no attention.
function attentionRank(
  priorityCode: string | null,
  live: SlaLiveStatus,
  escalated: boolean
): number | null {
  if (priorityCode === "critical") return 1;              // Critical
  if (live === "breached" || live === "overdue") return 2; // SLA Breached / Overdue
  if (escalated) return 3;                                 // Escalated
  if (live === "due_soon") return 5;                       // Due Soon
  return null;
}

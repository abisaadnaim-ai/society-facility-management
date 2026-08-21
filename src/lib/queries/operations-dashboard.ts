import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import type { FmRequestRow, WorkOrderRow } from "@/lib/types/fm";
import { getFmRequests } from "@/lib/queries/fm-requests";
import { getWorkOrders } from "@/lib/queries/work-orders";
import { WO_WAITING_CODES } from "@/lib/workflow";

export type OperationsCounts = {
  newRequests: number;
  underReview: number;
  openWorkOrders: number;
  inProgress: number;
  waiting: number;
  completedAwaitingVerification: number;
  criticalOpen: number;
};

export type OperationsDashboard = {
  counts: OperationsCounts;
  recentRequests: FmRequestRow[];
  recentWorkOrders: WorkOrderRow[];
};

const REQUEST_OPEN = ["new", "under_review", "work_order_created"];
const WO_OPEN_EXCLUDE = ["closed", "cancelled"];

export async function getOperationsDashboard(
  supabase: SupabaseClient<Database>
): Promise<OperationsDashboard> {
  // Lightweight rows for counting (status + priority codes only).
  const [{ data: reqRows }, { data: woRows }] = await Promise.all([
    supabase
      .from("fm_requests")
      .select("id, status:status_id(code), priority:priority_id(code)"),
    supabase
      .from("work_orders")
      .select("id, status:status_id(code), priority:priority_id(code)"),
  ]);

  const reqs = (reqRows ?? []) as unknown as {
    status: { code: string } | null;
    priority: { code: string } | null;
  }[];
  const wos = (woRows ?? []) as unknown as {
    status: { code: string } | null;
    priority: { code: string } | null;
  }[];

  const waiting = new Set<string>(WO_WAITING_CODES);

  const counts: OperationsCounts = {
    newRequests: reqs.filter((r) => r.status?.code === "new").length,
    underReview: reqs.filter((r) => r.status?.code === "under_review").length,
    openWorkOrders: wos.filter(
      (w) => w.status && !WO_OPEN_EXCLUDE.includes(w.status.code)
    ).length,
    inProgress: wos.filter((w) => w.status?.code === "in_progress").length,
    waiting: wos.filter((w) => w.status && waiting.has(w.status.code)).length,
    completedAwaitingVerification: wos.filter(
      (w) => w.status?.code === "completed"
    ).length,
    criticalOpen:
      reqs.filter(
        (r) =>
          r.priority?.code === "critical" &&
          r.status &&
          REQUEST_OPEN.includes(r.status.code)
      ).length +
      wos.filter(
        (w) =>
          w.priority?.code === "critical" &&
          w.status &&
          !WO_OPEN_EXCLUDE.includes(w.status.code)
      ).length,
  };

  const [allRequests, allWorkOrders] = await Promise.all([
    getFmRequests(supabase, {}),
    getWorkOrders(supabase, {}),
  ]);

  return {
    counts,
    recentRequests: allRequests.slice(0, 5),
    recentWorkOrders: allWorkOrders.slice(0, 5),
  };
}

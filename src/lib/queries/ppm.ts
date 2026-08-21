import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import type {
  PpmPlanRow,
  PpmPlanDetail,
  PpmPlanTask,
  PpmHistoryRow,
  PpmActivityRow,
  PpmOccurrenceRow,
  PpmSummary,
  PpmFilters,
  WorkOrderTaskRow,
} from "@/lib/types/ppm";

const PLAN_SELECT =
  "*, asset:asset_id(id,asset_code,name,is_active,location:location_id(id,name),area:area_id(id,name))," +
  " category:category_id(id,name), priority:priority_id(id,name,code)," +
  " technician:default_assigned_to(full_name,email)";

function sanitize(term: string): string {
  return term.replace(/[,()%]/g, " ").trim();
}

/** ISO yyyy-mm-dd for today and today+n, computed on the server. */
export function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}
function isoPlusDays(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function getPpmPlans(
  supabase: SupabaseClient<Database>,
  filters: Partial<PpmFilters> = {}
): Promise<PpmPlanRow[]> {
  let query = supabase
    .from("ppm_plans")
    .select(PLAN_SELECT)
    .order("next_due_date", { ascending: true });

  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.assetId) query = query.eq("asset_id", filters.assetId);
  if (filters.technicianId) query = query.eq("default_assigned_to", filters.technicianId);
  if (filters.status) query = query.eq("status", filters.status);

  const term = filters.search ? sanitize(filters.search) : "";
  if (term) {
    query = query.or(`ppm_number.ilike.%${term}%,name.ilike.%${term}%`);
  }

  const { data, error } = await query;
  if (error) {
    console.error("getPpmPlans failed:", error.message);
    return [];
  }
  let rows = (data ?? []) as unknown as PpmPlanRow[];

  // Location / area live on the asset, so filter them here after the join.
  if (filters.locationId) rows = rows.filter((r) => r.asset?.location?.id === filters.locationId);
  if (filters.areaId) rows = rows.filter((r) => r.asset?.area?.id === filters.areaId);
  if (filters.frequencyKey && filters.frequencyKey !== "all") {
    // frequencyKey is applied client-side against presets; left permissive here.
  }
  return rows;
}

export async function getPpmPlanById(
  supabase: SupabaseClient<Database>,
  id: string
): Promise<PpmPlanDetail | null> {
  const { data, error } = await supabase
    .from("ppm_plans")
    .select(PLAN_SELECT + ", creator:created_by(full_name,email)")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("getPpmPlanById failed:", error.message);
    return null;
  }
  return (data as unknown as PpmPlanDetail) ?? null;
}

export async function getPpmPlanTasks(
  supabase: SupabaseClient<Database>,
  planId: string
): Promise<PpmPlanTask[]> {
  const { data, error } = await supabase
    .from("ppm_plan_tasks")
    .select("*")
    .eq("ppm_plan_id", planId)
    .order("sort_order", { ascending: true });
  if (error) {
    console.error("getPpmPlanTasks failed:", error.message);
    return [];
  }
  return data ?? [];
}

/** PPM-generated work orders for a plan (history table on the detail page). */
export async function getPpmHistoryForPlan(
  supabase: SupabaseClient<Database>,
  planId: string
): Promise<PpmHistoryRow[]> {
  const { data, error } = await supabase
    .from("work_orders")
    .select(
      "id, work_order_number, due_date, completed_at, verified_at, ppm_occurrence_id," +
        " status:status_id(id,name,code), assignee:assigned_to(full_name,email)"
    )
    .eq("ppm_plan_id", planId)
    .order("due_date", { ascending: false });
  if (error) {
    console.error("getPpmHistoryForPlan failed:", error.message);
    return [];
  }
  return (data ?? []) as unknown as PpmHistoryRow[];
}

export async function getPpmPlansForAsset(
  supabase: SupabaseClient<Database>,
  assetId: string
): Promise<PpmPlanRow[]> {
  const { data, error } = await supabase
    .from("ppm_plans")
    .select(PLAN_SELECT)
    .eq("asset_id", assetId)
    .order("next_due_date", { ascending: true });
  if (error) {
    console.error("getPpmPlansForAsset failed:", error.message);
    return [];
  }
  return (data ?? []) as unknown as PpmPlanRow[];
}

export async function getPpmActivity(
  supabase: SupabaseClient<Database>,
  planId: string
): Promise<PpmActivityRow[]> {
  const { data, error } = await supabase
    .from("ppm_activity")
    .select("*, actor:actor_id(full_name,email)")
    .eq("ppm_plan_id", planId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    console.error("getPpmActivity failed:", error.message);
    return [];
  }
  return (data ?? []) as unknown as PpmActivityRow[];
}

/** Execution checklist for a work order (technician + FM view). */
export async function getWorkOrderTasks(
  supabase: SupabaseClient<Database>,
  workOrderId: string
): Promise<WorkOrderTaskRow[]> {
  const { data, error } = await supabase
    .from("work_order_tasks")
    .select("*, completer:completed_by(full_name,email)")
    .eq("work_order_id", workOrderId)
    .order("sort_order", { ascending: true });
  if (error) {
    console.error("getWorkOrderTasks failed:", error.message);
    return [];
  }
  return (data ?? []) as unknown as WorkOrderTaskRow[];
}

/** Upcoming occurrences grouped windows for the schedule view. */
export async function getUpcomingOccurrences(
  supabase: SupabaseClient<Database>,
  withinDays = 30
): Promise<PpmOccurrenceRow[]> {
  const until = isoPlusDays(withinDays);
  const { data, error } = await supabase
    .from("ppm_occurrences")
    .select(
      "*, plan:ppm_plan_id(id,ppm_number,name)," +
        " work_order:work_order_id(id,work_order_number,status:status_id(id,name,code))"
    )
    .lte("scheduled_date", until)
    .in("status", ["upcoming", "due", "work_order_created"])
    .order("scheduled_date", { ascending: true });
  if (error) {
    console.error("getUpcomingOccurrences failed:", error.message);
    return [];
  }
  return (data ?? []) as unknown as PpmOccurrenceRow[];
}

/** Real summary metrics for the PM landing page + dashboard. */
export async function getPpmSummary(
  supabase: SupabaseClient<Database>
): Promise<PpmSummary> {
  const today = isoToday();
  const in7 = isoPlusDays(7);

  const activeBase = () => supabase.from("ppm_plans").select("id", { count: "exact", head: true }).eq("status", "active");

  // Closed/cancelled status ids to exclude from "open" PPM work orders.
  const { data: statuses } = await supabase
    .from("work_order_statuses")
    .select("id, code")
    .in("code", ["closed", "cancelled"]);
  const closedIds = (statuses ?? []).map((s) => (s as { id: string }).id);

  let openWo = supabase
    .from("work_orders")
    .select("id", { count: "exact", head: true })
    .eq("source", "ppm");
  if (closedIds.length) openWo = openWo.not("status_id", "in", `(${closedIds.join(",")})`);

  const [active, dueToday, dueSoon, overdue, open] = await Promise.all([
    activeBase(),
    activeBase().eq("next_due_date", today),
    activeBase().gt("next_due_date", today).lte("next_due_date", in7),
    activeBase().lt("next_due_date", today),
    openWo,
  ]);

  return {
    activePlans: active.count ?? 0,
    dueToday: dueToday.count ?? 0,
    dueNext7Days: dueSoon.count ?? 0,
    overdue: overdue.count ?? 0,
    openPpmWorkOrders: open.count ?? 0,
  };
}

/** Active assets with the fields the PPM plan picker needs. */
export async function getPpmAssetOptions(
  supabase: SupabaseClient<Database>
): Promise<import("@/lib/types/ppm").PpmAssetOption[]> {
  const { data, error } = await supabase
    .from("assets")
    .select("id, asset_code, name, category_id, category:category_id(name), location:location_id(name), area:area_id(name)")
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) {
    console.error("getPpmAssetOptions failed:", error.message);
    return [];
  }
  type Raw = {
    id: string; asset_code: string | null; name: string; category_id: string;
    category: { name: string } | null; location: { name: string } | null; area: { name: string } | null;
  };
  return ((data ?? []) as unknown as Raw[]).map((a) => ({
    id: a.id,
    asset_code: a.asset_code,
    name: a.name,
    category_id: a.category_id,
    category_name: a.category?.name ?? null,
    location_name: a.location?.name ?? null,
    area_name: a.area?.name ?? null,
  }));
}

/** The next upcoming/due occurrence for a plan (the one FM can generate/skip). */
export async function getNextActionableOccurrence(
  supabase: SupabaseClient<Database>,
  planId: string
): Promise<import("@/lib/types/ppm").PpmOccurrence | null> {
  const { data, error } = await supabase
    .from("ppm_occurrences")
    .select("*")
    .eq("ppm_plan_id", planId)
    .in("status", ["upcoming", "due"])
    .order("scheduled_date", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("getNextActionableOccurrence failed:", error.message);
    return null;
  }
  return (data as unknown as import("@/lib/types/ppm").PpmOccurrence) ?? null;
}

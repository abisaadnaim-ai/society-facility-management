import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { idb as vendorDb } from "@/lib/types/vendors";
import { idb as invDb } from "@/lib/types/inventory";
import type { ReportFilters } from "@/lib/reports/filters";
import {
  rdb,
  type DashboardOverview,
  type NeedsAttentionRow,
  type FmReport,
  type WoReport,
  type ResolutionReport,
  type SlaReport,
  type PpmReport,
  type InspectionReport,
  type FindingsReport,
  type AssetsReport,
  type VendorsReport,
  type InventoryReport,
  type LocationComparisonRow,
  type TechWorkloadRow,
  type PartsUsageRow,
  type TrendCountRow,
  type TrendSlaRow,
} from "@/lib/types/reports";

type SB = SupabaseClient<Database>;

async function callJson<T>(
  supabase: SB,
  fn: string,
  args: Record<string, unknown>,
  fallback: T
): Promise<T> {
  const { data, error } = await rdb(supabase).rpc<T>(fn, args);
  if (error) {
    console.error(`report rpc ${fn} failed:`, error.message);
    return fallback;
  }
  return (data ?? fallback) as T;
}

async function callRows<T>(
  supabase: SB,
  fn: string,
  args: Record<string, unknown>
): Promise<T[]> {
  const { data, error } = await rdb(supabase).rpc<T[]>(fn, args);
  if (error) {
    console.error(`report rpc ${fn} failed:`, error.message);
    return [];
  }
  return (data ?? []) as T[];
}

/** Common filter args for period reports. */
function periodArgs(f: ReportFilters, extra?: Record<string, unknown>) {
  return {
    p_from: f.fromUtc,
    p_to: f.toUtc,
    p_location: f.locationId,
    p_priority: f.priorityId,
    p_category: f.categoryId,
    ...extra,
  };
}

// ---- Dashboard / overview ----
export function getDashboardOverview(supabase: SB, f: ReportFilters) {
  return callJson<DashboardOverview>(
    supabase,
    "report_dashboard_overview",
    { p_location: f.locationId, p_priority: f.priorityId, p_category: f.categoryId },
    EMPTY_OVERVIEW
  );
}

export function getNeedsAttention(supabase: SB, f: ReportFilters, limit = 60) {
  return callRows<NeedsAttentionRow>(supabase, "report_needs_attention", {
    p_location: f.locationId,
    p_priority: f.priorityId,
    p_category: f.categoryId,
    p_limit: limit,
  });
}

export function getLocationComparison(supabase: SB, f: ReportFilters) {
  return callRows<LocationComparisonRow>(supabase, "report_location_comparison", {
    p_from: f.fromUtc,
    p_to: f.toUtc,
  });
}

// ---- Module reports ----
export const getFmReport = (s: SB, f: ReportFilters) =>
  callJson<FmReport>(s, "report_fm_requests", periodArgs(f), EMPTY_FM);
export const getWoReport = (s: SB, f: ReportFilters) =>
  callJson<WoReport>(s, "report_work_orders", periodArgs(f), EMPTY_WO);
export const getResolutionReport = (s: SB, f: ReportFilters) =>
  callJson<ResolutionReport>(s, "report_resolution_time", periodArgs(f), EMPTY_RES);
export const getSlaReport = (s: SB, f: ReportFilters) =>
  callJson<SlaReport>(s, "report_sla", periodArgs(f), EMPTY_SLA);
export const getPpmReport = (s: SB, f: ReportFilters) =>
  callJson<PpmReport>(s, "report_ppm", { p_from: f.fromUtc, p_to: f.toUtc, p_location: f.locationId }, EMPTY_PPM);
export const getInspectionReport = (s: SB, f: ReportFilters) =>
  callJson<InspectionReport>(s, "report_inspections", { p_from: f.fromUtc, p_to: f.toUtc, p_location: f.locationId }, EMPTY_INSP);
export const getFindingsReport = (s: SB, f: ReportFilters) =>
  callJson<FindingsReport>(s, "report_findings", periodArgs(f), EMPTY_FIND);
export const getAssetsReport = (s: SB, f: ReportFilters) =>
  callJson<AssetsReport>(s, "report_assets", { p_from: f.fromUtc, p_to: f.toUtc, p_location: f.locationId, p_category: f.categoryId }, EMPTY_ASSETS);
export const getVendorsReport = (s: SB, f: ReportFilters) =>
  callJson<VendorsReport>(s, "report_vendors", { p_from: f.fromUtc, p_to: f.toUtc }, EMPTY_VENDORS);
export const getInventoryReport = (s: SB, f: ReportFilters) =>
  callJson<InventoryReport>(s, "report_inventory", { p_from: f.fromUtc, p_to: f.toUtc, p_location: f.locationId }, EMPTY_INV);
export const getTechnicianWorkload = (s: SB, f: ReportFilters) =>
  callRows<TechWorkloadRow>(s, "report_technician_workload", { p_from: f.fromUtc, p_to: f.toUtc, p_location: f.locationId });
export const getPartsUsage = (s: SB, f: ReportFilters) =>
  callRows<PartsUsageRow>(s, "report_parts_usage", { p_from: f.fromUtc, p_to: f.toUtc, p_location: f.locationId });
export const getTrendCounts = (s: SB, f: ReportFilters, bucket = "day") =>
  callRows<TrendCountRow>(s, "report_trend_counts", { p_from: f.fromUtc, p_to: f.toUtc, p_location: f.locationId, p_bucket: bucket });
export const getTrendSla = (s: SB, f: ReportFilters, bucket = "week") =>
  callRows<TrendSlaRow>(s, "report_trend_sla", { p_from: f.fromUtc, p_to: f.toUtc, p_location: f.locationId, p_bucket: bucket });

// ============================================================================
// CSV row builders — RLS-respecting queries via the authenticated client.
// Business-facing columns only; human-readable WO/FM/PPM numbers, no UUIDs or
// internal implementation fields (spec §29/§47).
// ============================================================================

export type CsvTable = { filename: string; headers: string[]; rows: (string | number)[][] };

const iso = (v: string | null | undefined) => (v ? v : "");

export async function exportFmRequests(supabase: SB, f: ReportFilters): Promise<CsvTable> {
  let q = supabase
    .from("fm_requests")
    .select(
      "request_number, title, created_at, first_responded_at, response_sla_status, closed_at, status:status_id(name), priority:priority_id(name), category:category_id(name), location:location_id(name), area:area_id(name)"
    )
    .gte("created_at", f.fromUtc)
    .lt("created_at", f.toUtc);
  if (f.locationId) q = q.eq("location_id", f.locationId);
  if (f.areaId) q = q.eq("area_id", f.areaId);
  if (f.priorityId) q = q.eq("priority_id", f.priorityId);
  if (f.categoryId) q = q.eq("category_id", f.categoryId);
  const { data } = await q.order("created_at", { ascending: false });
  const rows = ((data ?? []) as unknown as Array<{
    request_number: string; title: string; created_at: string;
    first_responded_at: string | null; response_sla_status: string | null; closed_at: string | null;
    status: { name: string } | null; priority: { name: string } | null;
    category: { name: string } | null; location: { name: string } | null; area: { name: string } | null;
  }>)
    .map((r) => [
      r.request_number, r.title, r.status?.name ?? "", r.priority?.name ?? "",
      r.category?.name ?? "", r.location?.name ?? "", r.area?.name ?? "",
      iso(r.created_at), iso(r.first_responded_at), r.response_sla_status ?? "", iso(r.closed_at),
    ]);
  return {
    filename: "fm-requests",
    headers: ["Request #", "Title", "Status", "Priority", "Category", "Location", "Area", "Created", "First Response", "Response SLA", "Closed"],
    rows,
  };
}

export async function exportWorkOrders(supabase: SB, f: ReportFilters): Promise<CsvTable> {
  let q = supabase
    .from("work_orders")
    .select(
      "work_order_number, title, source, created_at, due_date, completed_at, closed_at, resolution_sla_status, status:status_id(name), priority:priority_id(name), category:category_id(name), location:location_id(name), assignee:assigned_to(full_name)"
    )
    .gte("created_at", f.fromUtc)
    .lt("created_at", f.toUtc);
  if (f.locationId) q = q.eq("location_id", f.locationId);
  if (f.priorityId) q = q.eq("priority_id", f.priorityId);
  if (f.categoryId) q = q.eq("category_id", f.categoryId);
  const { data } = await q.order("created_at", { ascending: false });
  const rows = ((data ?? []) as unknown as Array<{
    work_order_number: string; title: string; source: string; created_at: string;
    due_date: string | null; completed_at: string | null; closed_at: string | null; resolution_sla_status: string | null;
    status: { name: string } | null; priority: { name: string } | null; category: { name: string } | null;
    location: { name: string } | null; assignee: { full_name: string | null } | null;
  }>).map((r) => [
    r.work_order_number, r.title, r.status?.name ?? "", r.priority?.name ?? "",
    r.category?.name ?? "", r.location?.name ?? "", r.source ?? "", r.assignee?.full_name ?? "",
    iso(r.created_at), iso(r.due_date), iso(r.completed_at), iso(r.closed_at), r.resolution_sla_status ?? "",
  ]);
  return {
    filename: "work-orders",
    headers: ["WO #", "Title", "Status", "Priority", "Category", "Location", "Source", "Assigned To", "Created", "Due", "Completed", "Closed", "Resolution SLA"],
    rows,
  };
}

export async function exportContracts(supabase: SB): Promise<CsvTable> {
  const db = vendorDb(supabase);
  const { data } = await db
    .from("service_contracts")
    .select("contract_number, name, start_date, end_date, status, vendor_id")
    .order("end_date", { ascending: true });
  const contracts = ((data ?? []) as unknown as Array<{
    contract_number: string; name: string; start_date: string | null; end_date: string | null;
    status: string; vendor_id: string | null;
  }>);
  const vendorIds = [...new Set(contracts.map((c) => c.vendor_id).filter(Boolean))] as string[];
  const vendorMap = new Map<string, string>();
  if (vendorIds.length) {
    const { data: vs } = await db.from("vendors").select("id, company_name").in("id", vendorIds);
    ((vs ?? []) as unknown as { id: string; company_name: string | null }[]).forEach((v) =>
      vendorMap.set(v.id, v.company_name ?? "")
    );
  }
  const today = new Date();
  const rows = contracts.map((c) => {
    const remaining = c.end_date
      ? Math.ceil((new Date(`${c.end_date}T12:00:00Z`).getTime() - today.getTime()) / 86400000)
      : "";
    return [
      c.contract_number, c.name, c.vendor_id ? vendorMap.get(c.vendor_id) ?? "" : "",
      iso(c.start_date), iso(c.end_date), remaining, c.status,
    ];
  });
  return {
    filename: "contracts",
    headers: ["Contract #", "Contract", "Vendor", "Start Date", "End Date", "Remaining Days", "Status"],
    rows,
  };
}

export async function exportStockMovements(supabase: SB, f: ReportFilters): Promise<CsvTable> {
  const db = invDb(supabase);
  const { data } = await db
    .from("inventory_movements")
    .select("movement_number, created_at, movement_type, quantity, reference, inventory_item_id, technician_id, work_order_id")
    .gte("created_at", f.fromUtc)
    .lt("created_at", f.toUtc)
    .order("created_at", { ascending: false });
  const moves = ((data ?? []) as unknown as Array<{
    movement_number: string; created_at: string; movement_type: string; quantity: number; reference: string | null;
    inventory_item_id: string | null; technician_id: string | null; work_order_id: string | null;
  }>);

  const uniq = (arr: (string | null)[]) => [...new Set(arr.filter(Boolean))] as string[];
  const itemMap = new Map<string, { code: string; name: string }>();
  const techMap = new Map<string, string>();
  const woMap = new Map<string, string>();

  const itemIds = uniq(moves.map((m) => m.inventory_item_id));
  if (itemIds.length) {
    const { data: items } = await db.from("inventory_items").select("id, item_code, name").in("id", itemIds);
    ((items ?? []) as unknown as { id: string; item_code: string; name: string }[]).forEach((i) =>
      itemMap.set(i.id, { code: i.item_code, name: i.name })
    );
  }
  const techIds = uniq(moves.map((m) => m.technician_id));
  if (techIds.length) {
    const { data: ps } = await supabase.from("profiles").select("id, full_name").in("id", techIds);
    ((ps ?? []) as unknown as { id: string; full_name: string | null }[]).forEach((p) =>
      techMap.set(p.id, p.full_name ?? "")
    );
  }
  const woIds = uniq(moves.map((m) => m.work_order_id));
  if (woIds.length) {
    const { data: ws } = await supabase.from("work_orders").select("id, work_order_number").in("id", woIds);
    ((ws ?? []) as unknown as { id: string; work_order_number: string }[]).forEach((w) =>
      woMap.set(w.id, w.work_order_number)
    );
  }

  const rows = moves.map((m) => {
    const item = m.inventory_item_id ? itemMap.get(m.inventory_item_id) : undefined;
    return [
      m.movement_number, iso(m.created_at), m.movement_type, item?.code ?? "", item?.name ?? "",
      m.quantity, m.work_order_id ? woMap.get(m.work_order_id) ?? "" : "",
      m.technician_id ? techMap.get(m.technician_id) ?? "" : "", m.reference ?? "",
    ];
  });
  return {
    filename: "stock-movements",
    headers: ["Movement #", "Date", "Type", "Item Code", "Item", "Quantity", "Work Order #", "Technician", "Reference"],
    rows,
  };
}

// ---- empty defaults ----
const EMPTY_OVERVIEW: DashboardOverview = {
  as_of: "", today_qatar: "",
  current_ops: { open_fm_requests: 0, open_work_orders: 0, critical_open: 0, sla_breached: 0, overdue_work_orders: 0, awaiting_verification: 0, unassigned_work_orders: 0, open_escalations: 0 },
  preventive: { ppm_due_today: 0, ppm_due_7d: 0, ppm_overdue: 0, ppm_open_wo: 0 },
  inspections: { due_today: 0, overdue: 0, failed_open: 0, open_findings: 0 },
  vendors: { wo_waiting_vendor: 0, contracts_expiring_90d: 0, contracts_expired: 0 },
  inventory: { low_stock: 0, out_of_stock: 0 },
};
const EMPTY_FM: FmReport = { totals: { total: 0, open: 0, closed: 0, rejected: 0, cancelled: 0, critical: 0 }, avg_response_seconds: null, response_sample: 0, by_priority: [], by_category: [], by_location: [], by_area: [] };
const EMPTY_WO: WoReport = { totals: { total: 0, new: 0, assigned: 0, in_progress: 0, waiting: 0, completed: 0, verified: 0, closed: 0, cancelled: 0, open: 0, overdue: 0, sla_breached: 0, escalated: 0 }, by_status: [], by_priority: [], by_source: [], by_location: [], by_area: [], by_category: [], by_technician: [] };
const EMPTY_RES: ResolutionReport = { resolved_count: 0, avg_seconds: null, median_seconds: null, min_seconds: null, max_seconds: null, by_priority: [], by_location: [], by_category: [] };
const EMPTY_SLA: SlaReport = { response: { met: 0, breached: 0, applicable: 0, compliance_pct: null }, resolution: { met: 0, breached: 0, applicable: 0, compliance_pct: null }, overall: { met: 0, breached: 0, applicable: 0, compliance_pct: null }, breaches_by_priority: [], breaches_by_location: [], breaches_by_category: [] };
const EMPTY_PPM: PpmReport = { active_plans: 0, scheduled: 0, completed: 0, completed_on_time: 0, overdue: 0, skipped: 0, open_wo: 0, compliance_pct: null, by_location: [], by_category: [], by_technician: [] };
const EMPTY_INSP: InspectionReport = { scheduled: 0, completed: 0, passed: 0, failed: 0, overdue: 0, skipped: 0, awaiting_review: 0, compliance_pct: null, by_location: [], by_area: [], by_template: [], by_inspector: [] };
const EMPTY_FIND: FindingsReport = { total: 0, open: 0, action_required: 0, fm_request_created: 0, work_order_created: 0, resolved: 0, dismissed: 0, by_location: [], by_priority: [], by_category: [], by_template: [], by_asset: [] };
const EMPTY_ASSETS: AssetsReport = { most_wo: [], repeat_failure_count: 0, repeat_failures: [], out_of_service: 0, under_maintenance: 0, out_of_service_list: [], findings_by_asset: [], recurring_categories: [], recurring_areas: [], downtime_supported: false, downtime_note: "" };
const EMPTY_VENDORS: VendorsReport = { active_vendors: 0, active_contracts: 0, expiring_90d: 0, expiring_30d: 0, expired: 0, wo_waiting_vendor: 0, completed_vendor_wo: 0, avg_resolution_seconds: null, wo_by_vendor: [] };
const EMPTY_INV: InventoryReport = { total_items: 0, low_stock: 0, out_of_stock: 0, movements_total: 0, issued_qty: 0, returned_qty: 0, adjustments: 0, transfers: 0 };

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

/**
 * The reporting RPCs are created by Phase 9 migrations and are not present in
 * the generated database types (which we do not regenerate). We call them via a
 * narrow typed wrapper rather than `any`, and cast each result to its interface.
 */
type RpcResult<T> = { data: T | null; error: { message: string } | null };
interface ReportRpcClient {
  rpc<T>(fn: string, args?: Record<string, unknown>): PromiseLike<RpcResult<T>>;
}
export function rdb(supabase: SupabaseClient<Database>): ReportRpcClient {
  return supabase as unknown as ReportRpcClient;
}

export type Breakdown = {
  label?: string;
  code?: string | null;
  id?: string | null;
  count: number;
  avg_seconds?: number | null;
};

export type DashboardOverview = {
  as_of: string;
  today_qatar: string;
  current_ops: {
    open_fm_requests: number;
    open_work_orders: number;
    critical_open: number;
    sla_breached: number;
    overdue_work_orders: number;
    awaiting_verification: number;
    unassigned_work_orders: number;
    open_escalations: number;
  };
  preventive: {
    ppm_due_today: number;
    ppm_due_7d: number;
    ppm_overdue: number;
    ppm_open_wo: number;
  };
  inspections: {
    due_today: number;
    overdue: number;
    failed_open: number;
    open_findings: number;
  };
  vendors: {
    wo_waiting_vendor: number;
    contracts_expiring_90d: number;
    contracts_expired: number;
  };
  inventory: { low_stock: number; out_of_stock: number };
};

export type NeedsAttentionRow = {
  rank: number;
  category: string;
  entity_type: string;
  entity_id: string;
  ref: string | null;
  title: string | null;
  detail: string | null;
  priority_code: string | null;
  occurred_at: string | null;
  link: string;
};

export type FmReport = {
  totals: {
    total: number;
    open: number;
    closed: number;
    rejected: number;
    cancelled: number;
    critical: number;
  };
  avg_response_seconds: number | null;
  response_sample: number;
  by_priority: Breakdown[];
  by_category: Breakdown[];
  by_location: Breakdown[];
  by_area: Breakdown[];
};

export type WoReport = {
  totals: {
    total: number;
    new: number;
    assigned: number;
    in_progress: number;
    waiting: number;
    completed: number;
    verified: number;
    closed: number;
    cancelled: number;
    open: number;
    overdue: number;
    sla_breached: number;
    escalated: number;
  };
  by_status: Breakdown[];
  by_priority: Breakdown[];
  by_source: Breakdown[];
  by_location: Breakdown[];
  by_area: Breakdown[];
  by_category: Breakdown[];
  by_technician: Breakdown[];
};

export type ResolutionReport = {
  resolved_count: number;
  avg_seconds: number | null;
  median_seconds: number | null;
  min_seconds: number | null;
  max_seconds: number | null;
  by_priority: Breakdown[];
  by_location: Breakdown[];
  by_category: Breakdown[];
};

export type SlaBucket = {
  met: number;
  breached: number;
  applicable: number;
  compliance_pct: number | null;
};
export type SlaReport = {
  response: SlaBucket;
  resolution: SlaBucket;
  overall: SlaBucket;
  breaches_by_priority: Breakdown[];
  breaches_by_location: Breakdown[];
  breaches_by_category: Breakdown[];
};

export type PpmReport = {
  active_plans: number;
  scheduled: number;
  completed: number;
  completed_on_time: number;
  overdue: number;
  skipped: number;
  open_wo: number;
  compliance_pct: number | null;
  by_location: (Breakdown & {
    scheduled?: number;
    completed?: number;
    overdue?: number;
    skipped?: number;
    compliance_pct?: number | null;
  })[];
  by_category: (Breakdown & { scheduled?: number; completed?: number; overdue?: number })[];
  by_technician: (Breakdown & { scheduled?: number; completed?: number })[];
};

export type InspectionReport = {
  scheduled: number;
  completed: number;
  passed: number;
  failed: number;
  overdue: number;
  skipped: number;
  awaiting_review: number;
  compliance_pct: number | null;
  by_location: (Breakdown & { scheduled?: number; completed?: number; failed?: number })[];
  by_area: (Breakdown & { scheduled?: number })[];
  by_template: (Breakdown & { scheduled?: number; passed?: number; failed?: number })[];
  by_inspector: (Breakdown & { scheduled?: number; completed?: number })[];
};

export type FindingsReport = {
  total: number;
  open: number;
  action_required: number;
  fm_request_created: number;
  work_order_created: number;
  resolved: number;
  dismissed: number;
  by_location: Breakdown[];
  by_priority: Breakdown[];
  by_category: Breakdown[];
  by_template: Breakdown[];
  by_asset: Breakdown[];
};

export type AssetsReport = {
  most_wo: Breakdown[];
  repeat_failure_count: number;
  repeat_failures: Breakdown[];
  out_of_service: number;
  under_maintenance: number;
  out_of_service_list: Breakdown[];
  findings_by_asset: Breakdown[];
  recurring_categories: Breakdown[];
  recurring_areas: Breakdown[];
  downtime_supported: boolean;
  downtime_note: string;
};

export type VendorsReport = {
  active_vendors: number;
  active_contracts: number;
  expiring_90d: number;
  expiring_30d: number;
  expired: number;
  wo_waiting_vendor: number;
  completed_vendor_wo: number;
  avg_resolution_seconds: number | null;
  wo_by_vendor: Breakdown[];
};

export type InventoryReport = {
  total_items: number;
  low_stock: number;
  out_of_stock: number;
  movements_total: number;
  issued_qty: number;
  returned_qty: number;
  adjustments: number;
  transfers: number;
};

export type LocationComparisonRow = {
  location_id: string;
  location: string;
  fm_requests: number;
  work_orders: number;
  critical: number;
  overdue_wo: number;
  sla_met: number;
  sla_breached: number;
  sla_compliance_pct: number | null;
  avg_resolution_seconds: number | null;
  ppm_applicable: number;
  ppm_on_time: number;
  ppm_compliance_pct: number | null;
  insp_completed: number;
  insp_overdue: number;
  insp_compliance_pct: number | null;
  findings: number;
};

export type TechWorkloadRow = {
  technician_id: string;
  technician: string;
  new_assigned: number;
  in_progress: number;
  waiting: number;
  awaiting_verification: number;
  open_total: number;
  completed_period: number;
  closed_period: number;
  overdue: number;
  avg_resolution_seconds: number | null;
  ppm_open: number;
  inspections_assigned: number;
  inspections_completed: number;
};

export type PartsUsageRow = {
  item_id: string;
  item_code: string;
  item_name: string;
  issued_qty: number;
  returned_qty: number;
  net_used: number;
  movement_count: number;
};

export type TrendCountRow = {
  bucket: string;
  fm_created: number;
  wo_created: number;
  wo_closed: number;
};

export type TrendSlaRow = {
  bucket: string;
  response_pct: number | null;
  resolution_pct: number | null;
};

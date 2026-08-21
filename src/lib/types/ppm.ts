import type { Tables } from "@/lib/types/database";
import type { NamedRef, StatusRef, PersonRef } from "@/lib/types/fm";

// ---- Row aliases ----
export type PpmPlan = Tables<"ppm_plans">;
export type PpmPlanTask = Tables<"ppm_plan_tasks">;
export type PpmOccurrence = Tables<"ppm_occurrences">;
export type WorkOrderTask = Tables<"work_order_tasks">;
export type PpmActivity = Tables<"ppm_activity">;

// ---- Enums (mirror DB check constraints) ----
export type PpmPlanStatus = "active" | "paused" | "archived";
export type FrequencyUnit = "day" | "week" | "month" | "year";
export type OccurrenceStatus =
  | "upcoming"
  | "due"
  | "work_order_created"
  | "completed"
  | "skipped"
  | "cancelled";

/** Derived scheduling state shown in the UI (NOT the plan status). */
export type DueStatus =
  | "upcoming"
  | "due_soon"
  | "due_today"
  | "overdue"
  | "paused"
  | "archived";

// ---- Joined asset reference (asset drives location + area) ----
export type PpmAssetRef = {
  id: string;
  asset_code: string | null;
  name: string;
  is_active: boolean;
  location: NamedRef;
  area: NamedRef;
} | null;

// ---- Composite (joined) types ----
export type PpmPlanRow = PpmPlan & {
  asset: PpmAssetRef;
  category: NamedRef;
  priority: StatusRef;
  technician: PersonRef;
};

export type PpmPlanDetail = PpmPlanRow & {
  creator: PersonRef;
};

/** A previously generated PPM work order shown in plan/asset history. */
export type PpmHistoryRow = {
  id: string;
  work_order_number: string;
  due_date: string | null;
  completed_at: string | null;
  verified_at: string | null;
  status: StatusRef;
  assignee: PersonRef;
  ppm_occurrence_id: string | null;
};

export type PpmActivityRow = PpmActivity & { actor: PersonRef };

/** Occurrence joined with its (optional) work order, for the schedule view. */
export type PpmOccurrenceRow = PpmOccurrence & {
  plan: { id: string; ppm_number: string; name: string } | null;
  work_order: { id: string; work_order_number: string; status: StatusRef } | null;
};

/** Execution checklist item on a work order. */
export type WorkOrderTaskRow = WorkOrderTask & { completer: PersonRef };

// ---- Dashboard / summary metrics ----
export type PpmSummary = {
  activePlans: number;
  dueToday: number;
  dueNext7Days: number;
  overdue: number;
  openPpmWorkOrders: number;
};

// ---- Filters ----
export type PpmFilters = {
  search: string;
  locationId: string;
  areaId: string;
  categoryId: string;
  assetId: string;
  frequencyKey: string;
  technicianId: string;
  status: string;
  dueStatus: string;
};

// ---- Frequency presets (UI shows presets; DB stores unit + interval) ----
export type FrequencyPreset = {
  key: string;
  label: string;
  unit: FrequencyUnit;
  interval: number;
  custom?: boolean;
};

export const FREQUENCY_PRESETS: FrequencyPreset[] = [
  { key: "daily", label: "Daily", unit: "day", interval: 1 },
  { key: "weekly", label: "Weekly", unit: "week", interval: 1 },
  { key: "biweekly", label: "Every 2 weeks", unit: "week", interval: 2 },
  { key: "monthly", label: "Monthly", unit: "month", interval: 1 },
  { key: "quarterly", label: "Quarterly", unit: "month", interval: 3 },
  { key: "semiannual", label: "Semi-Annual", unit: "month", interval: 6 },
  { key: "annual", label: "Annual", unit: "year", interval: 1 },
  { key: "custom", label: "Custom interval", unit: "month", interval: 1, custom: true },
];

const UNIT_LABELS: Record<FrequencyUnit, [string, string]> = {
  day: ["day", "days"],
  week: ["week", "weeks"],
  month: ["month", "months"],
  year: ["year", "years"],
};

/** Human label for a unit+interval pair, using preset names where they match. */
export function frequencyLabel(unit: string, interval: number): string {
  const preset = FREQUENCY_PRESETS.find(
    (p) => !p.custom && p.unit === unit && p.interval === interval
  );
  if (preset) return preset.label;
  const u = UNIT_LABELS[unit as FrequencyUnit];
  if (!u) return `${interval} ${unit}`;
  return interval === 1 ? `Every ${u[0]}` : `Every ${interval} ${u[1]}`;
}

/** Maps a stored unit+interval back to a preset key (for editing). */
export function presetKeyFor(unit: string, interval: number): string {
  const preset = FREQUENCY_PRESETS.find(
    (p) => !p.custom && p.unit === unit && p.interval === interval
  );
  return preset ? preset.key : "custom";
}

/**
 * Derives the scheduling badge from plan status + next due date. This is the
 * PLAN's due status, kept deliberately separate from occurrence and work-order
 * status. `today` and `nextDue` are ISO yyyy-mm-dd strings.
 */
export function deriveDueStatus(
  status: string,
  nextDue: string | null,
  today: string
): DueStatus {
  if (status === "archived") return "archived";
  if (status === "paused") return "paused";
  if (!nextDue) return "upcoming";
  if (nextDue < today) return "overdue";
  if (nextDue === today) return "due_today";
  // within 7 days => due soon
  const d = new Date(nextDue + "T00:00:00Z").getTime();
  const t = new Date(today + "T00:00:00Z").getTime();
  const days = Math.round((d - t) / 86400000);
  return days <= 7 ? "due_soon" : "upcoming";
}

export const DUE_STATUS_META: Record<DueStatus, { label: string; tone: "neutral" | "info" | "warning" | "danger" | "success" }> = {
  upcoming: { label: "Upcoming", tone: "neutral" },
  due_soon: { label: "Due Soon", tone: "info" },
  due_today: { label: "Due Today", tone: "warning" },
  overdue: { label: "Overdue", tone: "danger" },
  paused: { label: "Paused", tone: "neutral" },
  archived: { label: "Archived", tone: "neutral" },
};

export const PLAN_STATUS_META: Record<PpmPlanStatus, { label: string; tone: "success" | "warning" | "neutral" }> = {
  active: { label: "Active", tone: "success" },
  paused: { label: "Paused", tone: "warning" },
  archived: { label: "Archived", tone: "neutral" },
};

export const OCCURRENCE_STATUS_META: Record<OccurrenceStatus, { label: string; tone: "neutral" | "info" | "warning" | "danger" | "success" }> = {
  upcoming: { label: "Upcoming", tone: "neutral" },
  due: { label: "Due", tone: "warning" },
  work_order_created: { label: "Work Order Created", tone: "info" },
  completed: { label: "Completed", tone: "success" },
  skipped: { label: "Skipped", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "danger" },
};

/** Rich asset option for the PPM plan picker (asset drives location/area/category). */
export type PpmAssetOption = {
  id: string;
  asset_code: string | null;
  name: string;
  category_id: string;
  category_name: string | null;
  location_name: string | null;
  area_name: string | null;
};

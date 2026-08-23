import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import {
  idb,
  type InspectionTemplate,
  type InspectionTemplateSection,
  type InspectionTemplateItem,
  type InspectionTemplateRow,
  type InspectionScheduleRow,
  type InspectionOccurrenceRow,
  type InspectionResponseRow,
  type InspectionFindingRow,
  type InspectionActivityRow,
  type InspectionSummary,
} from "@/lib/types/inspections";
import type { PersonOption } from "@/lib/types/fm";

export function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

const SCHEDULE_SELECT =
  "*, template:template_id(id,name,template_number), location:location_id(id,name)," +
  " area:area_id(id,name), asset:asset_id(id,name), assignee:assigned_to(full_name,email)";

const OCC_SELECT =
  "*, template:template_id(id,name), location:location_id(id,name), area:area_id(id,name)," +
  " asset:asset_id(id,name), assignee:assigned_to(full_name,email), schedule:schedule_id(id,schedule_number)";

const FINDING_SELECT =
  "*, inspection:inspection_id(id,inspection_number), location:location_id(id,name)," +
  " area:area_id(id,name), asset:asset_id(id,name), category:category_id(id,name)," +
  " priority:priority_id(id,name,code), fm_request:fm_request_id(id,request_number)," +
  " work_order:work_order_id(id,work_order_number)";

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------
export async function getInspectionTemplates(
  supabase: SupabaseClient<Database>
): Promise<InspectionTemplateRow[]> {
  const db = idb(supabase);
  const { data, error } = await db
    .from("inspection_templates")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getInspectionTemplates failed:", error.message);
    return [];
  }
  const templates = (data ?? []) as InspectionTemplate[];
  if (templates.length === 0) return [];

  const ids = templates.map((t) => t.id);
  const [{ data: secs }, { data: items }, { data: scheds }] = await Promise.all([
    db.from("inspection_template_sections").select("template_id").in("template_id", ids),
    db.from("inspection_template_items").select("template_id").in("template_id", ids),
    db.from("inspection_schedules").select("template_id").in("template_id", ids),
  ]);
  const count = (rows: { template_id: string }[] | null, id: string) =>
    (rows ?? []).filter((r) => r.template_id === id).length;

  return templates.map((t) => ({
    ...t,
    section_count: count(secs as { template_id: string }[] | null, t.id),
    item_count: count(items as { template_id: string }[] | null, t.id),
    schedule_count: count(scheds as { template_id: string }[] | null, t.id),
  }));
}

export type TemplateWithContent = {
  template: InspectionTemplate;
  sections: InspectionTemplateSection[];
  items: InspectionTemplateItem[];
};

export async function getInspectionTemplateById(
  supabase: SupabaseClient<Database>,
  id: string
): Promise<TemplateWithContent | null> {
  const db = idb(supabase);
  const { data: template, error } = await db
    .from("inspection_templates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !template) {
    if (error) console.error("getInspectionTemplateById failed:", error.message);
    return null;
  }
  const [{ data: sections }, { data: items }] = await Promise.all([
    db.from("inspection_template_sections").select("*").eq("template_id", id).order("sort_order"),
    db.from("inspection_template_items").select("*").eq("template_id", id).order("sort_order"),
  ]);
  return {
    template: template as InspectionTemplate,
    sections: (sections ?? []) as InspectionTemplateSection[],
    items: (items ?? []) as InspectionTemplateItem[],
  };
}

// ---------------------------------------------------------------------------
// Schedules
// ---------------------------------------------------------------------------
export async function getInspectionSchedules(
  supabase: SupabaseClient<Database>
): Promise<InspectionScheduleRow[]> {
  const { data, error } = await idb(supabase)
    .from("inspection_schedules")
    .select(SCHEDULE_SELECT)
    .order("next_due_date", { ascending: true });
  if (error) {
    console.error("getInspectionSchedules failed:", error.message);
    return [];
  }
  return (data ?? []) as unknown as InspectionScheduleRow[];
}

// ---------------------------------------------------------------------------
// Occurrences
// ---------------------------------------------------------------------------
export async function getInspectionOccurrences(
  supabase: SupabaseClient<Database>,
  opts: { assignedToMe?: string; statuses?: string[]; upcomingOnly?: boolean; historyOnly?: boolean } = {}
): Promise<InspectionOccurrenceRow[]> {
  let q = idb(supabase).from("inspection_occurrences").select(OCC_SELECT);
  if (opts.assignedToMe) q = q.eq("assigned_to", opts.assignedToMe);
  if (opts.statuses && opts.statuses.length) q = q.in("status", opts.statuses);
  if (opts.upcomingOnly) q = q.in("status", ["scheduled", "due", "in_progress"]);
  if (opts.historyOnly) q = q.in("status", ["closed", "skipped", "cancelled"]);
  q =
    opts.historyOnly
      ? q.order("scheduled_date", { ascending: false })
      : q.order("scheduled_date", { ascending: true });
  const { data, error } = await q;
  if (error) {
    console.error("getInspectionOccurrences failed:", error.message);
    return [];
  }
  return (data ?? []) as unknown as InspectionOccurrenceRow[];
}

export type InspectionDetail = {
  occurrence: InspectionOccurrenceRow;
  responses: InspectionResponseRow[];
  activity: InspectionActivityRow[];
};

export async function getInspectionById(
  supabase: SupabaseClient<Database>,
  id: string
): Promise<InspectionDetail | null> {
  const db = idb(supabase);
  const { data: occ, error } = await db
    .from("inspection_occurrences")
    .select(OCC_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error || !occ) {
    if (error) console.error("getInspectionById failed:", error.message);
    return null;
  }
  const [{ data: responses }, { data: atts }, { data: activity }] = await Promise.all([
    db.from("inspection_responses").select("*, responder:responded_by(full_name,email)").eq("inspection_id", id).order("sort_order"),
    db.from("inspection_response_attachments").select("*").eq("inspection_id", id),
    db.from("inspection_activity").select("*, actor:actor_id(full_name,email)").eq("occurrence_id", id).order("created_at", { ascending: false }),
  ]);
  const attByResp = (atts ?? []) as { response_id: string }[];
  const responseRows = ((responses ?? []) as unknown as InspectionResponseRow[]).map((r) => ({
    ...r,
    attachments: (attByResp.filter((a) => a.response_id === r.id) as unknown as InspectionResponseRow["attachments"]),
  }));
  return {
    occurrence: occ as unknown as InspectionOccurrenceRow,
    responses: responseRows,
    activity: (activity ?? []) as unknown as InspectionActivityRow[],
  };
}

// ---------------------------------------------------------------------------
// Findings
// ---------------------------------------------------------------------------
export async function getInspectionFindings(
  supabase: SupabaseClient<Database>,
  opts: { openOnly?: boolean } = {}
): Promise<InspectionFindingRow[]> {
  let q = idb(supabase).from("inspection_findings").select(FINDING_SELECT);
  if (opts.openOnly) q = q.in("status", ["open", "action_required"]);
  q = q.order("created_at", { ascending: false });
  const { data, error } = await q;
  if (error) {
    console.error("getInspectionFindings failed:", error.message);
    return [];
  }
  return (data ?? []) as unknown as InspectionFindingRow[];
}

export async function getFindingsForInspection(
  supabase: SupabaseClient<Database>,
  inspectionId: string
): Promise<InspectionFindingRow[]> {
  const { data, error } = await idb(supabase)
    .from("inspection_findings")
    .select(FINDING_SELECT)
    .eq("inspection_id", inspectionId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("getFindingsForInspection failed:", error.message);
    return [];
  }
  return (data ?? []) as unknown as InspectionFindingRow[];
}

// ---------------------------------------------------------------------------
// Dashboard summary
// ---------------------------------------------------------------------------
export async function getInspectionSummary(
  supabase: SupabaseClient<Database>
): Promise<InspectionSummary> {
  const db = idb(supabase);
  const today = isoToday();

  const [dueToday, overdue, inProgress, awaitingReview, failed, openFindings] = await Promise.all([
    db.from("inspection_occurrences").select("id", { count: "exact", head: true })
      .in("status", ["scheduled", "due"]).eq("scheduled_date", today),
    db.from("inspection_occurrences").select("id", { count: "exact", head: true })
      .in("status", ["scheduled", "due", "in_progress"]).lt("scheduled_date", today),
    db.from("inspection_occurrences").select("id", { count: "exact", head: true })
      .eq("status", "in_progress"),
    db.from("inspection_occurrences").select("id", { count: "exact", head: true })
      .eq("status", "submitted"),
    db.from("inspection_occurrences").select("id", { count: "exact", head: true })
      .in("status", ["submitted", "reviewed"]).eq("overall_result", "fail"),
    db.from("inspection_findings").select("id", { count: "exact", head: true })
      .in("status", ["open", "action_required"]),
  ]);

  return {
    dueToday: dueToday.count ?? 0,
    overdue: overdue.count ?? 0,
    inProgress: inProgress.count ?? 0,
    awaitingReview: awaitingReview.count ?? 0,
    failedInspections: failed.count ?? 0,
    openFindings: openFindings.count ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Asset / location light integration
// ---------------------------------------------------------------------------
export async function getInspectionsForAsset(
  supabase: SupabaseClient<Database>,
  assetId: string
): Promise<InspectionOccurrenceRow[]> {
  const { data, error } = await idb(supabase)
    .from("inspection_occurrences")
    .select(OCC_SELECT)
    .eq("asset_id", assetId)
    .order("scheduled_date", { ascending: false })
    .limit(10);
  if (error) return [];
  return (data ?? []) as unknown as InspectionOccurrenceRow[];
}

// ---------------------------------------------------------------------------
// Inspector options (active users who may perform inspections)
// ---------------------------------------------------------------------------
export async function getInspectorOptions(
  supabase: SupabaseClient<Database>
): Promise<PersonOption[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, is_active, role:role_id(code)")
    .eq("is_active", true)
    .order("full_name");
  if (error) {
    console.error("getInspectorOptions failed:", error.message);
    return [];
  }
  const allowed = new Set(["super_admin", "facility_manager", "technician"]);
  return ((data ?? []) as unknown as Array<PersonOption & { role: { code: string } | null }>)
    .filter((p) => p.role && allowed.has(p.role.code))
    .map((p) => ({ id: p.id, full_name: p.full_name, email: p.email }));
}

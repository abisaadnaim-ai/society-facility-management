import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/types/database";
import type { NamedRef, StatusRef, PersonRef } from "@/lib/types/fm";

// ---------------------------------------------------------------------------
// The generated database.ts is not regenerated in this environment, so we
// augment it with the Phase 5 tables + RPCs via a type intersection and use a
// typed client cast (the same `as unknown as` style used elsewhere). This keeps
// the generated file untouched while giving full typing for inspections.
// ---------------------------------------------------------------------------
type Row<T> = { Row: T; Insert: Partial<T>; Update: Partial<T>; Relationships: [] };

export type InspectionTemplate = {
  id: string; organization_id: string; template_number: string; name: string;
  description: string | null; instructions: string | null; requires_manager_review: boolean;
  status: string; created_by: string; created_at: string; updated_at: string;
};
export type InspectionTemplateSection = {
  id: string; organization_id: string; template_id: string; name: string;
  description: string | null; sort_order: number; created_at: string; updated_at: string;
};
export type InspectionTemplateItem = {
  id: string; organization_id: string; template_id: string; section_id: string | null;
  item_text: string; instructions: string | null; is_required: boolean; allow_na: boolean;
  require_comment_on_fail: boolean; require_photo_on_fail: boolean;
  failure_priority_id: string | null; failure_category_id: string | null;
  sort_order: number; created_at: string; updated_at: string;
};
export type InspectionSchedule = {
  id: string; organization_id: string; schedule_number: string; template_id: string;
  location_id: string; area_id: string | null; asset_id: string | null; assigned_to: string | null;
  frequency_unit: string; frequency_interval: number; start_date: string;
  scheduled_time: string | null; next_due_date: string; status: string;
  created_by: string; created_at: string; updated_at: string;
};
export type InspectionOccurrence = {
  id: string; organization_id: string; inspection_number: string; schedule_id: string;
  template_id: string; location_id: string; area_id: string | null; asset_id: string | null;
  assigned_to: string | null; requires_manager_review: boolean; scheduled_date: string;
  scheduled_time: string | null; status: string; overall_result: string | null;
  started_at: string | null; submitted_at: string | null; reviewed_by: string | null;
  reviewed_at: string | null; review_notes: string | null; closed_at: string | null;
  skipped_by: string | null; skipped_at: string | null; skip_reason: string | null;
  cancelled_at: string | null; created_at: string; updated_at: string;
};
export type InspectionResponse = {
  id: string; organization_id: string; inspection_id: string; template_item_id: string | null;
  section_name_snapshot: string | null; item_text_snapshot: string; instructions_snapshot: string | null;
  is_required: boolean; allow_na: boolean; require_comment_on_fail: boolean; require_photo_on_fail: boolean;
  failure_priority_id: string | null; failure_category_id: string | null;
  result: string | null; comment: string | null; responded_by: string | null;
  responded_at: string | null; sort_order: number; created_at: string; updated_at: string;
};
export type InspectionFinding = {
  id: string; organization_id: string; inspection_id: string; response_id: string;
  location_id: string; area_id: string | null; asset_id: string | null;
  category_id: string | null; priority_id: string | null; description: string; status: string;
  fm_request_id: string | null; work_order_id: string | null; resolution_notes: string | null;
  resolved_by: string | null; resolved_at: string | null; dismissed_by: string | null;
  dismissed_at: string | null; dismissal_reason: string | null; created_at: string; updated_at: string;
};
export type InspectionResponseAttachment = {
  id: string; organization_id: string; inspection_id: string; response_id: string;
  file_name: string; file_path: string; file_type: string | null; file_size: number | null;
  uploaded_by: string | null; created_at: string;
};
export type InspectionActivity = {
  id: string; organization_id: string; template_id: string | null; schedule_id: string | null;
  occurrence_id: string | null; finding_id: string | null; actor_id: string | null;
  is_system: boolean; action: string; field_name: string | null; old_value: string | null;
  new_value: string | null; metadata: Json | null; created_at: string;
};

type InspectionsSchema = {
  Tables: {
    inspection_templates: Row<InspectionTemplate>;
    inspection_template_sections: Row<InspectionTemplateSection>;
    inspection_template_items: Row<InspectionTemplateItem>;
    inspection_schedules: Row<InspectionSchedule>;
    inspection_occurrences: Row<InspectionOccurrence>;
    inspection_responses: Row<InspectionResponse>;
    inspection_findings: Row<InspectionFinding>;
    inspection_response_attachments: Row<InspectionResponseAttachment>;
    inspection_activity: Row<InspectionActivity>;
  };
  Functions: {
    inspection_start: { Args: { p_occurrence_id: string }; Returns: undefined };
    inspection_submit: { Args: { p_occurrence_id: string }; Returns: string };
    inspection_review: { Args: { p_occurrence_id: string; p_notes: string | null }; Returns: undefined };
    inspection_close: { Args: { p_occurrence_id: string }; Returns: undefined };
    inspection_skip: { Args: { p_occurrence_id: string; p_reason: string }; Returns: undefined };
    inspection_assign: { Args: { p_occurrence_id: string; p_user_id: string | null }; Returns: undefined };
    inspection_set_schedule_status: { Args: { p_schedule_id: string; p_status: string }; Returns: undefined };
    inspection_finding_create_fm_request: {
      Args: { p_finding_id: string; p_title: string; p_description: string | null; p_category_id: string | null; p_priority_id: string | null };
      Returns: string;
    };
    inspection_finding_create_work_order: {
      Args: { p_finding_id: string; p_title: string; p_description: string | null; p_category_id: string | null; p_priority_id: string | null; p_assigned_to: string | null };
      Returns: string;
    };
    inspection_finding_resolve: { Args: { p_finding_id: string; p_notes: string | null }; Returns: undefined };
    inspection_finding_dismiss: { Args: { p_finding_id: string; p_reason: string }; Returns: undefined };
  };
};

export type InspectionsDatabase = Database & {
  public: Database["public"] & {
    Tables: Database["public"]["Tables"] & InspectionsSchema["Tables"];
    Functions: Database["public"]["Functions"] & InspectionsSchema["Functions"];
  };
};

/** Cast the RLS-scoped client to one that knows the Phase 5 tables + RPCs. */
export function idb(supabase: SupabaseClient<Database>): SupabaseClient<InspectionsDatabase> {
  return supabase as unknown as SupabaseClient<InspectionsDatabase>;
}

// ---------------------------------------------------------------------------
// Enums (mirror DB check constraints)
// ---------------------------------------------------------------------------
export type TemplateStatus = "active" | "archived";
export type ScheduleStatus = "active" | "paused" | "archived";
export type OccurrenceStatus =
  | "scheduled" | "due" | "in_progress" | "submitted" | "reviewed" | "closed" | "skipped" | "cancelled";
export type OverallResult = "pass" | "fail" | "incomplete";
export type ResponseResult = "pass" | "fail" | "na";
export type FindingStatus =
  | "open" | "action_required" | "fm_request_created" | "work_order_created" | "resolved" | "dismissed";

type Tone = "neutral" | "info" | "warning" | "danger" | "success";

export const OCC_STATUS_META: Record<OccurrenceStatus, { label: string; tone: Tone }> = {
  scheduled: { label: "Scheduled", tone: "neutral" },
  due: { label: "Due", tone: "warning" },
  in_progress: { label: "In Progress", tone: "info" },
  submitted: { label: "Submitted", tone: "info" },
  reviewed: { label: "Reviewed", tone: "info" },
  closed: { label: "Closed", tone: "success" },
  skipped: { label: "Skipped", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "danger" },
};

export const RESULT_META: Record<OverallResult, { label: string; tone: Tone }> = {
  pass: { label: "Pass", tone: "success" },
  fail: { label: "Fail", tone: "danger" },
  incomplete: { label: "Incomplete", tone: "warning" },
};

export const FINDING_STATUS_META: Record<FindingStatus, { label: string; tone: Tone }> = {
  open: { label: "Open", tone: "warning" },
  action_required: { label: "Action Required", tone: "warning" },
  fm_request_created: { label: "FM Request Created", tone: "info" },
  work_order_created: { label: "Work Order Created", tone: "info" },
  resolved: { label: "Resolved", tone: "success" },
  dismissed: { label: "Dismissed", tone: "neutral" },
};

export const SCHEDULE_STATUS_META: Record<ScheduleStatus, { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "success" },
  paused: { label: "Paused", tone: "warning" },
  archived: { label: "Archived", tone: "neutral" },
};

// ---------------------------------------------------------------------------
// Composite (joined) types for queries
// ---------------------------------------------------------------------------
export type InspectionTemplateRow = InspectionTemplate & {
  section_count: number;
  item_count: number;
  schedule_count: number;
};

export type InspectionScheduleRow = InspectionSchedule & {
  template: { id: string; name: string; template_number: string } | null;
  location: NamedRef;
  area: NamedRef;
  asset: NamedRef;
  assignee: PersonRef;
};

export type InspectionOccurrenceRow = InspectionOccurrence & {
  template: { id: string; name: string } | null;
  location: NamedRef;
  area: NamedRef;
  asset: NamedRef;
  assignee: PersonRef;
  schedule: { id: string; schedule_number: string } | null;
};

export type InspectionResponseRow = InspectionResponse & {
  responder: PersonRef;
  attachments: InspectionResponseAttachment[];
};

export type InspectionFindingRow = InspectionFinding & {
  inspection: { id: string; inspection_number: string } | null;
  location: NamedRef;
  area: NamedRef;
  asset: NamedRef;
  category: NamedRef;
  priority: StatusRef;
  fm_request: { id: string; request_number: string } | null;
  work_order: { id: string; work_order_number: string } | null;
};

export type InspectionActivityRow = InspectionActivity & { actor: PersonRef };

// ---------------------------------------------------------------------------
// Dashboard / summary metrics
// ---------------------------------------------------------------------------
export type InspectionSummary = {
  dueToday: number;
  overdue: number;
  inProgress: number;
  awaitingReview: number;
  failedInspections: number;
  openFindings: number;
};

// ---------------------------------------------------------------------------
// Due-bucket derivation for the Upcoming view (reuses the PPM bucket idea).
// ---------------------------------------------------------------------------
export type DueBucket = "overdue" | "today" | "next7" | "next30" | "later";

export function dueBucket(scheduledDate: string, today: string): DueBucket {
  if (scheduledDate < today) return "overdue";
  if (scheduledDate === today) return "today";
  const d = new Date(scheduledDate + "T00:00:00Z").getTime();
  const t = new Date(today + "T00:00:00Z").getTime();
  const days = Math.round((d - t) / 86400000);
  if (days <= 7) return "next7";
  if (days <= 30) return "next30";
  return "later";
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import type {
  FmRequestRow,
  FmRequestDetail,
  FmRequestActivityRow,
  FmRequestCommentRow,
  FmRequestAttachmentRow,
  FmRequestFilters,
  LinkedWorkOrder,
} from "@/lib/types/fm";

const LIST_SELECT =
  "*, location:location_id(id,name), area:area_id(id,name), category:category_id(id,name), priority:priority_id(id,name,code), status:status_id(id,name,code), requester:requested_by(full_name,email)";

const DETAIL_SELECT =
  LIST_SELECT +
  ", asset:asset_id(id,name), reviewer:reviewed_by(full_name,email)";

function sanitize(term: string): string {
  return term.replace(/[,()%]/g, " ").trim();
}

export async function getFmRequests(
  supabase: SupabaseClient<Database>,
  filters: Partial<FmRequestFilters> = {}
): Promise<FmRequestRow[]> {
  let query = supabase
    .from("fm_requests")
    .select(LIST_SELECT)
    .order("created_at", { ascending: false });

  if (filters.locationId) query = query.eq("location_id", filters.locationId);
  if (filters.areaId) query = query.eq("area_id", filters.areaId);
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.priorityId) query = query.eq("priority_id", filters.priorityId);
  if (filters.statusId) query = query.eq("status_id", filters.statusId);
  if (filters.requesterId) query = query.eq("requested_by", filters.requesterId);

  const term = filters.search ? sanitize(filters.search) : "";
  if (term) {
    query = query.or(
      `request_number.ilike.%${term}%,title.ilike.%${term}%,description.ilike.%${term}%`
    );
  }

  const { data, error } = await query;
  if (error) {
    console.error("getFmRequests failed:", error.message);
    return [];
  }
  return (data ?? []) as unknown as FmRequestRow[];
}

export async function getFmRequestById(
  supabase: SupabaseClient<Database>,
  id: string
): Promise<FmRequestDetail | null> {
  const { data, error } = await supabase
    .from("fm_requests")
    .select(DETAIL_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("getFmRequestById failed:", error.message);
    return null;
  }
  if (!data) return null;

  const base = data as unknown as Omit<FmRequestDetail, "work_order">;

  // Linked work order (0 or 1 by the one-WO-per-request rule). Fetched
  // separately to keep the embed unambiguous.
  const { data: wo } = await supabase
    .from("work_orders")
    .select("id, work_order_number, status:status_id(id,name,code)")
    .eq("fm_request_id", id)
    .maybeSingle();

  return { ...base, work_order: (wo as unknown as LinkedWorkOrder) ?? null };
}

export async function getFmRequestActivity(
  supabase: SupabaseClient<Database>,
  requestId: string
): Promise<FmRequestActivityRow[]> {
  const { data, error } = await supabase
    .from("fm_request_activity")
    .select("*, actor:actor_id(full_name,email)")
    .eq("request_id", requestId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getFmRequestActivity failed:", error.message);
    return [];
  }
  return (data ?? []) as unknown as FmRequestActivityRow[];
}

export async function getFmRequestComments(
  supabase: SupabaseClient<Database>,
  requestId: string
): Promise<FmRequestCommentRow[]> {
  // RLS hides internal comments from requesters automatically.
  const { data, error } = await supabase
    .from("fm_request_comments")
    .select("*, author:author_id(full_name,email)")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("getFmRequestComments failed:", error.message);
    return [];
  }
  return (data ?? []) as unknown as FmRequestCommentRow[];
}

export async function getFmRequestAttachments(
  supabase: SupabaseClient<Database>,
  requestId: string
): Promise<FmRequestAttachmentRow[]> {
  const { data, error } = await supabase
    .from("fm_request_attachments")
    .select("*, uploader:uploaded_by(full_name,email)")
    .eq("request_id", requestId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getFmRequestAttachments failed:", error.message);
    return [];
  }
  return (data ?? []) as unknown as FmRequestAttachmentRow[];
}

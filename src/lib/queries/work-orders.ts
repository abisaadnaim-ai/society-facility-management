import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import type {
  WorkOrderRow,
  WorkOrderDetail,
  WorkOrderActivityRow,
  WorkOrderCommentRow,
  WorkOrderAttachmentRow,
  WorkOrderFilters,
  OriginRequest,
} from "@/lib/types/fm";

const LIST_SELECT =
  "*, location:location_id(id,name), area:area_id(id,name), asset:asset_id(id,name), category:category_id(id,name), priority:priority_id(id,name,code), status:status_id(id,name,code), assignee:assigned_to(full_name,email)";

const DETAIL_SELECT =
  LIST_SELECT +
  ", creator:created_by(full_name,email), verifier:verified_by(full_name,email), closer:closed_by(full_name,email)";

function sanitize(term: string): string {
  return term.replace(/[,()%]/g, " ").trim();
}

export async function getWorkOrders(
  supabase: SupabaseClient<Database>,
  filters: Partial<WorkOrderFilters> & { userId?: string } = {}
): Promise<WorkOrderRow[]> {
  let query = supabase
    .from("work_orders")
    .select(LIST_SELECT)
    .order("created_at", { ascending: false });

  if (filters.locationId) query = query.eq("location_id", filters.locationId);
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.priorityId) query = query.eq("priority_id", filters.priorityId);
  if (filters.statusId) query = query.eq("status_id", filters.statusId);
  if (filters.technicianId) query = query.eq("assigned_to", filters.technicianId);
  if (filters.mineOnly && filters.userId) query = query.eq("assigned_to", filters.userId);

  const term = filters.search ? sanitize(filters.search) : "";
  if (term) {
    query = query.or(
      `work_order_number.ilike.%${term}%,title.ilike.%${term}%,description.ilike.%${term}%`
    );
  }

  const { data, error } = await query;
  if (error) {
    console.error("getWorkOrders failed:", error.message);
    return [];
  }
  return (data ?? []) as unknown as WorkOrderRow[];
}

/** Work orders associated with a specific asset (for the Asset Detail tab). */
export async function getWorkOrdersForAsset(
  supabase: SupabaseClient<Database>,
  assetId: string
): Promise<WorkOrderRow[]> {
  const { data, error } = await supabase
    .from("work_orders")
    .select(LIST_SELECT)
    .eq("asset_id", assetId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getWorkOrdersForAsset failed:", error.message);
    return [];
  }
  return (data ?? []) as unknown as WorkOrderRow[];
}

export async function getWorkOrderById(
  supabase: SupabaseClient<Database>,
  id: string
): Promise<WorkOrderDetail | null> {
  const { data, error } = await supabase
    .from("work_orders")
    .select(DETAIL_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("getWorkOrderById failed:", error.message);
    return null;
  }
  if (!data) return null;

  const base = data as unknown as Omit<WorkOrderDetail, "fm_request">;
  let origin: OriginRequest = null;
  const fmId = (base as unknown as { fm_request_id: string | null }).fm_request_id;
  if (fmId) {
    const { data: req } = await supabase
      .from("fm_requests")
      .select("id, request_number")
      .eq("id", fmId)
      .maybeSingle();
    origin = (req as unknown as OriginRequest) ?? null;
  }
  return { ...base, fm_request: origin };
}

export async function getWorkOrderActivity(
  supabase: SupabaseClient<Database>,
  workOrderId: string
): Promise<WorkOrderActivityRow[]> {
  const { data, error } = await supabase
    .from("work_order_activity")
    .select("*, actor:actor_id(full_name,email)")
    .eq("work_order_id", workOrderId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getWorkOrderActivity failed:", error.message);
    return [];
  }
  return (data ?? []) as unknown as WorkOrderActivityRow[];
}

export async function getWorkOrderComments(
  supabase: SupabaseClient<Database>,
  workOrderId: string
): Promise<WorkOrderCommentRow[]> {
  const { data, error } = await supabase
    .from("work_order_comments")
    .select("*, author:author_id(full_name,email)")
    .eq("work_order_id", workOrderId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("getWorkOrderComments failed:", error.message);
    return [];
  }
  return (data ?? []) as unknown as WorkOrderCommentRow[];
}

export async function getWorkOrderAttachments(
  supabase: SupabaseClient<Database>,
  workOrderId: string
): Promise<WorkOrderAttachmentRow[]> {
  const { data, error } = await supabase
    .from("work_order_attachments")
    .select("*, uploader:uploaded_by(full_name,email)")
    .eq("work_order_id", workOrderId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getWorkOrderAttachments failed:", error.message);
    return [];
  }
  return (data ?? []) as unknown as WorkOrderAttachmentRow[];
}

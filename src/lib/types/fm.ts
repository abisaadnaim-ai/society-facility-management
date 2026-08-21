import type { Tables } from "@/lib/types/database";

// ---- Configuration row aliases ----
export type FmCategory = Tables<"fm_categories">;
export type FmPriority = Tables<"fm_priorities">;
export type FmRequestStatus = Tables<"fm_request_statuses">;
export type WorkOrderStatus = Tables<"work_order_statuses">;

// ---- Operational row aliases ----
export type FmRequest = Tables<"fm_requests">;
export type FmRequestComment = Tables<"fm_request_comments">;
export type FmRequestAttachment = Tables<"fm_request_attachments">;
export type FmRequestActivity = Tables<"fm_request_activity">;
export type WorkOrder = Tables<"work_orders">;
export type WorkOrderComment = Tables<"work_order_comments">;
export type WorkOrderAttachment = Tables<"work_order_attachments">;
export type WorkOrderActivity = Tables<"work_order_activity">;

// ---- Small shared shapes ----
export type NamedRef = { id: string; name: string } | null;
export type StatusRef = { id: string; name: string; code: string } | null;
export type PersonRef = { full_name: string | null; email: string | null } | null;

/** A person option for assignment / requester filters. */
export type PersonOption = {
  id: string;
  full_name: string | null;
  email: string | null;
};

/** Config lookup shown in dropdowns. */
export type Lookup = { id: string; name: string; code: string | null };

// ---- Composite (joined) types ----
export type FmRequestRow = FmRequest & {
  location: NamedRef;
  area: NamedRef;
  category: NamedRef;
  priority: StatusRef;
  status: StatusRef;
  requester: PersonRef;
};

export type LinkedWorkOrder = {
  id: string;
  work_order_number: string;
  status: StatusRef;
} | null;

export type FmRequestDetail = FmRequestRow & {
  asset: NamedRef;
  reviewer: PersonRef;
  work_order: LinkedWorkOrder;
};

export type WorkOrderRow = WorkOrder & {
  location: NamedRef;
  area: NamedRef;
  asset: NamedRef;
  category: NamedRef;
  priority: StatusRef;
  status: StatusRef;
  assignee: PersonRef;
};

export type OriginRequest = { id: string; request_number: string } | null;

export type WorkOrderDetail = WorkOrderRow & {
  creator: PersonRef;
  verifier: PersonRef;
  closer: PersonRef;
  fm_request: OriginRequest;
};

export type FmRequestActivityRow = FmRequestActivity & { actor: PersonRef };
export type WorkOrderActivityRow = WorkOrderActivity & { actor: PersonRef };
export type FmRequestCommentRow = FmRequestComment & { author: PersonRef };
export type WorkOrderCommentRow = WorkOrderComment & { author: PersonRef };
export type FmRequestAttachmentRow = FmRequestAttachment & { uploader: PersonRef };
export type WorkOrderAttachmentRow = WorkOrderAttachment & { uploader: PersonRef };

// ---- Filter state ----
export type FmRequestFilters = {
  search: string;
  locationId: string;
  areaId: string;
  categoryId: string;
  priorityId: string;
  statusId: string;
  requesterId: string;
};

export type WorkOrderFilters = {
  search: string;
  locationId: string;
  categoryId: string;
  priorityId: string;
  statusId: string;
  technicianId: string;
  mineOnly: boolean;
};

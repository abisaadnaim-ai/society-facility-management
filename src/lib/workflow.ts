/**
 * Centralized Phase 3 workflow logic. Transition rules and role gates live here
 * (not scattered across components) and MIRROR the database triggers/RLS that
 * actually enforce them. UI uses these to decide which actions to render; the
 * database is the real boundary, so a bypassed client still hits a DB error.
 */
import type { RoleCode } from "@/lib/types/auth";

// ---- Status codes ----
export const REQUEST_STATUS = {
  new: "new",
  under_review: "under_review",
  work_order_created: "work_order_created",
  closed: "closed",
  rejected: "rejected",
  cancelled: "cancelled",
} as const;

export const WO_STATUS = {
  new: "new",
  assigned: "assigned",
  in_progress: "in_progress",
  on_hold: "on_hold",
  waiting_parts: "waiting_parts",
  waiting_vendor: "waiting_vendor",
  waiting_procurement: "waiting_procurement",
  waiting_approval: "waiting_approval",
  completed: "completed",
  verified: "verified",
  closed: "closed",
  cancelled: "cancelled",
} as const;

export const WO_WAITING_CODES = [
  "on_hold",
  "waiting_parts",
  "waiting_vendor",
  "waiting_procurement",
  "waiting_approval",
] as const;

/** Badge variant for a request status code. */
export function requestStatusVariant(
  code: string | null | undefined
): "success" | "warning" | "danger" | "neutral" | "info" {
  switch (code) {
    case "closed":
      return "success";
    case "under_review":
      return "warning";
    case "work_order_created":
      return "info";
    case "rejected":
    case "cancelled":
      return "danger";
    default:
      return "neutral";
  }
}

/** Badge variant for a work order status code. */
export function workOrderStatusVariant(
  code: string | null | undefined
): "success" | "warning" | "danger" | "neutral" | "info" {
  switch (code) {
    case "verified":
    case "closed":
      return "success";
    case "completed":
      return "info";
    case "in_progress":
      return "warning";
    case "on_hold":
    case "waiting_parts":
    case "waiting_vendor":
    case "waiting_procurement":
    case "waiting_approval":
      return "warning";
    case "cancelled":
      return "danger";
    default:
      return "neutral";
  }
}

/** Badge variant for a priority code. */
export function priorityVariant(
  code: string | null | undefined
): "success" | "warning" | "danger" | "neutral" | "info" {
  switch (code) {
    case "critical":
      return "danger";
    case "high":
      return "warning";
    case "medium":
      return "info";
    case "low":
      return "neutral";
    default:
      return "neutral";
  }
}

const FM_MANAGER_ROLES: RoleCode[] = ["super_admin", "facility_manager"];
export function isManagerRole(role: RoleCode | null | undefined): boolean {
  return !!role && FM_MANAGER_ROLES.includes(role);
}

// ---- FM Request transitions (manager-driven) ----
/** Terminal states a request can no longer move out of. */
export const REQUEST_TERMINAL = ["closed", "rejected", "cancelled"];

export function requestIsOpen(code: string | null | undefined): boolean {
  return !!code && !REQUEST_TERMINAL.includes(code);
}

/** Can a manager start reviewing this request? */
export function canStartReview(role: RoleCode | null, statusCode: string | null): boolean {
  return isManagerRole(role) && statusCode === REQUEST_STATUS.new;
}

/** Can a manager still edit review fields (priority/category/area/asset)? */
export function canEditReview(role: RoleCode | null, statusCode: string | null): boolean {
  return (
    isManagerRole(role) &&
    (statusCode === REQUEST_STATUS.new || statusCode === REQUEST_STATUS.under_review)
  );
}

/** Can a manager create a work order from this request? */
export function canCreateWorkOrderFromRequest(
  role: RoleCode | null,
  statusCode: string | null,
  hasWorkOrder: boolean
): boolean {
  return (
    isManagerRole(role) &&
    !hasWorkOrder &&
    (statusCode === REQUEST_STATUS.new || statusCode === REQUEST_STATUS.under_review)
  );
}

/** Can a manager reject/cancel this request? Only while still open and not converted. */
export function canRejectRequest(role: RoleCode | null, statusCode: string | null): boolean {
  return (
    isManagerRole(role) &&
    (statusCode === REQUEST_STATUS.new || statusCode === REQUEST_STATUS.under_review)
  );
}
export function canCancelRequest(role: RoleCode | null, statusCode: string | null): boolean {
  return isManagerRole(role) && requestIsOpen(statusCode);
}

// ---- Work Order transitions ----
/**
 * The set of statuses a TECHNICIAN may move an assigned work order into,
 * given its current status. Mirrors enforce_work_order_transition().
 */
export function allowedTechnicianTransitions(currentCode: string | null): string[] {
  switch (currentCode) {
    case WO_STATUS.assigned:
      return [WO_STATUS.in_progress];
    case WO_STATUS.in_progress:
      return [
        WO_STATUS.on_hold,
        WO_STATUS.waiting_parts,
        WO_STATUS.waiting_vendor,
        WO_STATUS.waiting_procurement,
        WO_STATUS.waiting_approval,
        WO_STATUS.completed,
      ];
    case WO_STATUS.on_hold:
    case WO_STATUS.waiting_parts:
    case WO_STATUS.waiting_vendor:
    case WO_STATUS.waiting_procurement:
    case WO_STATUS.waiting_approval:
      return [WO_STATUS.in_progress];
    default:
      return [];
  }
}

/**
 * Operational statuses a MANAGER may set directly (excludes verify/close/cancel,
 * which are dedicated actions with their own required fields).
 */
export function allowedManagerOperationalTransitions(currentCode: string | null): string[] {
  if (currentCode === WO_STATUS.completed || currentCode === WO_STATUS.verified) return [];
  if (currentCode === WO_STATUS.closed || currentCode === WO_STATUS.cancelled) return [];
  const base = [
    WO_STATUS.assigned,
    WO_STATUS.in_progress,
    WO_STATUS.on_hold,
    WO_STATUS.waiting_parts,
    WO_STATUS.waiting_vendor,
    WO_STATUS.waiting_procurement,
    WO_STATUS.waiting_approval,
    WO_STATUS.completed,
  ];
  return base.filter((c) => c !== currentCode);
}

export function canAssignWorkOrder(role: RoleCode | null, statusCode: string | null): boolean {
  if (!isManagerRole(role)) return false;
  return statusCode !== WO_STATUS.closed && statusCode !== WO_STATUS.cancelled;
}

export function canVerifyWorkOrder(role: RoleCode | null, statusCode: string | null): boolean {
  return isManagerRole(role) && statusCode === WO_STATUS.completed;
}

export function canReturnToTechnician(role: RoleCode | null, statusCode: string | null): boolean {
  return isManagerRole(role) && statusCode === WO_STATUS.completed;
}

export function canCloseWorkOrder(role: RoleCode | null, statusCode: string | null): boolean {
  return (
    isManagerRole(role) &&
    (statusCode === WO_STATUS.verified || statusCode === WO_STATUS.completed)
  );
}

export function canCancelWorkOrder(role: RoleCode | null, statusCode: string | null): boolean {
  return (
    isManagerRole(role) &&
    statusCode !== WO_STATUS.closed &&
    statusCode !== WO_STATUS.cancelled
  );
}

export function isTechnicianAssigned(
  role: RoleCode | null,
  assignedTo: string | null,
  userId: string
): boolean {
  return role === "technician" && !!assignedTo && assignedTo === userId;
}

/** Whole-number age in days from an ISO timestamp to now. */
export function ageInDays(iso: string | null | undefined): number {
  if (!iso) return 0;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
}

/** Short "3d", "5h", "just now" age label. */
export function ageLabel(iso: string | null | undefined): string {
  if (!iso) return "-";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "-";
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

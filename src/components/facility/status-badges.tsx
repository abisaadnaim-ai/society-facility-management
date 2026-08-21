import { Badge } from "@/components/ui/badge";
import type { StatusRef, PersonRef } from "@/lib/types/fm";
import {
  requestStatusVariant,
  workOrderStatusVariant,
  priorityVariant,
} from "@/lib/workflow";

export function RequestStatusBadge({ status }: { status: StatusRef }) {
  return <Badge variant={requestStatusVariant(status?.code)}>{status?.name ?? "-"}</Badge>;
}

export function WorkOrderStatusBadge({ status }: { status: StatusRef }) {
  return <Badge variant={workOrderStatusVariant(status?.code)}>{status?.name ?? "-"}</Badge>;
}

export function PriorityBadge({ priority }: { priority: StatusRef }) {
  if (!priority) return <Badge variant="neutral">Unset</Badge>;
  return <Badge variant={priorityVariant(priority.code)}>{priority.name}</Badge>;
}

/** Best available display name for a person reference. */
export function personName(p: PersonRef): string {
  return p?.full_name || p?.email || "Unknown";
}

import { formatDateTime } from "@/lib/format";
import { personName } from "@/components/facility/status-badges";
import type { PersonRef } from "@/lib/types/fm";

type ActivityItem = {
  id: string;
  action: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  metadata: unknown;
  created_at: string;
  actor: PersonRef;
};

const LABELS: Record<string, string> = {
  created: "Created",
  review_started: "Review started",
  priority_set: "Priority set",
  category_changed: "Category changed",
  area_changed: "Area changed",
  asset_changed: "Asset linked",
  work_order_created: "Work order created",
  rejected: "Request rejected",
  cancelled: "Cancelled",
  closed: "Closed",
  assigned: "Technician assigned",
  reassigned: "Technician reassigned",
  status_changed: "Status changed",
  completed: "Marked completed",
  verified: "Verified",
  returned_to_technician: "Returned to technician",
  attachment_added: "Attachment added",
  attachment_removed: "Attachment removed",
};

function label(action: string): string {
  return LABELS[action] ?? action.replace(/_/g, " ");
}

function detail(item: ActivityItem): string | null {
  const meta = item.metadata as { reason?: string } | null;
  if (meta?.reason) return meta.reason;
  if (item.new_value && item.field_name === "status") return null;
  if (item.new_value) return item.new_value;
  return null;
}

export function ActivityTimeline({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">No activity recorded yet.</p>;
  }
  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const d = detail(item);
        return (
          <li key={item.id} className="flex gap-3">
            <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-slate-300" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm text-slate-900">
                {label(item.action)}
                {d && <span className="text-slate-500"> - {d}</span>}
              </p>
              <p className="text-xs text-slate-400">
                {personName(item.actor)} - {formatDateTime(item.created_at)}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

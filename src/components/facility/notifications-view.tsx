"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTimeQatar, formatRelativeTime } from "@/lib/format";
import {
  notificationPriorityVariant,
  type AppNotification,
} from "@/lib/types/notifications";
import {
  markNotificationRead,
  markAllNotificationsRead,
  dismissNotification,
} from "@/lib/actions/notifications";

export function NotificationsView({ notifications }: { notifications: AppNotification[] }) {
  const router = useRouter();
  const [items, setItems] = useState(notifications);
  const [pending, startTransition] = useTransition();
  const unread = items.filter((n) => !n.read_at).length;

  function open(n: AppNotification) {
    if (!n.read_at) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
      startTransition(async () => {
        await markNotificationRead(n.id);
      });
    }
    if (n.link_url) router.push(n.link_url);
  }

  function markAll() {
    setItems((prev) => prev.map((x) => (x.read_at ? x : { ...x, read_at: new Date().toISOString() })));
    startTransition(async () => {
      await markAllNotificationsRead();
    });
  }

  function dismiss(id: string) {
    setItems((prev) => prev.filter((x) => x.id !== id));
    startTransition(async () => {
      await dismissNotification(id);
    });
  }

  return (
    <div>
      <PageHeader
        title="Notifications"
        description={unread > 0 ? `${unread} unread` : "You're all caught up"}
        actions={
          unread > 0 ? (
            <Button variant="outline" onClick={markAll} disabled={pending}>
              Mark all as read
            </Button>
          ) : undefined
        }
      />

      {items.length === 0 ? (
        <EmptyState title="No notifications" description="Operational alerts will appear here as they happen." />
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
          {items.map((n) => (
            <li
              key={n.id}
              className={["flex items-start gap-3 px-4 py-3.5", n.read_at ? "" : "bg-blue-50/40"].join(" ")}
            >
              <button
                type="button"
                onClick={() => open(n)}
                className="flex min-w-0 flex-1 items-start gap-3 text-left"
              >
                <span
                  className={[
                    "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                    n.priority === "critical"
                      ? "bg-red-500"
                      : n.priority === "high"
                        ? "bg-amber-500"
                        : n.read_at
                          ? "bg-transparent"
                          : "bg-blue-500",
                  ].join(" ")}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-slate-900">{n.title}</span>
                    {n.priority !== "normal" && (
                      <Badge variant={notificationPriorityVariant(n.priority)}>
                        {n.priority === "critical" ? "Critical" : "High"}
                      </Badge>
                    )}
                  </span>
                  {n.message && <span className="mt-0.5 block text-sm text-slate-600">{n.message}</span>}
                  <span
                    className="mt-0.5 block text-xs text-slate-400"
                    title={formatDateTimeQatar(n.created_at)}
                  >
                    {formatRelativeTime(n.created_at)}
                  </span>
                </span>
              </button>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => dismiss(n.id)}
                disabled={pending}
                className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateTimeQatar, formatMinutes } from "@/lib/format";
import { SlaBadge, EscalatedBadge } from "@/components/facility/sla-badges";
import { liveSlaStatus } from "@/lib/types/notifications";
import type { EscalationRow } from "@/lib/types/notifications";
import { acknowledgeEscalation } from "@/lib/actions/escalations";

type WoSla = {
  priorityName: string | null;
  createdAt: string;
  resolutionDueAt: string | null;
  resolutionTargetMinutes: number | null;
  closedAt: string | null;
  cancelled: boolean;
  escalationLevel: number | null;
  manualDueDate: string | null;
};

export function WorkOrderSlaPanel({
  wo,
  escalations,
  canAcknowledge,
}: {
  wo: WoSla;
  escalations: EscalationRow[];
  canAcknowledge: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const live = liveSlaStatus({
    targetMinutes: wo.resolutionTargetMinutes,
    start: wo.createdAt,
    due: wo.resolutionDueAt,
    done: wo.closedAt,
    cancelled: wo.cancelled,
  });

  const hasSla = wo.resolutionTargetMinutes != null;
  const openEscalations = escalations.filter((e) => !e.resolved_at);

  // Don't render an empty panel when there is nothing SLA/escalation-related.
  if (!hasSla && escalations.length === 0) return null;

  function ack(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await acknowledgeEscalation(id);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">SLA &amp; Escalation</h2>
        {openEscalations.length > 0 && <EscalatedBadge level={wo.escalationLevel} />}
      </div>

      <dl className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
        <Row label="Priority" value={wo.priorityName ?? "—"} />
        <Row label="Resolution target" value={hasSla ? formatMinutes(wo.resolutionTargetMinutes) : "—"} />
        <Row
          label="SLA resolution due"
          value={wo.resolutionDueAt ? formatDateTimeQatar(wo.resolutionDueAt) : "—"}
        />
        <Row label="SLA status" value={<SlaBadge status={live} />} />
        <Row
          label="Operational due date (manual)"
          value={wo.manualDueDate ? formatDateTimeQatar(wo.manualDueDate) : "Not set"}
        />
        <Row
          label="Resolved (closed)"
          value={wo.closedAt ? formatDateTimeQatar(wo.closedAt) : "Open"}
        />
      </dl>

      {escalations.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Escalation history
          </h3>
          <ul className="divide-y divide-slate-100 rounded-md border border-slate-100">
            {escalations.map((e) => (
              <li key={e.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant={e.resolved_at ? "neutral" : "danger"}>
                      Level {e.escalation_level}
                    </Badge>
                    {e.resolved_at ? (
                      <span className="text-xs text-emerald-700">Resolved</span>
                    ) : e.acknowledged_at ? (
                      <span className="text-xs text-slate-500">
                        Acknowledged{e.acknowledged_by_name ? ` by ${e.acknowledged_by_name}` : ""}
                      </span>
                    ) : (
                      <span className="text-xs text-amber-700">Open</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-slate-700">{e.reason}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{formatDateTimeQatar(e.triggered_at)}</p>
                </div>
                {canAcknowledge && !e.acknowledged_at && !e.resolved_at && (
                  <Button variant="outline" onClick={() => ack(e.id)} disabled={pending}>
                    Acknowledge
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
      )}
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-50 py-1.5">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-right text-sm font-medium text-slate-900">{value}</dd>
    </div>
  );
}

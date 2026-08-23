"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ScheduleStatusBadge } from "@/components/facility/inspection-badges";
import { personName } from "@/components/facility/status-badges";
import { formatDate } from "@/lib/format";
import { frequencyLabel } from "@/lib/types/ppm";
import { setInspectionScheduleStatus } from "@/lib/actions/inspections";
import type { InspectionScheduleRow } from "@/lib/types/inspections";

export function InspectionSchedulesView({ schedules, canManage }: { schedules: InspectionScheduleRow[]; canManage: boolean }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function setStatus(id: string, status: "active" | "paused" | "archived") {
    setBusyId(id);
    await setInspectionScheduleStatus(id, status);
    setBusyId(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/inspections" className="text-sm text-slate-500 hover:text-slate-900">&larr; Inspections</Link>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">Inspection Schedules</h1>
        </div>
        {canManage && <Link href="/inspections/schedules/new"><Button>New schedule</Button></Link>}
      </div>

      {schedules.length === 0 ? (
        <EmptyState title="No schedules yet" description="Schedule a template against a location to auto-generate inspections."
          action={canManage ? <Link href="/inspections/schedules/new"><Button>New schedule</Button></Link> : undefined} />
      ) : (
        <div className="space-y-2">
          {schedules.map((s) => (
            <Card key={s.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900">{s.template?.name ?? "Template"}</span>
                    <ScheduleStatusBadge status={s.status} />
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {s.schedule_number} · {frequencyLabel(s.frequency_unit, s.frequency_interval)} · {s.location?.name ?? "—"}
                    {s.area?.name ? ` / ${s.area.name}` : ""} · Next: {formatDate(s.next_due_date)}
                    {s.assignee ? ` · ${personName(s.assignee)}` : ""}
                  </p>
                </div>
                {canManage && s.status !== "archived" && (
                  <div className="flex items-center gap-2">
                    {s.status === "active" ? (
                      <Button variant="ghost" size="sm" isLoading={busyId === s.id} onClick={() => setStatus(s.id, "paused")}>Pause</Button>
                    ) : (
                      <Button variant="ghost" size="sm" isLoading={busyId === s.id} onClick={() => setStatus(s.id, "active")}>Resume</Button>
                    )}
                    <Button variant="ghost" size="sm" isLoading={busyId === s.id} onClick={() => setStatus(s.id, "archived")}>Archive</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

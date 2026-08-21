"use client";

import { useMemo } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  TableShell, TableHead, TableHeaderCell, TableBody, TableRow, TableCell,
} from "@/components/shared/table-shell";
import { formatDate } from "@/lib/format";
import { frequencyLabel, type PpmPlanRow } from "@/lib/types/ppm";

type Props = {
  plans: PpmPlanRow[];
  today: string;
};

/** Shift an ISO yyyy-mm-dd date by n days (UTC), for bucket boundaries only. */
function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

type BucketTone = "danger" | "warning" | "info" | "neutral";

export function PpmScheduleView({ plans, today }: Props) {
  const in7 = addDays(today, 7);
  const in30 = addDays(today, 30);

  // Bucket ACTIVE plans purely by their stored next_due_date. The date itself is
  // computed by the database scheduling engine on create/complete/skip — this view
  // only compares it against the window boundaries, so there is no scheduling logic here.
  const buckets = useMemo(() => {
    const overdue: PpmPlanRow[] = [];
    const dueToday: PpmPlanRow[] = [];
    const next7: PpmPlanRow[] = [];
    const next30: PpmPlanRow[] = [];
    for (const p of plans) {
      const d = p.next_due_date;
      if (!d) continue;
      if (d < today) overdue.push(p);
      else if (d === today) dueToday.push(p);
      else if (d <= in7) next7.push(p);
      else if (d <= in30) next30.push(p);
    }
    const byDate = (a: PpmPlanRow, b: PpmPlanRow) =>
      (a.next_due_date ?? "").localeCompare(b.next_due_date ?? "");
    return {
      overdue: overdue.sort(byDate),
      dueToday: dueToday.sort(byDate),
      next7: next7.sort(byDate),
      next30: next30.sort(byDate),
    };
  }, [plans, today, in7, in30]);

  const sections: { key: keyof typeof buckets; title: string; tone: BucketTone; empty: string }[] = [
    { key: "overdue", title: "Overdue", tone: "danger", empty: "Nothing overdue." },
    { key: "dueToday", title: "Today", tone: "warning", empty: "Nothing due today." },
    { key: "next7", title: "Next 7 Days", tone: "info", empty: "Nothing due in the next 7 days." },
    { key: "next30", title: "Next 30 Days", tone: "neutral", empty: "Nothing due in the next 30 days." },
  ];

  const totalUpcoming = buckets.overdue.length + buckets.dueToday.length + buckets.next7.length + buckets.next30.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Upcoming PPM Schedule"
        description="Active preventive maintenance plans grouped by when they are next due."
        actions={
          <Link href="/preventive-maintenance">
            <Button variant="outline">All plans</Button>
          </Link>
        }
      />

      {totalUpcoming === 0 ? (
        <EmptyState
          title="Nothing due in the next 30 days"
          description="Active plans with a due date in the next 30 days (or overdue) will appear here."
        />
      ) : (
        sections.map((s) => {
          const rows = buckets[s.key];
          return (
            <Card key={s.key}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{s.title}</CardTitle>
                <Badge variant={s.tone}>{rows.length}</Badge>
              </CardHeader>
              <CardContent>
                {rows.length === 0 ? (
                  <p className="text-sm text-slate-500">{s.empty}</p>
                ) : (
                  <TableShell>
                    <TableHead>
                      <TableHeaderCell>PPM #</TableHeaderCell>
                      <TableHeaderCell>Plan</TableHeaderCell>
                      <TableHeaderCell>Asset</TableHeaderCell>
                      <TableHeaderCell>Location / Area</TableHeaderCell>
                      <TableHeaderCell>Frequency</TableHeaderCell>
                      <TableHeaderCell>Next Due</TableHeaderCell>
                      <TableHeaderCell>Technician</TableHeaderCell>
                    </TableHead>
                    <TableBody>
                      {rows.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>
                            <Link href={`/preventive-maintenance/${p.id}`} className="font-medium text-sky-700 hover:underline">
                              {p.ppm_number}
                            </Link>
                          </TableCell>
                          <TableCell>{p.name}</TableCell>
                          <TableCell>
                            <span className="block">{p.asset?.name ?? "—"}</span>
                            {p.asset?.asset_code && <span className="text-xs text-slate-500">{p.asset.asset_code}</span>}
                          </TableCell>
                          <TableCell>
                            <span className="block">{p.asset?.location?.name ?? "—"}</span>
                            {p.asset?.area?.name && <span className="text-xs text-slate-500">{p.asset.area.name}</span>}
                          </TableCell>
                          <TableCell>{frequencyLabel(p.frequency_unit, p.frequency_interval)}</TableCell>
                          <TableCell>{formatDate(p.next_due_date)}</TableCell>
                          <TableCell>{p.technician?.full_name || p.technician?.email || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </TableShell>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { OccurrenceStatusBadge, OverallResultBadge } from "@/components/facility/inspection-badges";
import { formatDate } from "@/lib/format";
import { dueBucket, type InspectionOccurrenceRow, type InspectionSummary } from "@/lib/types/inspections";

export function InspectionHubView({
  today, summary, myInspections, upcoming, canManage,
}: {
  today: string;
  summary: InspectionSummary;
  myInspections: InspectionOccurrenceRow[];
  upcoming: InspectionOccurrenceRow[];
  canManage: boolean;
}) {
  const overdue = upcoming.filter((o) => dueBucket(o.scheduled_date, today) === "overdue");
  const dueToday = upcoming.filter((o) => dueBucket(o.scheduled_date, today) === "today");
  const next = upcoming.filter((o) => ["next7", "next30", "later"].includes(dueBucket(o.scheduled_date, today)));

  const metrics: { label: string; value: number; href?: string }[] = [
    { label: "Due today", value: summary.dueToday },
    { label: "Overdue", value: summary.overdue },
    { label: "In progress", value: summary.inProgress },
    { label: "Awaiting review", value: summary.awaitingReview },
    { label: "Open findings", value: summary.openFindings, href: "/inspections/findings" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-slate-900">Inspections</h1>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Link href="/inspections/templates"><Button variant="outline" size="sm">Templates</Button></Link>
            <Link href="/inspections/schedules"><Button variant="outline" size="sm">Schedules</Button></Link>
            <Link href="/inspections/findings"><Button variant="outline" size="sm">Findings</Button></Link>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {metrics.map((m) => {
          const inner = (
            <Card className="h-full">
              <CardContent>
                <p className="text-2xl font-semibold text-slate-900">{m.value}</p>
                <p className="text-xs text-slate-500">{m.label}</p>
              </CardContent>
            </Card>
          );
          return m.href ? <Link key={m.label} href={m.href}>{inner}</Link> : <div key={m.label}>{inner}</div>;
        })}
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">My inspections</h2>
        {myInspections.length === 0 ? (
          <EmptyState title="Nothing assigned to you" description="Inspections assigned to you that need action will appear here." />
        ) : (
          <div className="space-y-2">{myInspections.map((o) => <OccurrenceCard key={o.id} o={o} />)}</div>
        )}
      </section>

      {canManage && (
        <>
          <Bucket title="Overdue" items={overdue} />
          <Bucket title="Due today" items={dueToday} />
          <Bucket title="Upcoming" items={next} />
        </>
      )}
    </div>
  );
}

function Bucket({ title, items }: { title: string; items: InspectionOccurrenceRow[] }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-slate-900">{title} ({items.length})</h2>
      <div className="space-y-2">{items.map((o) => <OccurrenceCard key={o.id} o={o} />)}</div>
    </section>
  );
}

function OccurrenceCard({ o }: { o: InspectionOccurrenceRow }) {
  return (
    <Link href={`/inspections/${o.id}`}>
      <Card className="transition-colors hover:bg-slate-50">
        <CardContent className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-900">{o.template?.name ?? "Inspection"}</p>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {o.inspection_number} · {o.location?.name ?? "—"}{o.area?.name ? ` / ${o.area.name}` : ""} · {formatDate(o.scheduled_date)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <OverallResultBadge result={o.overall_result} />
            <OccurrenceStatusBadge status={o.status} />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

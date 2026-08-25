import { createClient } from "@/lib/supabase/server";
import { resolveFilters, filtersToQuery, rangeLabel, type RawSearchParams } from "@/lib/reports/filters";
import { getWoReport, getResolutionReport } from "@/lib/queries/reports";
import { KpiCard, KpiGrid, ReportSection, BarList } from "@/components/reports/ui";
import { PrintButton, ExportCsvButton } from "@/components/reports/toolbar";
import { formatDuration } from "@/lib/reports/util";
import type { Breakdown } from "@/lib/types/reports";

const toBars = (items: Breakdown[]) =>
  items.map((b) => ({ label: b.label ?? b.code ?? "—", value: b.count }));

export default async function WoReportPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const f = resolveFilters(await searchParams);
  const supabase = await createClient();
  const [r, res] = await Promise.all([getWoReport(supabase, f), getResolutionReport(supabase, f)]);
  const q = filtersToQuery(f);
  const t = r.totals;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">Work Orders · {rangeLabel(f)}</p>
        <div className="flex gap-2">
          <ExportCsvButton dataset="work-orders" query={q} />
          <PrintButton />
        </div>
      </div>

      <ReportSection title="Summary" description="Work orders created in the selected period.">
        <KpiGrid cols={6}>
          <KpiCard label="Total" value={t.total} />
          <KpiCard label="Open" value={t.open} />
          <KpiCard label="In Progress" value={t.in_progress} />
          <KpiCard label="Waiting" value={t.waiting} />
          <KpiCard label="Completed" value={t.completed} />
          <KpiCard label="Verified" value={t.verified} />
          <KpiCard label="Closed" value={t.closed} />
          <KpiCard label="Cancelled" value={t.cancelled} />
          <KpiCard label="Overdue" value={t.overdue} tone="warning" hint="Open & past manual due date (Asia/Qatar)." />
          <KpiCard label="SLA Breached" value={t.sla_breached} tone="danger" />
          <KpiCard label="Escalated" value={t.escalated} tone="danger" />
          <KpiCard label="New" value={t.new} />
        </KpiGrid>
      </ReportSection>

      <ReportSection
        title="Resolution Time"
        description="Time from work order creation to closure, over work orders CLOSED in the period. Open work orders are excluded (spec §9)."
      >
        <KpiGrid cols={4}>
          <KpiCard label="Resolved" value={res.resolved_count} sub="closed in period" />
          <KpiCard label="Average" value={formatDuration(res.avg_seconds)} />
          <KpiCard label="Median" value={formatDuration(res.median_seconds)} />
          <KpiCard label="Fastest / Longest" value={`${formatDuration(res.min_seconds)} / ${formatDuration(res.max_seconds)}`} />
        </KpiGrid>
      </ReportSection>

      <div className="grid grid-cols-1 gap-x-8 lg:grid-cols-2">
        <ReportSection title="By Status"><BarList items={toBars(r.by_status)} /></ReportSection>
        <ReportSection title="By Priority"><BarList items={toBars(r.by_priority)} /></ReportSection>
        <ReportSection title="By Source" description="Direct, FM Request, PPM, Inspection."><BarList items={toBars(r.by_source)} /></ReportSection>
        <ReportSection title="By Technician"><BarList items={toBars(r.by_technician)} /></ReportSection>
        <ReportSection title="By Location"><BarList items={toBars(r.by_location)} /></ReportSection>
        <ReportSection title="By Category"><BarList items={toBars(r.by_category)} /></ReportSection>
      </div>

      <div className="grid grid-cols-1 gap-x-8 lg:grid-cols-2">
        <ReportSection title="Resolution by Priority">
          <BarList items={res.by_priority.map((b) => ({ label: `${b.label ?? b.code ?? "—"} · ${formatDuration(b.avg_seconds)}`, value: b.count }))} empty="No closed work orders in the selected period." />
        </ReportSection>
        <ReportSection title="Resolution by Location">
          <BarList items={res.by_location.map((b) => ({ label: `${b.label ?? "—"} · ${formatDuration(b.avg_seconds)}`, value: b.count }))} empty="No closed work orders in the selected period." />
        </ReportSection>
      </div>
    </div>
  );
}

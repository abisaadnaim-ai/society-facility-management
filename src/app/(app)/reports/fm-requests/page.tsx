import { createClient } from "@/lib/supabase/server";
import { resolveFilters, filtersToQuery, rangeLabel, type RawSearchParams } from "@/lib/reports/filters";
import { getFmReport } from "@/lib/queries/reports";
import { KpiCard, KpiGrid, ReportSection, BarList } from "@/components/reports/ui";
import { PrintButton, ExportCsvButton } from "@/components/reports/toolbar";
import { formatDuration } from "@/lib/reports/util";
import type { Breakdown } from "@/lib/types/reports";

const toBars = (items: Breakdown[]) =>
  items.map((b) => ({ label: b.label ?? b.code ?? "—", value: b.count }));

export default async function FmReportPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const f = resolveFilters(await searchParams);
  const supabase = await createClient();
  const r = await getFmReport(supabase, f);
  const q = filtersToQuery(f);
  const t = r.totals;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">FM Requests · {rangeLabel(f)}</p>
        <div className="flex gap-2">
          <ExportCsvButton dataset="fm-requests" query={q} />
          <PrintButton />
        </div>
      </div>

      <ReportSection title="Summary" description="Requests created in the selected period.">
        <KpiGrid cols={6}>
          <KpiCard label="Total" value={t.total} />
          <KpiCard label="Open" value={t.open} />
          <KpiCard label="Closed" value={t.closed} />
          <KpiCard label="Rejected" value={t.rejected} />
          <KpiCard label="Cancelled" value={t.cancelled} />
          <KpiCard label="Critical" value={t.critical} tone="danger" />
        </KpiGrid>
      </ReportSection>

      <ReportSection
        title="Average Response Time"
        description="Mean time from request creation to first FM response/review (requests with a response). Uses Phase 8 SLA timestamps."
      >
        <KpiGrid cols={3}>
          <KpiCard label="Avg Response" value={formatDuration(r.avg_response_seconds)} hint="Time from request created to first_responded_at." />
          <KpiCard label="Responded (sample)" value={r.response_sample} sub={`of ${t.total} created`} />
          <KpiCard label="—" value="" />
        </KpiGrid>
      </ReportSection>

      <div className="grid grid-cols-1 gap-x-8 lg:grid-cols-2">
        <ReportSection title="By Priority"><BarList items={toBars(r.by_priority)} /></ReportSection>
        <ReportSection title="By Category"><BarList items={toBars(r.by_category)} /></ReportSection>
        <ReportSection title="By Location"><BarList items={toBars(r.by_location)} /></ReportSection>
        <ReportSection title="By Area"><BarList items={toBars(r.by_area)} /></ReportSection>
      </div>
    </div>
  );
}

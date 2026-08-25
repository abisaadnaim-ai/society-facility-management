import { createClient } from "@/lib/supabase/server";
import { resolveFilters, rangeLabel, type RawSearchParams } from "@/lib/reports/filters";
import { getInspectionReport, getFindingsReport } from "@/lib/queries/reports";
import { KpiCard, KpiGrid, ReportSection, BarList } from "@/components/reports/ui";
import { PrintButton } from "@/components/reports/toolbar";
import { num, formatPct } from "@/lib/reports/util";
import type { Breakdown, InspectionReport } from "@/lib/types/reports";

type TplRow = InspectionReport["by_template"][number];
const toBars = (items: Breakdown[]) => items.map((b) => ({ label: b.label ?? "—", value: b.count }));
const schedBars = (items: (Breakdown & { scheduled?: number })[]) =>
  items.map((b) => ({ label: b.label ?? "—", value: num(b.scheduled) }));

export default async function InspectionsReportPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const f = resolveFilters(await searchParams);
  const supabase = await createClient();
  const [r, findings] = await Promise.all([getInspectionReport(supabase, f), getFindingsReport(supabase, f)]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">Inspections · {rangeLabel(f)}</p>
        <PrintButton />
      </div>

      <ReportSection
        title="Summary"
        description="Occurrences scheduled in the period. Compliance % = completed ÷ (completed + overdue). Completed = submitted/reviewed/closed."
      >
        <KpiGrid cols={4}>
          <KpiCard label="Scheduled" value={r.scheduled} />
          <KpiCard label="Completed" value={r.completed} />
          <KpiCard label="Passed" value={r.passed} tone="success" />
          <KpiCard label="Failed" value={r.failed} tone="danger" />
          <KpiCard label="Overdue" value={r.overdue} tone="warning" />
          <KpiCard label="Skipped" value={r.skipped} />
          <KpiCard label="Awaiting Review" value={r.awaiting_review} />
          <KpiCard label="Compliance" value={formatPct(r.compliance_pct)} />
        </KpiGrid>
      </ReportSection>

      <div className="grid grid-cols-1 gap-x-8 lg:grid-cols-2">
        <ReportSection title="By Location"><BarList items={schedBars(r.by_location)} empty="No inspections in the selected period." /></ReportSection>
        <ReportSection title="By Area"><BarList items={schedBars(r.by_area)} empty="No inspections in the selected period." /></ReportSection>
        <ReportSection title="By Template">
          <BarList items={(r.by_template as TplRow[]).map((b) => ({ label: `${b.label ?? "—"} · ${num(b.passed)}✓ ${num(b.failed)}✗`, value: num(b.scheduled) }))} empty="No inspections in the selected period." />
        </ReportSection>
        <ReportSection title="By Inspector"><BarList items={schedBars(r.by_inspector)} empty="No inspections in the selected period." /></ReportSection>
      </div>

      <ReportSection title="Findings" description="Findings created in the selected period.">
        <KpiGrid cols={6}>
          <KpiCard label="Total" value={findings.total} />
          <KpiCard label="Open" value={findings.open} tone="warning" />
          <KpiCard label="Action Required" value={findings.action_required} tone="warning" />
          <KpiCard label="FM Request Created" value={findings.fm_request_created} />
          <KpiCard label="Work Order Created" value={findings.work_order_created} />
          <KpiCard label="Resolved" value={findings.resolved} tone="success" />
        </KpiGrid>
      </ReportSection>

      <div className="grid grid-cols-1 gap-x-8 lg:grid-cols-2">
        <ReportSection title="Findings by Priority"><BarList items={toBars(findings.by_priority)} empty="No findings in the selected period." /></ReportSection>
        <ReportSection title="Findings by Asset"><BarList items={toBars(findings.by_asset)} empty="No findings in the selected period." /></ReportSection>
        <ReportSection title="Findings by Template"><BarList items={toBars(findings.by_template)} empty="No findings in the selected period." /></ReportSection>
        <ReportSection title="Findings by Location"><BarList items={toBars(findings.by_location)} empty="No findings in the selected period." /></ReportSection>
      </div>
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import { resolveFilters, rangeLabel, type RawSearchParams } from "@/lib/reports/filters";
import { getAssetsReport } from "@/lib/queries/reports";
import { KpiCard, KpiGrid, ReportSection, BarList } from "@/components/reports/ui";
import { PrintButton } from "@/components/reports/toolbar";
import type { Breakdown } from "@/lib/types/reports";

const codeBars = (items: Breakdown[]) =>
  items.map((b) => ({ label: b.code ? `${b.code} · ${b.label ?? ""}`.trim() : b.label ?? "—", value: b.count }));
const labelBars = (items: Breakdown[]) => items.map((b) => ({ label: b.label ?? "—", value: b.count }));

export default async function AssetsReportPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const f = resolveFilters(await searchParams);
  const supabase = await createClient();
  const r = await getAssetsReport(supabase, f);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">Asset Reliability · {rangeLabel(f)}</p>
        <PrintButton />
      </div>

      <ReportSection title="Status & Reliability" description="Repeat failure = 2 or more work orders against the same asset within the selected period (factual, no invented threshold).">
        <KpiGrid cols={4}>
          <KpiCard label="Out of Service" value={r.out_of_service} tone="danger" />
          <KpiCard label="Under Maintenance" value={r.under_maintenance} tone="warning" />
          <KpiCard label="Repeat-Failure Assets" value={r.repeat_failure_count} tone="warning" />
          <KpiCard label="Assets w/ Findings" value={r.findings_by_asset.length} />
        </KpiGrid>
      </ReportSection>

      <div className="grid grid-cols-1 gap-x-8 lg:grid-cols-2">
        <ReportSection title="Assets with Most Work Orders"><BarList items={codeBars(r.most_wo)} empty="No work orders against assets in the selected period." /></ReportSection>
        <ReportSection title="Repeat Failures (≥2 WOs)"><BarList items={codeBars(r.repeat_failures)} empty="No repeat failures in the selected period." /></ReportSection>
        <ReportSection title="Findings by Asset"><BarList items={codeBars(r.findings_by_asset)} empty="No findings against assets in the selected period." /></ReportSection>
        <ReportSection title="Currently Out of Service"><BarList items={codeBars(r.out_of_service_list)} empty="No assets are out of service." /></ReportSection>
      </div>

      <ReportSection title="Recurring Issues" description="Categories and areas generating repeated work orders in the period (spec §23, factual — no root-cause claims).">
        <div className="grid grid-cols-1 gap-x-8 lg:grid-cols-2">
          <BarList items={labelBars(r.recurring_categories)} empty="No recurring categories in the selected period." />
          <BarList items={labelBars(r.recurring_areas)} empty="No recurring areas in the selected period." />
        </div>
      </ReportSection>

      <ReportSection title="Asset Downtime">
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-4 text-sm text-slate-500">
          {r.downtime_note || "Downtime tracking requires additional asset lifecycle timestamps."}
        </div>
      </ReportSection>
    </div>
  );
}

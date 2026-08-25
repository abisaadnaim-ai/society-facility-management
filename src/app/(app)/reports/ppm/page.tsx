import { createClient } from "@/lib/supabase/server";
import { resolveFilters, rangeLabel, type RawSearchParams } from "@/lib/reports/filters";
import { getPpmReport } from "@/lib/queries/reports";
import { KpiCard, KpiGrid, ReportSection, DataTable, BarList, type Column } from "@/components/reports/ui";
import { PrintButton } from "@/components/reports/toolbar";
import { num, formatPct } from "@/lib/reports/util";
import type { Breakdown, PpmReport } from "@/lib/types/reports";

type LocRow = PpmReport["by_location"][number];

export default async function PpmReportPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const f = resolveFilters(await searchParams);
  const supabase = await createClient();
  const r = await getPpmReport(supabase, f);

  const locCols: Column<LocRow>[] = [
    { key: "label", label: "Location", render: (x) => <span className="font-medium text-slate-900">{x.label ?? "—"}</span> },
    { key: "scheduled", label: "Scheduled", align: "right", render: (x) => num(x.scheduled) },
    { key: "completed", label: "Completed", align: "right", render: (x) => num(x.completed) },
    { key: "overdue", label: "Overdue", align: "right", render: (x) => num(x.overdue) },
    { key: "skipped", label: "Skipped", align: "right", render: (x) => num(x.skipped) },
    { key: "compliance", label: "Compliance", align: "right", render: (x) => formatPct(x.compliance_pct) },
  ];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">Preventive Maintenance · {rangeLabel(f)}</p>
        <PrintButton />
      </div>

      <ReportSection
        title="Summary"
        description="Occurrences scheduled in the period. Compliance % = completed-on-time ÷ (completed + overdue-missed). On-time = completed on/before the due date (Asia/Qatar). Skipped shown separately."
      >
        <KpiGrid cols={4}>
          <KpiCard label="Active Plans" value={r.active_plans} />
          <KpiCard label="Scheduled" value={r.scheduled} />
          <KpiCard label="Completed" value={r.completed} />
          <KpiCard label="Completed On Time" value={r.completed_on_time} tone="success" />
          <KpiCard label="Overdue / Missed" value={r.overdue} tone="warning" />
          <KpiCard label="Skipped" value={r.skipped} />
          <KpiCard label="Open PPM WOs" value={r.open_wo} />
          <KpiCard label="Compliance" value={formatPct(r.compliance_pct)} />
        </KpiGrid>
      </ReportSection>

      <ReportSection title="By Location">
        <DataTable columns={locCols} rows={r.by_location} getKey={(x, i) => `${x.label ?? i}`} empty="No PPM occurrences scheduled in the selected period." />
      </ReportSection>

      <div className="grid grid-cols-1 gap-x-8 lg:grid-cols-2">
        <ReportSection title="By Asset Category">
          <BarList items={(r.by_category as Breakdown[]).map((b) => ({ label: b.label ?? "—", value: num((b as LocRow).scheduled) }))} empty="No PPM occurrences in the selected period." />
        </ReportSection>
        <ReportSection title="By Technician">
          <BarList items={(r.by_technician as Breakdown[]).map((b) => ({ label: b.label ?? "—", value: num((b as LocRow).scheduled) }))} empty="No PPM occurrences in the selected period." />
        </ReportSection>
      </div>
    </div>
  );
}

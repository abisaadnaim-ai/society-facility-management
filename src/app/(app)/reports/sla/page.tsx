import { createClient } from "@/lib/supabase/server";
import { resolveFilters, rangeLabel, type RawSearchParams } from "@/lib/reports/filters";
import { getSlaReport, getTrendSla } from "@/lib/queries/reports";
import { KpiCard, KpiGrid, ReportSection, BarList } from "@/components/reports/ui";
import { LineChartSvg } from "@/components/reports/charts";
import { PrintButton } from "@/components/reports/toolbar";
import { num, formatPct } from "@/lib/reports/util";
import type { Breakdown } from "@/lib/types/reports";

const toBars = (items: Breakdown[]) => items.map((b) => ({ label: b.label ?? "—", value: b.count }));
const shortDate = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export default async function SlaReportPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const f = resolveFilters(await searchParams);
  const supabase = await createClient();
  const days = Math.round(
    (new Date(`${f.toDate}T12:00:00Z`).getTime() - new Date(`${f.fromDate}T12:00:00Z`).getTime()) / 86400000
  );
  const bucket = days > 120 ? "month" : days > 21 ? "week" : "day";
  const [r, trend] = await Promise.all([getSlaReport(supabase, f), getTrendSla(supabase, f, bucket)]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">SLA Compliance · {rangeLabel(f)}</p>
        <PrintButton />
      </div>

      <ReportSection
        title="Compliance"
        description="Compliance % = Met / (Met + Breached) × 100. Excludes Not Applicable and still-open (pending) records. Cohort = records created in the period with a final SLA status."
      >
        <KpiGrid cols={3}>
          <KpiCard label="Response Compliance" value={formatPct(r.response.compliance_pct)} sub={`${r.response.met} met · ${r.response.breached} breached`} tone={num(r.response.breached) > 0 ? "warning" : "success"} />
          <KpiCard label="Resolution Compliance" value={formatPct(r.resolution.compliance_pct)} sub={`${r.resolution.met} met · ${r.resolution.breached} breached`} tone={num(r.resolution.breached) > 0 ? "warning" : "success"} />
          <KpiCard label="Overall Compliance" value={formatPct(r.overall.compliance_pct)} sub={`${r.overall.applicable} applicable`} />
        </KpiGrid>
      </ReportSection>

      <ReportSection title="Applicable Records">
        <KpiGrid cols={6}>
          <KpiCard label="Response Met" value={r.response.met} tone="success" />
          <KpiCard label="Response Breached" value={r.response.breached} tone="danger" />
          <KpiCard label="Resolution Met" value={r.resolution.met} tone="success" />
          <KpiCard label="Resolution Breached" value={r.resolution.breached} tone="danger" />
          <KpiCard label="Total Applicable" value={r.overall.applicable} />
          <KpiCard label="Total Breached" value={r.overall.breached} tone="danger" />
        </KpiGrid>
      </ReportSection>

      <ReportSection title="Compliance Trend" description={`Response and resolution compliance over ${rangeLabel(f)}.`}>
        <LineChartSvg
          labels={trend.map((t) => shortDate(t.bucket))}
          ySuffix="%"
          yMax={100}
          series={[
            { name: "Response %", color: "#0ea5e9", points: trend.map((t) => (t.response_pct == null ? null : num(t.response_pct))) },
            { name: "Resolution %", color: "#6366f1", points: trend.map((t) => (t.resolution_pct == null ? null : num(t.resolution_pct))) },
          ]}
          empty="No SLA-applicable records in the selected period."
        />
      </ReportSection>

      <div className="grid grid-cols-1 gap-x-8 lg:grid-cols-3">
        <ReportSection title="Breaches by Priority"><BarList items={toBars(r.breaches_by_priority)} empty="No breaches in the selected period." /></ReportSection>
        <ReportSection title="Breaches by Location"><BarList items={toBars(r.breaches_by_location)} empty="No breaches in the selected period." /></ReportSection>
        <ReportSection title="Breaches by Category"><BarList items={toBars(r.breaches_by_category)} empty="No breaches in the selected period." /></ReportSection>
      </div>
    </div>
  );
}

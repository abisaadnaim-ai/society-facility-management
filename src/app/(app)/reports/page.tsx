import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolveFilters, rangeLabel, filtersToQuery, type RawSearchParams } from "@/lib/reports/filters";
import {
  getDashboardOverview,
  getNeedsAttention,
  getLocationComparison,
  getTrendCounts,
} from "@/lib/queries/reports";
import { KpiCard, KpiGrid, ReportSection, Empty, DataTable, type Column } from "@/components/reports/ui";
import { LineChartSvg } from "@/components/reports/charts";
import { PrintButton } from "@/components/reports/toolbar";
import { num, formatDuration, formatPct } from "@/lib/reports/util";
import { formatDateTimeQatar } from "@/lib/format";
import type { LocationComparisonRow } from "@/lib/types/reports";

function bucketFor(fromDate: string, toDate: string): "day" | "week" | "month" {
  const days = Math.round(
    (new Date(`${toDate}T12:00:00Z`).getTime() - new Date(`${fromDate}T12:00:00Z`).getTime()) / 86400000
  );
  if (days > 366) return "month";
  if (days > 45) return "week";
  return "day";
}

const shortDate = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export default async function ReportsOverviewPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const sp = await searchParams;
  const f = resolveFilters(sp);
  const supabase = await createClient();

  const [ov, needs, locations, trend] = await Promise.all([
    getDashboardOverview(supabase, f),
    getNeedsAttention(supabase, f, 40),
    getLocationComparison(supabase, f),
    getTrendCounts(supabase, f, bucketFor(f.fromDate, f.toDate)),
  ]);

  const co = ov.current_ops;
  const q = filtersToQuery(f);
  const withQ = (href: string) => (q ? `${href}?${q}` : href);

  const trendLabels = trend.map((r) => shortDate(r.bucket));
  const locationsWithData = locations.filter(
    (l) => num(l.fm_requests) + num(l.work_orders) + num(l.ppm_applicable) + num(l.insp_completed) > 0
  );

  const locCols: Column<LocationComparisonRow>[] = [
    { key: "location", label: "Location", render: (r) => <span className="font-medium text-slate-900">{r.location}</span> },
    { key: "fm_requests", label: "FM Req.", align: "right", render: (r) => num(r.fm_requests) },
    { key: "work_orders", label: "WOs", align: "right", render: (r) => num(r.work_orders) },
    { key: "critical", label: "Critical", align: "right", render: (r) => num(r.critical) },
    { key: "overdue_wo", label: "Overdue", align: "right", render: (r) => num(r.overdue_wo) },
    { key: "sla", label: "SLA %", align: "right", render: (r) => formatPct(r.sla_compliance_pct) },
    { key: "avg_res", label: "Avg Resolution", align: "right", render: (r) => formatDuration(r.avg_resolution_seconds) },
    { key: "ppm", label: "PPM %", align: "right", render: (r) => formatPct(r.ppm_compliance_pct) },
    { key: "insp", label: "Insp. %", align: "right", render: (r) => formatPct(r.insp_compliance_pct) },
    { key: "findings", label: "Findings", align: "right", render: (r) => num(r.findings) },
  ];

  return (
    <div>
      {/* Print header (visible only when printing) — spec §31 */}
      <div className="mb-4 hidden print:block">
        <h1 className="text-xl font-semibold text-slate-900">Society Facility Management — Management Overview</h1>
        <p className="text-sm text-slate-600">
          Period: {rangeLabel(f)} · Generated {formatDateTimeQatar(new Date().toISOString())} (Asia/Qatar)
        </p>
      </div>

      <div className="mb-4 flex items-center justify-between print:hidden">
        <p className="text-sm text-slate-500">
          Current operational state · Trends for {rangeLabel(f)}
        </p>
        <PrintButton />
      </div>

      <ReportSection title="Current Operations" description="Live state right now, filtered by location/priority/category.">
        <KpiGrid cols={4}>
          <KpiCard label="Open FM Requests" value={co.open_fm_requests} href={withQ("/fm-requests")} />
          <KpiCard label="Open Work Orders" value={co.open_work_orders} href={withQ("/work-orders")} />
          <KpiCard label="Critical Open" value={co.critical_open} href={withQ("/work-orders")} tone="danger" />
          <KpiCard label="SLA Breached" value={co.sla_breached} href="/work-orders" tone="danger" hint="Open records currently in breached SLA state." />
          <KpiCard label="Overdue Work Orders" value={co.overdue_work_orders} href="/work-orders" tone="warning" hint="Open work orders past their manual due date (Asia/Qatar)." />
          <KpiCard label="Awaiting Verification" value={co.awaiting_verification} href="/work-orders" />
          <KpiCard label="Unassigned Work Orders" value={co.unassigned_work_orders} href="/work-orders" tone="warning" />
          <KpiCard label="Open Escalations" value={co.open_escalations} href="/work-orders" tone="danger" />
        </KpiGrid>
      </ReportSection>

      <div className="grid grid-cols-1 gap-x-8 lg:grid-cols-2">
        <ReportSection title="Preventive Operations">
          <KpiGrid cols={4}>
            <KpiCard label="PPM Due Today" value={ov.preventive.ppm_due_today} href="/preventive-maintenance" />
            <KpiCard label="PPM Due 7 Days" value={ov.preventive.ppm_due_7d} href="/preventive-maintenance" />
            <KpiCard label="PPM Overdue" value={ov.preventive.ppm_overdue} href="/preventive-maintenance" tone="warning" />
            <KpiCard label="Open PPM WOs" value={ov.preventive.ppm_open_wo} href="/work-orders" />
          </KpiGrid>
        </ReportSection>

        <ReportSection title="Inspections">
          <KpiGrid cols={4}>
            <KpiCard label="Due Today" value={ov.inspections.due_today} href="/inspections" />
            <KpiCard label="Overdue" value={ov.inspections.overdue} href="/inspections" tone="warning" />
            <KpiCard label="Failed (open)" value={ov.inspections.failed_open} href="/inspections" tone="danger" />
            <KpiCard label="Open Findings" value={ov.inspections.open_findings} href="/inspections/findings" tone="warning" />
          </KpiGrid>
        </ReportSection>

        <ReportSection title="Vendors & Contracts">
          <KpiGrid cols={3}>
            <KpiCard label="WOs Waiting Vendor" value={ov.vendors.wo_waiting_vendor} href="/work-orders" />
            <KpiCard label="Expiring ≤90 Days" value={ov.vendors.contracts_expiring_90d} href="/vendors/contracts" tone="warning" />
            <KpiCard label="Expired" value={ov.vendors.contracts_expired} href="/vendors/contracts" tone="danger" />
          </KpiGrid>
        </ReportSection>

        <ReportSection title="Inventory">
          <KpiGrid cols={3}>
            <KpiCard label="Low Stock" value={ov.inventory.low_stock} href="/inventory" tone="warning" />
            <KpiCard label="Out of Stock" value={ov.inventory.out_of_stock} href="/inventory" tone="danger" />
            <KpiCard label="—" value={""} />
          </KpiGrid>
        </ReportSection>
      </div>

      <ReportSection title="Needs Attention" description="Ranked by urgency. Each item links to the underlying record.">
        {needs.length === 0 ? (
          <Empty message="Nothing needs attention right now." />
        ) : (
          <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
            {needs.map((it) => (
              <Link
                key={`${it.entity_type}:${it.entity_id}:${it.rank}`}
                href={it.link}
                className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {it.ref ? `${it.ref} · ` : ""}
                    {it.title ?? "—"}
                  </p>
                  <p className="truncate text-xs text-slate-500">{it.detail}</p>
                </div>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {it.category}
                </span>
              </Link>
            ))}
          </div>
        )}
      </ReportSection>

      <ReportSection title="Activity Trend" description={`FM requests, work orders created and closed · ${rangeLabel(f)}`}>
        <LineChartSvg
          labels={trendLabels}
          series={[
            { name: "FM created", color: "#0ea5e9", points: trend.map((r) => num(r.fm_created)) },
            { name: "WO created", color: "#6366f1", points: trend.map((r) => num(r.wo_created)) },
            { name: "WO closed", color: "#10b981", points: trend.map((r) => num(r.wo_closed)) },
          ]}
        />
      </ReportSection>

      <ReportSection title="Location Comparison" description="Factual operational metrics per location for the selected period (spec §6).">
        <DataTable
          columns={locCols}
          rows={locationsWithData}
          getKey={(r) => r.location_id}
          empty="No location activity for the selected period."
        />
      </ReportSection>
    </div>
  );
}

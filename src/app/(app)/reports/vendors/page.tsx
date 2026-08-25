import { createClient } from "@/lib/supabase/server";
import { resolveFilters, rangeLabel, type RawSearchParams } from "@/lib/reports/filters";
import { getVendorsReport } from "@/lib/queries/reports";
import { KpiCard, KpiGrid, ReportSection, BarList } from "@/components/reports/ui";
import { PrintButton, ExportCsvButton } from "@/components/reports/toolbar";
import { formatDuration } from "@/lib/reports/util";
import type { Breakdown } from "@/lib/types/reports";

export default async function VendorsReportPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const f = resolveFilters(await searchParams);
  const supabase = await createClient();
  const r = await getVendorsReport(supabase, f);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">Vendors & Contracts · {rangeLabel(f)}</p>
        <div className="flex gap-2">
          <ExportCsvButton dataset="contracts" query="" />
          <PrintButton />
        </div>
      </div>

      <ReportSection title="Summary" description="Vendor and service-contract state (factual — no vendor scoring).">
        <KpiGrid cols={4}>
          <KpiCard label="Active Vendors" value={r.active_vendors} href="/vendors" />
          <KpiCard label="Active Contracts" value={r.active_contracts} href="/vendors/contracts" />
          <KpiCard label="Expiring ≤90 Days" value={r.expiring_90d} href="/vendors/contracts" tone="warning" />
          <KpiCard label="Expiring ≤30 Days" value={r.expiring_30d} href="/vendors/contracts" tone="warning" />
          <KpiCard label="Expired" value={r.expired} href="/vendors/contracts" tone="danger" />
          <KpiCard label="WOs Waiting Vendor" value={r.wo_waiting_vendor} href="/work-orders" />
          <KpiCard label="Completed Vendor WOs" value={r.completed_vendor_wo} sub="closed in period" />
          <KpiCard label="Avg Vendor Resolution" value={formatDuration(r.avg_resolution_seconds)} />
        </KpiGrid>
      </ReportSection>

      <ReportSection title="Work Orders by Vendor" description="Vendor-related work orders created in the selected period.">
        <BarList items={(r.wo_by_vendor as Breakdown[]).map((b) => ({ label: b.label ?? "—", value: b.count }))} empty="No vendor-related work orders in the selected period." />
      </ReportSection>
    </div>
  );
}

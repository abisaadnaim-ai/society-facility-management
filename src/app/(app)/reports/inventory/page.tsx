import { createClient } from "@/lib/supabase/server";
import { resolveFilters, filtersToQuery, rangeLabel, type RawSearchParams } from "@/lib/reports/filters";
import { getInventoryReport, getPartsUsage } from "@/lib/queries/reports";
import { KpiCard, KpiGrid, ReportSection, DataTable, type Column } from "@/components/reports/ui";
import { PrintButton, ExportCsvButton } from "@/components/reports/toolbar";
import { num } from "@/lib/reports/util";
import type { PartsUsageRow } from "@/lib/types/reports";

export default async function InventoryReportPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const f = resolveFilters(await searchParams);
  const supabase = await createClient();
  const [r, parts] = await Promise.all([getInventoryReport(supabase, f), getPartsUsage(supabase, f)]);
  const q = filtersToQuery(f);

  const cols: Column<PartsUsageRow>[] = [
    { key: "item_code", label: "Item Code", render: (x) => <span className="font-medium text-slate-900">{x.item_code}</span> },
    { key: "item_name", label: "Item" },
    { key: "issued_qty", label: "Issued", align: "right", render: (x) => num(x.issued_qty) },
    { key: "returned_qty", label: "Returned", align: "right", render: (x) => num(x.returned_qty) },
    { key: "net_used", label: "Net Used", align: "right", render: (x) => num(x.net_used) },
    { key: "movement_count", label: "Movements", align: "right", render: (x) => num(x.movement_count) },
  ];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">Inventory & Parts Usage · {rangeLabel(f)}</p>
        <div className="flex gap-2">
          <ExportCsvButton dataset="stock-movements" query={q} />
          <PrintButton />
        </div>
      </div>

      <ReportSection title="Stock" description="FM stock reporting only — no financial valuation (no procurement/cost data).">
        <KpiGrid cols={4}>
          <KpiCard label="Total Items" value={r.total_items} href="/inventory" />
          <KpiCard label="Low Stock" value={r.low_stock} href="/inventory" tone="warning" />
          <KpiCard label="Out of Stock" value={r.out_of_stock} href="/inventory" tone="danger" />
          <KpiCard label="Movements" value={r.movements_total} href="/inventory/movements" sub="in period" />
        </KpiGrid>
      </ReportSection>

      <ReportSection title="Movement Activity" description="Movements recorded in the selected period.">
        <KpiGrid cols={4}>
          <KpiCard label="Issued (qty)" value={num(r.issued_qty)} />
          <KpiCard label="Returned (qty)" value={num(r.returned_qty)} />
          <KpiCard label="Adjustments" value={r.adjustments} />
          <KpiCard label="Transfers" value={r.transfers} />
        </KpiGrid>
      </ReportSection>

      <ReportSection title="Parts Usage" description="Net Used = Issued − Returned (Phase 7 movement history), most-used first.">
        <DataTable columns={cols} rows={parts} getKey={(x) => x.item_id} empty="No parts issued or returned in the selected period." />
      </ReportSection>
    </div>
  );
}

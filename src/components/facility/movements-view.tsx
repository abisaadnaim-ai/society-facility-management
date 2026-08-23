"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { FilterContainer } from "@/components/shared/filter-container";
import { SearchField } from "@/components/shared/search-field";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { MovementTypeBadge } from "@/components/facility/inventory-badges";
import { formatDate } from "@/lib/format";
import { fmtQty, MOVEMENT_TYPE_LABEL, type MovementListRow, type MovementType } from "@/lib/types/inventory";

const TYPES: MovementType[] = ["opening_balance", "stock_in", "issue", "return", "adjustment_increase", "adjustment_decrease", "transfer_out", "transfer_in"];

export function MovementsView({
  movements,
  stockLocations,
}: {
  movements: MovementListRow[];
  stockLocations: { id: string; name: string; code: string }[];
}) {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [loc, setLoc] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return movements.filter((m) => {
      if (type && m.movement_type !== type) return false;
      if (loc && m.stock_location?.id !== loc) return false;
      if (q) {
        const hay = [m.movement_number, m.item?.item_code, m.item?.name, m.work_order?.work_order_number, m.reference]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [movements, search, type, loc]);

  return (
    <div>
      <PageHeader
        title="Stock Movements"
        description="Full history of inventory transactions."
        actions={<Link href="/inventory"><Button variant="ghost">Back to Inventory</Button></Link>}
      />
      <FilterContainer>
        <SearchField placeholder="Search movement, item, WO, reference" value={search} onChange={(e) => setSearch(e.target.value)} className="sm:w-80" />
        <Select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          {TYPES.map((t) => <option key={t} value={t}>{MOVEMENT_TYPE_LABEL[t]}</option>)}
        </Select>
        <Select value={loc} onChange={(e) => setLoc(e.target.value)}>
          <option value="">All locations</option>
          {stockLocations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
      </FilterContainer>

      {filtered.length === 0 ? (
        <EmptyState title="No movements" description={movements.length === 0 ? "No stock transactions have been recorded yet." : "No movements match your filters."} />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-lg border border-slate-200 md:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Movement #</th><th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Item</th><th className="px-4 py-2.5 font-medium">Type</th>
                  <th className="px-4 py-2.5 text-right font-medium">Qty</th><th className="px-4 py-2.5 font-medium">Location</th>
                  <th className="px-4 py-2.5 font-medium">Work Order</th><th className="px-4 py-2.5 font-medium">Reference</th><th className="px-4 py-2.5 font-medium">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-medium text-slate-800">{m.movement_number}</td>
                    <td className="px-4 py-2.5 text-slate-500">{formatDate(m.created_at)}</td>
                    <td className="px-4 py-2.5">
                      {m.item ? <Link href={`/inventory/${m.item.id}`} className="text-slate-800 hover:underline">{m.item.item_code}</Link> : "—"}
                      <span className="block text-xs text-slate-400">{m.item?.name}</span>
                    </td>
                    <td className="px-4 py-2.5"><MovementTypeBadge type={m.movement_type} /></td>
                    <td className="px-4 py-2.5 text-right text-slate-900">{fmtQty(m.quantity)}</td>
                    <td className="px-4 py-2.5 text-slate-600">{m.stock_location?.name ?? "—"}</td>
                    <td className="px-4 py-2.5 text-slate-600">{m.work_order ? <Link href={`/work-orders/${m.work_order.id}`} className="hover:underline">{m.work_order.work_order_number}</Link> : "—"}</td>
                    <td className="px-4 py-2.5 text-slate-500">{m.reference ?? "—"}</td>
                    <td className="px-4 py-2.5 text-slate-500">{m.user_name ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-3 md:hidden">
            {filtered.map((m) => (
              <div key={m.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{m.item?.name ?? "—"}</p>
                    <p className="text-xs text-slate-500">{m.movement_number} · {formatDate(m.created_at)}</p>
                  </div>
                  <MovementTypeBadge type={m.movement_type} />
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-slate-500">{m.stock_location?.name ?? "—"}</span>
                  <span className="font-medium text-slate-900">{fmtQty(m.quantity)}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">{filtered.length} of {movements.length} movements</p>
        </>
      )}
    </div>
  );
}

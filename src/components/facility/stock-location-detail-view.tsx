"use client";

import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StockStatusBadge } from "@/components/facility/inventory-badges";
import { fmtQty, type StockLocationDetail } from "@/lib/types/inventory";

export function StockLocationDetailView({ location, canManage }: { location: StockLocationDetail; canManage: boolean }) {
  const totalUnits = location.items.reduce((s, i) => s + i.quantity, 0);
  const lowCount = location.items.filter((i) => i.status !== "in_stock").length;
  return (
    <div>
      <PageHeader
        title={location.name}
        description={`${location.code} · ${location.location_name ?? "—"}${location.area_name ? ` · ${location.area_name}` : ""}`}
        actions={
          <div className="flex gap-2">
            <Link href="/inventory/stock-locations"><Button variant="ghost">Back</Button></Link>
            {canManage && <Link href={`/inventory/stock-locations/${location.id}/edit`}><Button variant="outline">Edit</Button></Link>}
          </div>
        }
      />
      <div className="mb-6 grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Items</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{location.items.length}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total Units</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{fmtQty(totalUnits)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Low / Out</p>
          <p className={["mt-1 text-2xl font-semibold", lowCount > 0 ? "text-amber-600" : "text-slate-900"].join(" ")}>{lowCount}</p>
        </div>
      </div>

      {location.description && <p className="mb-4 text-sm text-slate-600">{location.description}</p>}

      {location.items.length === 0 ? (
        <EmptyState title="No stock held here" description="This location has no inventory yet." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Item Code</th><th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 text-right font-medium">Qty Here</th><th className="px-4 py-2.5 text-right font-medium">Min</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {location.items.map((i) => (
                <tr key={i.inventory_item_id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5"><Link href={`/inventory/${i.inventory_item_id}`} className="font-medium text-slate-800 hover:underline">{i.item_code}</Link></td>
                  <td className="px-4 py-2.5 text-slate-700">{i.name}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-slate-900">{fmtQty(i.quantity)}</td>
                  <td className="px-4 py-2.5 text-right text-slate-500">{fmtQty(i.minimum_stock_level)}</td>
                  <td className="px-4 py-2.5"><StockStatusBadge status={i.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

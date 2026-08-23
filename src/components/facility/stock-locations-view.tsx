"use client";

import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { StockLocationRow } from "@/lib/types/inventory";

export function StockLocationsView({ locations, canManage }: { locations: StockLocationRow[]; canManage: boolean }) {
  return (
    <div>
      <PageHeader
        title="Stock Locations"
        description="Physical stores where inventory is held."
        actions={
          <div className="flex gap-2">
            <Link href="/inventory"><Button variant="ghost">Back to Inventory</Button></Link>
            {canManage && <Link href="/inventory/stock-locations/new"><Button>New Stock Location</Button></Link>}
          </div>
        }
      />
      {locations.length === 0 ? (
        <EmptyState
          title="No stock locations"
          description="Add the FM stores where inventory is physically kept."
          action={canManage ? <Link href="/inventory/stock-locations/new"><Button>New Stock Location</Button></Link> : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {locations.map((l) => (
            <Link key={l.id} href={`/inventory/stock-locations/${l.id}`} className="rounded-lg border border-slate-200 bg-white p-4 hover:bg-slate-50">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{l.name}</p>
                  <p className="text-xs text-slate-500">{l.code}</p>
                </div>
                {!l.is_active && <Badge variant="neutral">Inactive</Badge>}
              </div>
              <p className="mt-2 text-sm text-slate-500">
                {l.location_name ?? "—"}{l.area_name ? ` · ${l.area_name}` : ""}
              </p>
              <div className="mt-3 flex items-center gap-4 text-sm">
                <span className="text-slate-600">{l.item_count} item{l.item_count === 1 ? "" : "s"}</span>
                {l.low_stock_count > 0 && <span className="text-amber-600">{l.low_stock_count} low/out</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

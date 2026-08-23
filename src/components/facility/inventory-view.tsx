"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { FilterContainer } from "@/components/shared/filter-container";
import { SearchField } from "@/components/shared/search-field";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StockStatusBadge } from "@/components/facility/inventory-badges";
import { fmtQty, type InventoryItemRow, type InventoryCategory, type StockStatus } from "@/lib/types/inventory";

export function InventoryView({
  items,
  categories,
  stockLocations,
  canManage,
}: {
  items: InventoryItemRow[];
  categories: InventoryCategory[];
  stockLocations: { id: string; name: string; code: string }[];
  canManage: boolean;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [active, setActive] = useState("active");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (category && it.category_id !== category) return false;
      if (status && it.status !== (status as StockStatus)) return false;
      if (active === "active" && !it.is_active) return false;
      if (active === "inactive" && it.is_active) return false;
      if (q) {
        const hay = [it.item_code, it.name, it.part_number, it.manufacturer, it.barcode]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, search, category, status, active]);

  return (
    <div>
      <PageHeader
        title="Inventory"
        description="Spare parts and consumables held by facility management."
        actions={
          canManage ? (
            <div className="flex gap-2">
              <Link href="/inventory/stock-locations"><Button variant="outline">Stock Locations</Button></Link>
              <Link href="/inventory/movements"><Button variant="outline">Movements</Button></Link>
              <Link href="/inventory/new"><Button>New Item</Button></Link>
            </div>
          ) : (
            <div className="flex gap-2">
              <Link href="/inventory/stock-locations"><Button variant="outline">Stock Locations</Button></Link>
              <Link href="/inventory/movements"><Button variant="outline">Movements</Button></Link>
            </div>
          )
        }
      />

      <FilterContainer>
        <SearchField
          placeholder="Search code, name, part no., manufacturer, barcode"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:w-80"
        />
        <Select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Any stock status</option>
          <option value="in_stock">In Stock</option>
          <option value="low_stock">Low Stock</option>
          <option value="out_of_stock">Out of Stock</option>
        </Select>
        <Select value={active} onChange={(e) => setActive(e.target.value)}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="all">All</option>
        </Select>
      </FilterContainer>

      {filtered.length === 0 ? (
        <EmptyState
          title="No inventory items"
          description={items.length === 0 ? "No items have been added yet." : "No items match your filters."}
          action={canManage && items.length === 0 ? <Link href="/inventory/new"><Button>New Item</Button></Link> : undefined}
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-lg border border-slate-200 md:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Item Code</th>
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">Category</th>
                  <th className="px-4 py-2.5 font-medium">Part No.</th>
                  <th className="px-4 py-2.5 font-medium">Unit</th>
                  <th className="px-4 py-2.5 text-right font-medium">Total Stock</th>
                  <th className="px-4 py-2.5 text-right font-medium">Min</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((it) => (
                  <tr key={it.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <Link href={`/inventory/${it.id}`} className="font-medium text-slate-900 hover:underline">{it.item_code}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">
                      {it.name}{!it.is_active && <span className="ml-2 text-xs text-slate-400">(inactive)</span>}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{it.category?.name ?? "—"}</td>
                    <td className="px-4 py-2.5 text-slate-600">{it.part_number ?? "—"}</td>
                    <td className="px-4 py-2.5 text-slate-600">{it.unit?.abbreviation ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-slate-900">{fmtQty(it.total_stock)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{fmtQty(it.minimum_stock_level)}</td>
                    <td className="px-4 py-2.5"><StockStatusBadge status={it.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {filtered.map((it) => (
              <Link
                key={it.id}
                href={`/inventory/${it.id}`}
                className="block rounded-lg border border-slate-200 bg-white p-4 active:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{it.name}</p>
                    <p className="text-xs text-slate-500">{it.item_code}{it.part_number ? ` · ${it.part_number}` : ""}</p>
                  </div>
                  <StockStatusBadge status={it.status} />
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-slate-500">{it.category?.name ?? "—"}</span>
                  <span className="font-medium text-slate-900">
                    {fmtQty(it.total_stock)} {it.unit?.abbreviation ?? ""}
                    {it.minimum_stock_level != null && <span className="ml-1 text-xs font-normal text-slate-400">/ min {fmtQty(it.minimum_stock_level)}</span>}
                  </span>
                </div>
              </Link>
            ))}
          </div>

          <p className="mt-3 text-xs text-slate-500">{filtered.length} of {items.length} items · {stockLocations.length} stock location{stockLocations.length === 1 ? "" : "s"}</p>
        </>
      )}
    </div>
  );
}

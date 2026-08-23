"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { createInventoryItem, updateInventoryItem, type InventoryItemInput } from "@/lib/actions/inventory";
import type { InventoryCategory, UnitOfMeasure, InventoryItem } from "@/lib/types/inventory";

export function InventoryItemForm({
  categories,
  units,
  vendors,
  item,
}: {
  categories: InventoryCategory[];
  units: UnitOfMeasure[];
  vendors: { id: string; company_name: string }[];
  item?: InventoryItem;
}) {
  const router = useRouter();
  const editing = !!item;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({
    name: item?.name ?? "",
    description: item?.description ?? "",
    category_id: item?.category_id ?? "",
    unit_of_measure_id: item?.unit_of_measure_id ?? "",
    manufacturer: item?.manufacturer ?? "",
    part_number: item?.part_number ?? "",
    barcode: item?.barcode ?? "",
    preferred_vendor_id: item?.preferred_vendor_id ?? "",
    minimum_stock_level: item?.minimum_stock_level != null ? String(item.minimum_stock_level) : "",
    reorder_reference_level: item?.reorder_reference_level != null ? String(item.reorder_reference_level) : "",
    notes: item?.notes ?? "",
  });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function submit() {
    setError(null);
    setBusy(true);
    const payload: InventoryItemInput = {
      name: f.name,
      description: f.description || null,
      category_id: f.category_id,
      unit_of_measure_id: f.unit_of_measure_id,
      manufacturer: f.manufacturer || null,
      part_number: f.part_number || null,
      barcode: f.barcode || null,
      preferred_vendor_id: f.preferred_vendor_id || null,
      minimum_stock_level: f.minimum_stock_level.trim() === "" ? null : Number(f.minimum_stock_level),
      reorder_reference_level: f.reorder_reference_level.trim() === "" ? null : Number(f.reorder_reference_level),
      notes: f.notes || null,
    };
    const res = editing ? await updateInventoryItem(item!.id, payload) : await createInventoryItem(payload);
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    router.push(editing ? `/inventory/${item!.id}` : "/inventory");
    router.refresh();
  }

  return (
    <div className="max-w-2xl space-y-4">
      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Item Name</label>
        <Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Treadmill Running Belt" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Category</label>
          <Select value={f.category_id} onChange={(e) => set("category_id", e.target.value)}>
            <option value="">Select category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Unit of Measure</label>
          <Select value={f.unit_of_measure_id} onChange={(e) => set("unit_of_measure_id", e.target.value)}>
            <option value="">Select unit</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.abbreviation})</option>)}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Manufacturer <span className="text-slate-400">(optional)</span></label>
          <Input value={f.manufacturer} onChange={(e) => set("manufacturer", e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Part Number <span className="text-slate-400">(optional)</span></label>
          <Input value={f.part_number} onChange={(e) => set("part_number", e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Barcode <span className="text-slate-400">(optional)</span></label>
          <Input value={f.barcode} onChange={(e) => set("barcode", e.target.value)} placeholder="Stored for future scanning" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Preferred Vendor <span className="text-slate-400">(informational)</span></label>
          <Select value={f.preferred_vendor_id} onChange={(e) => set("preferred_vendor_id", e.target.value)}>
            <option value="">None</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.company_name}</option>)}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Minimum Stock Level <span className="text-slate-400">(optional)</span></label>
          <Input type="number" min="0" step="0.001" value={f.minimum_stock_level} onChange={(e) => set("minimum_stock_level", e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Reorder Reference Level <span className="text-slate-400">(optional)</span></label>
          <Input type="number" min="0" step="0.001" value={f.reorder_reference_level} onChange={(e) => set("reorder_reference_level", e.target.value)} />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Description <span className="text-slate-400">(optional)</span></label>
        <Textarea rows={2} value={f.description} onChange={(e) => set("description", e.target.value)} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Notes <span className="text-slate-400">(optional)</span></label>
        <Textarea rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
      </div>

      <div className="flex gap-2 pt-2">
        <Button onClick={submit} isLoading={busy}>{editing ? "Save Changes" : "Create Item"}</Button>
        <Button variant="ghost" onClick={() => router.back()} disabled={busy}>Cancel</Button>
      </div>

      <p className="text-xs text-slate-500">
        Stock levels are established through Opening Balance and Stock In on the item page — not entered here. This module does not include purchasing.
      </p>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { createStockLocation, updateStockLocation, type StockLocationInput } from "@/lib/actions/inventory";
import type { StockLocation } from "@/lib/types/inventory";

export function StockLocationForm({
  locations,
  areas,
  location,
}: {
  locations: { id: string; name: string }[];
  areas: { id: string; name: string; location_id: string }[];
  location?: StockLocation;
}) {
  const router = useRouter();
  const editing = !!location;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({
    location_id: location?.location_id ?? "",
    area_id: location?.area_id ?? "",
    name: location?.name ?? "",
    code: location?.code ?? "",
    description: location?.description ?? "",
    is_active: location?.is_active ?? true,
  });
  const set = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));
  const areaOptions = areas.filter((a) => a.location_id === f.location_id);

  async function submit() {
    setError(null);
    setBusy(true);
    const payload: StockLocationInput = {
      location_id: f.location_id, area_id: f.area_id || null,
      name: f.name, code: f.code, description: f.description || null,
    };
    const res = editing
      ? await updateStockLocation(location!.id, { ...payload, is_active: f.is_active })
      : await createStockLocation(payload);
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    router.push("/inventory/stock-locations");
    router.refresh();
  }

  return (
    <div className="max-w-xl space-y-4">
      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
          <Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Main FM Store" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Code</label>
          <Input value={f.code} onChange={(e) => set("code", e.target.value)} placeholder="e.g. FMS-01" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Society Location</label>
          <Select value={f.location_id} onChange={(e) => { set("location_id", e.target.value); set("area_id", ""); }}>
            <option value="">Select location</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Area <span className="text-slate-400">(optional)</span></label>
          <Select value={f.area_id} onChange={(e) => set("area_id", e.target.value)} disabled={!f.location_id}>
            <option value="">None</option>
            {areaOptions.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Description <span className="text-slate-400">(optional)</span></label>
        <Textarea rows={2} value={f.description} onChange={(e) => set("description", e.target.value)} />
      </div>
      {editing && (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={f.is_active} onChange={(e) => set("is_active", e.target.checked)} />
          Active
        </label>
      )}
      <div className="flex gap-2 pt-2">
        <Button onClick={submit} isLoading={busy}>{editing ? "Save Changes" : "Create Stock Location"}</Button>
        <Button variant="ghost" onClick={() => router.back()} disabled={busy}>Cancel</Button>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { fmtQty, type AssetSparePartRow } from "@/lib/types/inventory";
import { linkAssetSparePart, unlinkAssetSparePart, setSparePartPreferred } from "@/lib/actions/inventory";

export function AssetSparePartsCard({
  assetId,
  parts,
  canManage,
  itemOptions,
}: {
  assetId: string;
  parts: AssetSparePartRow[];
  canManage: boolean;
  itemOptions: { id: string; item_code: string; name: string }[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [item, setItem] = useState("");
  const [preferred, setPreferred] = useState(false);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const linkedIds = new Set(parts.map((p) => p.inventory_item_id));
  const available = itemOptions.filter((i) => !linkedIds.has(i.id));

  async function add() {
    setError(null);
    if (!item) { setError("Select an item."); return; }
    setBusy(true);
    const res = await linkAssetSparePart({ asset_id: assetId, inventory_item_id: item, is_preferred: preferred, notes: notes || null });
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    setAdding(false); setItem(""); setPreferred(false); setNotes("");
    router.refresh();
  }

  async function unlink(id: string) {
    if (!confirm("Remove this compatible part?")) return;
    const res = await unlinkAssetSparePart(id, assetId);
    if (!res.ok) alert(res.error); else router.refresh();
  }

  async function togglePreferred(id: string, val: boolean) {
    const res = await setSparePartPreferred(id, assetId, val);
    if (!res.ok) alert(res.error); else router.refresh();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Spare Parts</CardTitle>
        {canManage && <Button size="sm" onClick={() => setAdding(true)} disabled={available.length === 0}>Link Part</Button>}
      </CardHeader>
      <CardContent>
        {parts.length === 0 ? (
          <p className="text-sm text-slate-500">No compatible spare parts linked to this asset.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Item</th><th className="px-3 py-2 font-medium">Code</th>
                  <th className="px-3 py-2 text-right font-medium">Stock</th><th className="px-3 py-2 font-medium">Preferred</th>
                  {canManage && <th className="px-3 py-2"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parts.map((p) => (
                  <tr key={p.id}>
                    <td className="px-3 py-2">
                      {p.item ? <Link href={`/inventory/${p.inventory_item_id}`} className="text-slate-800 hover:underline">{p.item.name}</Link> : "—"}
                      {p.item && !p.item.is_active && <span className="ml-2 text-xs text-slate-400">(inactive)</span>}
                    </td>
                    <td className="px-3 py-2 text-slate-500">{p.item?.item_code ?? "—"}</td>
                    <td className="px-3 py-2 text-right font-medium text-slate-900">{fmtQty(p.total_stock)}</td>
                    <td className="px-3 py-2">
                      {canManage ? (
                        <button onClick={() => togglePreferred(p.id, !p.is_preferred)}>
                          {p.is_preferred ? <Badge variant="info">Preferred</Badge> : <span className="text-xs text-slate-400 hover:underline">Set preferred</span>}
                        </button>
                      ) : p.is_preferred ? <Badge variant="info">Preferred</Badge> : <span className="text-slate-400">—</span>}
                    </td>
                    {canManage && <td className="px-3 py-2 text-right"><Button size="sm" variant="ghost" onClick={() => unlink(p.id)}>Remove</Button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {adding && (
        <Dialog
          open
          onClose={() => setAdding(false)}
          title="Link Compatible Part"
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAdding(false)} disabled={busy}>Cancel</Button>
              <Button onClick={add} isLoading={busy}>Link</Button>
            </div>
          }
        >
          <div className="space-y-3">
            {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Inventory Item</label>
              <Select value={item} onChange={(e) => setItem(e.target.value)}>
                <option value="">Select item</option>
                {available.map((i) => <option key={i.id} value={i.id}>{i.item_code} · {i.name}</option>)}
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={preferred} onChange={(e) => setPreferred(e.target.checked)} /> Preferred part
            </label>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Notes <span className="text-slate-400">(optional)</span></label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
        </Dialog>
      )}
    </Card>
  );
}

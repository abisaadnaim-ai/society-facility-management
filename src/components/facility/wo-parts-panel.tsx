"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/format";
import { fmtQty, type WorkOrderPartRow } from "@/lib/types/inventory";
import { issuePart, returnPart } from "@/lib/actions/inventory";

export function WorkOrderPartsPanel({
  workOrderId,
  parts,
  canIssue,
  itemOptions,
  stockLocations,
  technicians,
}: {
  workOrderId: string;
  parts: WorkOrderPartRow[];
  canIssue: boolean;
  itemOptions: { id: string; item_code: string; name: string }[];
  stockLocations: { id: string; name: string; code: string }[];
  technicians: { id: string; full_name: string | null; email: string | null }[];
}) {
  const [mode, setMode] = useState<"issue" | "return" | null>(null);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Parts / Materials</CardTitle>
        {canIssue && (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setMode("issue")}>Issue Part</Button>
            {parts.some((p) => p.net > 0) && <Button size="sm" variant="outline" onClick={() => setMode("return")}>Return Part</Button>}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {parts.length === 0 ? (
          <p className="text-sm text-slate-500">No parts have been issued to this work order.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Item</th><th className="px-3 py-2 font-medium">Code</th>
                  <th className="px-3 py-2 text-right font-medium">Issued</th><th className="px-3 py-2 text-right font-medium">Returned</th>
                  <th className="px-3 py-2 text-right font-medium">Net Used</th><th className="px-3 py-2 font-medium">Location</th><th className="px-3 py-2 font-medium">Last</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parts.map((p) => (
                  <tr key={p.inventory_item_id}>
                    <td className="px-3 py-2"><Link href={`/inventory/${p.inventory_item_id}`} className="text-slate-800 hover:underline">{p.name}</Link></td>
                    <td className="px-3 py-2 text-slate-500">{p.item_code}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{fmtQty(p.issued)}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{fmtQty(p.returned)}</td>
                    <td className="px-3 py-2 text-right font-medium text-slate-900">{fmtQty(p.net)} {p.unit ?? ""}</td>
                    <td className="px-3 py-2 text-slate-500">{p.stock_location_name ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-400">{formatDate(p.last_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-slate-400">Net Used = Issued − Returned. Full transaction history is preserved on each item.</p>
      </CardContent>

      {mode && (
        <PartDialog
          mode={mode}
          workOrderId={workOrderId}
          parts={parts}
          itemOptions={itemOptions}
          stockLocations={stockLocations}
          technicians={technicians}
          onClose={() => setMode(null)}
        />
      )}
    </Card>
  );
}

function PartDialog({
  mode, workOrderId, parts, itemOptions, stockLocations, technicians, onClose,
}: {
  mode: "issue" | "return";
  workOrderId: string;
  parts: WorkOrderPartRow[];
  itemOptions: { id: string; item_code: string; name: string }[];
  stockLocations: { id: string; name: string; code: string }[];
  technicians: { id: string; full_name: string | null; email: string | null }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const returnable = parts.filter((p) => p.net > 0);
  const [item, setItem] = useState(mode === "return" ? returnable[0]?.inventory_item_id ?? "" : "");
  const [location, setLocation] = useState(stockLocations[0]?.id ?? "");
  const [qty, setQty] = useState("");
  const [tech, setTech] = useState("");
  const [notes, setNotes] = useState("");

  async function submit() {
    setError(null);
    const q = Number(qty);
    if (!item) { setError("Select an item."); return; }
    if (!(q > 0)) { setError("Quantity must be greater than zero."); return; }
    if (!location) { setError("Select a stock location."); return; }
    setBusy(true);
    const res = mode === "issue"
      ? await issuePart({ item_id: item, stock_location_id: location, quantity: q, work_order_id: workOrderId, technician_id: tech || null, notes: notes || null })
      : await returnPart({ item_id: item, stock_location_id: location, quantity: q, work_order_id: workOrderId, notes: notes || null });
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    onClose();
    router.refresh();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={mode === "issue" ? "Issue Part" : "Return Part"}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} isLoading={busy}>Confirm</Button>
        </div>
      }
    >
      <div className="space-y-3">
        {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Item</label>
          <Select value={item} onChange={(e) => setItem(e.target.value)}>
            <option value="">Select item</option>
            {mode === "issue"
              ? itemOptions.map((i) => <option key={i.id} value={i.id}>{i.item_code} · {i.name}</option>)
              : returnable.map((p) => <option key={p.inventory_item_id} value={p.inventory_item_id}>{p.item_code} · {p.name} (net {fmtQty(p.net)})</option>)}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">{mode === "issue" ? "From Stock Location" : "Return to Stock Location"}</label>
          <Select value={location} onChange={(e) => setLocation(e.target.value)}>
            <option value="">Select location</option>
            {stockLocations.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Quantity</label>
          <Input type="number" min="0" step="0.001" value={qty} onChange={(e) => setQty(e.target.value)} />
        </div>
        {mode === "issue" && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Technician <span className="text-slate-400">(optional)</span></label>
            <Select value={tech} onChange={(e) => setTech(e.target.value)}>
              <option value="">Unassigned</option>
              {technicians.map((t) => <option key={t.id} value={t.id}>{t.full_name ?? t.email}</option>)}
            </Select>
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Notes <span className="text-slate-400">(optional)</span></label>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
    </Dialog>
  );
}

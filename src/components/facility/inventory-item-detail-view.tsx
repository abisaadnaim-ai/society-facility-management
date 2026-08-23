"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { StockStatusBadge, MovementTypeBadge } from "@/components/facility/inventory-badges";
import { formatDate, formatDateTime, formatFileSize } from "@/lib/format";
import { fmtQty, type InventoryItemDetail } from "@/lib/types/inventory";
import { createClient } from "@/lib/supabase/client";
import {
  setOpeningBalance, stockIn, adjustStock, transferStock, setItemActive,
  recordItemDocument, getItemDocumentSignedUrl, deleteItemDocument,
} from "@/lib/actions/inventory";

type Tab = "stock" | "movements" | "usage" | "documents" | "activity";
type ActionMode = "opening" | "stock_in" | "adjust" | "transfer" | null;

const TABS: { id: Tab; label: string }[] = [
  { id: "stock", label: "Stock" },
  { id: "movements", label: "Movements" },
  { id: "usage", label: "Work Order Usage" },
  { id: "documents", label: "Documents" },
  { id: "activity", label: "Activity" },
];

export function InventoryItemDetailView({
  item,
  stockLocations,
  canManage,
  orgId,
}: {
  item: InventoryItemDetail;
  stockLocations: { id: string; name: string; code: string }[];
  canManage: boolean;
  orgId: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("stock");
  const [mode, setMode] = useState<ActionMode>(null);
  const [confirmActive, setConfirmActive] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggleActive() {
    setBusy(true);
    const res = await setItemActive(item.id, !item.is_active);
    setBusy(false);
    setConfirmActive(false);
    if (!res.ok) { alert(res.error); return; }
    router.refresh();
  }

  return (
    <div>
      <PageHeader
        title={item.name}
        description={`${item.item_code}${item.part_number ? ` · Part ${item.part_number}` : ""}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/inventory"><Button variant="ghost">Back</Button></Link>
            {canManage && (
              <>
                <Link href={`/inventory/${item.id}/edit`}><Button variant="outline">Edit</Button></Link>
                <Button variant="outline" onClick={() => setConfirmActive(true)}>
                  {item.is_active ? "Deactivate" : "Reactivate"}
                </Button>
              </>
            )}
          </div>
        }
      />

      {!item.is_active && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          This item is inactive and cannot be used for new stock transactions.
        </div>
      )}

      {/* Summary */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total Stock</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{fmtQty(item.total_stock)} <span className="text-sm font-normal text-slate-500">{item.unit?.abbreviation}</span></p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
          <p className="mt-2"><StockStatusBadge status={item.status} /></p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Minimum Level</p>
          <p className="mt-1 text-lg font-medium text-slate-900">{fmtQty(item.minimum_stock_level)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Category</p>
          <p className="mt-1 text-sm font-medium text-slate-900">{item.category?.name ?? "—"}</p>
        </div>
      </div>

      {canManage && (
        <div className="mb-6 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setMode("opening")} disabled={!item.is_active}>Set Opening Balance</Button>
          <Button size="sm" variant="secondary" onClick={() => setMode("stock_in")} disabled={!item.is_active}>Stock In</Button>
          <Button size="sm" variant="outline" onClick={() => setMode("adjust")} disabled={!item.is_active}>Adjust</Button>
          <Button size="sm" variant="outline" onClick={() => setMode("transfer")} disabled={!item.is_active || stockLocations.length < 2}>Transfer</Button>
        </div>
      )}

      {/* Meta line */}
      <div className="mb-6 grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg border border-slate-200 bg-white p-4 text-sm sm:grid-cols-3">
        <Meta label="Unit" value={item.unit ? `${item.unit.name} (${item.unit.abbreviation})` : "—"} />
        <Meta label="Manufacturer" value={item.manufacturer ?? "—"} />
        <Meta label="Barcode" value={item.barcode ?? "—"} />
        <Meta label="Preferred Vendor" value={item.preferred_vendor?.company_name ?? "—"} />
        <Meta label="Reorder Reference" value={fmtQty(item.reorder_reference_level)} />
        <Meta label="Created" value={formatDate(item.created_at)} />
      </div>
      {(item.description || item.notes) && (
        <div className="mb-6 space-y-2 text-sm text-slate-600">
          {item.description && <p>{item.description}</p>}
          {item.notes && <p className="text-slate-500">{item.notes}</p>}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-4 flex gap-1 border-b border-slate-200 text-sm">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={["border-b-2 px-3 py-2 font-medium", tab === t.id ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-700"].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "stock" && <StockTab item={item} />}
      {tab === "movements" && <MovementsTab item={item} />}
      {tab === "usage" && <UsageTab item={item} />}
      {tab === "documents" && <DocumentsTab item={item} canManage={canManage} orgId={orgId} />}
      {tab === "activity" && <ActivityTab item={item} />}

      {mode && (
        <StockActionDialog
          mode={mode}
          item={item}
          stockLocations={stockLocations}
          onClose={() => setMode(null)}
          onDone={() => { setMode(null); router.refresh(); }}
        />
      )}

      <ConfirmDialog
        open={confirmActive}
        onClose={() => setConfirmActive(false)}
        title={item.is_active ? "Deactivate item?" : "Reactivate item?"}
        description={item.is_active
          ? "The item stays in history but can't be used for new stock transactions."
          : "The item can be used for stock transactions again."}
        confirmLabel={item.is_active ? "Deactivate" : "Reactivate"}
        onConfirm={toggleActive}
        isLoading={busy}
      />
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-slate-800">{value}</p>
    </div>
  );
}

function StockTab({ item }: { item: InventoryItemDetail }) {
  if (item.balances.length === 0) {
    return <EmptyState title="No stock recorded" description="Set an opening balance or record stock in to begin tracking." />;
  }
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr><th className="px-4 py-2.5 font-medium">Stock Location</th><th className="px-4 py-2.5 text-right font-medium">Quantity</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {item.balances.map((b) => (
            <tr key={b.stock_location_id}>
              <td className="px-4 py-2.5 text-slate-700">{b.location_name} <span className="text-xs text-slate-400">{b.location_code}</span></td>
              <td className="px-4 py-2.5 text-right font-medium text-slate-900">{fmtQty(b.quantity)}</td>
            </tr>
          ))}
          <tr className="bg-slate-50">
            <td className="px-4 py-2.5 font-medium text-slate-900">Total</td>
            <td className="px-4 py-2.5 text-right font-semibold text-slate-900">{fmtQty(item.total_stock)} {item.unit?.abbreviation}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function MovementsTab({ item }: { item: InventoryItemDetail }) {
  if (item.movements.length === 0) return <EmptyState title="No movements yet" />;
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2.5 font-medium">Movement</th><th className="px-4 py-2.5 font-medium">Type</th>
            <th className="px-4 py-2.5 text-right font-medium">Qty</th><th className="px-4 py-2.5 font-medium">Location</th>
            <th className="px-4 py-2.5 font-medium">Work Order</th><th className="px-4 py-2.5 font-medium">Date</th><th className="px-4 py-2.5 font-medium">By</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {item.movements.map((m) => (
            <tr key={m.id}>
              <td className="px-4 py-2.5 font-medium text-slate-800">{m.movement_number}</td>
              <td className="px-4 py-2.5"><MovementTypeBadge type={m.movement_type} /></td>
              <td className="px-4 py-2.5 text-right text-slate-900">{fmtQty(m.quantity)}</td>
              <td className="px-4 py-2.5 text-slate-600">{m.stock_location_name ?? "—"}</td>
              <td className="px-4 py-2.5 text-slate-600">
                {m.work_order_id ? <Link href={`/work-orders/${m.work_order_id}`} className="text-slate-700 hover:underline">{m.work_order_number}</Link> : "—"}
              </td>
              <td className="px-4 py-2.5 text-slate-500">{formatDate(m.created_at)}</td>
              <td className="px-4 py-2.5 text-slate-500">{m.user_name ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UsageTab({ item }: { item: InventoryItemDetail }) {
  if (item.work_order_usage.length === 0) return <EmptyState title="Not used on any work order yet" />;
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2.5 font-medium">Work Order</th><th className="px-4 py-2.5 font-medium">Title</th>
            <th className="px-4 py-2.5 text-right font-medium">Issued</th><th className="px-4 py-2.5 text-right font-medium">Returned</th>
            <th className="px-4 py-2.5 text-right font-medium">Net Used</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {item.work_order_usage.map((u) => (
            <tr key={u.work_order_id}>
              <td className="px-4 py-2.5"><Link href={`/work-orders/${u.work_order_id}`} className="font-medium text-slate-800 hover:underline">{u.work_order_number}</Link></td>
              <td className="px-4 py-2.5 text-slate-600">{u.title}</td>
              <td className="px-4 py-2.5 text-right text-slate-700">{fmtQty(u.issued)}</td>
              <td className="px-4 py-2.5 text-right text-slate-700">{fmtQty(u.returned)}</td>
              <td className="px-4 py-2.5 text-right font-medium text-slate-900">{fmtQty(u.net)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DocumentsTab({ item, canManage, orgId }: { item: InventoryItemDetail; canManage: boolean; orgId: string }) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const supabase = createClient();
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${orgId}/items/${item.id}/${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage.from("inventory-documents").upload(path, file);
      if (upErr) { setError(upErr.message); setUploading(false); return; }
      const res = await recordItemDocument({
        inventory_item_id: item.id, document_type: null, document_name: file.name,
        file_name: file.name, file_path: path, file_type: file.type || null, file_size: file.size,
      });
      if (!res.ok) setError(res.error);
      else router.refresh();
    } finally {
      setUploading(false);
    }
  }

  async function open(path: string) {
    const res = await getItemDocumentSignedUrl(path);
    if (res.ok) window.open(res.data.url, "_blank");
    else alert(res.error);
  }

  async function remove(id: string, path: string) {
    if (!confirm("Delete this document?")) return;
    const res = await deleteItemDocument(id, path, item.id);
    if (!res.ok) alert(res.error);
    else router.refresh();
  }

  return (
    <div>
      {canManage && (
        <div className="mb-4">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <input type="file" className="hidden" onChange={onFile} disabled={uploading} />
            {uploading ? "Uploading…" : "Upload document"}
          </label>
          <span className="ml-2 text-xs text-slate-400">Datasheet, manual, image or spec (max 20MB)</span>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
      )}
      {item.documents.length === 0 ? (
        <EmptyState title="No documents" description="Attach a datasheet, manual or product image if useful." />
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {item.documents.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <button onClick={() => open(d.file_path)} className="min-w-0 text-left">
                <p className="truncate text-sm font-medium text-slate-800 hover:underline">{d.document_name}</p>
                <p className="text-xs text-slate-400">{d.file_size ? formatFileSize(d.file_size) : ""} · {formatDate(d.created_at)}</p>
              </button>
              {canManage && <Button size="sm" variant="ghost" onClick={() => remove(d.id, d.file_path)}>Delete</Button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ActivityTab({ item }: { item: InventoryItemDetail }) {
  if (item.activity.length === 0) return <EmptyState title="No activity yet" />;
  return (
    <ul className="space-y-2">
      {item.activity.map((a) => (
        <li key={a.id} className="flex items-start justify-between gap-3 rounded-md border border-slate-100 bg-white px-3 py-2 text-sm">
          <div>
            <span className="font-medium text-slate-800">{a.action.replace(/_/g, " ")}</span>
            {a.detail && <span className="ml-2 text-slate-500">{a.detail}</span>}
          </div>
          <div className="shrink-0 text-right text-xs text-slate-400">
            {a.actor?.full_name ?? a.actor?.email ?? "—"}<br />{formatDateTime(a.created_at)}
          </div>
        </li>
      ))}
    </ul>
  );
}

// -------------------- Stock action dialog --------------------
function StockActionDialog({
  mode, item, stockLocations, onClose, onDone,
}: {
  mode: Exclude<ActionMode, null>;
  item: InventoryItemDetail;
  stockLocations: { id: string; name: string; code: string }[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState(stockLocations[0]?.id ?? "");
  const [dest, setDest] = useState(stockLocations[1]?.id ?? "");
  const [qty, setQty] = useState("");
  const [direction, setDirection] = useState<"increase" | "decrease">("decrease");
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const titles: Record<Exclude<ActionMode, null>, string> = {
    opening: "Set Opening Balance", stock_in: "Stock In", adjust: "Stock Adjustment", transfer: "Transfer Stock",
  };

  async function submit() {
    setError(null);
    const q = Number(qty);
    if (!(q > 0)) { setError("Quantity must be greater than zero."); return; }
    if (!location) { setError("Select a stock location."); return; }
    setBusy(true);
    let res;
    if (mode === "opening") res = await setOpeningBalance({ item_id: item.id, stock_location_id: location, quantity: q, reference: reference || null, notes: notes || null });
    else if (mode === "stock_in") res = await stockIn({ item_id: item.id, stock_location_id: location, quantity: q, reference: reference || null, notes: notes || null });
    else if (mode === "adjust") res = await adjustStock({ item_id: item.id, stock_location_id: location, direction, quantity: q, reason });
    else res = await transferStock({ item_id: item.id, source_location_id: location, dest_location_id: dest, quantity: q, notes: notes || null });
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    onDone();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={titles[mode]}
      description={`${item.item_code} · ${item.name}`}
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
          <label className="mb-1 block text-sm font-medium text-slate-700">{mode === "transfer" ? "Source Location" : "Stock Location"}</label>
          <Select value={location} onChange={(e) => setLocation(e.target.value)}>
            <option value="">Select location</option>
            {stockLocations.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
          </Select>
        </div>

        {mode === "transfer" && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Destination Location</label>
            <Select value={dest} onChange={(e) => setDest(e.target.value)}>
              <option value="">Select destination</option>
              {stockLocations.filter((s) => s.id !== location).map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
            </Select>
          </div>
        )}

        {mode === "adjust" && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Direction</label>
            <Select value={direction} onChange={(e) => setDirection(e.target.value as "increase" | "decrease")}>
              <option value="decrease">Decrease</option>
              <option value="increase">Increase</option>
            </Select>
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Quantity ({item.unit?.abbreviation})</label>
          <Input type="number" min="0" step="0.001" value={qty} onChange={(e) => setQty(e.target.value)} />
        </div>

        {(mode === "opening" || mode === "stock_in") && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Reference <span className="text-slate-400">(optional)</span></label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder={mode === "stock_in" ? "e.g. delivery / GRN reference" : "optional"} />
          </div>
        )}

        {mode === "adjust" && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Reason</label>
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. physical count correction, damaged item" />
          </div>
        )}

        {mode !== "adjust" && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Notes <span className="text-slate-400">(optional)</span></label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        )}

        {mode === "stock_in" && (
          <p className="text-xs text-slate-500">Stock In records that FM received stock. It is not a purchase order and has no procurement workflow.</p>
        )}
      </div>
    </Dialog>
  );
}

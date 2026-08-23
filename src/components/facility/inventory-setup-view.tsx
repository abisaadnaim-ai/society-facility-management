"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createCategory, updateCategory, createUnit, updateUnit } from "@/lib/actions/inventory";
import type { InventoryCategory, UnitOfMeasure } from "@/lib/types/inventory";

type Editing =
  | { kind: "category"; row?: InventoryCategory }
  | { kind: "unit"; row?: UnitOfMeasure }
  | null;

export function InventorySetupView({ categories, units }: { categories: InventoryCategory[]; units: UnitOfMeasure[] }) {
  const [editing, setEditing] = useState<Editing>(null);

  return (
    <div>
      <PageHeader title="Inventory Setup" description="Manage inventory categories and units of measure." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Categories</h2>
            <Button size="sm" onClick={() => setEditing({ kind: "category" })}>Add Category</Button>
          </div>
          <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {categories.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <div>
                  <span className="font-medium text-slate-800">{c.name}</span>
                  <span className="ml-2 text-xs text-slate-400">{c.code}</span>
                  {!c.is_active && <span className="ml-2"><Badge variant="neutral">Inactive</Badge></span>}
                </div>
                <Button size="sm" variant="ghost" onClick={() => setEditing({ kind: "category", row: c })}>Edit</Button>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Units of Measure</h2>
            <Button size="sm" onClick={() => setEditing({ kind: "unit" })}>Add Unit</Button>
          </div>
          <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {units.map((u) => (
              <div key={u.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <div>
                  <span className="font-medium text-slate-800">{u.name}</span>
                  <span className="ml-2 text-xs text-slate-400">{u.abbreviation}</span>
                  {!u.is_active && <span className="ml-2"><Badge variant="neutral">Inactive</Badge></span>}
                </div>
                <Button size="sm" variant="ghost" onClick={() => setEditing({ kind: "unit", row: u })}>Edit</Button>
              </div>
            ))}
          </div>
        </section>
      </div>

      {editing && <SetupDialog editing={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function SetupDialog({ editing, onClose }: { editing: NonNullable<Editing>; onClose: () => void }) {
  const router = useRouter();
  const isCat = editing.kind === "category";
  const catRow = isCat ? (editing.row as InventoryCategory | undefined) : undefined;
  const unitRow = !isCat ? (editing.row as UnitOfMeasure | undefined) : undefined;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(catRow?.name ?? unitRow?.name ?? "");
  const [code, setCode] = useState(catRow?.code ?? unitRow?.abbreviation ?? "");
  const [description, setDescription] = useState(catRow?.description ?? "");
  const [active, setActive] = useState(catRow?.is_active ?? unitRow?.is_active ?? true);

  async function submit() {
    setError(null);
    if (!name.trim() || !code.trim()) { setError("Name and code are required."); return; }
    setBusy(true);
    let res;
    if (isCat) {
      res = catRow
        ? await updateCategory(catRow.id, { name, code, description: description || null, is_active: active })
        : await createCategory({ name, code, description: description || null });
    } else {
      res = unitRow
        ? await updateUnit(unitRow.id, { name, abbreviation: code, is_active: active })
        : await createUnit({ name, abbreviation: code });
    }
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    onClose();
    router.refresh();
  }

  const title = `${editing.row ? "Edit" : "Add"} ${isCat ? "Category" : "Unit"}`;
  return (
    <Dialog
      open
      onClose={onClose}
      title={title}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} isLoading={busy}>Save</Button>
        </div>
      }
    >
      <div className="space-y-3">
        {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">{isCat ? "Code" : "Abbreviation"}</label>
          <Input value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
        {isCat && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Description <span className="text-slate-400">(optional)</span></label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        )}
        {editing.row && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active
          </label>
        )}
      </div>
    </Dialog>
  );
}

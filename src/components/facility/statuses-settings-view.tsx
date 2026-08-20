"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AssetStatus } from "@/lib/types/facility";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { statusVariant } from "@/lib/format";
import { createStatus, updateStatus, type StatusInput } from "@/lib/actions/config";

export function StatusesSettingsView({ statuses }: { statuses: AssetStatus[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AssetStatus | null>(null);

  return (
    <div>
      <PageHeader
        title="Asset Statuses"
        description="Configure the lifecycle statuses available for assets."
        actions={<Button onClick={() => setCreating(true)}>Add status</Button>}
      />

      {statuses.length === 0 ? (
        <EmptyState title="No statuses yet" description="Add your first status." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <ul className="divide-y divide-slate-100">
            {statuses.map((status) => (
              <li key={status.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Badge variant={statusVariant(status.code)}>{status.name}</Badge>
                  <span className="truncate text-xs text-slate-400">{status.code}</span>
                  {!status.is_active && <Badge variant="neutral">Inactive</Badge>}
                </div>
                <Button variant="ghost" size="sm" onClick={() => setEditing(status)}>
                  Edit
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(creating || editing) && (
        <StatusDialog
          status={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function StatusDialog({
  status,
  onClose,
  onSaved,
}: {
  status: AssetStatus | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!status;
  const [name, setName] = useState(status?.name ?? "");
  const [code, setCode] = useState(status?.code ?? "");
  const [description, setDescription] = useState(status?.description ?? "");
  const [isActive, setIsActive] = useState(status?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    setSaving(true);
    const input: StatusInput = {
      name,
      code,
      description: description || null,
      is_active: isActive,
    };
    const res = isEdit ? await updateStatus(status!.id, input) : await createStatus(input);
    setSaving(false);
    if (!res.ok) setError(res.error);
    else onSaved();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={isEdit ? "Edit status" : "Add status"}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={save} isLoading={saving}>
            {isEdit ? "Save changes" : "Create"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Code</label>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={isEdit}
            placeholder="e.g. awaiting_inspection"
          />
          {isEdit && (
            <p className="mt-1 text-xs text-slate-400">Code can&apos;t be changed after creation.</p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
          <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Active
        </label>
        {error && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}

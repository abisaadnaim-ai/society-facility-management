"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AssetCategory } from "@/lib/types/facility";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { createCategory, updateCategory, type CategoryInput } from "@/lib/actions/config";

export function CategoriesSettingsView({ categories }: { categories: AssetCategory[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AssetCategory | null>(null);

  return (
    <div>
      <PageHeader
        title="Asset Categories"
        description="Configure the categories available when registering assets."
        actions={<Button onClick={() => setCreating(true)}>Add category</Button>}
      />

      {categories.length === 0 ? (
        <EmptyState title="No categories yet" description="Add your first category." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <ul className="divide-y divide-slate-100">
            {categories.map((cat) => (
              <li key={cat.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-slate-900">{cat.name}</span>
                    {!cat.is_active && <Badge variant="neutral">Inactive</Badge>}
                  </div>
                  {cat.description && (
                    <p className="mt-0.5 truncate text-xs text-slate-500">{cat.description}</p>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={() => setEditing(cat)}>
                  Edit
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(creating || editing) && (
        <CategoryDialog
          category={editing}
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

function CategoryDialog({
  category,
  onClose,
  onSaved,
}: {
  category: AssetCategory | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!category;
  const [name, setName] = useState(category?.name ?? "");
  const [code, setCode] = useState(category?.code ?? "");
  const [description, setDescription] = useState(category?.description ?? "");
  const [isActive, setIsActive] = useState(category?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    setSaving(true);
    const input: CategoryInput = {
      name,
      code: code || null,
      description: description || null,
      is_active: isActive,
    };
    const res = isEdit ? await updateCategory(category!.id, input) : await createCategory(input);
    setSaving(false);
    if (!res.ok) setError(res.error);
    else onSaved();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={isEdit ? "Edit category" : "Add category"}
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
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Optional" />
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

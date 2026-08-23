"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { createInspectionTemplate, type TemplateItemInput } from "@/lib/actions/inspections";
import type { Lookup } from "@/lib/types/fm";

type ItemDraft = TemplateItemInput & { key: string };
type SectionDraft = { key: string; name: string; description: string; items: ItemDraft[] };

let seq = 0;
const nextKey = () => `k${seq++}`;
function emptyItem(): ItemDraft {
  return {
    key: nextKey(), item_text: "", instructions: null, is_required: true, allow_na: true,
    require_comment_on_fail: true, require_photo_on_fail: false, failure_category_id: null, failure_priority_id: null,
  };
}
function emptySection(): SectionDraft {
  return { key: nextKey(), name: "", description: "", items: [emptyItem()] };
}

export function InspectionTemplateBuilder({ categories, priorities }: { categories: Lookup[]; priorities: Lookup[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [requiresReview, setRequiresReview] = useState(true);
  const [sections, setSections] = useState<SectionDraft[]>([emptySection()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function patchSection(k: string, patch: Partial<SectionDraft>) {
    setSections((prev) => prev.map((s) => (s.key === k ? { ...s, ...patch } : s)));
  }
  function patchItem(sk: string, ik: string, patch: Partial<ItemDraft>) {
    setSections((prev) => prev.map((s) => s.key === sk
      ? { ...s, items: s.items.map((it) => (it.key === ik ? { ...it, ...patch } : it)) } : s));
  }

  async function submit() {
    setBusy(true); setError(null);
    const res = await createInspectionTemplate({
      name, description: description || null, instructions: instructions || null,
      requires_manager_review: requiresReview,
      sections: sections.map((s) => ({
        name: s.name, description: s.description || null,
        items: s.items.map((it) => ({
          item_text: it.item_text, instructions: it.instructions,
          is_required: it.is_required, allow_na: it.allow_na,
          require_comment_on_fail: it.require_comment_on_fail, require_photo_on_fail: it.require_photo_on_fail,
          failure_category_id: it.failure_category_id, failure_priority_id: it.failure_priority_id,
        })),
      })),
    });
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    router.push(`/inspections/templates/${res.data.id}`);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div><Link href="/inspections/templates" className="text-sm text-slate-500 hover:text-slate-900">&larr; Templates</Link></div>

      <Card>
        <CardHeader><CardTitle>Template details</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Name <span className="text-red-500">*</span></label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Daily Gym Floor Opening Check" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Instructions for inspector</label>
            <Textarea rows={2} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={requiresReview} onChange={(e) => setRequiresReview(e.target.checked)} />
            Require manager review before closing (recommended)
          </label>
        </CardContent>
      </Card>

      {sections.map((s, si) => (
        <Card key={s.key}>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Section {si + 1}</CardTitle>
            {sections.length > 1 && (
              <Button variant="ghost" size="sm" onClick={() => setSections((prev) => prev.filter((x) => x.key !== s.key))}>Remove</Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            <Input value={s.name} onChange={(e) => patchSection(s.key, { name: e.target.value })} placeholder="Section name (e.g. Reception)" />
            <Input value={s.description} onChange={(e) => patchSection(s.key, { description: e.target.value })} placeholder="Section description (optional)" />

            <div className="space-y-3">
              {s.items.map((it, ii) => (
                <div key={it.key} className="rounded-md border border-slate-200 p-3">
                  <div className="flex items-start gap-2">
                    <span className="mt-2 text-xs text-slate-400">{ii + 1}.</span>
                    <div className="flex-1 space-y-2">
                      <Input value={it.item_text} onChange={(e) => patchItem(s.key, it.key, { item_text: e.target.value })} placeholder="Check item (e.g. Floor is clean and dry)" />
                      <Input value={it.instructions ?? ""} onChange={(e) => patchItem(s.key, it.key, { instructions: e.target.value || null })} placeholder="Item instructions (optional)" />
                      <div className="grid grid-cols-2 gap-2 text-sm text-slate-700">
                        <label className="flex items-center gap-2"><input type="checkbox" checked={it.is_required} onChange={(e) => patchItem(s.key, it.key, { is_required: e.target.checked })} />Required</label>
                        <label className="flex items-center gap-2"><input type="checkbox" checked={it.allow_na} onChange={(e) => patchItem(s.key, it.key, { allow_na: e.target.checked })} />Allow N/A</label>
                        <label className="flex items-center gap-2"><input type="checkbox" checked={it.require_comment_on_fail} onChange={(e) => patchItem(s.key, it.key, { require_comment_on_fail: e.target.checked })} />Comment on fail</label>
                        <label className="flex items-center gap-2"><input type="checkbox" checked={it.require_photo_on_fail} onChange={(e) => patchItem(s.key, it.key, { require_photo_on_fail: e.target.checked })} />Photo on fail</label>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Select value={it.failure_category_id ?? ""} onChange={(e) => patchItem(s.key, it.key, { failure_category_id: e.target.value || null })}>
                          <option value="">Fail category (optional)</option>
                          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </Select>
                        <Select value={it.failure_priority_id ?? ""} onChange={(e) => patchItem(s.key, it.key, { failure_priority_id: e.target.value || null })}>
                          <option value="">Fail priority (optional)</option>
                          {priorities.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </Select>
                      </div>
                    </div>
                    {s.items.length > 1 && (
                      <button type="button" className="mt-2 text-xs text-slate-400 hover:text-red-600" onClick={() => patchSection(s.key, { items: s.items.filter((x) => x.key !== it.key) })}>Remove</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={() => patchSection(s.key, { items: [...s.items, emptyItem()] })}>+ Add item</Button>
          </CardContent>
        </Card>
      ))}

      <Button variant="outline" onClick={() => setSections((prev) => [...prev, emptySection()])}>+ Add section</Button>

      {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex justify-end gap-2">
        <Link href="/inspections/templates"><Button variant="outline">Cancel</Button></Link>
        <Button isLoading={busy} onClick={submit}>Create template</Button>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  updateInspectionTemplate,
  addTemplateSection,
  deleteTemplateSection,
  addTemplateItem,
  deleteTemplateItem,
  type TemplateItemInput,
} from "@/lib/actions/inspections";
import type { TemplateWithContent } from "@/lib/queries/inspections";
import type { Lookup } from "@/lib/types/fm";

export function InspectionTemplateDetailView({
  content, canManage, categories, priorities,
}: {
  content: TemplateWithContent;
  canManage: boolean;
  categories: Lookup[];
  priorities: Lookup[];
}) {
  const router = useRouter();
  const t = content.template;
  const [name, setName] = useState(t.name);
  const [description, setDescription] = useState(t.description ?? "");
  const [instructions, setInstructions] = useState(t.instructions ?? "");
  const [requiresReview, setRequiresReview] = useState(t.requires_manager_review);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [newSection, setNewSection] = useState("");

  async function saveDetails() {
    setBusy(true); setMsg(null);
    const res = await updateInspectionTemplate(t.id, {
      name, description: description || null, instructions: instructions || null, requires_manager_review: requiresReview,
    });
    setBusy(false);
    setMsg(res.ok ? "Saved." : res.error);
    if (res.ok) router.refresh();
  }

  const itemsBySection = (sectionId: string | null) => content.items.filter((i) => i.section_id === sectionId);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/inspections/templates" className="text-sm text-slate-500 hover:text-slate-900">&larr; Templates</Link>
        <Badge variant={t.status === "active" ? "success" : "neutral"}>{t.status === "active" ? "Active" : "Archived"} · {t.template_number}</Badge>
      </div>

      <Card>
        <CardHeader><CardTitle>Template details</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input value={name} disabled={!canManage} onChange={(e) => setName(e.target.value)} />
          <Textarea rows={2} value={description} disabled={!canManage} onChange={(e) => setDescription(e.target.value)} placeholder="Description" />
          <Textarea rows={2} value={instructions} disabled={!canManage} onChange={(e) => setInstructions(e.target.value)} placeholder="Instructions for inspector" />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" disabled={!canManage} checked={requiresReview} onChange={(e) => setRequiresReview(e.target.checked)} />
            Require manager review before closing
          </label>
          {canManage && (
            <div className="flex items-center gap-3">
              <Button isLoading={busy} onClick={saveDetails}>Save details</Button>
              {msg && <span className="text-sm text-slate-500">{msg}</span>}
            </div>
          )}
          <p className="text-xs text-slate-500">Edits apply to future inspections only. Past inspections keep their original snapshot.</p>
        </CardContent>
      </Card>

      {content.sections.map((sec) => (
        <SectionCard key={sec.id} templateId={t.id} sectionId={sec.id} title={sec.name}
          items={itemsBySection(sec.id)} canManage={canManage} categories={categories} priorities={priorities} />
      ))}
      {itemsBySection(null).length > 0 && (
        <SectionCard templateId={t.id} sectionId={null} title="Ungrouped items"
          items={itemsBySection(null)} canManage={canManage} categories={categories} priorities={priorities} />
      )}

      {canManage && (
        <Card>
          <CardContent className="flex items-end gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-slate-700">New section</label>
              <Input value={newSection} onChange={(e) => setNewSection(e.target.value)} placeholder="Section name" />
            </div>
            <Button variant="outline" onClick={async () => {
              if (!newSection.trim()) return;
              await addTemplateSection(t.id, newSection, null);
              setNewSection("");
              router.refresh();
            }}>Add section</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SectionCard({
  templateId, sectionId, title, items, canManage, categories, priorities,
}: {
  templateId: string;
  sectionId: string | null;
  title: string;
  items: TemplateWithContent["items"];
  canManage: boolean;
  categories: Lookup[];
  priorities: Lookup[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const base: TemplateItemInput = {
    item_text: "", instructions: null, is_required: true, allow_na: true,
    require_comment_on_fail: true, require_photo_on_fail: false, failure_category_id: null, failure_priority_id: null,
  };
  const [opts, setOpts] = useState(base);

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>{title}</CardTitle>
        {canManage && sectionId && (
          <Button variant="ghost" size="sm" onClick={async () => { await deleteTemplateSection(templateId, sectionId); router.refresh(); }}>Delete section</Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 && <p className="text-sm text-slate-500">No items yet.</p>}
        {items.map((it) => (
          <div key={it.id} className="flex items-start justify-between gap-2 rounded-md border border-slate-100 px-3 py-2">
            <div>
              <p className="text-sm text-slate-800">{it.item_text}{it.is_required && <span className="ml-1 text-red-500">*</span>}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {!it.allow_na && <Badge variant="neutral">No N/A</Badge>}
                {it.require_comment_on_fail && <Badge variant="neutral">Comment on fail</Badge>}
                {it.require_photo_on_fail && <Badge variant="neutral">Photo on fail</Badge>}
              </div>
            </div>
            {canManage && (
              <button className="text-xs text-slate-400 hover:text-red-600" onClick={async () => { await deleteTemplateItem(templateId, it.id); router.refresh(); }}>Delete</button>
            )}
          </div>
        ))}

        {canManage && !adding && <Button variant="outline" size="sm" onClick={() => setAdding(true)}>+ Add item</Button>}
        {canManage && adding && (
          <div className="space-y-2 rounded-md border border-slate-200 p-3">
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Check item" />
            <div className="grid grid-cols-2 gap-2 text-sm text-slate-700">
              <label className="flex items-center gap-2"><input type="checkbox" checked={opts.is_required} onChange={(e) => setOpts({ ...opts, is_required: e.target.checked })} />Required</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={opts.allow_na} onChange={(e) => setOpts({ ...opts, allow_na: e.target.checked })} />Allow N/A</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={opts.require_comment_on_fail} onChange={(e) => setOpts({ ...opts, require_comment_on_fail: e.target.checked })} />Comment on fail</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={opts.require_photo_on_fail} onChange={(e) => setOpts({ ...opts, require_photo_on_fail: e.target.checked })} />Photo on fail</label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select value={opts.failure_category_id ?? ""} onChange={(e) => setOpts({ ...opts, failure_category_id: e.target.value || null })}>
                <option value="">Fail category (optional)</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
              <Select value={opts.failure_priority_id ?? ""} onChange={(e) => setOpts({ ...opts, failure_priority_id: e.target.value || null })}>
                <option value="">Fail priority (optional)</option>
                {priorities.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => { setAdding(false); setText(""); }}>Cancel</Button>
              <Button size="sm" isLoading={busy} onClick={async () => {
                if (!text.trim()) return;
                setBusy(true);
                await addTemplateItem(templateId, sectionId, { ...opts, item_text: text });
                setBusy(false); setText(""); setOpts(base); setAdding(false);
                router.refresh();
              }}>Add</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

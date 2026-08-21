"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createPpmPlan, type PpmTaskInput } from "@/lib/actions/ppm";
import { FREQUENCY_PRESETS, type PpmAssetOption } from "@/lib/types/ppm";
import type { FmCategory, FmPriority, PersonOption } from "@/lib/types/fm";

type Props = {
  assets: PpmAssetOption[];
  categories: FmCategory[];
  priorities: FmPriority[];
  technicians: PersonOption[];
  preselectedAssetId: string | null;
};

type DraftTask = PpmTaskInput & { key: string };

let taskKeySeq = 0;
const newTask = (): DraftTask => ({ key: `t${taskKeySeq++}`, task_description: "", instructions: null, is_required: true });

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function PpmPlanForm({ assets, categories, priorities, technicians, preselectedAssetId }: Props) {
  const router = useRouter();
  const [assetId, setAssetId] = useState(preselectedAssetId ?? "");
  const [assetQuery, setAssetQuery] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [priorityId, setPriorityId] = useState("");
  const [presetKey, setPresetKey] = useState("monthly");
  const [customUnit, setCustomUnit] = useState("month");
  const [customInterval, setCustomInterval] = useState(1);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [leadTime, setLeadTime] = useState(0);
  const [duration, setDuration] = useState("");
  const [technicianId, setTechnicianId] = useState("");
  const [tasks, setTasks] = useState<DraftTask[]>([newTask()]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedAsset = useMemo(() => assets.find((a) => a.id === assetId) ?? null, [assets, assetId]);

  // Default category to the asset's own category when an asset is chosen.
  const effectiveCategoryId = categoryId || selectedAsset?.category_id || "";

  const filteredAssets = useMemo(() => {
    const q = assetQuery.trim().toLowerCase();
    if (!q) return assets.slice(0, 50);
    return assets
      .filter((a) =>
        [a.name, a.asset_code, a.location_name, a.area_name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
      .slice(0, 50);
  }, [assets, assetQuery]);

  function resolveFrequency(): { unit: string; interval: number } {
    if (presetKey === "custom") return { unit: customUnit, interval: customInterval };
    const preset = FREQUENCY_PRESETS.find((p) => p.key === presetKey)!;
    return { unit: preset.unit, interval: preset.interval };
  }

  function updateTask(key: string, patch: Partial<DraftTask>) {
    setTasks((prev) => prev.map((t) => (t.key === key ? { ...t, ...patch } : t)));
  }
  function move(key: string, dir: -1 | 1) {
    setTasks((prev) => {
      const i = prev.findIndex((t) => t.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const copy = [...prev];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  }

  async function onSubmit() {
    setError(null);
    if (!assetId) return setError("Please choose an asset.");
    if (!name.trim()) return setError("Please enter a plan name.");
    if (!priorityId) return setError("Please choose a priority.");
    if (!effectiveCategoryId) return setError("Please choose a category.");
    const freq = resolveFrequency();
    setSaving(true);
    const res = await createPpmPlan({
      asset_id: assetId,
      category_id: effectiveCategoryId,
      name,
      description: description || null,
      maintenance_instructions: instructions || null,
      priority_id: priorityId,
      frequency_unit: freq.unit,
      frequency_interval: freq.interval,
      start_date: startDate,
      lead_time_days: Number(leadTime) || 0,
      estimated_duration_minutes: duration ? Number(duration) : null,
      due_window_days: null,
      default_assigned_to: technicianId || null,
      tasks: tasks
        .filter((t) => t.task_description.trim())
        .map((t) => ({ task_description: t.task_description, instructions: t.instructions, is_required: t.is_required })),
    });
    setSaving(false);
    if (!res.ok) return setError(res.error);
    router.push(`/preventive-maintenance/${res.data.id}`);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="New PPM Plan" description="Define a recurring preventive maintenance plan for an asset." />

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <Card>
        <CardHeader><CardTitle>Asset</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Field label="Find asset" hint="Search by asset name, code, location or area.">
            <Input placeholder="Search assets…" value={assetQuery} onChange={(e) => setAssetQuery(e.target.value)} />
          </Field>
          <Field label="Asset">
            <Select value={assetId} onChange={(e) => setAssetId(e.target.value)}>
              <option value="">Select an asset…</option>
              {filteredAssets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}{a.asset_code ? ` (${a.asset_code})` : ""} — {a.location_name ?? "?"}{a.area_name ? ` / ${a.area_name}` : ""}
                </option>
              ))}
            </Select>
          </Field>
          {selectedAsset && (
            <div className="grid grid-cols-1 gap-2 rounded-md bg-slate-50 p-3 text-sm sm:grid-cols-3">
              <div><span className="text-slate-500">Location:</span> {selectedAsset.location_name ?? "—"}</div>
              <div><span className="text-slate-500">Area:</span> {selectedAsset.area_name ?? "—"}</div>
              <div><span className="text-slate-500">Asset category:</span> {selectedAsset.category_name ?? "—"}</div>
            </div>
          )}
          {assets.length === 0 && (
            <p className="text-sm text-amber-700">No active assets are available. Create an asset first, then return here.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Maintenance</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Field label="PPM Plan name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Treadmill Quarterly Maintenance" /></Field>
          <Field label="Description"><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></Field>
          <Field label="Maintenance instructions" hint="Copied into each generated work order's description.">
            <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={3} />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Category" hint="Defaults to the asset's category.">
              <Select value={effectiveCategoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">Select…</option>
                {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
              </Select>
            </Field>
            <Field label="Priority">
              <Select value={priorityId} onChange={(e) => setPriorityId(e.target.value)}>
                <option value="">Select…</option>
                {priorities.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
              </Select>
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Schedule</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Frequency">
              <Select value={presetKey} onChange={(e) => setPresetKey(e.target.value)}>
                {FREQUENCY_PRESETS.map((p) => (<option key={p.key} value={p.key}>{p.label}</option>))}
              </Select>
            </Field>
            {presetKey === "custom" && (
              <div className="grid grid-cols-2 gap-2">
                <Field label="Every">
                  <Input type="number" min={1} value={customInterval} onChange={(e) => setCustomInterval(Number(e.target.value))} />
                </Field>
                <Field label="Unit">
                  <Select value={customUnit} onChange={(e) => setCustomUnit(e.target.value)}>
                    <option value="day">Day(s)</option>
                    <option value="week">Week(s)</option>
                    <option value="month">Month(s)</option>
                    <option value="year">Year(s)</option>
                  </Select>
                </Field>
              </div>
            )}
            <Field label="Start date" hint="The first occurrence is scheduled on this date.">
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            <Field label="Lead time (days)" hint="Generate the work order this many days before it's due (0 = on the due date).">
              <Input type="number" min={0} value={leadTime} onChange={(e) => setLeadTime(Number(e.target.value))} />
            </Field>
            <Field label="Estimated duration (minutes)">
              <Input type="number" min={0} value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="Optional" />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Assignment</CardTitle></CardHeader>
        <CardContent>
          <Field label="Default technician" hint="Optional. Only active technicians are listed. Work orders auto-assign to them; otherwise they're created as New for the FM to assign.">
            <Select value={technicianId} onChange={(e) => setTechnicianId(e.target.value)}>
              <option value="">No default (FM assigns)</option>
              {technicians.map((t) => (<option key={t.id} value={t.id}>{t.full_name || t.email}</option>))}
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Maintenance Tasks</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {tasks.map((t, i) => (
            <div key={t.key} className="rounded-md border border-slate-200 p-3">
              <div className="flex items-start gap-2">
                <span className="mt-2 text-sm text-slate-400">{i + 1}.</span>
                <div className="flex-1 space-y-2">
                  <Input
                    placeholder="Task description (e.g. Inspect running belt)"
                    value={t.task_description}
                    onChange={(e) => updateTask(t.key, { task_description: e.target.value })}
                  />
                  <Input
                    placeholder="Instructions (optional)"
                    value={t.instructions ?? ""}
                    onChange={(e) => updateTask(t.key, { instructions: e.target.value || null })}
                  />
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input type="checkbox" checked={t.is_required} onChange={(e) => updateTask(t.key, { is_required: e.target.checked })} />
                    Required to complete the work order
                  </label>
                </div>
                <div className="flex flex-col gap-1">
                  <Button type="button" variant="ghost" size="sm" onClick={() => move(t.key, -1)} disabled={i === 0}>↑</Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => move(t.key, 1)} disabled={i === tasks.length - 1}>↓</Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setTasks((p) => p.filter((x) => x.key !== t.key))}>✕</Button>
                </div>
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setTasks((p) => [...p, newTask()])}>+ Add task</Button>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.push("/preventive-maintenance")} disabled={saving}>Cancel</Button>
        <Button onClick={onSubmit} isLoading={saving}>Create PPM Plan</Button>
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { formatMinutes } from "@/lib/format";
import type { FmSlaRuleRow } from "@/lib/types/notifications";
import {
  createSlaRule,
  updateSlaRule,
  toggleSlaRuleActive,
  type SlaRuleInput,
} from "@/lib/actions/sla-rules";

type PriorityOption = { id: string; name: string };

const BLANK: SlaRuleInput = {
  name: "",
  priority_id: "",
  response_minutes: 60,
  resolution_minutes: 480,
  applies_to_request: true,
  applies_to_work_order: true,
  is_active: true,
  effective_from: null,
  effective_to: null,
};

export function SlaRulesView({
  rules,
  priorities,
}: {
  rules: FmSlaRuleRow[];
  priorities: PriorityOption[];
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<SlaRuleInput>(BLANK);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function beginCreate() {
    setForm({ ...BLANK, priority_id: priorities[0]?.id ?? "" });
    setCreating(true);
    setEditingId(null);
    setError(null);
  }

  function beginEdit(r: FmSlaRuleRow) {
    setForm({
      name: r.name,
      priority_id: r.priority_id,
      response_minutes: r.response_minutes,
      resolution_minutes: r.resolution_minutes,
      applies_to_request: r.applies_to_request,
      applies_to_work_order: r.applies_to_work_order,
      is_active: r.is_active,
      effective_from: r.effective_from,
      effective_to: r.effective_to,
    });
    setEditingId(r.id);
    setCreating(false);
    setError(null);
  }

  function cancel() {
    setCreating(false);
    setEditingId(null);
    setError(null);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const res = editingId ? await updateSlaRule(editingId, form) : await createSlaRule(form);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      cancel();
      router.refresh();
    });
  }

  function toggle(r: FmSlaRuleRow) {
    startTransition(async () => {
      const res = await toggleSlaRuleActive(r.id, r.priority_id, !r.is_active);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  const showForm = creating || editingId !== null;

  return (
    <div>
      <PageHeader
        title="SLA Rules"
        description="Target response and resolution times by priority. Applied to new FM requests and work orders."
        actions={
          !showForm ? (
            <Button onClick={beginCreate}>Add rule</Button>
          ) : undefined
        }
      />

      <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Rules marked <span className="font-medium">Sample Default</span> are development placeholders, not
        approved Society SLA policy. Review and confirm real targets during UAT.
      </div>

      {showForm && (
        <div className="mb-6 rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">
            {editingId ? "Edit SLA rule" : "New SLA rule"}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Name</span>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Critical priority SLA"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Priority</span>
              <Select
                value={form.priority_id}
                onChange={(e) => setForm({ ...form, priority_id: e.target.value })}
              >
                <option value="" disabled>
                  Select priority
                </option>
                {priorities.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Response target (minutes)
              </span>
              <Input
                type="number"
                min={1}
                value={form.response_minutes}
                onChange={(e) => setForm({ ...form, response_minutes: Number(e.target.value) })}
              />
              <span className="mt-1 block text-xs text-slate-500">= {formatMinutes(form.response_minutes)}</span>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Resolution target (minutes)
              </span>
              <Input
                type="number"
                min={1}
                value={form.resolution_minutes}
                onChange={(e) => setForm({ ...form, resolution_minutes: Number(e.target.value) })}
              />
              <span className="mt-1 block text-xs text-slate-500">= {formatMinutes(form.resolution_minutes)}</span>
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.applies_to_request}
                onChange={(e) => setForm({ ...form, applies_to_request: e.target.checked })}
              />
              Applies to FM requests (response)
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.applies_to_work_order}
                onChange={(e) => setForm({ ...form, applies_to_work_order: e.target.checked })}
              />
              Applies to work orders (resolution)
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
              Active
            </label>
          </div>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          <div className="mt-5 flex gap-2">
            <Button onClick={save} disabled={pending}>
              {editingId ? "Save changes" : "Create rule"}
            </Button>
            <Button variant="outline" onClick={cancel} disabled={pending}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {rules.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">
          No SLA rules yet. Add one to start tracking response and resolution targets.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Rule</th>
                <th className="px-4 py-2.5">Priority</th>
                <th className="px-4 py-2.5">Response</th>
                <th className="px-4 py-2.5">Resolution</th>
                <th className="px-4 py-2.5">Applies to</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rules.map((r) => (
                <tr key={r.id} className={r.is_active ? "" : "opacity-60"}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{r.name}</div>
                    {r.is_sample_default && (
                      <span className="text-xs text-amber-700">Sample Default</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{r.priority?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-700">{formatMinutes(r.response_minutes)}</td>
                  <td className="px-4 py-3 text-slate-700">{formatMinutes(r.resolution_minutes)}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {[r.applies_to_request ? "Requests" : null, r.applies_to_work_order ? "Work orders" : null]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {r.is_active ? (
                      <Badge variant="success">Active</Badge>
                    ) : (
                      <Badge variant="neutral">Inactive</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" onClick={() => beginEdit(r)} disabled={pending}>
                        Edit
                      </Button>
                      <Button variant="ghost" onClick={() => toggle(r)} disabled={pending}>
                        {r.is_active ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

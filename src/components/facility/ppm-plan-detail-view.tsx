"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  TableShell, TableHead, TableHeaderCell, TableBody, TableRow, TableCell,
} from "@/components/shared/table-shell";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  frequencyLabel, deriveDueStatus, DUE_STATUS_META, PLAN_STATUS_META,
  type PpmPlanDetail, type PpmPlanTask, type PpmHistoryRow, type PpmOccurrence,
  type PpmPlanStatus, type DueStatus,
} from "@/lib/types/ppm";
import type { FmPriority, PersonOption } from "@/lib/types/fm";
import {
  setPpmPlanStatus, generatePpmWorkOrder, skipPpmOccurrence,
  addPpmTask, updatePpmTask, deletePpmTask, reorderPpmTasks, updatePpmPlan,
} from "@/lib/actions/ppm";

type Props = {
  plan: PpmPlanDetail;
  tasks: PpmPlanTask[];
  history: PpmHistoryRow[];
  nextOccurrence: PpmOccurrence | null;
  priorities: FmPriority[];
  technicians: PersonOption[];
  canManage: boolean;
  today: string;
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right text-slate-800">{children}</span>
    </div>
  );
}

export function PpmPlanDetailView({
  plan, tasks, history, nextOccurrence, priorities, technicians, canManage, today,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [skipOpen, setSkipOpen] = useState(false);
  const [skipReason, setSkipReason] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [taskDialog, setTaskDialog] = useState<{ mode: "add" | "edit"; task?: PpmPlanTask } | null>(null);
  const [deleteTask, setDeleteTask] = useState<PpmPlanTask | null>(null);

  const status = plan.status as PpmPlanStatus;
  const planMeta = PLAN_STATUS_META[status];
  const due = deriveDueStatus(plan.status, plan.next_due_date, today) as DueStatus;
  const dueMeta = DUE_STATUS_META[due];

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    setError(null);
    const res = await fn();
    setBusy(false);
    if (!res.ok) setError(res.error ?? "Something went wrong.");
    else router.refresh();
    return res.ok;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${plan.ppm_number} — ${plan.name}`}
        description="Preventive maintenance plan"
        actions={
          canManage ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>Edit</Button>
              {status === "active" && (
                <Button variant="outline" size="sm" onClick={() => run(() => setPpmPlanStatus(plan.id, "paused"))} disabled={busy}>Pause</Button>
              )}
              {status === "paused" && (
                <Button variant="outline" size="sm" onClick={() => run(() => setPpmPlanStatus(plan.id, "active"))} disabled={busy}>Resume</Button>
              )}
              {status === "archived" ? (
                <Button variant="outline" size="sm" onClick={() => run(() => setPpmPlanStatus(plan.id, "active"))} disabled={busy}>Restore</Button>
              ) : (
                <Button variant="destructive" size="sm" onClick={() => setArchiveOpen(true)} disabled={busy}>Archive</Button>
              )}
            </div>
          ) : undefined
        }
      />

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={planMeta?.tone ?? "neutral"}>{planMeta?.label ?? plan.status}</Badge>
        {status === "active" && <Badge variant={dueMeta.tone}>{dueMeta.label}</Badge>}
        <span className="text-sm text-slate-500">Next due {formatDate(plan.next_due_date)}</span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Asset</CardTitle></CardHeader>
          <CardContent>
            <Row label="Asset">
              {plan.asset ? (
                <Link href={`/assets/${plan.asset.id}`} className="text-sky-700 hover:underline">{plan.asset.name}</Link>
              ) : "—"}
            </Row>
            <Row label="Asset code">{plan.asset?.asset_code ?? "—"}</Row>
            <Row label="Location">{plan.asset?.location?.name ?? "—"}</Row>
            <Row label="Area">{plan.asset?.area?.name ?? "—"}</Row>
            <Row label="Category">{plan.category?.name ?? "—"}</Row>
            {plan.asset && plan.asset.is_active === false && (
              <p className="mt-2 text-sm text-amber-700">This asset is inactive — work orders will not generate until the asset is reactivated.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Schedule</CardTitle></CardHeader>
          <CardContent>
            <Row label="Frequency">{frequencyLabel(plan.frequency_unit, plan.frequency_interval)}</Row>
            <Row label="Start date">{formatDate(plan.start_date)}</Row>
            <Row label="Next due">{formatDate(plan.next_due_date)}</Row>
            <Row label="Last completed">{plan.last_completed_at ? formatDateTime(plan.last_completed_at) : "—"}</Row>
            <Row label="Lead time">{plan.lead_time_days} day{plan.lead_time_days === 1 ? "" : "s"}</Row>
            <Row label="Priority">{plan.priority?.name ?? "—"}</Row>
            <Row label="Default technician">{plan.technician?.full_name || plan.technician?.email || "—"}</Row>
            <Row label="Estimated duration">{plan.estimated_duration_minutes ? `${plan.estimated_duration_minutes} min` : "—"}</Row>
          </CardContent>
        </Card>
      </div>

      {plan.maintenance_instructions && (
        <Card>
          <CardHeader><CardTitle>Maintenance Instructions</CardTitle></CardHeader>
          <CardContent><p className="whitespace-pre-wrap text-sm text-slate-700">{plan.maintenance_instructions}</p></CardContent>
        </Card>
      )}

      {/* Next occurrence + FM actions */}
      {canManage && status === "active" && nextOccurrence && (
        <Card>
          <CardHeader><CardTitle>Next Occurrence</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-slate-700">
              Scheduled for <strong>{formatDate(nextOccurrence.scheduled_date)}</strong>. No work order has been generated yet.
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => run(() => generatePpmWorkOrder(nextOccurrence.id, plan.id))} disabled={busy}>Generate Work Order</Button>
              <Button variant="outline" size="sm" onClick={() => { setSkipReason(""); setSkipOpen(true); }} disabled={busy}>Skip</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tasks */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Maintenance Tasks</CardTitle>
          {canManage && (
            <Button size="sm" variant="outline" onClick={() => setTaskDialog({ mode: "add" })}>+ Add task</Button>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {tasks.length === 0 ? (
            <p className="text-sm text-slate-500">No tasks defined. Add tasks so technicians have a checklist to complete.</p>
          ) : (
            tasks.map((t, i) => (
              <div key={t.id} className="flex items-start justify-between gap-3 rounded-md border border-slate-200 p-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-400">{i + 1}.</span>
                    <span className="text-sm font-medium text-slate-800">{t.task_description}</span>
                    <Badge variant={t.is_required ? "info" : "neutral"}>{t.is_required ? "Required" : "Optional"}</Badge>
                  </div>
                  {t.instructions && <p className="ml-6 mt-1 text-xs text-slate-500">{t.instructions}</p>}
                </div>
                {canManage && (
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => run(() => reorderPpmTasks(plan.id, moveId(tasks, t.id, -1)))} disabled={busy || i === 0}>↑</Button>
                    <Button variant="ghost" size="sm" onClick={() => run(() => reorderPpmTasks(plan.id, moveId(tasks, t.id, 1)))} disabled={busy || i === tasks.length - 1}>↓</Button>
                    <Button variant="ghost" size="sm" onClick={() => setTaskDialog({ mode: "edit", task: t })}>Edit</Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteTask(t)}>✕</Button>
                  </div>
                )}
              </div>
            ))
          )}
          {canManage && tasks.length > 0 && (
            <p className="text-xs text-slate-400">Editing tasks affects future work orders only. Work orders already generated keep the checklist they were created with.</p>
          )}
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardHeader><CardTitle>PPM History</CardTitle></CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-slate-500">No work orders have been generated from this plan yet.</p>
          ) : (
            <TableShell>
              <TableHead>
                <TableHeaderCell>Work Order</TableHeaderCell>
                <TableHeaderCell>Due Date</TableHeaderCell>
                <TableHeaderCell>Technician</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Completed</TableHeaderCell>
                <TableHeaderCell>Verified</TableHeaderCell>
              </TableHead>
              <TableBody>
                {history.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell>
                      <Link href={`/work-orders/${h.id}`} className="text-sky-700 hover:underline">{h.work_order_number}</Link>
                    </TableCell>
                    <TableCell>{formatDate(h.due_date)}</TableCell>
                    <TableCell>{h.assignee?.full_name || h.assignee?.email || "—"}</TableCell>
                    <TableCell>{h.status?.name ?? "—"}</TableCell>
                    <TableCell>{formatDate(h.completed_at)}</TableCell>
                    <TableCell>{formatDate(h.verified_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </TableShell>
          )}
        </CardContent>
      </Card>

      {/* Skip dialog */}
      <Dialog
        open={skipOpen}
        onClose={() => setSkipOpen(false)}
        title="Skip this occurrence"
        description="Skipping records a reason and moves the schedule on to the next occurrence. It does not pause the plan."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setSkipOpen(false)} disabled={busy}>Cancel</Button>
            <Button
              size="sm"
              isLoading={busy}
              onClick={async () => {
                if (!nextOccurrence) return;
                const ok = await run(() => skipPpmOccurrence(nextOccurrence.id, plan.id, skipReason));
                if (ok) setSkipOpen(false);
              }}
            >Skip occurrence</Button>
          </>
        }
      >
        <Textarea placeholder="Reason for skipping…" value={skipReason} onChange={(e) => setSkipReason(e.target.value)} rows={3} />
      </Dialog>

      <ConfirmDialog
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        onConfirm={async () => { const ok = await run(() => setPpmPlanStatus(plan.id, "archived")); if (ok) setArchiveOpen(false); }}
        title="Archive this plan?"
        description="Archived plans stop generating work orders and are hidden from active lists, but their history is kept. You can restore it later."
        confirmLabel="Archive"
        destructive
        isLoading={busy}
      />

      <ConfirmDialog
        open={!!deleteTask}
        onClose={() => setDeleteTask(null)}
        onConfirm={async () => { if (!deleteTask) return; const ok = await run(() => deletePpmTask(plan.id, deleteTask.id)); if (ok) setDeleteTask(null); }}
        title="Remove this task?"
        description="This removes the task from the plan template. Work orders already generated are unaffected."
        confirmLabel="Remove"
        destructive
        isLoading={busy}
      />

      {taskDialog && (
        <TaskDialog
          planId={plan.id}
          mode={taskDialog.mode}
          task={taskDialog.task}
          onClose={() => setTaskDialog(null)}
          onDone={() => { setTaskDialog(null); router.refresh(); }}
        />
      )}

      {editOpen && (
        <EditPlanDialog
          plan={plan}
          priorities={priorities}
          technicians={technicians}
          onClose={() => setEditOpen(false)}
          onDone={() => { setEditOpen(false); router.refresh(); }}
        />
      )}
    </div>
  );
}

function moveId(tasks: PpmPlanTask[], id: string, dir: -1 | 1): string[] {
  const ids = tasks.map((t) => t.id);
  const i = ids.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) return ids;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  return ids;
}

function TaskDialog({
  planId, mode, task, onClose, onDone,
}: {
  planId: string; mode: "add" | "edit"; task?: PpmPlanTask; onClose: () => void; onDone: () => void;
}) {
  const [desc, setDesc] = useState(task?.task_description ?? "");
  const [instr, setInstr] = useState(task?.instructions ?? "");
  const [required, setRequired] = useState(task?.is_required ?? true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true); setErr(null);
    const payload = { task_description: desc, instructions: instr || null, is_required: required };
    const res = mode === "add"
      ? await addPpmTask(planId, payload)
      : await updatePpmTask(planId, task!.id, payload);
    setBusy(false);
    if (!res.ok) setErr(res.error);
    else onDone();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={mode === "add" ? "Add task" : "Edit task"}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button size="sm" isLoading={busy} onClick={save}>Save</Button>
        </>
      }
    >
      <div className="space-y-3">
        {err && <p className="text-sm text-red-600">{err}</p>}
        <Input placeholder="Task description" value={desc} onChange={(e) => setDesc(e.target.value)} />
        <Textarea placeholder="Instructions (optional)" value={instr} onChange={(e) => setInstr(e.target.value)} rows={2} />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
          Required to complete the work order
        </label>
      </div>
    </Dialog>
  );
}

function EditPlanDialog({
  plan, priorities, technicians, onClose, onDone,
}: {
  plan: PpmPlanDetail; priorities: FmPriority[]; technicians: PersonOption[]; onClose: () => void; onDone: () => void;
}) {
  const [name, setName] = useState(plan.name);
  const [description, setDescription] = useState(plan.description ?? "");
  const [instructions, setInstructions] = useState(plan.maintenance_instructions ?? "");
  const [priorityId, setPriorityId] = useState(plan.priority_id);
  const [leadTime, setLeadTime] = useState(plan.lead_time_days);
  const [duration, setDuration] = useState(plan.estimated_duration_minutes?.toString() ?? "");
  const [technicianId, setTechnicianId] = useState(plan.default_assigned_to ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true); setErr(null);
    const res = await updatePpmPlan(plan.id, {
      name,
      description: description || null,
      maintenance_instructions: instructions || null,
      priority_id: priorityId,
      lead_time_days: Number(leadTime) || 0,
      estimated_duration_minutes: duration ? Number(duration) : null,
      due_window_days: plan.due_window_days,
      default_assigned_to: technicianId || null,
    });
    setBusy(false);
    if (!res.ok) setErr(res.error);
    else onDone();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Edit PPM plan"
      description="Schedule frequency and start date are fixed once a plan exists; archive and recreate to change them."
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button size="sm" isLoading={busy} onClick={save}>Save changes</Button>
        </>
      }
    >
      <div className="space-y-3">
        {err && <p className="text-sm text-red-600">{err}</p>}
        <Input placeholder="Plan name" value={name} onChange={(e) => setName(e.target.value)} />
        <Textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        <Textarea placeholder="Maintenance instructions" value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={3} />
        <Select value={priorityId} onChange={(e) => setPriorityId(e.target.value)}>
          {priorities.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
        </Select>
        <div className="grid grid-cols-2 gap-2">
          <Input type="number" min={0} placeholder="Lead time (days)" value={leadTime} onChange={(e) => setLeadTime(Number(e.target.value))} />
          <Input type="number" min={0} placeholder="Duration (min)" value={duration} onChange={(e) => setDuration(e.target.value)} />
        </div>
        <Select value={technicianId} onChange={(e) => setTechnicianId(e.target.value)}>
          <option value="">No default technician</option>
          {technicians.map((t) => (<option key={t.id} value={t.id}>{t.full_name || t.email}</option>))}
        </Select>
      </div>
    </Dialog>
  );
}

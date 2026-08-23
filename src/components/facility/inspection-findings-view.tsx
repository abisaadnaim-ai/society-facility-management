"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { FindingStatusBadge } from "@/components/facility/inspection-badges";
import { formatDate } from "@/lib/format";
import {
  createFmRequestFromFinding,
  createWorkOrderFromFinding,
  resolveFinding,
  dismissFinding,
} from "@/lib/actions/inspections";
import type { InspectionFindingRow } from "@/lib/types/inspections";
import type { Lookup, PersonOption } from "@/lib/types/fm";

export function InspectionFindingsView({
  findings, canManage, categories, priorities, inspectors,
}: {
  findings: InspectionFindingRow[];
  canManage: boolean;
  categories: Lookup[];
  priorities: Lookup[];
  inspectors: PersonOption[];
}) {
  const [filter, setFilter] = useState<"open" | "all">("open");
  const shown = filter === "open"
    ? findings.filter((f) => f.status === "open" || f.status === "action_required")
    : findings;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href="/inspections" className="text-sm text-slate-500 hover:text-slate-900">&larr; Inspections</Link>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">Findings</h1>
        </div>
        <div className="w-40">
          <Select value={filter} onChange={(e) => setFilter(e.target.value as "open" | "all")}>
            <option value="open">Open only</option>
            <option value="all">All findings</option>
          </Select>
        </div>
      </div>

      {shown.length === 0 ? (
        <EmptyState title="No findings" description="Failed inspection items appear here for corrective action." />
      ) : (
        <div className="space-y-2">
          {shown.map((f) => (
            <FindingCard key={f.id} finding={f} canManage={canManage} categories={categories} priorities={priorities} inspectors={inspectors} />
          ))}
        </div>
      )}
    </div>
  );
}

function FindingCard({
  finding, canManage, categories, priorities, inspectors,
}: {
  finding: InspectionFindingRow;
  canManage: boolean;
  categories: Lookup[];
  priorities: Lookup[];
  inspectors: PersonOption[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [dialog, setDialog] = useState<null | "fm" | "wo" | "dismiss">(null);
  const [title, setTitle] = useState(finding.description.slice(0, 120));
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState(finding.category?.id ?? "");
  const [priorityId, setPriorityId] = useState(finding.priority?.id ?? "");
  const [assignee, setAssignee] = useState("");
  const [reason, setReason] = useState("");

  const open = finding.status === "open" || finding.status === "action_required";

  async function act(fn: () => Promise<{ ok: boolean; error?: string }>, close = true) {
    setBusy(true); setErr(null);
    const res = await fn();
    setBusy(false);
    if (!res.ok) setErr(res.error ?? "Something went wrong.");
    else { if (close) setDialog(null); router.refresh(); }
  }

  return (
    <Card>
      <CardContent className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-slate-800">{finding.description}</p>
            <p className="mt-1 text-xs text-slate-500">
              {finding.inspection && <Link href={`/inspections/${finding.inspection.id}`} className="underline">{finding.inspection.inspection_number}</Link>}
              {" · "}{finding.location?.name ?? "—"}{finding.area?.name ? ` / ${finding.area.name}` : ""} · {formatDate(finding.created_at)}
            </p>
          </div>
          <FindingStatusBadge status={finding.status} />
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {finding.category?.name && <Badge variant="neutral">{finding.category.name}</Badge>}
          {finding.priority?.name && <Badge variant="neutral">{finding.priority.name}</Badge>}
          {finding.fm_request && <Link href={`/fm-requests/${finding.fm_request.id}`} className="text-slate-500 underline">{finding.fm_request.request_number}</Link>}
          {finding.work_order && <Link href={`/work-orders/${finding.work_order.id}`} className="text-slate-500 underline">{finding.work_order.work_order_number}</Link>}
        </div>

        {canManage && open && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={() => setDialog("fm")}>Create FM Request</Button>
            <Button size="sm" variant="outline" onClick={() => setDialog("wo")}>Create Work Order</Button>
            <Button size="sm" variant="ghost" isLoading={busy} onClick={() => act(() => resolveFinding(finding.id, null), false)}>Resolve</Button>
            <Button size="sm" variant="ghost" onClick={() => setDialog("dismiss")}>Dismiss</Button>
          </div>
        )}
        {err && <p className="text-xs text-red-600">{err}</p>}
      </CardContent>

      <Dialog open={dialog === "fm"} onClose={() => setDialog(null)} title="Create FM Request from finding"
        footer={<>
          <Button variant="outline" size="sm" onClick={() => setDialog(null)}>Cancel</Button>
          <Button size="sm" isLoading={busy} onClick={() => act(() => createFmRequestFromFinding(finding.id, { title, description, category_id: categoryId || null, priority_id: priorityId || null }))}>Create</Button>
        </>}>
        <div className="space-y-3">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
          <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" />
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Category (required)</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select value={priorityId} onChange={(e) => setPriorityId(e.target.value)}>
            <option value="">Priority (optional)</option>
            {priorities.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </div>
      </Dialog>

      <Dialog open={dialog === "wo"} onClose={() => setDialog(null)} title="Create Work Order from finding"
        footer={<>
          <Button variant="outline" size="sm" onClick={() => setDialog(null)}>Cancel</Button>
          <Button size="sm" isLoading={busy} onClick={() => act(() => createWorkOrderFromFinding(finding.id, { title, description, category_id: categoryId || null, priority_id: priorityId || null, assigned_to: assignee || null }))}>Create</Button>
        </>}>
        <div className="space-y-3">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
          <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" />
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Category (required)</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select value={priorityId} onChange={(e) => setPriorityId(e.target.value)}>
            <option value="">Priority (required)</option>
            {priorities.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <Select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">Assign later</option>
            {inspectors.map((i) => <option key={i.id} value={i.id}>{i.full_name || i.email}</option>)}
          </Select>
        </div>
      </Dialog>

      {dialog === "dismiss" && (
        <Dialog open onClose={() => setDialog(null)} title="Dismiss finding" description="A reason is required."
          footer={<>
            <Button variant="outline" size="sm" onClick={() => setDialog(null)}>Cancel</Button>
            <Button variant="destructive" size="sm" isLoading={busy} onClick={() => act(() => dismissFinding(finding.id, reason))}>Dismiss</Button>
          </>}>
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for dismissal" />
        </Dialog>
      )}
    </Card>
  );
}

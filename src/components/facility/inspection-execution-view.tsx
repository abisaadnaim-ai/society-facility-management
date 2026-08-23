"use client";

import { useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  OccurrenceStatusBadge,
  OverallResultBadge,
  FindingStatusBadge,
  ResultChip,
} from "@/components/facility/inspection-badges";
import { personName } from "@/components/facility/status-badges";
import {
  startInspection,
  saveInspectionResponse,
  submitInspection,
  reviewInspection,
  closeInspection,
  skipInspection,
  assignInspection,
  recordInspectionAttachment,
  getInspectionAttachmentUrl,
  createFmRequestFromFinding,
  createWorkOrderFromFinding,
  resolveFinding,
  dismissFinding,
} from "@/lib/actions/inspections";
import type { InspectionDetail } from "@/lib/queries/inspections";
import type { InspectionFindingRow } from "@/lib/types/inspections";
import type { PersonOption, Lookup } from "@/lib/types/fm";

const MAX_BYTES = 20 * 1024 * 1024;

type Props = {
  detail: InspectionDetail;
  findings: InspectionFindingRow[];
  canManage: boolean;
  canPerform: boolean;
  organizationId: string;
  inspectors: PersonOption[];
  categories: Lookup[];
  priorities: Lookup[];
};

export function InspectionExecutionView({
  detail,
  findings,
  canManage,
  canPerform,
  organizationId,
  inspectors,
  categories,
  priorities,
}: Props) {
  const router = useRouter();
  const occ = detail.occurrence;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const editable = occ.status === "in_progress" && canPerform;
  const answered = detail.responses.filter((r) => r.result).length;
  const total = detail.responses.length;

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
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Link href="/inspections" className="text-sm text-slate-500 hover:text-slate-900">
          &larr; Back to Inspections
        </Link>
      </div>

      <Card>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{occ.inspection_number}</p>
              <h1 className="truncate text-lg font-semibold text-slate-900">{occ.template?.name ?? "Inspection"}</h1>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <OccurrenceStatusBadge status={occ.status} />
              <OverallResultBadge result={occ.overall_result} />
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            <Field label="Location" value={occ.location?.name ?? "—"} />
            <Field label="Area" value={occ.area?.name ?? "Whole location"} />
            <Field label="Asset" value={occ.asset?.name ?? "Not asset-specific"} />
            <Field label="Scheduled" value={`${formatDate(occ.scheduled_date)}${occ.scheduled_time ? " " + occ.scheduled_time.slice(0, 5) : ""}`} />
            <Field label="Inspector" value={occ.assignee ? personName(occ.assignee) : "Unassigned"} />
            <Field label="Progress" value={`${answered}/${total} answered`} />
          </dl>
        </CardContent>
      </Card>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {/* Start */}
      {(occ.status === "scheduled" || occ.status === "due") && canPerform && (
        <Button size="lg" isLoading={busy} onClick={() => run(() => startInspection(occ.id))} className="w-full sm:w-auto">
          Start inspection
        </Button>
      )}

      {/* Checklist */}
      {total > 0 && (
        <ChecklistList
          detail={detail}
          editable={editable}
          organizationId={organizationId}
          onError={setError}
        />
      )}

      {/* Submit */}
      {editable && (
        <SubmitBar
          occId={occ.id}
          responses={detail.responses}
          busy={busy}
          onSubmit={async () => {
            setBusy(true); setError(null);
            const res = await submitInspection(occ.id);
            setBusy(false);
            if (!res.ok) setError(res.error ?? "Could not submit."); else router.refresh();
          }}
        />
      )}

      {/* Manager actions */}
      {canManage && (
        <ManagerPanel occ={occ} inspectors={inspectors} busy={busy} run={run} />
      )}

      {/* Findings */}
      {findings.length > 0 && (
        <FindingsPanel
          findings={findings}
          canManage={canManage}
          categories={categories}
          priorities={priorities}
          inspectors={inspectors}
        />
      )}

      {/* Activity */}
      {detail.activity.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Activity</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {detail.activity.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-3">
                  <span className="text-slate-700">
                    {a.action.replaceAll("_", " ")}
                    {a.new_value ? `: ${a.new_value}` : ""}
                    {a.is_system ? " (system)" : a.actor ? ` — ${personName(a.actor)}` : ""}
                  </span>
                  <span className="shrink-0 text-xs text-slate-400">{formatDateTime(a.created_at)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="truncate font-medium text-slate-900">{value}</dd>
    </div>
  );
}

// ---------------- Checklist ----------------
function ChecklistList({
  detail,
  editable,
  organizationId,
  onError,
}: {
  detail: InspectionDetail;
  editable: boolean;
  organizationId: string;
  onError: (m: string | null) => void;
}) {
  const responses = detail.responses;
  const groups = useMemo(() => {
    const out: { section: string | null; items: typeof responses }[] = [];
    for (const r of responses) {
      const key = r.section_name_snapshot ?? null;
      const last = out[out.length - 1];
      if (!last || last.section !== key) out.push({ section: key, items: [r] });
      else last.items.push(r);
    }
    return out;
  }, [responses]);

  return (
    <div className="space-y-4">
      {groups.map((g, gi) => (
        <Card key={gi}>
          {g.section && <CardHeader><CardTitle>{g.section}</CardTitle></CardHeader>}
          <CardContent className="divide-y divide-slate-100 p-0">
            {g.items.map((r) => (
              <ChecklistItem
                key={r.id}
                response={r}
                inspectionId={detail.occurrence.id}
                editable={editable}
                organizationId={organizationId}
                onError={onError}
              />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

type ResponseRow = InspectionDetail["responses"][number];

function ChecklistItem({
  response,
  inspectionId,
  editable,
  organizationId,
  onError,
}: {
  response: ResponseRow;
  inspectionId: string;
  editable: boolean;
  organizationId: string;
  onError: (m: string | null) => void;
}) {
  const router = useRouter();
  const [result, setResult] = useState<string | null>(response.result);
  const [comment, setComment] = useState(response.comment ?? "");
  const [saving, setSaving] = useState<null | "saving" | "saved">(null);
  const [uploading, setUploading] = useState(false);
  const [photos, setPhotos] = useState(response.attachments);
  const cameraRef = useRef<HTMLInputElement>(null);

  async function save(next: { result?: string | null; comment?: string | null }) {
    setSaving("saving");
    onError(null);
    const res = await saveInspectionResponse(inspectionId, response.id, {
      result: (next.result !== undefined ? next.result : result) as "pass" | "fail" | "na" | null,
      comment: next.comment !== undefined ? next.comment : comment,
    });
    if (!res.ok) {
      setSaving(null);
      onError(res.error ?? "Could not save.");
      // revert result on failure (e.g. N/A blocked)
      setResult(response.result);
      return;
    }
    setSaving("saved");
    setTimeout(() => setSaving(null), 1200);
  }

  function choose(v: string) {
    setResult(v);
    save({ result: v });
  }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_BYTES) { onError("File is too large (max 20 MB)."); return; }
    setUploading(true); onError(null);
    try {
      const supabase = createClient();
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${organizationId}/inspections/${inspectionId}/${response.id}/${Date.now()}_${safe}`;
      const { error: upErr } = await supabase.storage.from("inspection-attachments").upload(path, file, {
        upsert: false, contentType: file.type || undefined,
      });
      if (upErr) { onError("Upload failed. Please try again."); setUploading(false); return; }
      const res = await recordInspectionAttachment({
        inspection_id: inspectionId, response_id: response.id,
        file_name: file.name, file_path: path, file_type: file.type || null, file_size: file.size,
      });
      if (!res.ok) { await supabase.storage.from("inspection-attachments").remove([path]); onError(res.error ?? "Could not attach."); }
      else { setPhotos((p) => [...p, { id: res.data.id, inspection_id: inspectionId, response_id: response.id, organization_id: organizationId, file_name: file.name, file_path: path, file_type: file.type || null, file_size: file.size, uploaded_by: null, created_at: new Date().toISOString() }]); router.refresh(); }
    } finally {
      setUploading(false);
    }
  }

  async function openPhoto(path: string) {
    const res = await getInspectionAttachmentUrl(path);
    if (res.ok) window.open(res.data.url, "_blank", "noopener,noreferrer");
  }

  const showComment = editable || (response.comment && response.comment.length > 0);
  const failNeedsComment = result === "fail" && response.require_comment_on_fail;
  const failNeedsPhoto = result === "fail" && response.require_photo_on_fail;

  return (
    <div className="px-4 py-3 sm:px-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900">
            {response.item_text_snapshot}
            {response.is_required && <span className="ml-1 text-red-500">*</span>}
          </p>
          {response.instructions_snapshot && (
            <p className="mt-0.5 text-xs text-slate-500">{response.instructions_snapshot}</p>
          )}
        </div>
        {!editable && <ResultChip result={result} />}
      </div>

      {editable && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <ResultButton active={result === "pass"} tone="pass" onClick={() => choose("pass")}>Pass</ResultButton>
          <ResultButton active={result === "fail"} tone="fail" onClick={() => choose("fail")}>Fail</ResultButton>
          {response.allow_na ? (
            <ResultButton active={result === "na"} tone="na" onClick={() => choose("na")}>N/A</ResultButton>
          ) : (
            <div className="flex items-center justify-center rounded-md border border-dashed border-slate-200 text-xs text-slate-300">N/A off</div>
          )}
        </div>
      )}

      {showComment && (
        <div className="mt-3">
          <Textarea
            rows={2}
            value={comment}
            disabled={!editable}
            placeholder={failNeedsComment ? "Comment required on fail" : "Add a comment (optional)"}
            onChange={(e) => setComment(e.target.value)}
            onBlur={() => editable && save({ comment })}
            error={failNeedsComment && !comment.trim()}
          />
        </div>
      )}

      {/* Photos */}
      {(editable || photos.length > 0) && (
        <div className="mt-2">
          {photos.length > 0 && (
            <ul className="mb-2 flex flex-wrap gap-2">
              {photos.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => openPhoto(p.file_path)} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700 hover:bg-slate-200">
                    {p.file_name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {editable && (
            <div className="flex items-center gap-2">
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPhoto} />
              <Button type="button" variant="outline" size="sm" isLoading={uploading} onClick={() => cameraRef.current?.click()}>
                Take / add photo
              </Button>
              {failNeedsPhoto && photos.length === 0 && <span className="text-xs text-red-600">Photo required on fail</span>}
            </div>
          )}
        </div>
      )}

      {saving && <p className="mt-1 text-xs text-slate-400">{saving === "saving" ? "Saving…" : "Saved"}</p>}
    </div>
  );
}

function ResultButton({ active, tone, onClick, children }: { active: boolean; tone: "pass" | "fail" | "na"; onClick: () => void; children: React.ReactNode }) {
  const base = "flex h-11 items-center justify-center rounded-md border text-sm font-semibold transition-colors";
  const map: Record<string, string> = {
    pass: active ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-emerald-50",
    fail: active ? "border-red-600 bg-red-600 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-red-50",
    na: active ? "border-slate-500 bg-slate-500 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
  };
  return <button type="button" onClick={onClick} className={[base, map[tone]].join(" ")}>{children}</button>;
}

function SubmitBar({ occId, responses, busy, onSubmit }: { occId: string; responses: ResponseRow[]; busy: boolean; onSubmit: () => void }) {
  void occId;
  const missing = responses.filter((r) => r.is_required && !r.result).length;
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {missing > 0 ? `${missing} required item${missing === 1 ? "" : "s"} still need an answer.` : "All required items answered."}
        </p>
        <Button size="lg" isLoading={busy} onClick={onSubmit}>Submit inspection</Button>
      </CardContent>
    </Card>
  );
}

// ---------------- Manager panel ----------------
function ManagerPanel({
  occ, inspectors, busy, run,
}: {
  occ: InspectionDetail["occurrence"];
  inspectors: PersonOption[];
  busy: boolean;
  run: (fn: () => Promise<{ ok: boolean; error?: string }>) => Promise<boolean>;
}) {
  const [assignee, setAssignee] = useState(occ.assigned_to ?? "");
  const [reviewNotes, setReviewNotes] = useState("");
  const [skipOpen, setSkipOpen] = useState(false);
  const [skipReason, setSkipReason] = useState("");

  const canSkip = ["scheduled", "due", "in_progress"].includes(occ.status);

  return (
    <Card>
      <CardHeader><CardTitle>Manager actions</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Assigned inspector</label>
            <Select value={assignee} onChange={(e) => setAssignee(e.target.value)} disabled={["closed","cancelled","skipped"].includes(occ.status)}>
              <option value="">Unassigned</option>
              {inspectors.map((i) => (
                <option key={i.id} value={i.id}>{i.full_name || i.email}</option>
              ))}
            </Select>
          </div>
          <Button variant="outline" isLoading={busy} disabled={assignee === (occ.assigned_to ?? "")} onClick={() => run(() => assignInspection(occ.id, assignee || null))}>
            Save assignment
          </Button>
        </div>

        {occ.status === "submitted" && (
          <div className="space-y-2 border-t border-slate-100 pt-4">
            <label className="block text-sm font-medium text-slate-700">Review notes (optional)</label>
            <Textarea rows={2} value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} />
            <Button isLoading={busy} onClick={() => run(() => reviewInspection(occ.id, reviewNotes))}>Mark reviewed</Button>
          </div>
        )}
        {occ.status === "reviewed" && (
          <div className="border-t border-slate-100 pt-4">
            {occ.review_notes && <p className="mb-2 text-sm text-slate-600">Review notes: {occ.review_notes}</p>}
            <Button isLoading={busy} onClick={() => run(() => closeInspection(occ.id))}>Close inspection</Button>
          </div>
        )}

        {canSkip && (
          <div className="border-t border-slate-100 pt-4">
            <Button variant="outline" onClick={() => setSkipOpen(true)}>Skip this occurrence</Button>
          </div>
        )}
      </CardContent>

      <Dialog
        open={skipOpen}
        onClose={() => setSkipOpen(false)}
        title="Skip inspection"
        description="Future occurrences are unaffected. A reason is required."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setSkipOpen(false)}>Cancel</Button>
            <Button variant="destructive" size="sm" isLoading={busy} onClick={async () => {
              const ok = await run(() => skipInspection(occ.id, skipReason));
              if (ok) setSkipOpen(false);
            }}>Skip</Button>
          </>
        }
      >
        <Textarea rows={3} value={skipReason} onChange={(e) => setSkipReason(e.target.value)} placeholder="Reason for skipping" />
      </Dialog>
    </Card>
  );
}

// ---------------- Findings ----------------
function FindingsPanel({
  findings, canManage, categories, priorities, inspectors,
}: {
  findings: InspectionFindingRow[];
  canManage: boolean;
  categories: Lookup[];
  priorities: Lookup[];
  inspectors: PersonOption[];
}) {
  return (
    <Card>
      <CardHeader><CardTitle>Findings ({findings.length})</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {findings.map((f) => (
          <FindingRow key={f.id} finding={f} canManage={canManage} categories={categories} priorities={priorities} inspectors={inspectors} />
        ))}
      </CardContent>
    </Card>
  );
}

function FindingRow({
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
    <div className="rounded-md border border-slate-200 p-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-slate-800">{finding.description}</p>
        <FindingStatusBadge status={finding.status} />
      </div>
      <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
        {finding.category?.name && <Badge variant="neutral">{finding.category.name}</Badge>}
        {finding.priority?.name && <Badge variant="neutral">{finding.priority.name}</Badge>}
        {finding.fm_request && <Link href={`/fm-requests/${finding.fm_request.id}`} className="text-slate-500 underline">{finding.fm_request.request_number}</Link>}
        {finding.work_order && <Link href={`/work-orders/${finding.work_order.id}`} className="text-slate-500 underline">{finding.work_order.work_order_number}</Link>}
      </div>
      {finding.resolution_notes && <p className="mt-1 text-xs text-slate-500">Resolution: {finding.resolution_notes}</p>}
      {finding.dismissal_reason && <p className="mt-1 text-xs text-slate-500">Dismissed: {finding.dismissal_reason}</p>}

      {canManage && open && (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setDialog("fm")}>Create FM Request</Button>
          <Button size="sm" variant="outline" onClick={() => setDialog("wo")}>Create Work Order</Button>
          <Button size="sm" variant="ghost" isLoading={busy} onClick={() => act(() => resolveFinding(finding.id, null), false)}>Resolve</Button>
          <Button size="sm" variant="ghost" onClick={() => setDialog("dismiss")}>Dismiss</Button>
        </div>
      )}
      {err && <p className="mt-2 text-xs text-red-600">{err}</p>}

      {/* Create FM Request */}
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
            <option value="">Priority (set during review)</option>
            {priorities.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </div>
      </Dialog>

      {/* Create Work Order */}
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
    </div>
  );
}

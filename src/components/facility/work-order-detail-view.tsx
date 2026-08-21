"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog } from "@/components/ui/dialog";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  WorkOrderStatusBadge,
  PriorityBadge,
  personName,
} from "@/components/facility/status-badges";
import { ActivityTimeline } from "@/components/facility/activity-timeline";
import { CommentThread } from "@/components/facility/comment-thread";
import { AttachmentsPanel } from "@/components/facility/attachments-panel";
import {
  isManagerRole,
  isTechnicianAssigned,
  allowedTechnicianTransitions,
  allowedManagerOperationalTransitions,
  canAssignWorkOrder,
  canVerifyWorkOrder,
  canReturnToTechnician,
  canCloseWorkOrder,
  canCancelWorkOrder,
  WO_STATUS,
} from "@/lib/workflow";
import {
  assignTechnician,
  changeWorkOrderStatus,
  verifyWorkOrder,
  returnToTechnician,
  closeWorkOrder,
  cancelWorkOrder,
  addWorkOrderComment,
} from "@/lib/actions/work-orders";
import type { RoleCode } from "@/lib/types/auth";
import type {
  WorkOrderDetail,
  WorkOrderActivityRow,
  WorkOrderCommentRow,
  WorkOrderAttachmentRow,
  WorkOrderStatus,
  PersonOption,
} from "@/lib/types/fm";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-50 py-2">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-right text-sm font-medium text-slate-900">{value}</dd>
    </div>
  );
}

export function WorkOrderDetailView({
  workOrder,
  activity,
  comments,
  attachments,
  role,
  userId,
  organizationId,
  statuses,
  technicians,
}: {
  workOrder: WorkOrderDetail;
  activity: WorkOrderActivityRow[];
  comments: WorkOrderCommentRow[];
  attachments: WorkOrderAttachmentRow[];
  role: RoleCode | null;
  userId: string;
  organizationId: string;
  statuses: WorkOrderStatus[];
  technicians: PersonOption[];
}) {
  const router = useRouter();
  const wo = workOrder;
  const code = wo.status?.code ?? null;
  const isManager = isManagerRole(role);
  const isAssignedTech = isTechnicianAssigned(role, wo.assigned_to, userId);

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignId, setAssignId] = useState(wo.assigned_to ?? "");
  const [completeOpen, setCompleteOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyNotes, setVerifyNotes] = useState("");
  const [returnOpen, setReturnOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [mgrStatus, setMgrStatus] = useState("");

  const nameFor = (c: string) => statuses.find((s) => s.code === c)?.name ?? c;

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Something went wrong.");
      else {
        after?.();
        router.refresh();
      }
    });
  }

  const techTargets = isAssignedTech ? allowedTechnicianTransitions(code) : [];
  const mgrTargets = isManager ? allowedManagerOperationalTransitions(code) : [];

  return (
    <div>
      <div className="mb-4">
        <Link href="/work-orders" className="text-sm text-slate-500 hover:text-slate-900">
          &larr; Back to Work Orders
        </Link>
      </div>

      <PageHeader
        title={wo.title}
        description={wo.work_order_number}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canAssignWorkOrder(role, code) && (
              <Button size="sm" variant="outline" onClick={() => { setAssignId(wo.assigned_to ?? ""); setAssignOpen(true); }}>
                {wo.assigned_to ? "Reassign" : "Assign"}
              </Button>
            )}
            {canVerifyWorkOrder(role, code) && (
              <Button size="sm" onClick={() => { setVerifyNotes(""); setVerifyOpen(true); }}>
                Verify
              </Button>
            )}
            {canReturnToTechnician(role, code) && (
              <Button size="sm" variant="outline" onClick={() => { setReason(""); setReturnOpen(true); }}>
                Return to technician
              </Button>
            )}
            {canCloseWorkOrder(role, code) && code === WO_STATUS.verified && (
              <Button size="sm" onClick={() => run(() => closeWorkOrder(wo.id))} isLoading={pending}>
                Close
              </Button>
            )}
            {canCancelWorkOrder(role, code) && (
              <Button size="sm" variant="ghost" onClick={() => { setReason(""); setCancelOpen(true); }}>
                Cancel
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <WorkOrderStatusBadge status={wo.status} />
        <PriorityBadge priority={wo.priority} />
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {/* Execution controls */}
      {(techTargets.length > 0 || mgrTargets.length > 0) && (
        <section className="mb-5 rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Update status</h2>
          <div className="flex flex-wrap items-center gap-2">
            {isAssignedTech && code === WO_STATUS.assigned && (
              <Button size="sm" onClick={() => run(() => changeWorkOrderStatus(wo.id, WO_STATUS.in_progress))} isLoading={pending}>
                Start work
              </Button>
            )}
            {isAssignedTech && (code === WO_STATUS.on_hold || String(code).startsWith("waiting")) && (
              <Button size="sm" onClick={() => run(() => changeWorkOrderStatus(wo.id, WO_STATUS.in_progress))} isLoading={pending}>
                Resume work
              </Button>
            )}
            {isAssignedTech && code === WO_STATUS.in_progress && (
              <>
                <Button size="sm" onClick={() => { setNotes(""); setCompleteOpen(true); }}>
                  Mark completed
                </Button>
                <TechWaitingControl statuses={statuses} onPick={(c) => run(() => changeWorkOrderStatus(wo.id, c))} pending={pending} />
              </>
            )}
            {isManager && mgrTargets.length > 0 && (
              <div className="flex items-center gap-2">
                <Select value={mgrStatus} onChange={(e) => setMgrStatus(e.target.value)} className="w-48">
                  <option value="">Change status to...</option>
                  {mgrTargets.map((c) => (
                    <option key={c} value={c}>{nameFor(c)}</option>
                  ))}
                </Select>
                <Button
                  size="sm"
                  disabled={!mgrStatus || pending}
                  isLoading={pending}
                  onClick={() => {
                    if (mgrStatus === WO_STATUS.completed) {
                      setNotes("");
                      setCompleteOpen(true);
                    } else {
                      run(() => changeWorkOrderStatus(wo.id, mgrStatus), () => setMgrStatus(""));
                    }
                  }}
                >
                  Apply
                </Button>
              </div>
            )}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Job</h2>
            {wo.description ? (
              <p className="mb-4 whitespace-pre-wrap text-sm text-slate-700">{wo.description}</p>
            ) : (
              <p className="mb-4 text-sm text-slate-400">No description.</p>
            )}
            <dl>
              <Field label="Category" value={wo.category?.name ?? "-"} />
              <Field label="Technician" value={wo.assignee ? personName(wo.assignee) : "Unassigned"} />
              <Field label="Due date" value={wo.due_date ? formatDate(wo.due_date) : "-"} />
              <Field label="Created by" value={`${personName(wo.creator)} - ${formatDateTime(wo.created_at)}`} />
            </dl>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Location</h2>
            <dl>
              <Field label="Location" value={wo.location?.name ?? "-"} />
              <Field label="Area" value={wo.area?.name ?? "-"} />
              <Field
                label="Asset"
                value={
                  wo.asset ? (
                    <Link href={`/assets/${wo.asset.id}`} className="text-slate-900 underline">{wo.asset.name}</Link>
                  ) : "-"
                }
              />
            </dl>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Execution</h2>
            <dl>
              <Field label="Started" value={wo.started_at ? formatDateTime(wo.started_at) : "-"} />
              <Field label="Completed" value={wo.completed_at ? formatDateTime(wo.completed_at) : "-"} />
              {wo.completion_notes && <Field label="Completion notes" value={wo.completion_notes} />}
              {wo.verified_at && (
                <Field label="Verified" value={`${personName(wo.verifier)} - ${formatDateTime(wo.verified_at)}`} />
              )}
              {wo.verification_notes && <Field label="Verification notes" value={wo.verification_notes} />}
              {wo.closed_at && (
                <Field label="Closed" value={`${personName(wo.closer)} - ${formatDateTime(wo.closed_at)}`} />
              )}
              {wo.cancellation_reason && <Field label="Cancellation reason" value={wo.cancellation_reason} />}
            </dl>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Attachments</h2>
            <AttachmentsPanel
              kind="wo"
              parentId={wo.id}
              organizationId={organizationId}
              attachments={attachments}
              canManage={isManager || isAssignedTech}
            />
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Comments</h2>
            <CommentThread
              comments={comments}
              canPostPublic={isManager || isAssignedTech}
              canPostInternal={isManager || isAssignedTech}
              onSubmit={(body, isInternal) => addWorkOrderComment(wo.id, body, isInternal)}
            />
          </section>
        </div>

        <div className="space-y-5">
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Origin</h2>
            {wo.fm_request ? (
              <Link
                href={`/fm-requests/${wo.fm_request.id}`}
                className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 hover:bg-slate-50"
              >
                <span className="text-sm text-slate-500">FM Request</span>
                <span className="text-sm font-medium text-slate-900">{wo.fm_request.request_number}</span>
              </Link>
            ) : (
              <p className="text-sm text-slate-500">Created directly (no FM request).</p>
            )}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Activity</h2>
            <ActivityTimeline items={activity} />
          </section>
        </div>
      </div>

      {/* Assign dialog */}
      <Dialog
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        title={wo.assigned_to ? "Reassign work order" : "Assign work order"}
        description="Choose a technician to carry out this job."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setAssignOpen(false)} disabled={pending}>Cancel</Button>
            <Button size="sm" isLoading={pending} disabled={!assignId}
              onClick={() => run(() => assignTechnician(wo.id, assignId), () => setAssignOpen(false))}>
              {wo.assigned_to ? "Reassign" : "Assign"}
            </Button>
          </>
        }
      >
        <Select value={assignId} onChange={(e) => setAssignId(e.target.value)}>
          <option value="">Select a technician...</option>
          {technicians.map((t) => <option key={t.id} value={t.id}>{personName(t)}</option>)}
        </Select>
      </Dialog>

      {/* Complete dialog */}
      <Dialog
        open={completeOpen}
        onClose={() => setCompleteOpen(false)}
        title="Complete work order"
        description="Completion notes are required. Upload after-photos in Attachments."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setCompleteOpen(false)} disabled={pending}>Cancel</Button>
            <Button size="sm" isLoading={pending} disabled={!notes.trim()}
              onClick={() => run(() => changeWorkOrderStatus(wo.id, WO_STATUS.completed, notes), () => { setCompleteOpen(false); setMgrStatus(""); })}>
              Mark completed
            </Button>
          </>
        }
      >
        <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What was done..." />
      </Dialog>

      {/* Verify dialog */}
      <Dialog
        open={verifyOpen}
        onClose={() => setVerifyOpen(false)}
        title="Verify work order"
        description="Confirm the completed work meets standard."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setVerifyOpen(false)} disabled={pending}>Cancel</Button>
            <Button variant="secondary" size="sm" isLoading={pending}
              onClick={() => run(() => verifyWorkOrder(wo.id, verifyNotes, false), () => setVerifyOpen(false))}>
              Verify only
            </Button>
            <Button size="sm" isLoading={pending}
              onClick={() => run(() => verifyWorkOrder(wo.id, verifyNotes, true), () => setVerifyOpen(false))}>
              Verify &amp; close
            </Button>
          </>
        }
      >
        <Textarea rows={3} value={verifyNotes} onChange={(e) => setVerifyNotes(e.target.value)} placeholder="Verification notes (optional)..." />
      </Dialog>

      {/* Return dialog */}
      <Dialog
        open={returnOpen}
        onClose={() => setReturnOpen(false)}
        title="Return to technician"
        description="Explain what still needs to be done. The job goes back to In Progress."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setReturnOpen(false)} disabled={pending}>Cancel</Button>
            <Button size="sm" isLoading={pending} disabled={!reason.trim()}
              onClick={() => run(() => returnToTechnician(wo.id, reason), () => setReturnOpen(false))}>
              Return
            </Button>
          </>
        }
      >
        <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason..." />
      </Dialog>

      {/* Cancel dialog */}
      <Dialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel work order"
        description="Provide a reason for cancelling this work order."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setCancelOpen(false)} disabled={pending}>Keep</Button>
            <Button variant="destructive" size="sm" isLoading={pending} disabled={!reason.trim()}
              onClick={() => run(() => cancelWorkOrder(wo.id, reason), () => setCancelOpen(false))}>
              Cancel work order
            </Button>
          </>
        }
      >
        <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason..." />
      </Dialog>
    </div>
  );
}

function TechWaitingControl({
  statuses,
  onPick,
  pending,
}: {
  statuses: WorkOrderStatus[];
  onPick: (code: string) => void;
  pending: boolean;
}) {
  const [val, setVal] = useState("");
  const waiting = ["on_hold", "waiting_parts", "waiting_vendor", "waiting_procurement", "waiting_approval"];
  return (
    <div className="flex items-center gap-2">
      <Select value={val} onChange={(e) => setVal(e.target.value)} className="w-44">
        <option value="">Put on hold / waiting...</option>
        {statuses.filter((s) => waiting.includes(s.code)).map((s) => (
          <option key={s.code} value={s.code}>{s.name}</option>
        ))}
      </Select>
      <Button size="sm" variant="outline" disabled={!val || pending} isLoading={pending} onClick={() => onPick(val)}>
        Set
      </Button>
    </div>
  );
}

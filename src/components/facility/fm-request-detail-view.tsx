"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog } from "@/components/ui/dialog";
import { formatDateTime, formatDateTimeQatar, formatMinutes } from "@/lib/format";
import {
  RequestStatusBadge,
  PriorityBadge,
  WorkOrderStatusBadge,
  personName,
} from "@/components/facility/status-badges";
import { ActivityTimeline } from "@/components/facility/activity-timeline";
import { ResponseSlaBadge } from "@/components/facility/sla-badges";
import { CommentThread } from "@/components/facility/comment-thread";
import { AttachmentsPanel } from "@/components/facility/attachments-panel";
import { LocationAreaAssetPicker } from "@/components/facility/location-area-asset-picker";
import {
  canStartReview,
  canEditReview,
  canCreateWorkOrderFromRequest,
  canRejectRequest,
  canCancelRequest,
  isManagerRole,
} from "@/lib/workflow";
import {
  startReview,
  updateReview,
  rejectRequest,
  cancelRequest,
  addRequestComment,
} from "@/lib/actions/fm-requests";
import type { RoleCode } from "@/lib/types/auth";
import type {
  FmRequestDetail,
  FmRequestActivityRow,
  FmRequestCommentRow,
  FmRequestAttachmentRow,
  FmCategory,
  FmPriority,
} from "@/lib/types/fm";
import type { AssetOption } from "@/lib/queries/fm-config";

type AreaOpt = { id: string; name: string; location_id: string; is_active: boolean };

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-50 py-2">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-right text-sm font-medium text-slate-900">{value}</dd>
    </div>
  );
}

export function FmRequestDetailView({
  request,
  activity,
  comments,
  attachments,
  role,
  userId,
  organizationId,
  categories,
  priorities,
  areas,
  assets,
}: {
  request: FmRequestDetail;
  activity: FmRequestActivityRow[];
  comments: FmRequestCommentRow[];
  attachments: FmRequestAttachmentRow[];
  role: RoleCode | null;
  userId: string;
  organizationId: string;
  categories: FmCategory[];
  priorities: FmPriority[];
  areas: AreaOpt[];
  assets: AssetOption[];
}) {
  const router = useRouter();
  const statusCode = request.status?.code ?? null;
  const isManager = isManagerRole(role);
  const isOwnerRequester = role === "requester" && request.requested_by === userId;

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");

  // Review edit state
  const [editing, setEditing] = useState(false);
  const [categoryId, setCategoryId] = useState(request.category_id);
  const [priorityId, setPriorityId] = useState(request.priority_id ?? "");
  const [areaId, setAreaId] = useState(request.area_id ?? "");
  const [assetId, setAssetId] = useState(request.asset_id ?? "");

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

  return (
    <div>
      <div className="mb-4">
        <Link href="/fm-requests" className="text-sm text-slate-500 hover:text-slate-900">
          &larr; Back to FM Requests
        </Link>
      </div>

      <PageHeader
        title={request.title}
        description={request.request_number}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canStartReview(role, statusCode) && (
              <Button size="sm" onClick={() => run(() => startReview(request.id))} isLoading={pending}>
                Start review
              </Button>
            )}
            {canCreateWorkOrderFromRequest(role, statusCode, !!request.work_order) && (
              <Link href={`/work-orders/new?request=${request.id}`}>
                <Button size="sm">Create work order</Button>
              </Link>
            )}
            {canRejectRequest(role, statusCode) && (
              <Button size="sm" variant="outline" onClick={() => { setReason(""); setRejectOpen(true); }}>
                Reject
              </Button>
            )}
            {canCancelRequest(role, statusCode) && (
              <Button size="sm" variant="ghost" onClick={() => { setReason(""); setCancelOpen(true); }}>
                Cancel
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <RequestStatusBadge status={request.status} />
        <PriorityBadge priority={request.priority} />
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Issue</h2>
            {request.description ? (
              <p className="mb-4 whitespace-pre-wrap text-sm text-slate-700">{request.description}</p>
            ) : (
              <p className="mb-4 text-sm text-slate-400">No description provided.</p>
            )}
            <dl>
              <Field label="Category" value={request.category?.name ?? "-"} />
              <Field label="Requested by" value={personName(request.requester)} />
              <Field label="Reported" value={formatDateTime(request.created_at)} />
              {request.reviewed_at && (
                <Field label="Reviewed" value={`${personName(request.reviewer)} - ${formatDateTime(request.reviewed_at)}`} />
              )}
              {request.sla_response_target_minutes != null && (
                <>
                  <Field label="Response target" value={formatMinutes(request.sla_response_target_minutes)} />
                  <Field
                    label="Response due"
                    value={request.response_due_at ? formatDateTimeQatar(request.response_due_at) : "-"}
                  />
                  <Field
                    label="Response SLA"
                    value={
                      <ResponseSlaBadge
                        targetMinutes={request.sla_response_target_minutes}
                        createdAt={request.created_at}
                        responseDueAt={request.response_due_at}
                        firstRespondedAt={request.first_responded_at}
                      />
                    }
                  />
                </>
              )}
              {request.rejection_reason && <Field label="Rejection reason" value={request.rejection_reason} />}
              {request.cancellation_reason && <Field label="Cancellation reason" value={request.cancellation_reason} />}
            </dl>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Location</h2>
            <dl>
              <Field label="Location" value={request.location?.name ?? "-"} />
              <Field label="Area" value={request.area?.name ?? "-"} />
              <Field
                label="Asset"
                value={
                  request.asset ? (
                    <Link href={`/assets/${request.asset.id}`} className="text-slate-900 underline">
                      {request.asset.name}
                    </Link>
                  ) : "-"
                }
              />
              {request.exact_location_notes && (
                <Field label="Exact location" value={request.exact_location_notes} />
              )}
            </dl>
          </section>

          {isManager && canEditReview(role, statusCode) && (
            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">Review</h2>
                {!editing && (
                  <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                    Edit review
                  </Button>
                )}
              </div>
              {editing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Category</label>
                      <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Priority</label>
                      <Select value={priorityId} onChange={(e) => setPriorityId(e.target.value)}>
                        <option value="">Unset</option>
                        {priorities.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </Select>
                    </div>
                  </div>
                  <LocationAreaAssetPicker
                    locations={[{ id: request.location_id, name: request.location?.name ?? "Location" }]}
                    areas={areas}
                    assets={assets}
                    locationId={request.location_id}
                    areaId={areaId}
                    assetId={assetId}
                    onLocationChange={() => {}}
                    onAreaChange={setAreaId}
                    onAssetChange={setAssetId}
                  />
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={pending}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      isLoading={pending}
                      onClick={() =>
                        run(
                          () =>
                            updateReview(request.id, {
                              category_id: categoryId,
                              priority_id: priorityId || null,
                              area_id: areaId || null,
                              asset_id: assetId || null,
                            }),
                          () => setEditing(false)
                        )
                      }
                    >
                      Save review
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  Set the priority, correct the category, or link an area/asset before creating a work order.
                </p>
              )}
            </section>
          )}

          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Attachments</h2>
            <AttachmentsPanel
              kind="fm"
              parentId={request.id}
              organizationId={organizationId}
              attachments={attachments}
              canManage={isManager || isOwnerRequester}
            />
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Comments</h2>
            <CommentThread
              comments={comments}
              canPostPublic={isManager || isOwnerRequester}
              canPostInternal={isManager}
              onSubmit={(body, isInternal) => addRequestComment(request.id, body, isInternal)}
            />
          </section>
        </div>

        <div className="space-y-5">
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Work order</h2>
            {request.work_order ? (
              <Link
                href={`/work-orders/${request.work_order.id}`}
                className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 hover:bg-slate-50"
              >
                <span className="text-sm font-medium text-slate-900">
                  {request.work_order.work_order_number}
                </span>
                <WorkOrderStatusBadge status={request.work_order.status} />
              </Link>
            ) : (
              <p className="text-sm text-slate-500">No work order has been created yet.</p>
            )}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Activity</h2>
            <ActivityTimeline items={activity} />
          </section>
        </div>
      </div>

      <ReasonDialog
        open={rejectOpen}
        title="Reject request"
        description="Explain why this request is being rejected. The requester can see this."
        confirmLabel="Reject request"
        value={reason}
        onChange={setReason}
        pending={pending}
        onClose={() => setRejectOpen(false)}
        onConfirm={() => run(() => rejectRequest(request.id, reason), () => setRejectOpen(false))}
      />
      <ReasonDialog
        open={cancelOpen}
        title="Cancel request"
        description="Provide a reason for cancelling this request."
        confirmLabel="Cancel request"
        value={reason}
        onChange={setReason}
        pending={pending}
        onClose={() => setCancelOpen(false)}
        onConfirm={() => run(() => cancelRequest(request.id, reason), () => setCancelOpen(false))}
      />
    </div>
  );
}

function ReasonDialog({
  open,
  title,
  description,
  confirmLabel,
  value,
  onChange,
  pending,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  value: string;
  onChange: (v: string) => void;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant="destructive" size="sm" onClick={onConfirm} isLoading={pending} disabled={!value.trim()}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <Textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} placeholder="Reason..." />
    </Dialog>
  );
}

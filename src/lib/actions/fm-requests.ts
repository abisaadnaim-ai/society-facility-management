"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import {
  getActionContext,
  friendlyDbError,
  logActionError,
  type ActionResult,
} from "@/lib/actions/context";

async function reqStatusId(
  supabase: SupabaseClient<Database>,
  code: string
): Promise<string | null> {
  const { data } = await supabase
    .from("fm_request_statuses")
    .select("id")
    .eq("code", code)
    .maybeSingle();
  return data?.id ?? null;
}

export type FmRequestInput = {
  title: string;
  description: string | null;
  category_id: string;
  location_id: string;
  area_id: string | null;
  asset_id: string | null;
  exact_location_notes: string | null;
  priority_id: string | null;
};

function validate(input: FmRequestInput): string | null {
  if (!input.title.trim()) return "A short title for the issue is required.";
  if (!input.location_id) return "Location is required.";
  if (!input.category_id) return "Category is required.";
  return null;
}

export async function createFmRequest(
  input: FmRequestInput
): Promise<ActionResult<{ id: string }>> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;

  const validationError = validate(input);
  if (validationError) return { ok: false, error: validationError };

  const statusId = await reqStatusId(ctx.supabase, "new");
  if (!statusId) return { ok: false, error: "Request statuses are not configured." };

  // The official priority is set by a Facility Manager / Super Admin during
  // review -- never by a requester. Enforce this on the server so a modified
  // client request cannot smuggle a priority through, regardless of the UI.
  const roleCode = ctx.profile.role?.code ?? null;
  const canSetPriority = roleCode === "super_admin" || roleCode === "facility_manager";
  const priorityId = canSetPriority ? input.priority_id || null : null;

  const { data, error } = await ctx.supabase
    .from("fm_requests")
    .insert({
      organization_id: ctx.profile.organization_id,
      location_id: input.location_id,
      area_id: input.area_id || null,
      asset_id: input.asset_id || null,
      category_id: input.category_id,
      priority_id: priorityId,
      status_id: statusId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      exact_location_notes: input.exact_location_notes?.trim() || null,
      requested_by: ctx.profile.id,
    })
    .select("id")
    .single();

  if (error) {
    logActionError("createFmRequest", error);
    return { ok: false, error: friendlyDbError(error.message) };
  }

  const { error: logError } = await ctx.supabase.rpc("log_fm_request_activity", {
    p_request_id: data.id,
    p_action: "created",
  });
  if (logError) logActionError("createFmRequest.activity", logError);

  revalidatePath("/fm-requests");
  revalidatePath("/dashboard");
  return { ok: true, data: { id: data.id } };
}

export async function startReview(id: string): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;

  const statusId = await reqStatusId(ctx.supabase, "under_review");
  if (!statusId) return { ok: false, error: "Request statuses are not configured." };

  const { error } = await ctx.supabase
    .from("fm_requests")
    .update({
      status_id: statusId,
      reviewed_by: ctx.profile.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { ok: false, error: friendlyDbError(error.message) };

  await ctx.supabase.rpc("log_fm_request_activity", {
    p_request_id: id,
    p_action: "review_started",
    p_field_name: "status",
    p_new_value: "under_review",
  });

  revalidatePath(`/fm-requests/${id}`);
  revalidatePath("/fm-requests");
  return { ok: true, data: undefined };
}

export type ReviewUpdate = {
  category_id?: string;
  priority_id?: string | null;
  area_id?: string | null;
  asset_id?: string | null;
};

export async function updateReview(
  id: string,
  update: ReviewUpdate
): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;

  const { data: before } = await ctx.supabase
    .from("fm_requests")
    .select("category_id, priority_id, area_id, asset_id")
    .eq("id", id)
    .maybeSingle();

  const patch: {
    category_id?: string;
    priority_id?: string | null;
    area_id?: string | null;
    asset_id?: string | null;
  } = {};
  if (update.category_id !== undefined) patch.category_id = update.category_id;
  if (update.priority_id !== undefined) patch.priority_id = update.priority_id || null;
  if (update.area_id !== undefined) patch.area_id = update.area_id || null;
  if (update.asset_id !== undefined) patch.asset_id = update.asset_id || null;

  if (Object.keys(patch).length === 0) return { ok: true, data: undefined };

  const { error } = await ctx.supabase.from("fm_requests").update(patch).eq("id", id);
  if (error) return { ok: false, error: friendlyDbError(error.message) };

  // Log each meaningful change.
  if (before) {
    const b = before as Record<string, string | null>;
    for (const [field, value] of Object.entries(patch)) {
      if (b[field] !== value) {
        await ctx.supabase.rpc("log_fm_request_activity", {
          p_request_id: id,
          p_action: field === "priority_id" ? "priority_set" : `${field.replace("_id", "")}_changed`,
          p_field_name: field,
          p_old_value: b[field] ?? undefined,
          p_new_value: value ?? undefined,
        });
      }
    }
  }

  revalidatePath(`/fm-requests/${id}`);
  return { ok: true, data: undefined };
}

export async function addRequestComment(
  id: string,
  body: string,
  isInternal: boolean
): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  if (!body.trim()) return { ok: false, error: "Comment cannot be empty." };

  const { error } = await ctx.supabase.from("fm_request_comments").insert({
    organization_id: ctx.profile.organization_id,
    request_id: id,
    author_id: ctx.profile.id,
    body: body.trim(),
    is_internal: isInternal,
  });

  if (error) return { ok: false, error: friendlyDbError(error.message) };

  revalidatePath(`/fm-requests/${id}`);
  return { ok: true, data: undefined };
}

export async function rejectRequest(
  id: string,
  reason: string
): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  if (!reason.trim()) return { ok: false, error: "A rejection reason is required." };

  const statusId = await reqStatusId(ctx.supabase, "rejected");
  if (!statusId) return { ok: false, error: "Request statuses are not configured." };

  const { error } = await ctx.supabase
    .from("fm_requests")
    .update({
      status_id: statusId,
      rejection_reason: reason.trim(),
      reviewed_by: ctx.profile.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { ok: false, error: friendlyDbError(error.message) };

  await ctx.supabase.rpc("log_fm_request_activity", {
    p_request_id: id,
    p_action: "rejected",
    p_field_name: "status",
    p_new_value: "rejected",
    p_metadata: { reason: reason.trim() },
  });

  revalidatePath(`/fm-requests/${id}`);
  revalidatePath("/fm-requests");
  return { ok: true, data: undefined };
}

export async function cancelRequest(
  id: string,
  reason: string
): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  if (!reason.trim()) return { ok: false, error: "A cancellation reason is required." };

  const statusId = await reqStatusId(ctx.supabase, "cancelled");
  if (!statusId) return { ok: false, error: "Request statuses are not configured." };

  const { error } = await ctx.supabase
    .from("fm_requests")
    .update({ status_id: statusId, cancellation_reason: reason.trim() })
    .eq("id", id);

  if (error) return { ok: false, error: friendlyDbError(error.message) };

  await ctx.supabase.rpc("log_fm_request_activity", {
    p_request_id: id,
    p_action: "cancelled",
    p_field_name: "status",
    p_new_value: "cancelled",
    p_metadata: { reason: reason.trim() },
  });

  revalidatePath(`/fm-requests/${id}`);
  revalidatePath("/fm-requests");
  return { ok: true, data: undefined };
}

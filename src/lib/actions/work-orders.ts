"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { getActionContext, friendlyDbError, type ActionResult } from "@/lib/actions/context";

async function woStatusId(
  supabase: SupabaseClient<Database>,
  code: string
): Promise<string | null> {
  const { data } = await supabase
    .from("work_order_statuses")
    .select("id")
    .eq("code", code)
    .maybeSingle();
  return data?.id ?? null;
}

export type WorkOrderCreateInput = {
  fm_request_id: string | null;
  title: string;
  description: string | null;
  location_id: string;
  area_id: string | null;
  asset_id: string | null;
  category_id: string;
  priority_id: string;
  assigned_to: string | null;
  due_date: string | null;
};

function validateCreate(input: WorkOrderCreateInput): string | null {
  if (!input.title.trim()) return "A title is required.";
  if (!input.location_id) return "Location is required.";
  if (!input.category_id) return "Category is required.";
  if (!input.priority_id) return "Priority is required.";
  return null;
}

/**
 * Creates a work order, either from an FM request (fm_request_id set, which the
 * DB trigger uses to move the request to "Work Order Created") or directly.
 */
export async function createWorkOrder(
  input: WorkOrderCreateInput
): Promise<ActionResult<{ id: string }>> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;

  const validationError = validateCreate(input);
  if (validationError) return { ok: false, error: validationError };

  const startCode = input.assigned_to ? "assigned" : "new";
  const statusId = await woStatusId(ctx.supabase, startCode);
  if (!statusId) return { ok: false, error: "Work order statuses are not configured." };

  const { data, error } = await ctx.supabase
    .from("work_orders")
    .insert({
      organization_id: ctx.profile.organization_id,
      fm_request_id: input.fm_request_id || null,
      location_id: input.location_id,
      area_id: input.area_id || null,
      asset_id: input.asset_id || null,
      category_id: input.category_id,
      priority_id: input.priority_id,
      status_id: statusId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      assigned_to: input.assigned_to || null,
      due_date: input.due_date || null,
      created_by: ctx.profile.id,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: friendlyDbError(error.message) };

  await ctx.supabase.rpc("log_work_order_activity", {
    p_work_order_id: data.id,
    p_action: "created",
    p_metadata: input.fm_request_id ? { from_request: input.fm_request_id } : undefined,
  });
  if (input.assigned_to) {
    await ctx.supabase.rpc("log_work_order_activity", {
      p_work_order_id: data.id,
      p_action: "assigned",
      p_field_name: "assigned_to",
      p_new_value: input.assigned_to,
    });
  }

  revalidatePath("/work-orders");
  revalidatePath("/dashboard");
  if (input.fm_request_id) revalidatePath(`/fm-requests/${input.fm_request_id}`);
  return { ok: true, data: { id: data.id } };
}

export async function assignTechnician(
  id: string,
  technicianId: string
): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  if (!technicianId) return { ok: false, error: "Choose a technician to assign." };

  const { data: before } = await ctx.supabase
    .from("work_orders")
    .select("assigned_to, status_id, status:status_id(code)")
    .eq("id", id)
    .maybeSingle();
  const beforeAssigned = (before as { assigned_to: string | null } | null)?.assigned_to ?? null;
  const beforeCode = (before as unknown as { status: { code: string } | null } | null)?.status?.code;

  const patch: { assigned_to: string; status_id?: string } = { assigned_to: technicianId };
  // Moving from new -> assigned when first assigned.
  if (beforeCode === "new") {
    const assignedId = await woStatusId(ctx.supabase, "assigned");
    if (assignedId) patch.status_id = assignedId;
  }

  const { error } = await ctx.supabase.from("work_orders").update(patch).eq("id", id);
  if (error) return { ok: false, error: friendlyDbError(error.message) };

  await ctx.supabase.rpc("log_work_order_activity", {
    p_work_order_id: id,
    p_action: beforeAssigned ? "reassigned" : "assigned",
    p_field_name: "assigned_to",
    p_old_value: beforeAssigned ?? undefined,
    p_new_value: technicianId,
  });

  revalidatePath(`/work-orders/${id}`);
  revalidatePath("/work-orders");
  return { ok: true, data: undefined };
}

/**
 * Change operational status. Used by technicians (their allowed transitions) and
 * managers (broader operational set). Completion requires notes. The DB trigger
 * enforces the real limits and stamps started_at/completed_at.
 */
export async function changeWorkOrderStatus(
  id: string,
  targetStatusCode: string,
  completionNotes?: string
): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;

  const statusId = await woStatusId(ctx.supabase, targetStatusCode);
  if (!statusId) return { ok: false, error: "That status is not configured." };

  const { data: before } = await ctx.supabase
    .from("work_orders")
    .select("status:status_id(code)")
    .eq("id", id)
    .maybeSingle();
  const oldCode = (before as unknown as { status: { code: string } | null } | null)?.status?.code ?? null;

  const patch: { status_id: string; completion_notes?: string } = { status_id: statusId };
  if (targetStatusCode === "completed") {
    if (!completionNotes || !completionNotes.trim())
      return { ok: false, error: "Completion notes are required to complete the job." };
    patch.completion_notes = completionNotes.trim();
  }

  const { error } = await ctx.supabase.from("work_orders").update(patch).eq("id", id);
  if (error) return { ok: false, error: friendlyDbError(error.message) };

  await ctx.supabase.rpc("log_work_order_activity", {
    p_work_order_id: id,
    p_action: targetStatusCode === "completed" ? "completed" : "status_changed",
    p_field_name: "status",
    p_old_value: oldCode ?? undefined,
    p_new_value: targetStatusCode,
  });

  revalidatePath(`/work-orders/${id}`);
  revalidatePath("/work-orders");
  revalidatePath("/dashboard");
  return { ok: true, data: undefined };
}

export async function verifyWorkOrder(
  id: string,
  notes: string | null,
  alsoClose: boolean
): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;

  const verifiedId = await woStatusId(ctx.supabase, "verified");
  if (!verifiedId) return { ok: false, error: "Work order statuses are not configured." };

  const { error } = await ctx.supabase
    .from("work_orders")
    .update({ status_id: verifiedId, verification_notes: notes?.trim() || null })
    .eq("id", id);
  if (error) return { ok: false, error: friendlyDbError(error.message) };

  await ctx.supabase.rpc("log_work_order_activity", {
    p_work_order_id: id,
    p_action: "verified",
    p_field_name: "status",
    p_new_value: "verified",
  });

  if (alsoClose) {
    const closedId = await woStatusId(ctx.supabase, "closed");
    if (closedId) {
      const { error: closeErr } = await ctx.supabase
        .from("work_orders")
        .update({ status_id: closedId })
        .eq("id", id);
      if (closeErr) return { ok: false, error: friendlyDbError(closeErr.message) };
      await ctx.supabase.rpc("log_work_order_activity", {
        p_work_order_id: id,
        p_action: "closed",
        p_field_name: "status",
        p_new_value: "closed",
      });
    }
  }

  revalidatePath(`/work-orders/${id}`);
  revalidatePath("/work-orders");
  revalidatePath("/dashboard");
  return { ok: true, data: undefined };
}

export async function returnToTechnician(
  id: string,
  reason: string
): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  if (!reason.trim()) return { ok: false, error: "Please explain what needs more work." };

  const inProgressId = await woStatusId(ctx.supabase, "in_progress");
  if (!inProgressId) return { ok: false, error: "Work order statuses are not configured." };

  const { error } = await ctx.supabase
    .from("work_orders")
    .update({ status_id: inProgressId })
    .eq("id", id);
  if (error) return { ok: false, error: friendlyDbError(error.message) };

  await ctx.supabase.rpc("log_work_order_activity", {
    p_work_order_id: id,
    p_action: "returned_to_technician",
    p_field_name: "status",
    p_new_value: "in_progress",
    p_metadata: { reason: reason.trim() },
  });

  revalidatePath(`/work-orders/${id}`);
  revalidatePath("/work-orders");
  return { ok: true, data: undefined };
}

export async function closeWorkOrder(id: string): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;

  const closedId = await woStatusId(ctx.supabase, "closed");
  if (!closedId) return { ok: false, error: "Work order statuses are not configured." };

  const { error } = await ctx.supabase
    .from("work_orders")
    .update({ status_id: closedId })
    .eq("id", id);
  if (error) return { ok: false, error: friendlyDbError(error.message) };

  await ctx.supabase.rpc("log_work_order_activity", {
    p_work_order_id: id,
    p_action: "closed",
    p_field_name: "status",
    p_new_value: "closed",
  });

  revalidatePath(`/work-orders/${id}`);
  revalidatePath("/work-orders");
  revalidatePath("/dashboard");
  return { ok: true, data: undefined };
}

export async function cancelWorkOrder(
  id: string,
  reason: string
): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  if (!reason.trim()) return { ok: false, error: "A cancellation reason is required." };

  const cancelledId = await woStatusId(ctx.supabase, "cancelled");
  if (!cancelledId) return { ok: false, error: "Work order statuses are not configured." };

  const { error } = await ctx.supabase
    .from("work_orders")
    .update({ status_id: cancelledId, cancellation_reason: reason.trim() })
    .eq("id", id);
  if (error) return { ok: false, error: friendlyDbError(error.message) };

  await ctx.supabase.rpc("log_work_order_activity", {
    p_work_order_id: id,
    p_action: "cancelled",
    p_field_name: "status",
    p_new_value: "cancelled",
    p_metadata: { reason: reason.trim() },
  });

  revalidatePath(`/work-orders/${id}`);
  revalidatePath("/work-orders");
  return { ok: true, data: undefined };
}

export async function addWorkOrderComment(
  id: string,
  body: string,
  isInternal: boolean
): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  if (!body.trim()) return { ok: false, error: "Comment cannot be empty." };

  const { error } = await ctx.supabase.from("work_order_comments").insert({
    organization_id: ctx.profile.organization_id,
    work_order_id: id,
    author_id: ctx.profile.id,
    body: body.trim(),
    is_internal: isInternal,
  });
  if (error) return { ok: false, error: friendlyDbError(error.message) };

  revalidatePath(`/work-orders/${id}`);
  return { ok: true, data: undefined };
}

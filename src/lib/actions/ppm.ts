"use server";

import { revalidatePath } from "next/cache";
import { getActionContext, friendlyDbError, logActionError, type ActionResult } from "@/lib/actions/context";

export type PpmTaskInput = {
  task_description: string;
  instructions: string | null;
  is_required: boolean;
};

export type PpmPlanCreateInput = {
  asset_id: string;
  category_id: string;
  name: string;
  description: string | null;
  maintenance_instructions: string | null;
  priority_id: string;
  frequency_unit: string;
  frequency_interval: number;
  start_date: string;
  lead_time_days: number;
  estimated_duration_minutes: number | null;
  due_window_days: number | null;
  default_assigned_to: string | null;
  tasks: PpmTaskInput[];
};

function validatePlan(input: PpmPlanCreateInput): string | null {
  if (!input.name.trim()) return "A plan name is required.";
  if (!input.asset_id) return "An asset is required.";
  if (!input.category_id) return "A category is required.";
  if (!input.priority_id) return "A priority is required.";
  if (!["day", "week", "month", "year"].includes(input.frequency_unit)) return "Invalid frequency.";
  if (!Number.isInteger(input.frequency_interval) || input.frequency_interval < 1) return "Frequency interval must be a positive whole number.";
  if (!input.start_date) return "A start date is required.";
  if (input.lead_time_days < 0) return "Lead time cannot be negative.";
  return null;
}

export async function createPpmPlan(
  input: PpmPlanCreateInput
): Promise<ActionResult<{ id: string }>> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;

  const validationError = validatePlan(input);
  if (validationError) return { ok: false, error: validationError };

  // next_due_date starts at the plan start date (the first occurrence). The
  // after-insert trigger creates that occurrence and logs plan_created.
  const { data, error } = await ctx.supabase
    .from("ppm_plans")
    .insert({
      organization_id: ctx.profile.organization_id,
      asset_id: input.asset_id,
      category_id: input.category_id,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      maintenance_instructions: input.maintenance_instructions?.trim() || null,
      priority_id: input.priority_id,
      frequency_unit: input.frequency_unit,
      frequency_interval: input.frequency_interval,
      start_date: input.start_date,
      next_due_date: input.start_date,
      lead_time_days: input.lead_time_days,
      estimated_duration_minutes: input.estimated_duration_minutes,
      due_window_days: input.due_window_days,
      default_assigned_to: input.default_assigned_to || null,
      created_by: ctx.profile.id,
    })
    .select("id")
    .single();

  if (error) {
    logActionError("createPpmPlan", error);
    return { ok: false, error: friendlyDbError(error.message) };
  }

  const cleanTasks = input.tasks
    .map((t, i) => ({
      organization_id: ctx.profile.organization_id,
      ppm_plan_id: data.id,
      task_description: t.task_description.trim(),
      instructions: t.instructions?.trim() || null,
      is_required: t.is_required,
      sort_order: i + 1,
    }))
    .filter((t) => t.task_description.length > 0);

  if (cleanTasks.length) {
    const { error: taskError } = await ctx.supabase.from("ppm_plan_tasks").insert(cleanTasks);
    if (taskError) {
      logActionError("createPpmPlan.tasks", taskError);
      // Plan exists; surface a soft error so the user can add tasks on the detail page.
      return { ok: false, error: "The plan was created, but its tasks could not be saved. Please add them from the plan page." };
    }
  }

  revalidatePath("/preventive-maintenance");
  revalidatePath("/dashboard");
  return { ok: true, data: { id: data.id } };
}

export type PpmPlanUpdateInput = {
  name: string;
  description: string | null;
  maintenance_instructions: string | null;
  priority_id: string;
  lead_time_days: number;
  estimated_duration_minutes: number | null;
  due_window_days: number | null;
  default_assigned_to: string | null;
};

export async function updatePpmPlan(
  id: string,
  input: PpmPlanUpdateInput
): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  if (!input.name.trim()) return { ok: false, error: "A plan name is required." };

  const { error } = await ctx.supabase
    .from("ppm_plans")
    .update({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      maintenance_instructions: input.maintenance_instructions?.trim() || null,
      priority_id: input.priority_id,
      lead_time_days: input.lead_time_days,
      estimated_duration_minutes: input.estimated_duration_minutes,
      due_window_days: input.due_window_days,
      default_assigned_to: input.default_assigned_to || null,
    })
    .eq("id", id);
  if (error) {
    logActionError("updatePpmPlan", error);
    return { ok: false, error: friendlyDbError(error.message) };
  }
  revalidatePath(`/preventive-maintenance/${id}`);
  revalidatePath("/preventive-maintenance");
  return { ok: true, data: undefined };
}

// ---- Plan task template management (affects FUTURE occurrences only) ----
export async function addPpmTask(
  planId: string,
  input: PpmTaskInput
): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  if (!input.task_description.trim()) return { ok: false, error: "A task description is required." };

  const { data: last } = await ctx.supabase
    .from("ppm_plan_tasks")
    .select("sort_order")
    .eq("ppm_plan_id", planId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSort = ((last as { sort_order: number } | null)?.sort_order ?? 0) + 1;

  const { error } = await ctx.supabase.from("ppm_plan_tasks").insert({
    organization_id: ctx.profile.organization_id,
    ppm_plan_id: planId,
    task_description: input.task_description.trim(),
    instructions: input.instructions?.trim() || null,
    is_required: input.is_required,
    sort_order: nextSort,
  });
  if (error) {
    logActionError("addPpmTask", error);
    return { ok: false, error: friendlyDbError(error.message) };
  }
  revalidatePath(`/preventive-maintenance/${planId}`);
  return { ok: true, data: undefined };
}

export async function updatePpmTask(
  planId: string,
  taskId: string,
  input: PpmTaskInput
): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  if (!input.task_description.trim()) return { ok: false, error: "A task description is required." };
  const { error } = await ctx.supabase
    .from("ppm_plan_tasks")
    .update({
      task_description: input.task_description.trim(),
      instructions: input.instructions?.trim() || null,
      is_required: input.is_required,
    })
    .eq("id", taskId);
  if (error) {
    logActionError("updatePpmTask", error);
    return { ok: false, error: friendlyDbError(error.message) };
  }
  revalidatePath(`/preventive-maintenance/${planId}`);
  return { ok: true, data: undefined };
}

export async function deletePpmTask(planId: string, taskId: string): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  const { error } = await ctx.supabase.from("ppm_plan_tasks").delete().eq("id", taskId);
  if (error) {
    logActionError("deletePpmTask", error);
    return { ok: false, error: friendlyDbError(error.message) };
  }
  revalidatePath(`/preventive-maintenance/${planId}`);
  return { ok: true, data: undefined };
}

export async function reorderPpmTasks(planId: string, orderedIds: string[]): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await ctx.supabase
      .from("ppm_plan_tasks")
      .update({ sort_order: i + 1 })
      .eq("id", orderedIds[i]);
    if (error) {
      logActionError("reorderPpmTasks", error);
      return { ok: false, error: friendlyDbError(error.message) };
    }
  }
  revalidatePath(`/preventive-maintenance/${planId}`);
  return { ok: true, data: undefined };
}

// ---- Plan lifecycle + occurrence actions (call the gated SECURITY DEFINER RPCs) ----
export async function setPpmPlanStatus(
  id: string,
  status: "active" | "paused" | "archived"
): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  const { error } = await ctx.supabase.rpc("ppm_set_plan_status", { p_plan_id: id, p_status: status });
  if (error) {
    logActionError("setPpmPlanStatus", error);
    return { ok: false, error: friendlyDbError(error.message) };
  }
  revalidatePath(`/preventive-maintenance/${id}`);
  revalidatePath("/preventive-maintenance");
  return { ok: true, data: undefined };
}

export async function generatePpmWorkOrder(
  occurrenceId: string,
  planId: string
): Promise<ActionResult<{ workOrderId: string }>> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  const { data, error } = await ctx.supabase.rpc("ppm_generate_now", { p_occurrence_id: occurrenceId });
  if (error) {
    logActionError("generatePpmWorkOrder", error);
    return { ok: false, error: friendlyDbError(error.message) };
  }
  revalidatePath(`/preventive-maintenance/${planId}`);
  revalidatePath("/preventive-maintenance");
  revalidatePath("/work-orders");
  return { ok: true, data: { workOrderId: data as unknown as string } };
}

export async function skipPpmOccurrence(
  occurrenceId: string,
  planId: string,
  reason: string
): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  if (!reason.trim()) return { ok: false, error: "A reason is required to skip." };
  const { error } = await ctx.supabase.rpc("ppm_skip_occurrence", {
    p_occurrence_id: occurrenceId,
    p_reason: reason.trim(),
  });
  if (error) {
    logActionError("skipPpmOccurrence", error);
    return { ok: false, error: friendlyDbError(error.message) };
  }
  revalidatePath(`/preventive-maintenance/${planId}`);
  return { ok: true, data: undefined };
}

// ---- Technician / FM: mark a work-order maintenance task complete ----
export async function setWorkOrderTaskCompleted(
  taskId: string,
  workOrderId: string,
  isCompleted: boolean
): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  const { error } = await ctx.supabase
    .from("work_order_tasks")
    .update({
      is_completed: isCompleted,
      completed_by: isCompleted ? ctx.profile.id : null,
      completed_at: isCompleted ? new Date().toISOString() : null,
    })
    .eq("id", taskId);
  if (error) {
    logActionError("setWorkOrderTaskCompleted", error);
    return { ok: false, error: friendlyDbError(error.message) };
  }
  revalidatePath(`/work-orders/${workOrderId}`);
  return { ok: true, data: undefined };
}

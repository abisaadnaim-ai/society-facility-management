"use server";

import { revalidatePath } from "next/cache";
import { getActionContext, friendlyDbError, logActionError, type ActionResult } from "@/lib/actions/context";
import { ndb } from "@/lib/types/notifications";

export type SlaRuleInput = {
  name: string;
  priority_id: string;
  response_minutes: number;
  resolution_minutes: number;
  applies_to_request: boolean;
  applies_to_work_order: boolean;
  is_active: boolean;
  effective_from: string | null;
  effective_to: string | null;
};

function validate(input: SlaRuleInput): string | null {
  if (!input.name.trim()) return "A rule name is required.";
  if (!input.priority_id) return "A priority is required.";
  if (!Number.isFinite(input.response_minutes) || input.response_minutes <= 0)
    return "Response target must be greater than zero minutes.";
  if (!Number.isFinite(input.resolution_minutes) || input.resolution_minutes <= 0)
    return "Resolution target must be greater than zero minutes.";
  return null;
}

/**
 * Ensures at most one ACTIVE rule per priority (matches the partial unique
 * index). When a rule is being set active, any other active rule for the same
 * priority is deactivated first so the write never conflicts.
 */
async function deactivateOthers(
  ctx: Awaited<ReturnType<typeof getActionContext>> & { ok: true },
  priorityId: string,
  exceptId: string | null
) {
  let q = ndb(ctx.supabase)
    .from("fm_sla_rules")
    .update({ is_active: false })
    .eq("organization_id", ctx.profile.organization_id)
    .eq("priority_id", priorityId)
    .eq("is_active", true);
  if (exceptId) q = q.neq("id", exceptId);
  await q;
}

export async function createSlaRule(input: SlaRuleInput): Promise<ActionResult<{ id: string }>> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  const err = validate(input);
  if (err) return { ok: false, error: err };

  if (input.is_active) await deactivateOthers(ctx, input.priority_id, null);

  const { data, error } = await ndb(ctx.supabase)
    .from("fm_sla_rules")
    .insert({
      organization_id: ctx.profile.organization_id,
      name: input.name.trim(),
      priority_id: input.priority_id,
      response_minutes: input.response_minutes,
      resolution_minutes: input.resolution_minutes,
      applies_to_request: input.applies_to_request,
      applies_to_work_order: input.applies_to_work_order,
      is_active: input.is_active,
      effective_from: input.effective_from,
      effective_to: input.effective_to,
      is_sample_default: false,
      created_by: ctx.profile.id,
    })
    .select("id")
    .single();

  if (error) {
    logActionError("createSlaRule", error);
    return { ok: false, error: friendlyDbError(error.message) };
  }
  revalidatePath("/settings/sla-rules");
  return { ok: true, data: { id: (data as { id: string }).id } };
}

export async function updateSlaRule(id: string, input: SlaRuleInput): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  const err = validate(input);
  if (err) return { ok: false, error: err };

  if (input.is_active) await deactivateOthers(ctx, input.priority_id, id);

  const { error } = await ndb(ctx.supabase)
    .from("fm_sla_rules")
    .update({
      name: input.name.trim(),
      priority_id: input.priority_id,
      response_minutes: input.response_minutes,
      resolution_minutes: input.resolution_minutes,
      applies_to_request: input.applies_to_request,
      applies_to_work_order: input.applies_to_work_order,
      is_active: input.is_active,
      effective_from: input.effective_from,
      effective_to: input.effective_to,
    })
    .eq("id", id);

  if (error) {
    logActionError("updateSlaRule", error);
    return { ok: false, error: friendlyDbError(error.message) };
  }
  revalidatePath("/settings/sla-rules");
  return { ok: true, data: undefined };
}

/** Toggles a rule's active flag. Activating deactivates the priority's other active rule. */
export async function toggleSlaRuleActive(
  id: string,
  priorityId: string,
  makeActive: boolean
): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  if (makeActive) await deactivateOthers(ctx, priorityId, id);
  const { error } = await ndb(ctx.supabase)
    .from("fm_sla_rules")
    .update({ is_active: makeActive })
    .eq("id", id);
  if (error) {
    logActionError("toggleSlaRuleActive", error);
    return { ok: false, error: friendlyDbError(error.message) };
  }
  revalidatePath("/settings/sla-rules");
  return { ok: true, data: undefined };
}

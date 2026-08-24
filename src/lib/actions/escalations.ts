"use server";

import { revalidatePath } from "next/cache";
import { getActionContext, friendlyDbError, logActionError, type ActionResult } from "@/lib/actions/context";
import { ndb } from "@/lib/types/notifications";

/**
 * Acknowledges an escalation ("I have seen this"). This does NOT resolve the
 * underlying Work Order / FM Request — escalation status and entity status stay
 * separate (§33). RLS restricts this to Facility Manager / Super Admin.
 */
export async function acknowledgeEscalation(id: string): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  const { error } = await ndb(ctx.supabase)
    .from("fm_escalations")
    .update({ acknowledged_by: ctx.profile.id, acknowledged_at: new Date().toISOString() })
    .eq("id", id)
    .is("acknowledged_at", null);
  if (error) {
    logActionError("acknowledgeEscalation", error);
    return { ok: false, error: friendlyDbError(error.message) };
  }
  revalidatePath("/work-orders");
  revalidatePath("/dashboard");
  return { ok: true, data: undefined };
}

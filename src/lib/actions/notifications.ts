"use server";

import { revalidatePath } from "next/cache";
import { getActionContext, friendlyDbError, logActionError, type ActionResult } from "@/lib/actions/context";
import { ndb } from "@/lib/types/notifications";

/** Marks one of the current user's notifications as read. RLS + column grants
 *  ensure a user can only touch read_at/dismissed_at on their own rows. */
export async function markNotificationRead(id: string): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  const { error } = await ndb(ctx.supabase)
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", ctx.profile.id)
    .is("read_at", null);
  if (error) {
    logActionError("markNotificationRead", error);
    return { ok: false, error: friendlyDbError(error.message) };
  }
  revalidatePath("/notifications");
  return { ok: true, data: undefined };
}

/** Marks all of the current user's unread notifications as read. */
export async function markAllNotificationsRead(): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  const { error } = await ndb(ctx.supabase)
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", ctx.profile.id)
    .is("read_at", null);
  if (error) {
    logActionError("markAllNotificationsRead", error);
    return { ok: false, error: friendlyDbError(error.message) };
  }
  revalidatePath("/notifications");
  return { ok: true, data: undefined };
}

/** Dismisses a notification from the user's active list (no physical delete §24). */
export async function dismissNotification(id: string): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  const now = new Date().toISOString();
  const { error } = await ndb(ctx.supabase)
    .from("notifications")
    .update({ dismissed_at: now, read_at: now })
    .eq("id", id)
    .eq("user_id", ctx.profile.id)
    .is("dismissed_at", null);
  if (error) {
    logActionError("dismissNotification", error);
    return { ok: false, error: friendlyDbError(error.message) };
  }
  revalidatePath("/notifications");
  return { ok: true, data: undefined };
}

"use server";

import { revalidatePath } from "next/cache";
import {
  getActionContext,
  friendlyDbError,
  logActionError,
  type ActionResult,
} from "@/lib/actions/context";

/** Every action here requires an active Super Admin. This mirrors the check
 *  inside the admin_* SQL functions (which are the real boundary) and lets us
 *  fail fast with a clean message before calling the database. */
async function requireSuperAdmin() {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  if (ctx.profile.role?.code !== "super_admin") {
    return { ok: false as const, error: "Only a Super Admin can manage users." };
  }
  return ctx;
}

export type InviteUserInput = {
  full_name: string;
  email: string;
  role_id: string;
  phone: string | null;
  job_title: string | null;
  primary_location_id: string | null;
  is_active: boolean;
};

export async function inviteUser(
  input: InviteUserInput
): Promise<ActionResult<{ userId: string; email: string; tempPassword: string }>> {
  const ctx = await requireSuperAdmin();
  if (!ctx.ok) return ctx;

  if (!input.full_name.trim()) return { ok: false, error: "Full name is required." };
  if (!input.email.trim()) return { ok: false, error: "Email is required." };
  if (!input.role_id) return { ok: false, error: "A role is required." };

  const { data, error } = await ctx.supabase.rpc("admin_invite_user", {
    p_full_name: input.full_name,
    p_email: input.email,
    p_role_id: input.role_id,
    p_phone: input.phone,
    p_job_title: input.job_title,
    p_primary_location_id: input.primary_location_id,
    p_is_active: input.is_active,
  });
  if (error) {
    logActionError("inviteUser", error);
    return { ok: false, error: friendlyDbError(error.message) };
  }
  const res = data as unknown as { user_id: string; email: string; temp_password: string };
  revalidatePath("/settings/users");
  return {
    ok: true,
    data: { userId: res.user_id, email: res.email, tempPassword: res.temp_password },
  };
}

export type UpdateUserInput = {
  user_id: string;
  full_name: string;
  phone: string | null;
  job_title: string | null;
  role_id: string;
  primary_location_id: string | null;
  is_active: boolean;
};

export async function updateUser(input: UpdateUserInput): Promise<ActionResult> {
  const ctx = await requireSuperAdmin();
  if (!ctx.ok) return ctx;
  if (!input.full_name.trim()) return { ok: false, error: "Full name cannot be empty." };
  if (!input.role_id) return { ok: false, error: "A role is required." };

  const { error } = await ctx.supabase.rpc("admin_update_user", {
    p_user_id: input.user_id,
    p_full_name: input.full_name,
    p_phone: input.phone,
    p_job_title: input.job_title,
    p_role_id: input.role_id,
    p_primary_location_id: input.primary_location_id,
    p_is_active: input.is_active,
  });
  if (error) {
    logActionError("updateUser", error);
    return { ok: false, error: friendlyDbError(error.message) };
  }
  revalidatePath("/settings/users");
  revalidatePath(`/settings/users/${input.user_id}`);
  return { ok: true, data: undefined };
}

export async function setUserActive(
  userId: string,
  isActive: boolean,
  current: UpdateUserInput
): Promise<ActionResult> {
  // Deactivation/activation goes through the same guarded update path so the
  // last-Super-Admin protection and audit logging apply consistently.
  return updateUser({ ...current, user_id: userId, is_active: isActive });
}

export async function resetUserPassword(
  userId: string
): Promise<ActionResult<{ tempPassword: string }>> {
  const ctx = await requireSuperAdmin();
  if (!ctx.ok) return ctx;
  const { data, error } = await ctx.supabase.rpc("admin_reset_password", {
    p_user_id: userId,
  });
  if (error) {
    logActionError("resetUserPassword", error);
    return { ok: false, error: friendlyDbError(error.message) };
  }
  const res = data as unknown as { temp_password: string };
  return { ok: true, data: { tempPassword: res.temp_password } };
}

export async function changeUserEmail(
  userId: string,
  email: string
): Promise<ActionResult<{ email: string }>> {
  const ctx = await requireSuperAdmin();
  if (!ctx.ok) return ctx;
  if (!email.trim()) return { ok: false, error: "Email is required." };
  const { data, error } = await ctx.supabase.rpc("admin_change_email", {
    p_user_id: userId,
    p_email: email,
  });
  if (error) {
    logActionError("changeUserEmail", error);
    return { ok: false, error: friendlyDbError(error.message) };
  }
  const res = data as unknown as { email: string };
  revalidatePath("/settings/users");
  revalidatePath(`/settings/users/${userId}`);
  return { ok: true, data: { email: res.email } };
}

"use server";

import { revalidatePath } from "next/cache";
import {
  getActionContext,
  friendlyDbError,
  logActionError,
  type ActionResult,
} from "@/lib/actions/context";
import { createAdminClient } from "@/lib/supabase/admin";

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

/**
 * PROTOTYPE user creation (CEO review). Creates a pre-confirmed Supabase Auth
 * user via the Admin API using a Super-Admin-supplied temporary password, then
 * applies the chosen role/location/details to the auto-created profile.
 *
 * - Requires an active Super Admin (enforced here on the server, in addition to
 *   the page-level UI guard).
 * - Uses the service-role key strictly on the server (see createAdminClient).
 * - `email_confirm: true` so the user can sign in immediately with no email.
 * - The temporary password is passed ONLY to the Auth Admin API. It is never
 *   stored in profiles, the database, the audit log, or the server logs, and is
 *   never returned to the client.
 */
export type CreateUserInput = {
  full_name: string;
  email: string;
  password: string;
  confirm_password: string;
  role_id: string;
  phone: string | null;
  job_title: string | null;
  primary_location_id: string | null;
  is_active: boolean;
};

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function createUserWithPassword(
  input: CreateUserInput
): Promise<ActionResult<{ userId: string; email: string }>> {
  const ctx = await requireSuperAdmin();
  if (!ctx.ok) return ctx;

  const fullName = input.full_name.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (!fullName) return { ok: false, error: "Full name is required." };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Please enter a valid email address." };
  if (!input.role_id) return { ok: false, error: "A role is required." };
  if (!password || password.length < 8) {
    return { ok: false, error: "Temporary password must be at least 8 characters." };
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return { ok: false, error: "Temporary password must include at least one letter and one number." };
  }
  if (password !== input.confirm_password) {
    return { ok: false, error: "The temporary passwords do not match." };
  }

  const orgId = ctx.profile.organization_id;

  // Validate the role and (optional) location against the caller's organization,
  // using the RLS-scoped client so the Super Admin can only reference their org.
  const { data: role } = await ctx.supabase
    .from("roles").select("id").eq("id", input.role_id).maybeSingle();
  if (!role) return { ok: false, error: "The selected role is invalid." };
  if (input.primary_location_id) {
    const { data: loc } = await ctx.supabase
      .from("locations").select("id")
      .eq("id", input.primary_location_id).eq("organization_id", orgId).maybeSingle();
    if (!loc) return { ok: false, error: "The selected primary location is invalid." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    // Do not log the password or key. Only a generic server-side note.
    logActionError("createUserWithPassword", { message: "SUPABASE_SERVICE_ROLE_KEY is not configured." });
    return {
      ok: false,
      error:
        "User creation is not configured on the server yet. Add the SUPABASE_SERVICE_ROLE_KEY environment variable in the deployment settings and try again.",
    };
  }

  // 1) Create the Auth user, pre-confirmed so no confirmation email is needed.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (createErr) {
    const msg = (createErr.message || "").toLowerCase();
    if (msg.includes("already") && (msg.includes("regist") || msg.includes("exist"))) {
      return { ok: false, error: "A user with this email already exists." };
    }
    if (msg.includes("password")) {
      return { ok: false, error: "That temporary password was rejected. Please choose a stronger one." };
    }
    logActionError("createUserWithPassword", { message: createErr.message });
    return { ok: false, error: "Could not create the user. Please try again." };
  }

  const newUserId = created.user?.id;
  if (!newUserId) return { ok: false, error: "The user was not created. Please try again." };

  // 2) handle_new_user has created a default (viewer) profile for this auth user.
  //    Apply the selected role/location/details. Service-role bypasses RLS, so we
  //    scope explicitly to the Super Admin's organization.
  const { error: profileErr } = await admin
    .from("profiles")
    .update({
      full_name: fullName,
      role_id: input.role_id,
      primary_location_id: input.primary_location_id,
      job_title: input.job_title,
      phone: input.phone,
      is_active: input.is_active,
      organization_id: orgId,
    })
    .eq("id", newUserId);

  if (profileErr) {
    // Roll back so we never leave an orphaned/misconfigured auth account.
    await admin.auth.admin.deleteUser(newUserId).catch(() => {});
    logActionError("createUserWithPassword", profileErr);
    return { ok: false, error: "The account was created but its profile could not be set. Please try again." };
  }

  revalidatePath("/settings/users");
  return { ok: true, data: { userId: newUserId, email } };
}

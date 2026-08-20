import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/queries/get-session-profile";
import type { SessionProfile } from "@/lib/types/auth";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Resolves the current session + a server Supabase client for use inside a
 * Server Action. Returns an error result if there's no valid, active session.
 * The Supabase client here is the RLS-scoped anon client bound to the user's
 * cookies -- NOT the service role -- so every write is still checked by RLS
 * server-side. We never use the service-role key anywhere in the app.
 */
export async function getActionContext(): Promise<
  | { ok: true; supabase: SupabaseClient<Database>; profile: SessionProfile }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "You must be signed in to do that." };

  const profile = await getSessionProfile(supabase, user.id);
  if (!profile) return { ok: false, error: "Your profile could not be loaded." };
  if (!profile.is_active) return { ok: false, error: "Your account is inactive." };

  return { ok: true, supabase, profile };
}

/** Maps common Postgres/PostgREST errors to friendly messages. */
export function friendlyDbError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("duplicate key") || m.includes("already exists") || m.includes("unique")) {
    return "That already exists. Please use a different name or code.";
  }
  if (m.includes("row-level security") || m.includes("violates row-level") || m.includes("42501") || m.includes("insufficient")) {
    return "You don't have permission to do that.";
  }
  if (m.includes("does not belong") || m.includes("must match") || m.includes("must all belong")) {
    return message; // our own integrity messages are already user-friendly
  }
  if (m.includes("foreign key") || m.includes("still referenced") || m.includes("violates foreign key")) {
    return "This record is still in use and can't be removed. Deactivate it instead.";
  }
  return "Something went wrong. Please try again.";
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import type { SessionProfile } from "@/lib/types/auth";

/**
 * Fetches the current authenticated user's profile, joined with their role
 * and organization. Returns null if there is no session, or if the profile
 * row does not exist yet (e.g. the signup trigger hasn't run).
 *
 * RLS scopes this to the caller's own row automatically -- no explicit
 * `.eq("id", userId)` filtering is required for security, though we still
 * pass userId to make the query explicit and cache-friendly.
 */
export async function getSessionProfile(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<SessionProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*, role:roles(*), organization:organizations(*)")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("getSessionProfile: failed to load profile", error.message);
    return null;
  }

  return data as SessionProfile | null;
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import type {
  AdminUserRow,
  AdminUserDetail,
  RoleOption,
  LocationOption,
} from "@/lib/types/users";

/** Full org user list for the User Management table. Super Admin only (enforced
 *  inside admin_list_users; a non-admin caller gets an authorization error). */
export async function getUsers(
  supabase: SupabaseClient<Database>
): Promise<AdminUserRow[]> {
  const { data, error } = await supabase.rpc("admin_list_users");
  if (error) {
    console.error("getUsers failed:", error.message);
    return [];
  }
  return (data ?? []) as unknown as AdminUserRow[];
}

/** One user's detail with activity counts. Returns null if not found/authorized. */
export async function getUserDetail(
  supabase: SupabaseClient<Database>,
  id: string
): Promise<AdminUserDetail | null> {
  const { data, error } = await supabase.rpc("admin_get_user", { p_id: id });
  if (error) {
    console.error("getUserDetail failed:", error.message);
    return null;
  }
  const rows = (data ?? []) as unknown as AdminUserDetail[];
  return rows[0] ?? null;
}

/** All roles (id + human-readable name) for the role dropdown. */
export async function getRoleOptions(
  supabase: SupabaseClient<Database>
): Promise<RoleOption[]> {
  const { data, error } = await supabase
    .from("roles")
    .select("id, code, name")
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) {
    console.error("getRoleOptions failed:", error.message);
    return [];
  }
  return (data ?? []) as RoleOption[];
}

/** Active locations (id + name) for the Primary Location dropdown. */
export async function getLocationOptions(
  supabase: SupabaseClient<Database>
): Promise<LocationOption[]> {
  const { data, error } = await supabase
    .from("locations")
    .select("id, name")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) {
    console.error("getLocationOptions failed:", error.message);
    return [];
  }
  return (data ?? []) as LocationOption[];
}

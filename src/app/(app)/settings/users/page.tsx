import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/queries/get-session-profile";
import { isSuperAdmin } from "@/lib/auth/permissions";
import { getUsers, getRoleOptions, getLocationOptions } from "@/lib/queries/users";
import { UsersView } from "@/components/facility/users-view";

export default async function UsersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = user ? await getSessionProfile(supabase, user.id) : null;

  // User Management is Super Admin only, enforced here, in RLS, and inside the
  // admin_* SQL functions. A non-admin who navigates here is redirected.
  if (!isSuperAdmin(profile)) redirect("/dashboard");

  const [users, roles, locations] = await Promise.all([
    getUsers(supabase),
    getRoleOptions(supabase),
    getLocationOptions(supabase),
  ]);

  return <UsersView users={users} roles={roles} locations={locations} currentUserId={user?.id ?? ""} />;
}

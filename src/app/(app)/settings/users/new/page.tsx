import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/queries/get-session-profile";
import { isSuperAdmin } from "@/lib/auth/permissions";
import { getRoleOptions, getLocationOptions } from "@/lib/queries/users";
import { PageHeader } from "@/components/shared/page-header";
import { AddUserForm } from "@/components/facility/add-user-form";

export default async function NewUserPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = user ? await getSessionProfile(supabase, user.id) : null;
  if (!isSuperAdmin(profile)) redirect("/dashboard");

  const [roles, locations] = await Promise.all([
    getRoleOptions(supabase),
    getLocationOptions(supabase),
  ]);

  return (
    <div>
      <PageHeader title="Add User" description="Create a prototype account with a temporary password. The user can sign in immediately — no confirmation email is sent." />
      <AddUserForm roles={roles} locations={locations} />
    </div>
  );
}

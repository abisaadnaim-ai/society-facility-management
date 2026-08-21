import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/queries/get-session-profile";
import { isSuperAdmin } from "@/lib/auth/permissions";
import { getUserDetail, getRoleOptions, getLocationOptions } from "@/lib/queries/users";
import { UserDetailView } from "@/components/facility/user-detail-view";

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = user ? await getSessionProfile(supabase, user.id) : null;
  if (!isSuperAdmin(profile)) redirect("/dashboard");

  const [detail, roles, locations] = await Promise.all([
    getUserDetail(supabase, id),
    getRoleOptions(supabase),
    getLocationOptions(supabase),
  ]);
  if (!detail) notFound();

  return (
    <UserDetailView
      user={detail}
      roles={roles}
      locations={locations}
      isSelf={detail.id === (user?.id ?? "")}
    />
  );
}

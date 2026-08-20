import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/queries/get-session-profile";
import { getAssetStatuses } from "@/lib/queries/config";
import { canManageConfiguration } from "@/lib/auth/permissions";
import { StatusesSettingsView } from "@/components/facility/statuses-settings-view";

export default async function AssetStatusesSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = user ? await getSessionProfile(supabase, user.id) : null;

  if (!canManageConfiguration(profile)) {
    redirect("/dashboard");
  }

  const statuses = await getAssetStatuses(supabase, { includeInactive: true });

  return <StatusesSettingsView statuses={statuses} />;
}

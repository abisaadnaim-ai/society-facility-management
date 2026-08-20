import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/queries/get-session-profile";
import { getAssetCategories } from "@/lib/queries/config";
import { canManageConfiguration } from "@/lib/auth/permissions";
import { CategoriesSettingsView } from "@/components/facility/categories-settings-view";

export default async function AssetCategoriesSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = user ? await getSessionProfile(supabase, user.id) : null;

  // Configuration is Super Admin only. RLS also enforces this on write.
  if (!canManageConfiguration(profile)) {
    redirect("/dashboard");
  }

  const categories = await getAssetCategories(supabase, { includeInactive: true });

  return <CategoriesSettingsView categories={categories} />;
}

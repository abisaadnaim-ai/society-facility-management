import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/queries/get-session-profile";
import { getLocations } from "@/lib/queries/locations";
import { getAllAreas } from "@/lib/queries/areas";
import { getAssetCategories, getAssetStatuses } from "@/lib/queries/config";
import { canManageFacility } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { AssetForm } from "@/components/facility/asset-form";

export default async function NewAssetPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = user ? await getSessionProfile(supabase, user.id) : null;

  // Read-only users can't reach the form. The server action also enforces this,
  // but redirecting avoids showing a form that can only fail on submit.
  if (!canManageFacility(profile)) {
    redirect("/assets");
  }

  const [locations, areas, categories, statuses] = await Promise.all([
    getLocations(supabase, { includeInactive: false }),
    getAllAreas(supabase),
    getAssetCategories(supabase),
    getAssetStatuses(supabase),
  ]);

  return (
    <div>
      <PageHeader title="Add asset" description="Register a new asset in the facility." />
      <AssetForm
        mode="create"
        locations={locations}
        areas={areas}
        categories={categories}
        statuses={statuses}
      />
    </div>
  );
}

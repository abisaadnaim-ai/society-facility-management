import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/queries/get-session-profile";
import { getAssets } from "@/lib/queries/assets";
import { getLocations } from "@/lib/queries/locations";
import { getAllAreas } from "@/lib/queries/areas";
import { getAssetCategories, getAssetStatuses } from "@/lib/queries/config";
import { canManageFacility } from "@/lib/auth/permissions";
import { AssetRegisterView } from "@/components/facility/asset-register-view";

export default async function AssetsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = user ? await getSessionProfile(supabase, user.id) : null;

  // Load the register and all filter option lists in parallel.
  const [assets, locations, areas, categories, statuses] = await Promise.all([
    getAssets(supabase, { includeInactive: false }),
    getLocations(supabase, { includeInactive: false }),
    getAllAreas(supabase),
    getAssetCategories(supabase),
    getAssetStatuses(supabase),
  ]);

  return (
    <AssetRegisterView
      initialAssets={assets}
      locations={locations}
      areas={areas}
      categories={categories}
      statuses={statuses}
      canManage={canManageFacility(profile)}
    />
  );
}

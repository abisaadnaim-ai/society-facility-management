import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/queries/get-session-profile";
import { getAssetById } from "@/lib/queries/assets";
import { getLocations } from "@/lib/queries/locations";
import { getAllAreas } from "@/lib/queries/areas";
import { getAssetCategories, getAssetStatuses } from "@/lib/queries/config";
import { canManageFacility } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { AssetForm } from "@/components/facility/asset-form";

export default async function EditAssetPage({
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

  if (!canManageFacility(profile)) {
    redirect(`/assets/${id}`);
  }

  const [asset, locations, areas, categories, statuses] = await Promise.all([
    getAssetById(supabase, id),
    getLocations(supabase, { includeInactive: false }),
    getAllAreas(supabase),
    getAssetCategories(supabase),
    getAssetStatuses(supabase),
  ]);

  if (!asset) notFound();

  return (
    <div>
      <PageHeader title="Edit asset" description={asset.name} />
      <AssetForm
        mode="edit"
        asset={asset}
        locations={locations}
        areas={areas}
        categories={categories}
        statuses={statuses}
      />
    </div>
  );
}

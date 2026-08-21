import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/queries/get-session-profile";
import { getLocations } from "@/lib/queries/locations";
import { getAllAreas } from "@/lib/queries/areas";
import { getFmCategories, getFmPriorities, getAssetOptions } from "@/lib/queries/fm-config";
import { PageHeader } from "@/components/shared/page-header";
import { FmRequestForm } from "@/components/facility/fm-request-form";
import type { RoleCode } from "@/lib/types/auth";

export default async function NewFmRequestPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = user ? await getSessionProfile(supabase, user.id) : null;
  const role = (profile?.role?.code ?? null) as RoleCode | null;
  const canCreate = role === "super_admin" || role === "facility_manager" || role === "requester";
  if (!canCreate) redirect("/fm-requests");
  const canSetPriority = role === "super_admin" || role === "facility_manager";

  const [locations, areas, assets, categories, priorities] = await Promise.all([
    getLocations(supabase, { includeInactive: false }),
    getAllAreas(supabase),
    getAssetOptions(supabase),
    getFmCategories(supabase),
    getFmPriorities(supabase),
  ]);

  return (
    <div>
      <PageHeader title="New FM Request" description="Report a facility issue for review." />
      <FmRequestForm
        locations={locations}
        areas={areas}
        assets={assets}
        categories={categories}
        priorities={priorities}
        canSetPriority={canSetPriority}
        organizationId={profile?.organization_id ?? ""}
      />
    </div>
  );
}

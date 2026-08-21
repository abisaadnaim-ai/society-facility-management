import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/queries/get-session-profile";
import { getPpmAssetOptions } from "@/lib/queries/ppm";
import { getFmCategories, getFmPriorities, getTechnicianOptions } from "@/lib/queries/fm-config";
import { canManageFacility } from "@/lib/auth/permissions";
import { PpmPlanForm } from "@/components/facility/ppm-plan-form";

export default async function NewPpmPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ asset?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = user ? await getSessionProfile(supabase, user.id) : null;
  if (!canManageFacility(profile)) redirect("/preventive-maintenance");

  const { asset } = await searchParams;
  const [assets, categories, priorities, technicians] = await Promise.all([
    getPpmAssetOptions(supabase),
    getFmCategories(supabase),
    getFmPriorities(supabase),
    getTechnicianOptions(supabase),
  ]);

  return (
    <PpmPlanForm
      assets={assets}
      categories={categories}
      priorities={priorities}
      technicians={technicians}
      preselectedAssetId={asset ?? null}
    />
  );
}

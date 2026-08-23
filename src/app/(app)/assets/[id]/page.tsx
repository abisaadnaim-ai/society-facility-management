import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/queries/get-session-profile";
import { getAssetById, getAssetActivity, getAssetAttachments } from "@/lib/queries/assets";
import { getWorkOrdersForAsset } from "@/lib/queries/work-orders";
import { getPpmPlansForAsset } from "@/lib/queries/ppm";
import { getInspectionsForAsset } from "@/lib/queries/inspections";
import { getVendorCoverageForAsset } from "@/lib/queries/vendors";
import { getAssetSpareParts, getItemOptionsForIssue } from "@/lib/queries/inventory";
import { canManageFacility } from "@/lib/auth/permissions";
import { AssetDetailView } from "@/components/facility/asset-detail-view";
import { AssetInspectionsCard } from "@/components/facility/asset-inspections-card";
import { VendorCoverageCard } from "@/components/facility/vendor-coverage-card";
import { AssetSparePartsCard } from "@/components/facility/asset-spare-parts-card";
import type { RoleCode } from "@/lib/types/auth";

export default async function AssetDetailPage({
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

  const asset = await getAssetById(supabase, id);
  if (!asset) notFound();

  const role = (profile?.role?.code ?? null) as RoleCode | null;
  const showParts = role !== "requester";
  const canManageParts = role === "super_admin" || role === "facility_manager";

  const [activity, attachments, workOrders, ppmPlans, inspections, vendorCoverage, spareParts, sparePartOptions] = await Promise.all([
    getAssetActivity(supabase, id),
    getAssetAttachments(supabase, id),
    getWorkOrdersForAsset(supabase, id),
    getPpmPlansForAsset(supabase, id),
    getInspectionsForAsset(supabase, id),
    getVendorCoverageForAsset(supabase, id),
    showParts ? getAssetSpareParts(supabase, id) : Promise.resolve([]),
    canManageParts ? getItemOptionsForIssue(supabase) : Promise.resolve([]),
  ]);

  return (
    <>
      <AssetDetailView
        asset={asset}
        activity={activity}
        attachments={attachments}
        workOrders={workOrders}
        ppmPlans={ppmPlans}
        canManage={canManageFacility(profile)}
        organizationId={profile?.organization_id ?? ""}
      />
      <AssetInspectionsCard inspections={inspections} />
      <div className="mt-6">
        <VendorCoverageCard coverage={vendorCoverage} />
      </div>
      {showParts && (
        <div className="mt-6">
          <AssetSparePartsCard assetId={id} parts={spareParts} canManage={canManageParts} itemOptions={sparePartOptions} />
        </div>
      )}
    </>
  );
}

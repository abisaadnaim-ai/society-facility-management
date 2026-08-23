import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/queries/get-session-profile";
import { getVendorById, getVendorWorkOrders, getVendorCategories } from "@/lib/queries/vendors";
import { getLocations } from "@/lib/queries/locations";
import { getAssetOptions } from "@/lib/queries/fm-config";
import { VendorDetailView } from "@/components/facility/vendor-detail-view";
import type { RoleCode } from "@/lib/types/auth";

export default async function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = user ? await getSessionProfile(supabase, user.id) : null;
  const role = (profile?.role?.code ?? null) as RoleCode | null;
  if (role === "requester") redirect("/dashboard");
  const canManage = role === "super_admin" || role === "facility_manager";

  const [vendor, workOrders, categories, locations, assets] = await Promise.all([
    getVendorById(supabase, id),
    getVendorWorkOrders(supabase, id),
    getVendorCategories(supabase),
    getLocations(supabase, { includeInactive: false }),
    getAssetOptions(supabase),
  ]);
  if (!vendor) notFound();

  return (
    <VendorDetailView
      vendor={vendor}
      workOrders={workOrders}
      categories={categories}
      locationOptions={locations}
      assetOptions={assets}
      canManage={canManage}
      orgId={profile?.organization_id ?? ""}
    />
  );
}

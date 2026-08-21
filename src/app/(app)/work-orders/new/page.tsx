import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/queries/get-session-profile";
import { getFmRequestById } from "@/lib/queries/fm-requests";
import { getLocations } from "@/lib/queries/locations";
import { getAllAreas } from "@/lib/queries/areas";
import {
  getFmCategories,
  getFmPriorities,
  getAssetOptions,
  getTechnicianOptions,
} from "@/lib/queries/fm-config";
import { PageHeader } from "@/components/shared/page-header";
import { WorkOrderForm, type WorkOrderPrefill } from "@/components/facility/work-order-form";
import type { RoleCode } from "@/lib/types/auth";

export default async function NewWorkOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ request?: string }>;
}) {
  const { request: requestId } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = user ? await getSessionProfile(supabase, user.id) : null;
  const role = (profile?.role?.code ?? null) as RoleCode | null;
  if (role !== "super_admin" && role !== "facility_manager") redirect("/work-orders");

  const [locations, areas, assets, categories, priorities, technicians] = await Promise.all([
    getLocations(supabase, { includeInactive: false }),
    getAllAreas(supabase),
    getAssetOptions(supabase),
    getFmCategories(supabase),
    getFmPriorities(supabase),
    getTechnicianOptions(supabase),
  ]);

  let prefill: WorkOrderPrefill | undefined;
  if (requestId) {
    const req = await getFmRequestById(supabase, requestId);
    if (req && !req.work_order) {
      prefill = {
        fm_request_id: req.id,
        request_number: req.request_number,
        title: req.title,
        description: req.description ?? "",
        location_id: req.location_id,
        area_id: req.area_id ?? "",
        asset_id: req.asset_id ?? "",
        category_id: req.category_id,
        priority_id: req.priority_id ?? "",
      };
    } else if (req && req.work_order) {
      // A work order already exists for this request; go to it.
      redirect(`/work-orders/${req.work_order.id}`);
    }
  }

  return (
    <div>
      <PageHeader title="New Work Order" description="Create a maintenance job." />
      <WorkOrderForm
        locations={locations}
        areas={areas}
        assets={assets}
        categories={categories}
        priorities={priorities}
        technicians={technicians}
        prefill={prefill}
      />
    </div>
  );
}

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/queries/get-session-profile";
import {
  getWorkOrderById,
  getWorkOrderActivity,
  getWorkOrderComments,
  getWorkOrderAttachments,
} from "@/lib/queries/work-orders";
import { getWorkOrderStatuses, getTechnicianOptions } from "@/lib/queries/fm-config";
import { getWorkOrderTasks } from "@/lib/queries/ppm";
import {
  getWorkOrderVendorInfo,
  getWorkOrderVendorNotes,
  getVendorOptions,
  getVendorContactsLite,
  getContractsLite,
} from "@/lib/queries/vendors";
import { getWorkOrderParts, getItemOptionsForIssue, getStockLocationOptions } from "@/lib/queries/inventory";
import { WorkOrderDetailView } from "@/components/facility/work-order-detail-view";
import { WorkOrderVendorPanel } from "@/components/facility/wo-vendor-panel";
import { WorkOrderPartsPanel } from "@/components/facility/wo-parts-panel";
import type { RoleCode } from "@/lib/types/auth";

export default async function WorkOrderDetailPage({
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
  const role = (profile?.role?.code ?? null) as RoleCode | null;

  const workOrder = await getWorkOrderById(supabase, id);
  if (!workOrder) notFound();

  const [activity, comments, attachments, statuses, technicians, tasks] = await Promise.all([
    getWorkOrderActivity(supabase, id),
    getWorkOrderComments(supabase, id),
    getWorkOrderAttachments(supabase, id),
    getWorkOrderStatuses(supabase),
    getTechnicianOptions(supabase),
    getWorkOrderTasks(supabase, id),
  ]);

  const canManageVendor = role === "super_admin" || role === "facility_manager";
  const assignedTo = (workOrder as unknown as { assigned_to: string | null }).assigned_to;
  const canWriteVendorNotes = canManageVendor || (role === "technician" && assignedTo === (user?.id ?? ""));
  const showVendorPanel = role !== "requester";

  const vendorInfo = showVendorPanel ? await getWorkOrderVendorInfo(supabase, id) : null;
  const vendorNotes = showVendorPanel ? await getWorkOrderVendorNotes(supabase, id) : [];
  const vendorOptions = showVendorPanel && canManageVendor ? await getVendorOptions(supabase) : [];
  const vendorContacts = showVendorPanel && canManageVendor ? await getVendorContactsLite(supabase) : [];
  const vendorContracts = showVendorPanel && canManageVendor ? await getContractsLite(supabase) : [];

  const renderVendorPanel = showVendorPanel && (!!vendorInfo?.vendor || canManageVendor || vendorNotes.length > 0);

  // Parts / Materials (inventory) — visible to all non-requesters; issue/return
  // for FM/Super Admin or the technician assigned to this work order.
  const showParts = role !== "requester";
  const canIssueParts = canManageVendor || (role === "technician" && assignedTo === (user?.id ?? ""));
  const [woParts, partItemOptions, partStockLocations] = showParts
    ? await Promise.all([
        getWorkOrderParts(supabase, id),
        canIssueParts ? getItemOptionsForIssue(supabase) : Promise.resolve([]),
        canIssueParts ? getStockLocationOptions(supabase) : Promise.resolve([]),
      ])
    : [[], [], []];

  let ppmPlan: { id: string; ppm_number: string; name: string } | null = null;
  if (workOrder.source === "ppm" && workOrder.ppm_plan_id) {
    const { data: plan } = await supabase
      .from("ppm_plans")
      .select("id, ppm_number, name")
      .eq("id", workOrder.ppm_plan_id)
      .maybeSingle();
    ppmPlan = (plan as unknown as { id: string; ppm_number: string; name: string }) ?? null;
  }

  return (
    <>
      <WorkOrderDetailView
        workOrder={workOrder}
        activity={activity}
        comments={comments}
        attachments={attachments}
        role={role}
        userId={user?.id ?? ""}
        organizationId={profile?.organization_id ?? ""}
        statuses={statuses}
        technicians={technicians}
        tasks={tasks}
        ppmPlan={ppmPlan}
      />
      {renderVendorPanel && (
        <div className="mt-6">
          <WorkOrderVendorPanel
            workOrderId={id}
            info={vendorInfo}
            notes={vendorNotes}
            vendors={vendorOptions}
            contacts={vendorContacts}
            contracts={vendorContracts}
            canManage={canManageVendor}
            canWriteNotes={canWriteVendorNotes}
          />
        </div>
      )}
      {showParts && (
        <div className="mt-6">
          <WorkOrderPartsPanel
            workOrderId={id}
            parts={woParts}
            canIssue={canIssueParts}
            itemOptions={partItemOptions}
            stockLocations={partStockLocations}
            technicians={technicians}
          />
        </div>
      )}
    </>
  );
}

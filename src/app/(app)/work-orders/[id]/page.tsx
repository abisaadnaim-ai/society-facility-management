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
import { WorkOrderDetailView } from "@/components/facility/work-order-detail-view";
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

  const [activity, comments, attachments, statuses, technicians] = await Promise.all([
    getWorkOrderActivity(supabase, id),
    getWorkOrderComments(supabase, id),
    getWorkOrderAttachments(supabase, id),
    getWorkOrderStatuses(supabase),
    getTechnicianOptions(supabase),
  ]);

  return (
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
    />
  );
}

import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/queries/get-session-profile";
import { getInspectionById, getFindingsForInspection, getInspectorOptions } from "@/lib/queries/inspections";
import { getFmCategories, getFmPriorities } from "@/lib/queries/fm-config";
import { InspectionExecutionView } from "@/components/facility/inspection-execution-view";
import type { RoleCode } from "@/lib/types/auth";
import type { Lookup } from "@/lib/types/fm";

export default async function InspectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const profile = user ? await getSessionProfile(supabase, user.id) : null;
  const role = (profile?.role?.code ?? null) as RoleCode | null;
  if (!profile || role === "requester") redirect("/dashboard");

  const detail = await getInspectionById(supabase, id);
  if (!detail) notFound();

  const canManage = role === "super_admin" || role === "facility_manager";
  const canPerform = canManage || detail.occurrence.assigned_to === profile.id;

  const [findings, categories, priorities, inspectors] = await Promise.all([
    getFindingsForInspection(supabase, id),
    getFmCategories(supabase),
    getFmPriorities(supabase),
    getInspectorOptions(supabase),
  ]);

  const catOpts: Lookup[] = categories.map((c) => ({ id: c.id, name: c.name, code: c.code }));
  const prioOpts: Lookup[] = priorities.map((p) => ({ id: p.id, name: p.name, code: p.code }));

  return (
    <InspectionExecutionView
      detail={detail}
      findings={findings}
      canManage={canManage}
      canPerform={canPerform}
      organizationId={profile.organization_id}
      inspectors={inspectors}
      categories={catOpts}
      priorities={prioOpts}
    />
  );
}

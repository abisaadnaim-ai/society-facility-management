import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/queries/get-session-profile";
import { getInspectionFindings, getInspectorOptions } from "@/lib/queries/inspections";
import { getFmCategories, getFmPriorities } from "@/lib/queries/fm-config";
import { InspectionFindingsView } from "@/components/facility/inspection-findings-view";
import type { RoleCode } from "@/lib/types/auth";
import type { Lookup } from "@/lib/types/fm";

export default async function FindingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const profile = user ? await getSessionProfile(supabase, user.id) : null;
  const role = (profile?.role?.code ?? null) as RoleCode | null;
  if (!profile || role === "requester" || role === "technician") redirect("/inspections");
  const canManage = role === "super_admin" || role === "facility_manager";

  const [findings, categories, priorities, inspectors] = await Promise.all([
    getInspectionFindings(supabase),
    getFmCategories(supabase),
    getFmPriorities(supabase),
    getInspectorOptions(supabase),
  ]);
  const catOpts: Lookup[] = categories.map((c) => ({ id: c.id, name: c.name, code: c.code }));
  const prioOpts: Lookup[] = priorities.map((p) => ({ id: p.id, name: p.name, code: p.code }));

  return <InspectionFindingsView findings={findings} canManage={canManage} categories={catOpts} priorities={prioOpts} inspectors={inspectors} />;
}

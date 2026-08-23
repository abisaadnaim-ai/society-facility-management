import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/queries/get-session-profile";
import { getFmCategories, getFmPriorities } from "@/lib/queries/fm-config";
import { InspectionTemplateBuilder } from "@/components/facility/inspection-template-builder";
import type { RoleCode } from "@/lib/types/auth";
import type { Lookup } from "@/lib/types/fm";

export default async function NewTemplatePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const profile = user ? await getSessionProfile(supabase, user.id) : null;
  const role = (profile?.role?.code ?? null) as RoleCode | null;
  if (!profile || (role !== "super_admin" && role !== "facility_manager")) redirect("/inspections/templates");
  const [categories, priorities] = await Promise.all([getFmCategories(supabase), getFmPriorities(supabase)]);
  const catOpts: Lookup[] = categories.map((c) => ({ id: c.id, name: c.name, code: c.code }));
  const prioOpts: Lookup[] = priorities.map((p) => ({ id: p.id, name: p.name, code: p.code }));
  return <InspectionTemplateBuilder categories={catOpts} priorities={prioOpts} />;
}

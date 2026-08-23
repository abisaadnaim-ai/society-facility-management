import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/queries/get-session-profile";
import { getInspectionTemplateById } from "@/lib/queries/inspections";
import { getFmCategories, getFmPriorities } from "@/lib/queries/fm-config";
import { InspectionTemplateDetailView } from "@/components/facility/inspection-template-detail-view";
import type { RoleCode } from "@/lib/types/auth";
import type { Lookup } from "@/lib/types/fm";

export default async function TemplateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const profile = user ? await getSessionProfile(supabase, user.id) : null;
  const role = (profile?.role?.code ?? null) as RoleCode | null;
  if (!profile || role === "requester" || role === "technician") redirect("/inspections");
  const canManage = role === "super_admin" || role === "facility_manager";
  const content = await getInspectionTemplateById(supabase, id);
  if (!content) notFound();
  const [categories, priorities] = await Promise.all([getFmCategories(supabase), getFmPriorities(supabase)]);
  const catOpts: Lookup[] = categories.map((c) => ({ id: c.id, name: c.name, code: c.code }));
  const prioOpts: Lookup[] = priorities.map((p) => ({ id: p.id, name: p.name, code: p.code }));
  return <InspectionTemplateDetailView content={content} canManage={canManage} categories={catOpts} priorities={prioOpts} />;
}

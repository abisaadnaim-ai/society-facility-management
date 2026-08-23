import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/queries/get-session-profile";
import { getInspectionSchedules } from "@/lib/queries/inspections";
import { InspectionSchedulesView } from "@/components/facility/inspection-schedules-view";
import type { RoleCode } from "@/lib/types/auth";

export default async function SchedulesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const profile = user ? await getSessionProfile(supabase, user.id) : null;
  const role = (profile?.role?.code ?? null) as RoleCode | null;
  if (!profile || role === "requester" || role === "technician") redirect("/inspections");
  const canManage = role === "super_admin" || role === "facility_manager";
  const schedules = await getInspectionSchedules(supabase);
  return <InspectionSchedulesView schedules={schedules} canManage={canManage} />;
}

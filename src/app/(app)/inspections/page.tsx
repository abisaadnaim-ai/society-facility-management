import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/queries/get-session-profile";
import {
  getInspectionSummary,
  getInspectionOccurrences,
  isoToday,
} from "@/lib/queries/inspections";
import { InspectionHubView } from "@/components/facility/inspection-hub-view";
import type { RoleCode } from "@/lib/types/auth";

export default async function InspectionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const profile = user ? await getSessionProfile(supabase, user.id) : null;
  const role = (profile?.role?.code ?? null) as RoleCode | null;
  if (!profile || role === "requester") redirect("/dashboard");
  const canManage = role === "super_admin" || role === "facility_manager";

  const [summary, myInspections, upcoming] = await Promise.all([
    getInspectionSummary(supabase),
    getInspectionOccurrences(supabase, {
      assignedToMe: profile.id,
      statuses: ["scheduled", "due", "in_progress"],
    }),
    canManage
      ? getInspectionOccurrences(supabase, { upcomingOnly: true })
      : Promise.resolve([]),
  ]);

  return (
    <InspectionHubView
      today={isoToday()}
      summary={summary}
      myInspections={myInspections}
      upcoming={upcoming}
      canManage={canManage}
    />
  );
}

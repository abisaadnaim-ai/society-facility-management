import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/queries/get-session-profile";
import { getPpmPlans, getPpmSummary, isoToday } from "@/lib/queries/ppm";
import { PpmRegisterView } from "@/components/facility/ppm-register-view";
import type { RoleCode } from "@/lib/types/auth";

export default async function PreventiveMaintenancePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = user ? await getSessionProfile(supabase, user.id) : null;
  const role = (profile?.role?.code ?? null) as RoleCode | null;
  const canManage = role === "super_admin" || role === "facility_manager";

  const [summary, plans] = await Promise.all([
    getPpmSummary(supabase),
    getPpmPlans(supabase),
  ]);

  return (
    <PpmRegisterView
      plans={plans}
      summary={summary}
      canManage={canManage}
      today={isoToday()}
    />
  );
}

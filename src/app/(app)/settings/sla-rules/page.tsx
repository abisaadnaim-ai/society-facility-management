import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/queries/get-session-profile";
import { getFmPriorities } from "@/lib/queries/fm-config";
import { getSlaRules } from "@/lib/queries/notifications";
import { SlaRulesView } from "@/components/facility/sla-rules-view";

export default async function SlaRulesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = user ? await getSessionProfile(supabase, user.id) : null;

  // SLA configuration is Super Admin + Facility Manager (§14, §45). RLS also enforces this.
  const role = profile?.role?.code ?? null;
  if (role !== "super_admin" && role !== "facility_manager") {
    redirect("/dashboard");
  }

  const [rules, priorities] = await Promise.all([
    getSlaRules(supabase),
    getFmPriorities(supabase),
  ]);

  return <SlaRulesView rules={rules} priorities={priorities.map((p) => ({ id: p.id, name: p.name }))} />;
}

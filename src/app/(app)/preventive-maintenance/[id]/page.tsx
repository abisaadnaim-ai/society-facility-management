import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/queries/get-session-profile";
import {
  getPpmPlanById,
  getPpmPlanTasks,
  getPpmHistoryForPlan,
  getNextActionableOccurrence,
  isoToday,
} from "@/lib/queries/ppm";
import { getFmPriorities, getTechnicianOptions } from "@/lib/queries/fm-config";
import { PpmPlanDetailView } from "@/components/facility/ppm-plan-detail-view";
import type { RoleCode } from "@/lib/types/auth";

export default async function PpmPlanDetailPage({
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
  const canManage = role === "super_admin" || role === "facility_manager";

  const plan = await getPpmPlanById(supabase, id);
  if (!plan) notFound();

  const [tasks, history, nextOccurrence, priorities, technicians] = await Promise.all([
    getPpmPlanTasks(supabase, id),
    getPpmHistoryForPlan(supabase, id),
    getNextActionableOccurrence(supabase, id),
    getFmPriorities(supabase),
    getTechnicianOptions(supabase),
  ]);

  return (
    <PpmPlanDetailView
      plan={plan}
      tasks={tasks}
      history={history}
      nextOccurrence={nextOccurrence}
      priorities={priorities}
      technicians={technicians}
      canManage={canManage}
      today={isoToday()}
    />
  );
}

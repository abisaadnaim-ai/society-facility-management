import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/queries/get-session-profile";
import { getFmRequests } from "@/lib/queries/fm-requests";
import { getLocations } from "@/lib/queries/locations";
import {
  getFmCategories,
  getFmPriorities,
  getFmRequestStatuses,
  getOrgPeople,
} from "@/lib/queries/fm-config";
import { FmRequestsView } from "@/components/facility/fm-requests-view";
import type { RoleCode } from "@/lib/types/auth";

export default async function FmRequestsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = user ? await getSessionProfile(supabase, user.id) : null;
  const role = (profile?.role?.code ?? null) as RoleCode | null;
  const canCreate = role === "super_admin" || role === "facility_manager" || role === "requester";

  const [requests, locations, categories, priorities, statuses, people] = await Promise.all([
    getFmRequests(supabase, {}),
    getLocations(supabase, { includeInactive: false }),
    getFmCategories(supabase),
    getFmPriorities(supabase),
    getFmRequestStatuses(supabase),
    getOrgPeople(supabase),
  ]);

  return (
    <FmRequestsView
      requests={requests}
      locations={locations}
      categories={categories}
      priorities={priorities}
      statuses={statuses}
      people={people}
      canCreate={canCreate}
    />
  );
}

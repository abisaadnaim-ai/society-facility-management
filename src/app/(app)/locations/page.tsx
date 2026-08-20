import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/queries/get-session-profile";
import { getLocations } from "@/lib/queries/locations";
import { canManageFacility } from "@/lib/auth/permissions";
import { LocationsView } from "@/components/facility/locations-view";

export default async function LocationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = user ? await getSessionProfile(supabase, user.id) : null;

  const locations = await getLocations(supabase, { includeInactive: true });

  return (
    <LocationsView
      locations={locations}
      canManage={canManageFacility(profile)}
    />
  );
}

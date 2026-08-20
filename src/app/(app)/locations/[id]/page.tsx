import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/queries/get-session-profile";
import { getLocationById } from "@/lib/queries/locations";
import { getAreasForLocation } from "@/lib/queries/areas";
import { canManageFacility } from "@/lib/auth/permissions";
import { LocationDetailView } from "@/components/facility/location-detail-view";

export default async function LocationDetailPage({
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

  const location = await getLocationById(supabase, id);
  if (!location) notFound();

  const areas = await getAreasForLocation(supabase, id, { includeInactive: true });

  return (
    <LocationDetailView
      location={location}
      areas={areas}
      canManage={canManageFacility(profile)}
    />
  );
}

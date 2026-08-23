import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/queries/get-session-profile";
import { getLocations } from "@/lib/queries/locations";
import { getAllAreas } from "@/lib/queries/areas";
import { PageHeader } from "@/components/shared/page-header";
import { StockLocationForm } from "@/components/facility/stock-location-form";
import type { RoleCode } from "@/lib/types/auth";

export default async function NewStockLocationPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const profile = user ? await getSessionProfile(supabase, user.id) : null;
  const role = (profile?.role?.code ?? null) as RoleCode | null;
  if (!(role === "super_admin" || role === "facility_manager")) redirect("/inventory/stock-locations");

  const [locations, areas] = await Promise.all([
    getLocations(supabase, { includeInactive: false }),
    getAllAreas(supabase),
  ]);

  return (
    <div>
      <PageHeader title="New Stock Location" description="Define an FM store where inventory is kept." />
      <StockLocationForm
        locations={locations.map((l) => ({ id: l.id, name: l.name }))}
        areas={areas.map((a) => ({ id: a.id, name: a.name, location_id: a.location_id }))}
      />
    </div>
  );
}

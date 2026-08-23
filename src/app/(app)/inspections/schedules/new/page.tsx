import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/queries/get-session-profile";
import { getInspectionTemplates, getInspectorOptions } from "@/lib/queries/inspections";
import { getLocations } from "@/lib/queries/locations";
import { getAllAreas } from "@/lib/queries/areas";
import { getAssetOptions } from "@/lib/queries/fm-config";
import { InspectionScheduleForm } from "@/components/facility/inspection-schedule-form";
import type { RoleCode } from "@/lib/types/auth";

export default async function NewSchedulePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const profile = user ? await getSessionProfile(supabase, user.id) : null;
  const role = (profile?.role?.code ?? null) as RoleCode | null;
  if (!profile || (role !== "super_admin" && role !== "facility_manager")) redirect("/inspections/schedules");

  const [templates, locations, areas, assets, inspectors] = await Promise.all([
    getInspectionTemplates(supabase),
    getLocations(supabase, { includeInactive: false }),
    getAllAreas(supabase),
    getAssetOptions(supabase),
    getInspectorOptions(supabase),
  ]);
  const activeTemplates = templates
    .filter((t) => t.status === "active")
    .map((t) => ({ id: t.id, name: t.name, template_number: t.template_number }));

  return (
    <InspectionScheduleForm
      templates={activeTemplates}
      locations={locations.map((l) => ({ id: l.id, name: l.name }))}
      areas={areas.map((a) => ({ id: a.id, name: a.name, location_id: a.location_id, is_active: a.is_active }))}
      assets={assets}
      inspectors={inspectors}
    />
  );
}

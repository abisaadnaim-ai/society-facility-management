import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/queries/get-session-profile";
import { canViewReports } from "@/lib/auth/permissions";
import { getLocations } from "@/lib/queries/locations";
import { getAllAreas } from "@/lib/queries/areas";
import { getFmCategories, getFmPriorities } from "@/lib/queries/fm-config";
import { ReportFilterBar } from "@/components/reports/report-filter-bar";
import { ReportsNav } from "@/components/reports/reports-nav";

export default async function ReportsLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = user ? await getSessionProfile(supabase, user.id) : null;

  // Management reporting is Super Admin / Facility Manager / Viewer only (§32).
  // Technicians and Requesters are redirected to their operational dashboard.
  if (!canViewReports(profile)) {
    redirect("/dashboard");
  }

  const [locations, areas, priorities, categories] = await Promise.all([
    getLocations(supabase),
    getAllAreas(supabase),
    getFmPriorities(supabase),
    getFmCategories(supabase),
  ]);

  const locationOpts = locations.map((l) => ({ id: l.id, name: l.name }));
  const areaOpts = areas.map((a) => ({
    id: a.id,
    name: a.name,
    locationId: (a as unknown as { location_id: string | null }).location_id ?? null,
  }));
  const priorityOpts = priorities.map((p) => ({ id: p.id, name: p.name }));
  const categoryOpts = categories.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div>
      <div className="mb-4 print:hidden">
        <p className="text-sm font-medium text-slate-500">Management</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Reports &amp; Analytics</h1>
      </div>

      <ReportFilterBar
        locations={locationOpts}
        areas={areaOpts}
        priorities={priorityOpts}
        categories={categoryOpts}
      />
      <ReportsNav />

      {children}
    </div>
  );
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/queries/get-session-profile";
import { getStockLocations } from "@/lib/queries/inventory";
import { StockLocationsView } from "@/components/facility/stock-locations-view";
import type { RoleCode } from "@/lib/types/auth";

export default async function StockLocationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const profile = user ? await getSessionProfile(supabase, user.id) : null;
  const role = (profile?.role?.code ?? null) as RoleCode | null;
  if (role === "requester") redirect("/dashboard");
  const canManage = role === "super_admin" || role === "facility_manager";

  const locations = await getStockLocations(supabase);
  return <StockLocationsView locations={locations} canManage={canManage} />;
}

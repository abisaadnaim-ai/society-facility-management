import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/queries/get-session-profile";
import { getStockLocationById } from "@/lib/queries/inventory";
import { StockLocationDetailView } from "@/components/facility/stock-location-detail-view";
import type { RoleCode } from "@/lib/types/auth";

export default async function StockLocationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const profile = user ? await getSessionProfile(supabase, user.id) : null;
  const role = (profile?.role?.code ?? null) as RoleCode | null;
  if (role === "requester") redirect("/dashboard");
  const canManage = role === "super_admin" || role === "facility_manager";

  const location = await getStockLocationById(supabase, id);
  if (!location) notFound();

  return <StockLocationDetailView location={location} canManage={canManage} />;
}

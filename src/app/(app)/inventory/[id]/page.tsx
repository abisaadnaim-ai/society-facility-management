import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/queries/get-session-profile";
import { getInventoryItemById, getStockLocationOptions } from "@/lib/queries/inventory";
import { InventoryItemDetailView } from "@/components/facility/inventory-item-detail-view";
import type { RoleCode } from "@/lib/types/auth";

export default async function InventoryItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const profile = user ? await getSessionProfile(supabase, user.id) : null;
  const role = (profile?.role?.code ?? null) as RoleCode | null;
  if (role === "requester") redirect("/dashboard");
  const canManage = role === "super_admin" || role === "facility_manager";

  const [item, stockLocations] = await Promise.all([
    getInventoryItemById(supabase, id),
    getStockLocationOptions(supabase),
  ]);
  if (!item) notFound();

  return (
    <InventoryItemDetailView
      item={item}
      stockLocations={stockLocations}
      canManage={canManage}
      orgId={profile?.organization_id ?? ""}
    />
  );
}

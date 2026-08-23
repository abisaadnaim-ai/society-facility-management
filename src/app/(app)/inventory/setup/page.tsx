import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/queries/get-session-profile";
import { getInventoryCategories, getUnits } from "@/lib/queries/inventory";
import { InventorySetupView } from "@/components/facility/inventory-setup-view";
import type { RoleCode } from "@/lib/types/auth";

export default async function InventorySetupPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const profile = user ? await getSessionProfile(supabase, user.id) : null;
  const role = (profile?.role?.code ?? null) as RoleCode | null;
  if (role !== "super_admin") redirect("/inventory");

  const [categories, units] = await Promise.all([
    getInventoryCategories(supabase, { includeInactive: true }),
    getUnits(supabase, { includeInactive: true }),
  ]);

  return <InventorySetupView categories={categories} units={units} />;
}

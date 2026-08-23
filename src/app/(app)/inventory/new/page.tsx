import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/queries/get-session-profile";
import { getInventoryCategories, getUnits } from "@/lib/queries/inventory";
import { getVendorOptions } from "@/lib/queries/vendors";
import { PageHeader } from "@/components/shared/page-header";
import { InventoryItemForm } from "@/components/facility/inventory-item-form";
import type { RoleCode } from "@/lib/types/auth";

export default async function NewInventoryItemPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const profile = user ? await getSessionProfile(supabase, user.id) : null;
  const role = (profile?.role?.code ?? null) as RoleCode | null;
  if (!(role === "super_admin" || role === "facility_manager")) redirect("/inventory");

  const [categories, units, vendors] = await Promise.all([
    getInventoryCategories(supabase),
    getUnits(supabase),
    getVendorOptions(supabase),
  ]);

  return (
    <div>
      <PageHeader title="New Inventory Item" description="Add a spare part or consumable to the register." />
      <InventoryItemForm categories={categories} units={units} vendors={vendors.map((v) => ({ id: v.id, company_name: v.company_name }))} />
    </div>
  );
}

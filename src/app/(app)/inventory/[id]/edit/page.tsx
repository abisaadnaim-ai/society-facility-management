import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/queries/get-session-profile";
import { getInventoryCategories, getUnits } from "@/lib/queries/inventory";
import { getVendorOptions } from "@/lib/queries/vendors";
import { idb, type InventoryItem } from "@/lib/types/inventory";
import { PageHeader } from "@/components/shared/page-header";
import { InventoryItemForm } from "@/components/facility/inventory-item-form";
import type { RoleCode } from "@/lib/types/auth";

export default async function EditInventoryItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const profile = user ? await getSessionProfile(supabase, user.id) : null;
  const role = (profile?.role?.code ?? null) as RoleCode | null;
  if (!(role === "super_admin" || role === "facility_manager")) redirect(`/inventory/${id}`);

  const { data: itemRaw } = await idb(supabase).from("inventory_items").select("*").eq("id", id).maybeSingle();
  if (!itemRaw) notFound();
  const item = itemRaw as InventoryItem;

  const [categories, units, vendors] = await Promise.all([
    getInventoryCategories(supabase, { includeInactive: true }),
    getUnits(supabase, { includeInactive: true }),
    getVendorOptions(supabase),
  ]);

  return (
    <div>
      <PageHeader title="Edit Item" description={item.item_code} />
      <InventoryItemForm categories={categories} units={units} vendors={vendors.map((v) => ({ id: v.id, company_name: v.company_name }))} item={item} />
    </div>
  );
}

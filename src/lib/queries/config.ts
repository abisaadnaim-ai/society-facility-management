import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import type { AssetCategory, AssetStatus } from "@/lib/types/facility";

export async function getAssetCategories(
  supabase: SupabaseClient<Database>,
  opts: { includeInactive?: boolean } = {}
): Promise<AssetCategory[]> {
  let query = supabase
    .from("asset_categories")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (!opts.includeInactive) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) {
    console.error("getAssetCategories failed:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getAssetStatuses(
  supabase: SupabaseClient<Database>,
  opts: { includeInactive?: boolean } = {}
): Promise<AssetStatus[]> {
  let query = supabase
    .from("asset_statuses")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (!opts.includeInactive) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) {
    console.error("getAssetStatuses failed:", error.message);
    return [];
  }
  return data ?? [];
}

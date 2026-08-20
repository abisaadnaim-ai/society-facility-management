import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import type {
  AssetWithRelations,
  AssetFilters,
  AssetActivityWithActor,
  AssetAttachmentWithUploader,
} from "@/lib/types/facility";

const ASSET_SELECT =
  "*, location:locations(id, name), area:areas(id, name), category:asset_categories(id, name), status:asset_statuses(id, name, code)";

export async function getAssets(
  supabase: SupabaseClient<Database>,
  filters: Partial<AssetFilters> = {}
): Promise<AssetWithRelations[]> {
  let query = supabase.from("assets").select(ASSET_SELECT);

  if (!filters.includeInactive) query = query.eq("is_active", true);
  if (filters.locationId) query = query.eq("location_id", filters.locationId);
  if (filters.areaId) query = query.eq("area_id", filters.areaId);
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.statusId) query = query.eq("status_id", filters.statusId);

  if (filters.search && filters.search.trim()) {
    const term = filters.search.trim();
    // Match against the human-facing text fields. ilike is case-insensitive.
    query = query.or(
      `name.ilike.%${term}%,asset_code.ilike.%${term}%,manufacturer.ilike.%${term}%,model.ilike.%${term}%,serial_number.ilike.%${term}%`
    );
  }

  query = query.order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error) {
    console.error("getAssets failed:", error.message);
    return [];
  }
  return (data ?? []) as AssetWithRelations[];
}

export async function getAssetById(
  supabase: SupabaseClient<Database>,
  id: string
): Promise<AssetWithRelations | null> {
  const { data, error } = await supabase
    .from("assets")
    .select(ASSET_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("getAssetById failed:", error.message);
    return null;
  }
  return data as AssetWithRelations | null;
}

export async function getAssetActivity(
  supabase: SupabaseClient<Database>,
  assetId: string
): Promise<AssetActivityWithActor[]> {
  const { data, error } = await supabase
    .from("asset_activity")
    .select("*, actor:profiles(full_name, email)")
    .eq("asset_id", assetId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getAssetActivity failed:", error.message);
    return [];
  }
  return (data ?? []) as AssetActivityWithActor[];
}

export async function getAssetAttachments(
  supabase: SupabaseClient<Database>,
  assetId: string
): Promise<AssetAttachmentWithUploader[]> {
  const { data, error } = await supabase
    .from("asset_attachments")
    .select("*, uploader:profiles(full_name, email)")
    .eq("asset_id", assetId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getAssetAttachments failed:", error.message);
    return [];
  }
  return (data ?? []) as AssetAttachmentWithUploader[];
}

/** Lightweight KPI counts for the assets landing view. */
export async function getAssetSummary(
  supabase: SupabaseClient<Database>
): Promise<{ total: number; byStatus: { code: string; name: string; count: number }[] }> {
  const { data, error } = await supabase
    .from("assets")
    .select("status:asset_statuses(code, name)")
    .eq("is_active", true);

  if (error || !data) {
    return { total: 0, byStatus: [] };
  }

  const counts = new Map<string, { code: string; name: string; count: number }>();
  for (const row of data as unknown as { status: { code: string; name: string } | null }[]) {
    if (!row.status) continue;
    const existing = counts.get(row.status.code);
    if (existing) existing.count += 1;
    else counts.set(row.status.code, { code: row.status.code, name: row.status.name, count: 1 });
  }

  return { total: data.length, byStatus: Array.from(counts.values()) };
}

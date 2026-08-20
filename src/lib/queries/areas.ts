import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import type { Area, AreaWithLocation } from "@/lib/types/facility";

export async function getAreasForLocation(
  supabase: SupabaseClient<Database>,
  locationId: string,
  opts: { includeInactive?: boolean } = {}
): Promise<Area[]> {
  let query = supabase
    .from("areas")
    .select("*")
    .eq("location_id", locationId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (!opts.includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) {
    console.error("getAreasForLocation failed:", error.message);
    return [];
  }
  return data ?? [];
}

/** All active areas across the org, each with its location name — used to populate
 *  the Asset Register's area filter and the asset form's dependent selects. */
export async function getAllAreas(
  supabase: SupabaseClient<Database>
): Promise<AreaWithLocation[]> {
  const { data, error } = await supabase
    .from("areas")
    .select("*, location:locations(id, name)")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    console.error("getAllAreas failed:", error.message);
    return [];
  }
  return (data ?? []) as AreaWithLocation[];
}

export async function getAreaById(
  supabase: SupabaseClient<Database>,
  id: string
): Promise<Area | null> {
  const { data, error } = await supabase
    .from("areas")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("getAreaById failed:", error.message);
    return null;
  }
  return data;
}

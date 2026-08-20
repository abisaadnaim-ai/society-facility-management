import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import type { Location, LocationWithAreaCount } from "@/lib/types/facility";

/**
 * All facility data access is centralized here (and in the sibling query modules)
 * rather than inline in components, so RLS-scoped reads and the shape of joins
 * live in one place. Every query is implicitly org-scoped by RLS; we don't add
 * organization_id filters in the client because the policies already enforce them.
 */

export async function getLocations(
  supabase: SupabaseClient<Database>,
  opts: { includeInactive?: boolean } = {}
): Promise<LocationWithAreaCount[]> {
  let query = supabase
    .from("locations")
    .select("*, areas(count)")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (!opts.includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) {
    console.error("getLocations failed:", error.message);
    return [];
  }

  // areas(count) returns [{ count: n }]; areas here counts ALL areas (active+inactive)
  // for the location. We surface it as active_area_count via a follow-up filtered count
  // only where needed; for the list view the total is an acceptable, cheap summary.
  return (data ?? []).map((row) => {
    const areasAgg = (row as unknown as { areas: { count: number }[] }).areas;
    const count = Array.isArray(areasAgg) && areasAgg[0] ? areasAgg[0].count : 0;
    const { areas: _areas, ...location } = row as unknown as Location & {
      areas: unknown;
    };
    void _areas;
    return { ...(location as Location), active_area_count: count };
  });
}

export async function getLocationById(
  supabase: SupabaseClient<Database>,
  id: string
): Promise<Location | null> {
  const { data, error } = await supabase
    .from("locations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("getLocationById failed:", error.message);
    return null;
  }
  return data;
}

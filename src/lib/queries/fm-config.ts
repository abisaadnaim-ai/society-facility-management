import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import type {
  FmCategory,
  FmPriority,
  FmRequestStatus,
  WorkOrderStatus,
  PersonOption,
} from "@/lib/types/fm";

/** Lightweight asset option for the Location -> Area -> Asset picker. */
export type AssetOption = {
  id: string;
  name: string;
  location_id: string;
  area_id: string | null;
};

export async function getFmCategories(
  supabase: SupabaseClient<Database>
): Promise<FmCategory[]> {
  const { data, error } = await supabase
    .from("fm_categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) {
    console.error("getFmCategories failed:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getFmPriorities(
  supabase: SupabaseClient<Database>
): Promise<FmPriority[]> {
  const { data, error } = await supabase
    .from("fm_priorities")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) {
    console.error("getFmPriorities failed:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getFmRequestStatuses(
  supabase: SupabaseClient<Database>
): Promise<FmRequestStatus[]> {
  const { data, error } = await supabase
    .from("fm_request_statuses")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) {
    console.error("getFmRequestStatuses failed:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getWorkOrderStatuses(
  supabase: SupabaseClient<Database>
): Promise<WorkOrderStatus[]> {
  const { data, error } = await supabase
    .from("work_order_statuses")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) {
    console.error("getWorkOrderStatuses failed:", error.message);
    return [];
  }
  return data ?? [];
}

/** Active users with the Technician role (for Work Order assignment). */
export async function getTechnicianOptions(
  supabase: SupabaseClient<Database>
): Promise<PersonOption[]> {
  const { data: role } = await supabase
    .from("roles")
    .select("id")
    .eq("code", "technician")
    .maybeSingle();
  if (!role) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("role_id", role.id)
    .eq("is_active", true)
    .order("full_name", { ascending: true });
  if (error) {
    console.error("getTechnicianOptions failed:", error.message);
    return [];
  }
  return (data ?? []) as PersonOption[];
}

/** All active people in the org (used for the requester filter). */
export async function getOrgPeople(
  supabase: SupabaseClient<Database>
): Promise<PersonOption[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("is_active", true)
    .order("full_name", { ascending: true });
  if (error) {
    console.error("getOrgPeople failed:", error.message);
    return [];
  }
  return (data ?? []) as PersonOption[];
}

/** Active assets as lightweight options for the dependent picker. */
export async function getAssetOptions(
  supabase: SupabaseClient<Database>
): Promise<AssetOption[]> {
  const { data, error } = await supabase
    .from("assets")
    .select("id, name, location_id, area_id")
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) {
    console.error("getAssetOptions failed:", error.message);
    return [];
  }
  return (data ?? []) as AssetOption[];
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/queries/get-session-profile";
import { getMovements, getStockLocationOptions } from "@/lib/queries/inventory";
import { MovementsView } from "@/components/facility/movements-view";
import type { RoleCode } from "@/lib/types/auth";

export default async function MovementsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const profile = user ? await getSessionProfile(supabase, user.id) : null;
  const role = (profile?.role?.code ?? null) as RoleCode | null;
  if (role === "requester") redirect("/dashboard");

  const [movements, stockLocations] = await Promise.all([
    getMovements(supabase),
    getStockLocationOptions(supabase),
  ]);

  return <MovementsView movements={movements} stockLocations={stockLocations} />;
}

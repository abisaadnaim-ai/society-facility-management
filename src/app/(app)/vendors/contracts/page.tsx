import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/queries/get-session-profile";
import { getContracts, getVendorOptions } from "@/lib/queries/vendors";
import { getLocations } from "@/lib/queries/locations";
import { ContractsView } from "@/components/facility/contracts-view";
import type { RoleCode } from "@/lib/types/auth";

export default async function ContractsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = user ? await getSessionProfile(supabase, user.id) : null;
  const role = (profile?.role?.code ?? null) as RoleCode | null;
  if (role === "requester") redirect("/dashboard");
  const canManage = role === "super_admin" || role === "facility_manager";

  const [contracts, vendors, locations] = await Promise.all([
    getContracts(supabase),
    getVendorOptions(supabase),
    getLocations(supabase, { includeInactive: false }),
  ]);

  return <ContractsView contracts={contracts} vendors={vendors} locations={locations} canManage={canManage} />;
}

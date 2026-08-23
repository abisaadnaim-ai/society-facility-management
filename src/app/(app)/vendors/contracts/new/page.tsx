import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/queries/get-session-profile";
import { getVendorOptions, getVendorContactsLite } from "@/lib/queries/vendors";
import { getLocations } from "@/lib/queries/locations";
import { getAssetOptions } from "@/lib/queries/fm-config";
import { PageHeader } from "@/components/shared/page-header";
import { ContractForm } from "@/components/facility/contract-form";
import type { RoleCode } from "@/lib/types/auth";

export default async function NewContractPage({
  searchParams,
}: {
  searchParams: Promise<{ vendor?: string }>;
}) {
  const { vendor: vendorId } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = user ? await getSessionProfile(supabase, user.id) : null;
  const role = (profile?.role?.code ?? null) as RoleCode | null;
  if (role !== "super_admin" && role !== "facility_manager") redirect("/vendors/contracts");

  const [vendors, locations, assets, contacts] = await Promise.all([
    getVendorOptions(supabase),
    getLocations(supabase, { includeInactive: false }),
    getAssetOptions(supabase),
    getVendorContactsLite(supabase),
  ]);

  return (
    <div>
      <PageHeader title="New Service Contract" description="Create an AMC, service agreement, or warranty contract." />
      <ContractForm vendors={vendors} locations={locations} assets={assets} contacts={contacts} defaultVendorId={vendorId} />
    </div>
  );
}

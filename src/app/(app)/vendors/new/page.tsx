import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/queries/get-session-profile";
import { getVendorCategories } from "@/lib/queries/vendors";
import { PageHeader } from "@/components/shared/page-header";
import { VendorForm } from "@/components/facility/vendor-form";
import type { RoleCode } from "@/lib/types/auth";

export default async function NewVendorPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = user ? await getSessionProfile(supabase, user.id) : null;
  const role = (profile?.role?.code ?? null) as RoleCode | null;
  if (role !== "super_admin" && role !== "facility_manager") redirect("/vendors");

  const categories = await getVendorCategories(supabase);

  return (
    <div>
      <PageHeader title="New Vendor" description="Register a service provider or maintenance partner." />
      <VendorForm categories={categories} />
    </div>
  );
}

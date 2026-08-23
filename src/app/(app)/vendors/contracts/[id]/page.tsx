import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/queries/get-session-profile";
import { getContractById } from "@/lib/queries/vendors";
import { ContractDetailView } from "@/components/facility/contract-detail-view";
import type { RoleCode } from "@/lib/types/auth";

export default async function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = user ? await getSessionProfile(supabase, user.id) : null;
  const role = (profile?.role?.code ?? null) as RoleCode | null;
  if (role === "requester") redirect("/dashboard");
  const canManage = role === "super_admin" || role === "facility_manager";

  const contract = await getContractById(supabase, id);
  if (!contract) notFound();

  return <ContractDetailView contract={contract} canManage={canManage} orgId={profile?.organization_id ?? ""} />;
}

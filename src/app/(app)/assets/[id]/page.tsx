import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/queries/get-session-profile";
import { getAssetById, getAssetActivity, getAssetAttachments } from "@/lib/queries/assets";
import { canManageFacility } from "@/lib/auth/permissions";
import { AssetDetailView } from "@/components/facility/asset-detail-view";

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = user ? await getSessionProfile(supabase, user.id) : null;

  const asset = await getAssetById(supabase, id);
  if (!asset) notFound();

  const [activity, attachments] = await Promise.all([
    getAssetActivity(supabase, id),
    getAssetAttachments(supabase, id),
  ]);

  return (
    <AssetDetailView
      asset={asset}
      activity={activity}
      attachments={attachments}
      canManage={canManageFacility(profile)}
      organizationId={profile?.organization_id ?? ""}
    />
  );
}

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/queries/get-session-profile";
import {
  getFmRequestById,
  getFmRequestActivity,
  getFmRequestComments,
  getFmRequestAttachments,
} from "@/lib/queries/fm-requests";
import { getAllAreas } from "@/lib/queries/areas";
import { getFmCategories, getFmPriorities, getAssetOptions } from "@/lib/queries/fm-config";
import { FmRequestDetailView } from "@/components/facility/fm-request-detail-view";
import type { RoleCode } from "@/lib/types/auth";

export default async function FmRequestDetailPage({
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
  const role = (profile?.role?.code ?? null) as RoleCode | null;

  const request = await getFmRequestById(supabase, id);
  if (!request) notFound();

  const [activity, comments, attachments, categories, priorities, areas, assets] = await Promise.all([
    getFmRequestActivity(supabase, id),
    getFmRequestComments(supabase, id),
    getFmRequestAttachments(supabase, id),
    getFmCategories(supabase),
    getFmPriorities(supabase),
    getAllAreas(supabase),
    getAssetOptions(supabase),
  ]);

  return (
    <FmRequestDetailView
      request={request}
      activity={activity}
      comments={comments}
      attachments={attachments}
      role={role}
      userId={user?.id ?? ""}
      organizationId={profile?.organization_id ?? ""}
      categories={categories}
      priorities={priorities}
      areas={areas}
      assets={assets}
    />
  );
}

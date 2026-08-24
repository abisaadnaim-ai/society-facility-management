import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/queries/get-session-profile";
import { getNotifications } from "@/lib/queries/notifications";
import { NotificationsView } from "@/components/facility/notifications-view";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = user ? await getSessionProfile(supabase, user.id) : null;
  if (!profile) redirect("/login");

  const notifications = await getNotifications(supabase, profile.id);
  return <NotificationsView notifications={notifications} />;
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/queries/get-session-profile";
import { SessionProvider } from "@/lib/auth/session-context";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // The proxy (middleware) already redirects unauthenticated requests to /login
  // before they reach this layout. This check is defense in depth, not the
  // primary guard -- if it somehow fires, treat it the same way: bounce to login.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await getSessionProfile(supabase, user.id);

  // Missing profile: the signup trigger didn't run, or the row was removed.
  // This is a data-integrity problem, not a normal "not logged in" case.
  if (!profile) {
    redirect("/setup-error");
  }

  // Inactive accounts don't get normal access, even though middleware already
  // checked this -- same defense-in-depth reasoning as above.
  if (!profile.is_active) {
    redirect("/account-disabled");
  }

  return (
    <SessionProvider profile={profile}>
      <AppShell>{children}</AppShell>
    </SessionProvider>
  );
}

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/types/database";

// Paths reachable without a normal authenticated session. This includes both
// truly public pages (login, forgot-password) and pages that require a
// *recovery* session but not a normal one (reset-password), plus the pages a
// blocked authenticated user is redirected to (account-disabled, setup-error)
// -- those must stay public or the redirect itself would loop.
const PUBLIC_PATHS = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/account-disabled",
  "/setup-error",
  "/auth", // /auth/confirm route handler
];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const isPublicPath = PUBLIC_PATHS.some(
    (path) => request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(`${path}/`)
  );

  let user;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    user = data.user;
  } catch {
    // Network/Supabase outage: fail closed on protected routes rather than
    // letting a broken auth check silently grant access, but don't block
    // pages that are supposed to be reachable without a session anyway.
    if (isPublicPath) return response;
    return NextResponse.redirect(new URL("/login?error=network", request.url));
  }

  if (!user) {
    if (isPublicPath) return response;
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // User has a session. Public auth pages (login, forgot-password) don't need
  // further checks even when already signed in -- e.g. reset-password relies
  // on a *recovery* session existing, so it must stay reachable regardless.
  if (isPublicPath) return response;

  // Protected route: verify the profile exists and is active. This mirrors
  // the same check the (app) layout performs server-side -- defense in depth,
  // since middleware runs first and covers any protected route, not just
  // ones under the (app) layout.
  try {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (error) throw error;

    if (!profile) {
      return NextResponse.redirect(new URL("/setup-error", request.url));
    }
    if (!profile.is_active) {
      return NextResponse.redirect(new URL("/account-disabled", request.url));
    }
  } catch {
    return NextResponse.redirect(new URL("/login?error=network", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

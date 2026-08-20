import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Handles the link Supabase Auth emails for password recovery (and, later,
 * any other email-based flow such as invite/signup confirmation, though
 * Phase 1 has no public signup). The Supabase "Reset Password" email
 * template must point here: {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password
 * This is a manual one-time configuration step in the Supabase dashboard
 * (Authentication -> Email Templates) -- there is no API to set it from code.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/reset-password";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=invalid-reset-link`);
}

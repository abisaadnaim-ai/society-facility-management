import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

/**
 * Supabase client authenticated with the server-side SECRET key.
 *
 * SECURITY:
 *  - The secret is read from a NON-public env var and is never a NEXT_PUBLIC_*
 *    variable, so Next.js never inlines it into any client bundle — it exists
 *    only in the server runtime.
 *  - Prefers the modern `SUPABASE_SECRET_KEY` (sb_secret_...). Falls back to the
 *    legacy `SUPABASE_SERVICE_ROLE_KEY` for backward compatibility during
 *    migration; the legacy fallback can be removed once the new secret is set.
 *  - This module is imported only from server actions ("use server"), and the
 *    guard below hard-fails if it is ever evaluated in a browser context.
 *  - Use strictly for privileged admin operations (e.g. creating prototype users
 *    via the Auth Admin API). All normal user-facing reads/writes must keep
 *    going through the RLS-scoped anon client in `@/lib/supabase/server`.
 */
export function createAdminClient(): SupabaseClient<Database> {
  if (typeof window !== "undefined") {
    throw new Error("createAdminClient must never run in the browser.");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !secretKey) {
    throw new Error("ADMIN_CREDENTIALS_NOT_CONFIGURED");
  }

  return createClient<Database>(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

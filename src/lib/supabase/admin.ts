import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

/**
 * Supabase client authenticated with the SERVICE ROLE key.
 *
 * SECURITY:
 *  - The service-role key is read from a NON-public env var
 *    (SUPABASE_SERVICE_ROLE_KEY, never NEXT_PUBLIC_*), so Next.js never inlines
 *    it into any client bundle — it exists only in the server runtime.
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
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("ADMIN_CREDENTIALS_NOT_CONFIGURED");
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

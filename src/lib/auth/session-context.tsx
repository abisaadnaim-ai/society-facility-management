"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { SessionProfile } from "@/lib/types/auth";

const SessionContext = createContext<SessionProfile | null>(null);

/**
 * Provides the current user's profile (with role + organization joined) to
 * any client component in the authenticated app shell, without prop-drilling
 * or a redundant client-side fetch. The value is fetched once, server-side,
 * in the (app) layout -- this context only distributes it.
 */
export function SessionProvider({
  profile,
  children,
}: {
  profile: SessionProfile;
  children: ReactNode;
}) {
  return <SessionContext.Provider value={profile}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionProfile {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider (inside the (app) layout).");
  }
  return context;
}

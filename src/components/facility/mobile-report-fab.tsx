"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/auth/session-context";

/**
 * Prominent, always-reachable "Report an Issue" action for operational staff on
 * mobile. Shown only to roles that can raise FM requests, hidden on desktop
 * (the sidebar covers that), and hidden on the request form itself.
 */
export function MobileReportFab() {
  const profile = useSession();
  const pathname = usePathname();
  const role = profile.role?.code ?? null;
  const canReport = role === "requester" || role === "facility_manager" || role === "super_admin";

  if (!canReport) return null;
  if (pathname.startsWith("/fm-requests/new")) return null;

  return (
    <Link
      href="/fm-requests/new"
      aria-label="Report an Issue"
      className="fixed bottom-5 right-4 z-40 flex items-center gap-2 rounded-full bg-[#DD7927] px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-orange-900/20 active:scale-95 md:hidden"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      Report an Issue
    </Link>
  );
}

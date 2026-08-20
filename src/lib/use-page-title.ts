"use client";

import { usePathname } from "next/navigation";
import { ALL_NAV_ITEMS } from "@/lib/nav-items";

export function usePageTitle(): string {
  const pathname = usePathname();

  // Longest matching href wins, so /settings/asset-categories beats /settings.
  let best: { label: string; len: number } | null = null;
  for (const item of ALL_NAV_ITEMS) {
    if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
      if (!best || item.href.length > best.len) {
        best = { label: item.label, len: item.href.length };
      }
    }
  }
  return best?.label ?? "Society Facility Management";
}

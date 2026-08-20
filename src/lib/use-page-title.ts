"use client";

import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/nav-items";

export function usePageTitle(): string {
  const pathname = usePathname();
  const match = NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  );
  return match?.label ?? "Society Facility Management";
}

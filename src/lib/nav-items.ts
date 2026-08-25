import type { SessionProfile } from "@/lib/types/auth";
import { canManageConfiguration, canViewReports } from "@/lib/auth/permissions";

export type NavItem = {
  label: string;
  href: string;
  /** If set, the item only renders when the predicate passes for the current user. */
  visible?: (profile: SessionProfile) => boolean;
};

export type NavGroup = {
  label: string | null;
  items: NavItem[];
};

/**
 * Grouped navigation. Areas are intentionally NOT a top-level item - they are
 * managed inside each Location's detail page, matching the
 * Organization -> Location -> Area -> Asset hierarchy. Settings sub-pages for
 * asset configuration are Super Admin only.
 */
export const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: null,
    items: [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Assets", href: "/assets" },
      { label: "Locations", href: "/locations" },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "FM Requests", href: "/fm-requests" },
      { label: "Work Orders", href: "/work-orders" },
      { label: "Preventive Maintenance", href: "/preventive-maintenance" },
      { label: "Inspections", href: "/inspections", visible: (p) => p.role?.code !== "requester" },
    ],
  },
  {
    label: "Supply",
    items: [
      { label: "Vendors", href: "/vendors", visible: (p) => p.role?.code !== "requester" },
      { label: "Inventory", href: "/inventory", visible: (p) => p.role?.code !== "requester" },
    ],
  },
  {
    label: "Insights & Config",
    items: [
      { label: "Reports", href: "/reports", visible: canViewReports },
      { label: "User Management", href: "/settings/users", visible: canManageConfiguration },
      { label: "Asset Categories", href: "/settings/asset-categories", visible: canManageConfiguration },
      { label: "Asset Statuses", href: "/settings/asset-statuses", visible: canManageConfiguration },
      { label: "Inventory Setup", href: "/inventory/setup", visible: canManageConfiguration },
      {
        label: "SLA Rules",
        href: "/settings/sla-rules",
        visible: (p) => p.role?.code === "super_admin" || p.role?.code === "facility_manager",
      },
      { label: "Settings", href: "/settings" },
    ],
  },
];

/** Flat list of every href -> label, for the header page-title lookup. */
export const ALL_NAV_ITEMS: readonly NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export function visibleNavGroups(profile: SessionProfile): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.visible || item.visible(profile)),
  })).filter((group) => group.items.length > 0);
}

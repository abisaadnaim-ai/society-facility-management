export type NavItem = {
  label: string;
  href: string;
};

export const NAV_ITEMS: readonly NavItem[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Work Orders", href: "/work-orders" },
  { label: "Assets", href: "/assets" },
  { label: "Locations", href: "/locations" },
  { label: "Areas", href: "/areas" },
  { label: "Preventive Maintenance", href: "/preventive-maintenance" },
  { label: "Inspections", href: "/inspections" },
  { label: "Vendors", href: "/vendors" },
  { label: "Inventory", href: "/inventory" },
  { label: "Reports", href: "/reports" },
  { label: "Settings", href: "/settings" },
];

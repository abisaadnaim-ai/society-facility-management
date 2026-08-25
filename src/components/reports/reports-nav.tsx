"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const TABS: { href: string; label: string }[] = [
  { href: "/reports", label: "Overview" },
  { href: "/reports/fm-requests", label: "FM Requests" },
  { href: "/reports/work-orders", label: "Work Orders" },
  { href: "/reports/assets", label: "Assets" },
  { href: "/reports/ppm", label: "PPM" },
  { href: "/reports/inspections", label: "Inspections" },
  { href: "/reports/vendors", label: "Vendors" },
  { href: "/reports/inventory", label: "Inventory" },
  { href: "/reports/sla", label: "SLA" },
];

export function ReportsNav() {
  const pathname = usePathname();
  const sp = useSearchParams();
  const qs = sp.toString();

  return (
    <nav className="mb-5 overflow-x-auto border-b border-slate-200 print:hidden">
      <ul className="flex min-w-max gap-1">
        {TABS.map((t) => {
          const active = pathname === t.href;
          return (
            <li key={t.href}>
              <Link
                href={qs ? `${t.href}?${qs}` : t.href}
                className={[
                  "inline-block whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "border-slate-900 text-slate-900"
                    : "border-transparent text-slate-500 hover:text-slate-800",
                ].join(" ")}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

import Link from "next/link";
import type { RoleCode } from "@/lib/types/auth";

type Counts = {
  newRequests: number;
  underReview: number;
  openWorkOrders: number;
  inProgress: number;
  waiting: number;
  completedAwaitingVerification: number;
  criticalOpen: number;
};
type Ppm = { dueToday: number; dueNext7Days: number; overdue: number; openPpmWorkOrders: number };

type Tile = { label: string; value?: number; href: string; highlight?: boolean };

function ActionTile({ label, value, href, highlight }: Tile) {
  return (
    <Link
      href={href}
      className={[
        "flex min-h-[76px] flex-col justify-between rounded-xl border bg-white p-3.5 active:scale-[0.99]",
        highlight && (value ?? 0) > 0 ? "border-red-200" : "border-slate-200",
      ].join(" ")}
    >
      {value !== undefined ? (
        <span
          className={[
            "text-2xl font-semibold leading-none",
            highlight && value > 0 ? "text-red-600" : "text-slate-900",
          ].join(" ")}
        >
          {value}
        </span>
      ) : (
        <span className="text-slate-400" aria-hidden>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      )}
      <span className="text-xs font-medium leading-tight text-slate-600">{label}</span>
    </Link>
  );
}

/** Mobile-first, role-aware quick actions shown at the top of the dashboard. */
export function DashboardQuickActions({
  role,
  counts,
  ppm,
}: {
  role: RoleCode | null;
  counts: Counts;
  ppm: Ppm;
}) {
  const canReport = role === "requester" || role === "facility_manager" || role === "super_admin";

  let tiles: Tile[] = [];
  if (role === "requester") {
    tiles = [
      { label: "My open requests", value: counts.newRequests + counts.underReview, href: "/fm-requests" },
      { label: "All my requests", href: "/fm-requests" },
    ];
  } else if (role === "technician") {
    tiles = [
      { label: "Open work orders", value: counts.openWorkOrders, href: "/work-orders" },
      { label: "In progress", value: counts.inProgress, href: "/work-orders" },
      { label: "PPM work orders", value: ppm.openPpmWorkOrders, href: "/work-orders" },
      { label: "Upcoming PPM", href: "/preventive-maintenance/schedule" },
    ];
  } else if (role === "facility_manager" || role === "super_admin") {
    tiles = [
      { label: "New FM requests", value: counts.newRequests, href: "/fm-requests" },
      { label: "Awaiting verification", value: counts.completedAwaitingVerification, href: "/work-orders" },
      { label: "Critical open", value: counts.criticalOpen, href: "/work-orders", highlight: true },
      { label: "PPM due today", value: ppm.dueToday, href: "/preventive-maintenance/schedule" },
    ];
  } else {
    // Viewer: read-only, no quick actions (the stat cards below cover it).
    return null;
  }

  return (
    <div className="mb-6">
      {canReport && (
        <Link
          href="/fm-requests/new"
          className="mb-3 flex items-center justify-center gap-2 rounded-xl bg-[#DD7927] px-4 py-4 text-base font-semibold text-white shadow-sm active:scale-[0.99]"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          Report an Issue
        </Link>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((t) => (
          <ActionTile key={t.label} {...t} />
        ))}
      </div>
    </div>
  );
}

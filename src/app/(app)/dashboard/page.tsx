import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/queries/get-session-profile";
import { getOperationsDashboard } from "@/lib/queries/operations-dashboard";
import { getPpmSummary } from "@/lib/queries/ppm";
import { getInspectionSummary } from "@/lib/queries/inspections";
import {
  getVendorDashboardMetrics,
  getExpiringContracts,
  getWorkOrdersWaitingForVendor,
} from "@/lib/queries/vendors";
import { getInventoryDashboardMetrics, getLowStockItems } from "@/lib/queries/inventory";
import { fmtQty } from "@/lib/types/inventory";
import { formatDate } from "@/lib/format";
import { DashboardQuickActions } from "@/components/facility/dashboard-quick-actions";
import { ContractStateBadge } from "@/components/facility/vendor-badges";
import type { RoleCode } from "@/lib/types/auth";
import {
  RequestStatusBadge,
  WorkOrderStatusBadge,
  PriorityBadge,
} from "@/components/facility/status-badges";

function StatCard({
  label,
  value,
  href,
  highlight,
}: {
  label: string;
  value: number;
  href: string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={[
        "rounded-lg border bg-white p-4 transition-colors hover:bg-slate-50",
        highlight && value > 0 ? "border-red-200" : "border-slate-200",
      ].join(" ")}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={[
          "mt-1 text-2xl font-semibold",
          highlight && value > 0 ? "text-red-600" : "text-slate-900",
        ].join(" ")}
      >
        {value}
      </p>
    </Link>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = user ? await getSessionProfile(supabase, user.id) : null;
  const firstName = (profile?.full_name ?? profile?.email ?? "there").split(" ")[0];

  const { counts, recentRequests, recentWorkOrders } = await getOperationsDashboard(supabase);
  const ppm = await getPpmSummary(supabase);
  const role = (profile?.role?.code ?? null) as RoleCode | null;
  const inspections = role === "requester" ? null : await getInspectionSummary(supabase);
  const vendorMetrics = role === "requester" ? null : await getVendorDashboardMetrics(supabase);
  const expiringContracts = role === "requester" ? [] : await getExpiringContracts(supabase, 60);
  const waitingVendorWOs = role === "requester" ? [] : await getWorkOrdersWaitingForVendor(supabase);
  const inventoryMetrics = role === "requester" ? null : await getInventoryDashboardMetrics(supabase);
  const lowStockItems = role === "requester" ? [] : await getLowStockItems(supabase, 8);

  return (
    <div>
      <div className="mb-6">
        <p className="text-sm font-medium text-slate-500">Facility Operations</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Welcome, {firstName}</h1>
      </div>

      <DashboardQuickActions role={role} counts={counts} ppm={ppm} />

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="New requests" value={counts.newRequests} href="/fm-requests" />
        <StatCard label="Under review" value={counts.underReview} href="/fm-requests" />
        <StatCard label="Open work orders" value={counts.openWorkOrders} href="/work-orders" />
        <StatCard label="In progress" value={counts.inProgress} href="/work-orders" />
        <StatCard label="Waiting / on hold" value={counts.waiting} href="/work-orders" />
        <StatCard label="Awaiting verification" value={counts.completedAwaitingVerification} href="/work-orders" />
        <StatCard label="Critical open" value={counts.criticalOpen} href="/work-orders" highlight />
      </div>

      <div className="mb-8">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Preventive Maintenance</h2>
          <Link href="/preventive-maintenance" className="text-sm text-slate-500 hover:text-slate-900">View all</Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="PPM due today" value={ppm.dueToday} href="/preventive-maintenance" />
          <StatCard label="PPM due next 7 days" value={ppm.dueNext7Days} href="/preventive-maintenance" />
          <StatCard label="PPM overdue" value={ppm.overdue} href="/preventive-maintenance" highlight />
          <StatCard label="Open PPM work orders" value={ppm.openPpmWorkOrders} href="/work-orders" />
        </div>
      </div>

      {inspections && (
        <div className="mb-8">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Inspections</h2>
            <Link href="/inspections" className="text-sm text-slate-500 hover:text-slate-900">View all</Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Due today" value={inspections.dueToday} href="/inspections" />
            <StatCard label="Overdue" value={inspections.overdue} href="/inspections" highlight />
            <StatCard label="In progress" value={inspections.inProgress} href="/inspections" />
            <StatCard label="Awaiting review" value={inspections.awaitingReview} href="/inspections" />
            <StatCard label="Failed" value={inspections.failedInspections} href="/inspections" highlight />
            <StatCard label="Open findings" value={inspections.openFindings} href="/inspections/findings" highlight />
          </div>
        </div>
      )}

      {vendorMetrics && (
        <div className="mb-8">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Vendors &amp; Service Contracts</h2>
            <Link href="/vendors" className="text-sm text-slate-500 hover:text-slate-900">View all</Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Active vendors" value={vendorMetrics.activeVendors} href="/vendors" />
            <StatCard label="Active contracts" value={vendorMetrics.activeContracts} href="/vendors/contracts" />
            <StatCard label="Expiring in 30 days" value={vendorMetrics.expiring30} href="/vendors/contracts" highlight />
            <StatCard label="Expiring in 60 days" value={vendorMetrics.expiring60} href="/vendors/contracts" />
            <StatCard label="Expired contracts" value={vendorMetrics.expired} href="/vendors/contracts" highlight />
            <StatCard label="WOs waiting for vendor" value={vendorMetrics.openWorkOrdersWaitingVendor} href="/work-orders" />
          </div>

          {(expiringContracts.length > 0 || waitingVendorWOs.length > 0) && (
            <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
              {expiringContracts.length > 0 && (
                <section className="rounded-lg border border-slate-200 bg-white p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900">Contracts Expiring Soon</h3>
                    <Link href="/vendors/contracts" className="text-sm text-slate-500 hover:text-slate-900">View all</Link>
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {expiringContracts.map((c) => (
                      <li key={c.id}>
                        <Link href={`/vendors/contracts/${c.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:opacity-80">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-900">{c.name}</p>
                            <p className="text-xs text-slate-500">{c.vendor_name} - expires {formatDate(c.end_date)}</p>
                          </div>
                          <ContractStateBadge state={c.state} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {waitingVendorWOs.length > 0 && (
                <section className="rounded-lg border border-slate-200 bg-white p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900">Work Orders Waiting for Vendor</h3>
                    <Link href="/work-orders" className="text-sm text-slate-500 hover:text-slate-900">View all</Link>
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {waitingVendorWOs.map((w) => (
                      <li key={w.id}>
                        <Link href={`/work-orders/${w.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:opacity-80">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-900">{w.title}</p>
                            <p className="text-xs text-slate-500">{w.work_order_number}{w.vendor_name ? ` - ${w.vendor_name}` : ""}</p>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}
        </div>
      )}

      {inventoryMetrics && (
        <div className="mb-8">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Inventory &amp; Spare Parts</h2>
            <Link href="/inventory" className="text-sm text-slate-500 hover:text-slate-900">View all</Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Total items" value={inventoryMetrics.totalItems} href="/inventory" />
            <StatCard label="Low stock items" value={inventoryMetrics.lowStockItems} href="/inventory" highlight />
            <StatCard label="Out of stock" value={inventoryMetrics.outOfStockItems} href="/inventory" highlight />
            <StatCard label="Issued this month" value={inventoryMetrics.issuedThisMonth} href="/inventory/movements" />
          </div>

          {lowStockItems.length > 0 && (
            <section className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Low Stock Items</h3>
                <Link href="/inventory" className="text-sm text-slate-500 hover:text-slate-900">View all</Link>
              </div>
              <ul className="divide-y divide-slate-100">
                {lowStockItems.map((i) => (
                  <li key={i.id}>
                    <Link href={`/inventory/${i.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:opacity-80">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">{i.name}</p>
                        <p className="text-xs text-slate-500">{i.item_code}</p>
                      </div>
                      <p className="shrink-0 text-sm text-slate-600">
                        {fmtQty(i.total_stock)}{i.minimum_stock_level != null ? ` / min ${fmtQty(i.minimum_stock_level)}` : ""}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Recent FM Requests</h2>
            <Link href="/fm-requests" className="text-sm text-slate-500 hover:text-slate-900">View all</Link>
          </div>
          {recentRequests.length === 0 ? (
            <p className="text-sm text-slate-500">No FM requests yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentRequests.map((r) => (
                <li key={r.id}>
                  <Link href={`/fm-requests/${r.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:opacity-80">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{r.title}</p>
                      <p className="text-xs text-slate-500">
                        {r.request_number} - {r.location?.name ?? "-"} - {formatDate(r.created_at)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <PriorityBadge priority={r.priority} />
                      <RequestStatusBadge status={r.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Recent Work Orders</h2>
            <Link href="/work-orders" className="text-sm text-slate-500 hover:text-slate-900">View all</Link>
          </div>
          {recentWorkOrders.length === 0 ? (
            <p className="text-sm text-slate-500">No work orders yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentWorkOrders.map((w) => (
                <li key={w.id}>
                  <Link href={`/work-orders/${w.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:opacity-80">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{w.title}</p>
                      <p className="text-xs text-slate-500">
                        {w.work_order_number} - {w.location?.name ?? "-"} - {formatDate(w.created_at)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <PriorityBadge priority={w.priority} />
                      <WorkOrderStatusBadge status={w.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

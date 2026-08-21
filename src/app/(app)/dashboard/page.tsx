import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/queries/get-session-profile";
import { getOperationsDashboard } from "@/lib/queries/operations-dashboard";
import { formatDate } from "@/lib/format";
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

  return (
    <div>
      <div className="mb-6">
        <p className="text-sm font-medium text-slate-500">Facility Operations</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Welcome, {firstName}</h1>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="New requests" value={counts.newRequests} href="/fm-requests" />
        <StatCard label="Under review" value={counts.underReview} href="/fm-requests" />
        <StatCard label="Open work orders" value={counts.openWorkOrders} href="/work-orders" />
        <StatCard label="In progress" value={counts.inProgress} href="/work-orders" />
        <StatCard label="Waiting / on hold" value={counts.waiting} href="/work-orders" />
        <StatCard label="Awaiting verification" value={counts.completedAwaitingVerification} href="/work-orders" />
        <StatCard label="Critical open" value={counts.criticalOpen} href="/work-orders" highlight />
      </div>

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

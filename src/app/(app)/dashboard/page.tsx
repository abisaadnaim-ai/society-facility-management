"use client";

import { useSession } from "@/lib/auth/session-context";
import { displayOrganizationName, displayRoleName } from "@/lib/auth/permissions";
import { Card, CardContent } from "@/components/ui/card";

export default function DashboardPage() {
  const profile = useSession();
  const firstName = (profile.full_name ?? profile.email ?? "there").split(" ")[0];

  return (
    <div className="max-w-2xl">
      <Card>
        <CardContent className="py-8">
          <p className="text-sm font-medium text-slate-500">Facility Management System</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            Welcome, {firstName}
          </h1>

          <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Organization
              </dt>
              <dd className="mt-1 text-sm text-slate-900">{displayOrganizationName(profile)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Role
              </dt>
              <dd className="mt-1 text-sm text-slate-900">{displayRoleName(profile)}</dd>
            </div>
          </dl>

          <p className="mt-6 text-sm text-slate-500">
            Operational metrics for work orders and assets will appear here once those
            modules are built in later phases.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

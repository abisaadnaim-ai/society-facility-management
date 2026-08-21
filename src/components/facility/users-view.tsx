"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { SearchField } from "@/components/shared/search-field";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate, formatDateTime } from "@/lib/format";
import type { AdminUserRow, RoleOption, LocationOption } from "@/lib/types/users";

function roleBadge(code: string | null): "info" | "neutral" {
  return code === "super_admin" || code === "facility_manager" ? "info" : "neutral";
}

export function UsersView({
  users,
  roles,
  locations,
  currentUserId,
}: {
  users: AdminUserRow[];
  roles: RoleOption[];
  locations: LocationOption[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return users.filter((u) => {
      if (term) {
        const hay = `${u.full_name ?? ""} ${u.email ?? ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      if (roleFilter && u.role_id !== roleFilter) return false;
      if (locationFilter && u.primary_location_id !== locationFilter) return false;
      if (statusFilter === "active" && !u.is_active) return false;
      if (statusFilter === "inactive" && u.is_active) return false;
      return true;
    });
  }, [users, q, roleFilter, locationFilter, statusFilter]);

  return (
    <div>
      <PageHeader
        title="User Management"
        description="Create and manage the people who can access Society Facility Management."
        actions={
          <Link href="/settings/users/new">
            <Button size="sm">Add User</Button>
          </Link>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <SearchField
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name or email..."
        />
        <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="">All roles</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </Select>
        <Select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
          <option value="">All locations</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </Select>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No users match your filters" description="Try clearing the search or filters." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Job Title</th>
                <th className="px-4 py-3 font-medium">Primary Location</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Last Sign In</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => router.push(`/settings/users/${u.id}`)}
                  className="cursor-pointer hover:bg-slate-50"
                >
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                    {u.full_name ?? "-"}
                    {u.id === currentUserId && (
                      <span className="ml-2 text-xs font-normal text-slate-400">(you)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{u.email ?? "-"}</td>
                  <td className="px-4 py-3">
                    <Badge variant={roleBadge(u.role_code)}>{u.role_name ?? "No role"}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{u.job_title ?? "-"}</td>
                  <td className="px-4 py-3 text-slate-600">{u.location_name ?? "-"}</td>
                  <td className="px-4 py-3">
                    <Badge variant={u.is_active ? "success" : "neutral"}>
                      {u.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                    {u.last_sign_in_at ? formatDateTime(u.last_sign_in_at) : "Never"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDate(u.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-slate-400">
        {filtered.length} of {users.length} user{users.length === 1 ? "" : "s"}
      </p>
    </div>
  );
}

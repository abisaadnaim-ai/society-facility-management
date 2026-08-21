"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { FilterContainer } from "@/components/shared/filter-container";
import { SearchField } from "@/components/shared/search-field";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/format";
import { ageLabel } from "@/lib/workflow";
import {
  RequestStatusBadge,
  PriorityBadge,
  personName,
} from "@/components/facility/status-badges";
import type {
  FmRequestRow,
  FmCategory,
  FmPriority,
  FmRequestStatus,
  PersonOption,
} from "@/lib/types/fm";

type LocationOpt = { id: string; name: string };

export function FmRequestsView({
  requests,
  locations,
  categories,
  priorities,
  statuses,
  people,
  canCreate,
}: {
  requests: FmRequestRow[];
  locations: LocationOpt[];
  categories: FmCategory[];
  priorities: FmPriority[];
  statuses: FmRequestStatus[];
  people: PersonOption[];
  canCreate: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [locationId, setLocationId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [priorityId, setPriorityId] = useState("");
  const [statusId, setStatusId] = useState("");
  const [requesterId, setRequesterId] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((r) => {
      if (locationId && r.location_id !== locationId) return false;
      if (categoryId && r.category_id !== categoryId) return false;
      if (priorityId && r.priority_id !== priorityId) return false;
      if (statusId && r.status_id !== statusId) return false;
      if (requesterId && r.requested_by !== requesterId) return false;
      if (q) {
        const hay = `${r.request_number} ${r.title} ${r.description ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [requests, search, locationId, categoryId, priorityId, statusId, requesterId]);

  return (
    <div>
      <PageHeader
        title="FM Requests"
        description="Reported facility issues awaiting review and action."
        actions={
          canCreate ? (
            <Link href="/fm-requests/new">
              <Button>New request</Button>
            </Link>
          ) : undefined
        }
      />

      <FilterContainer>
        <div className="w-full sm:max-w-xs">
          <SearchField
            placeholder="Search number, title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={locationId} onChange={(e) => setLocationId(e.target.value)} className="sm:w-44">
          <option value="">All locations</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </Select>
        <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="sm:w-44">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
        <Select value={priorityId} onChange={(e) => setPriorityId(e.target.value)} className="sm:w-36">
          <option value="">All priorities</option>
          {priorities.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </Select>
        <Select value={statusId} onChange={(e) => setStatusId(e.target.value)} className="sm:w-40">
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </Select>
        <Select value={requesterId} onChange={(e) => setRequesterId(e.target.value)} className="sm:w-44">
          <option value="">All requesters</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>{personName(p)}</option>
          ))}
        </Select>
      </FilterContainer>

      {filtered.length === 0 ? (
        <EmptyState
          title="No FM requests found"
          description={
            requests.length === 0
              ? "When issues are reported, they'll appear here."
              : "No requests match the current filters."
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Request #</th>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Location</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Priority</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Requested by</th>
                  <th className="px-4 py-3 font-medium">Age</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => router.push(`/fm-requests/${r.id}`)}
                    className="cursor-pointer hover:bg-slate-50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">{r.request_number}</td>
                    <td className="px-4 py-3 text-slate-700">{r.title}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {r.location?.name ?? "-"}
                      {r.area?.name ? ` - ${r.area.name}` : ""}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{r.category?.name ?? "-"}</td>
                    <td className="px-4 py-3"><PriorityBadge priority={r.priority} /></td>
                    <td className="px-4 py-3"><RequestStatusBadge status={r.status} /></td>
                    <td className="px-4 py-3 text-slate-600">{personName(r.requester)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{ageLabel(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {filtered.map((r) => (
              <Link
                key={r.id}
                href={`/fm-requests/${r.id}`}
                className="block rounded-lg border border-slate-200 bg-white p-4"
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-900">{r.request_number}</span>
                  <RequestStatusBadge status={r.status} />
                </div>
                <p className="mb-2 text-sm text-slate-700">{r.title}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <PriorityBadge priority={r.priority} />
                  <span>{r.location?.name ?? "-"}</span>
                  <span>- {r.category?.name ?? "-"}</span>
                  <span>- {formatDate(r.created_at)}</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

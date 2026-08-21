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
import {
  WorkOrderStatusBadge,
  PriorityBadge,
  personName,
} from "@/components/facility/status-badges";
import type {
  WorkOrderRow,
  FmCategory,
  FmPriority,
  WorkOrderStatus,
  PersonOption,
} from "@/lib/types/fm";

type LocationOpt = { id: string; name: string };

export function WorkOrdersView({
  workOrders,
  locations,
  categories,
  priorities,
  statuses,
  technicians,
  canCreate,
  currentUserId,
  isTechnician,
}: {
  workOrders: WorkOrderRow[];
  locations: LocationOpt[];
  categories: FmCategory[];
  priorities: FmPriority[];
  statuses: WorkOrderStatus[];
  technicians: PersonOption[];
  canCreate: boolean;
  currentUserId: string;
  isTechnician: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [locationId, setLocationId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [priorityId, setPriorityId] = useState("");
  const [statusId, setStatusId] = useState("");
  const [technicianId, setTechnicianId] = useState("");
  const [mineOnly, setMineOnly] = useState(isTechnician);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return workOrders.filter((w) => {
      if (mineOnly && w.assigned_to !== currentUserId) return false;
      if (locationId && w.location_id !== locationId) return false;
      if (categoryId && w.category_id !== categoryId) return false;
      if (priorityId && w.priority_id !== priorityId) return false;
      if (statusId && w.status_id !== statusId) return false;
      if (technicianId && w.assigned_to !== technicianId) return false;
      if (q) {
        const hay = `${w.work_order_number} ${w.title} ${w.description ?? ""} ${w.asset?.name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [workOrders, mineOnly, currentUserId, search, locationId, categoryId, priorityId, statusId, technicianId]);

  return (
    <div>
      <PageHeader
        title="Work Orders"
        description="Maintenance jobs across the facility."
        actions={
          canCreate ? (
            <Link href="/work-orders/new">
              <Button>New work order</Button>
            </Link>
          ) : undefined
        }
      />

      <FilterContainer>
        <div className="w-full sm:max-w-xs">
          <SearchField
            placeholder="Search number, title, asset..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={mineOnly}
            onChange={(e) => setMineOnly(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          My work orders
        </label>
        <Select value={locationId} onChange={(e) => setLocationId(e.target.value)} className="sm:w-44">
          <option value="">All locations</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </Select>
        <Select value={statusId} onChange={(e) => setStatusId(e.target.value)} className="sm:w-44">
          <option value="">All statuses</option>
          {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        <Select value={priorityId} onChange={(e) => setPriorityId(e.target.value)} className="sm:w-36">
          <option value="">All priorities</option>
          {priorities.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="sm:w-44">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Select value={technicianId} onChange={(e) => setTechnicianId(e.target.value)} className="sm:w-44">
          <option value="">All technicians</option>
          {technicians.map((t) => <option key={t.id} value={t.id}>{personName(t)}</option>)}
        </Select>
      </FilterContainer>

      {filtered.length === 0 ? (
        <EmptyState
          title="No work orders found"
          description={
            workOrders.length === 0
              ? "Work orders you create or that are assigned to you will appear here."
              : "No work orders match the current filters."
          }
        />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">WO #</th>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Location</th>
                  <th className="px-4 py-3 font-medium">Asset</th>
                  <th className="px-4 py-3 font-medium">Priority</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Technician</th>
                  <th className="px-4 py-3 font-medium">Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((w) => (
                  <tr
                    key={w.id}
                    onClick={() => router.push(`/work-orders/${w.id}`)}
                    className="cursor-pointer hover:bg-slate-50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">{w.work_order_number}</td>
                    <td className="px-4 py-3 text-slate-700">{w.title}</td>
                    <td className="px-4 py-3 text-slate-600">{w.location?.name ?? "-"}</td>
                    <td className="px-4 py-3 text-slate-600">{w.asset?.name ?? "-"}</td>
                    <td className="px-4 py-3"><PriorityBadge priority={w.priority} /></td>
                    <td className="px-4 py-3"><WorkOrderStatusBadge status={w.status} /></td>
                    <td className="px-4 py-3 text-slate-600">{w.assignee ? personName(w.assignee) : "Unassigned"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{w.due_date ? formatDate(w.due_date) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {filtered.map((w) => (
              <Link
                key={w.id}
                href={`/work-orders/${w.id}`}
                className="block rounded-lg border border-slate-200 bg-white p-4"
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-900">{w.work_order_number}</span>
                  <WorkOrderStatusBadge status={w.status} />
                </div>
                <p className="mb-2 text-sm text-slate-700">{w.title}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <PriorityBadge priority={w.priority} />
                  <span>{w.location?.name ?? "-"}</span>
                  {w.asset?.name && <span>- {w.asset.name}</span>}
                  <span>- {w.assignee ? personName(w.assignee) : "Unassigned"}</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

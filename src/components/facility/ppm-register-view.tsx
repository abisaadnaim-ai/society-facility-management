"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { FilterContainer } from "@/components/shared/filter-container";
import { SearchField } from "@/components/shared/search-field";
import {
  TableShell,
  TableHead,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/shared/table-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/format";
import {
  frequencyLabel,
  deriveDueStatus,
  DUE_STATUS_META,
  PLAN_STATUS_META,
  type PpmPlanRow,
  type PpmSummary,
  type PpmPlanStatus,
  type DueStatus,
} from "@/lib/types/ppm";

type Props = {
  plans: PpmPlanRow[];
  summary: PpmSummary;
  canManage: boolean;
  today: string;
};

const SUMMARY_CARDS: { key: keyof PpmSummary; label: string; tone: string }[] = [
  { key: "activePlans", label: "Active Plans", tone: "text-emerald-600" },
  { key: "dueToday", label: "Due Today", tone: "text-amber-600" },
  { key: "dueNext7Days", label: "Due Next 7 Days", tone: "text-sky-600" },
  { key: "overdue", label: "Overdue", tone: "text-red-600" },
  { key: "openPpmWorkOrders", label: "Open PPM Work Orders", tone: "text-slate-700" },
];

export function PpmRegisterView({ plans, summary, canManage, today }: Props) {
  const [search, setSearch] = useState("");
  const [locationId, setLocationId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [assetId, setAssetId] = useState("");
  const [frequency, setFrequency] = useState("");
  const [technicianId, setTechnicianId] = useState("");
  const [status, setStatus] = useState("");
  const [dueStatus, setDueStatus] = useState("");

  // Build filter option lists from the data itself.
  const locations = useMemo(() => {
    const m = new Map<string, string>();
    plans.forEach((p) => p.asset?.location && m.set(p.asset.location.id, p.asset.location.name));
    return Array.from(m, ([id, name]) => ({ id, name }));
  }, [plans]);
  const areas = useMemo(() => {
    const m = new Map<string, string>();
    plans.forEach((p) => p.asset?.area && m.set(p.asset.area.id, p.asset.area.name));
    return Array.from(m, ([id, name]) => ({ id, name }));
  }, [plans]);
  const categories = useMemo(() => {
    const m = new Map<string, string>();
    plans.forEach((p) => p.category && m.set(p.category.id, p.category.name));
    return Array.from(m, ([id, name]) => ({ id, name }));
  }, [plans]);
  const assets = useMemo(() => {
    const m = new Map<string, string>();
    plans.forEach((p) => p.asset && m.set(p.asset.id, p.asset.name));
    return Array.from(m, ([id, name]) => ({ id, name }));
  }, [plans]);
  const technicians = useMemo(() => {
    const m = new Map<string, string>();
    plans.forEach((p) => {
      if (p.default_assigned_to && p.technician)
        m.set(p.default_assigned_to, p.technician.full_name || p.technician.email || "Technician");
    });
    return Array.from(m, ([id, name]) => ({ id, name }));
  }, [plans]);
  const frequencies = useMemo(() => {
    const m = new Map<string, string>();
    plans.forEach((p) => {
      const label = frequencyLabel(p.frequency_unit, p.frequency_interval);
      m.set(`${p.frequency_unit}:${p.frequency_interval}`, label);
    });
    return Array.from(m, ([id, name]) => ({ id, name }));
  }, [plans]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return plans.filter((p) => {
      if (locationId && p.asset?.location?.id !== locationId) return false;
      if (areaId && p.asset?.area?.id !== areaId) return false;
      if (categoryId && p.category?.id !== categoryId) return false;
      if (assetId && p.asset?.id !== assetId) return false;
      if (frequency && `${p.frequency_unit}:${p.frequency_interval}` !== frequency) return false;
      if (technicianId && p.default_assigned_to !== technicianId) return false;
      if (status && p.status !== status) return false;
      if (dueStatus && deriveDueStatus(p.status, p.next_due_date, today) !== dueStatus) return false;
      if (term) {
        const hay = [p.ppm_number, p.name, p.asset?.name, p.asset?.asset_code]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [plans, search, locationId, areaId, categoryId, assetId, frequency, technicianId, status, dueStatus, today]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Preventive Maintenance"
        description="Recurring maintenance plans (PPM) that automatically raise work orders when due."
        actions={
          <div className="flex gap-2">
            <Link href="/preventive-maintenance/schedule">
              <Button variant="outline">Upcoming schedule</Button>
            </Link>
            {canManage && (
              <Link href="/preventive-maintenance/new">
                <Button>New PPM Plan</Button>
              </Link>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {SUMMARY_CARDS.map((c) => (
          <Card key={c.key}>
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{c.label}</p>
              <p className={`mt-1 text-2xl font-semibold ${c.tone}`}>{summary[c.key]}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <FilterContainer>
        <SearchField
          placeholder="Search PPM #, plan, asset…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
          <option value="">All locations</option>
          {locations.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </Select>
        <Select value={areaId} onChange={(e) => setAreaId(e.target.value)}>
          <option value="">All areas</option>
          {areas.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </Select>
        <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </Select>
        <Select value={assetId} onChange={(e) => setAssetId(e.target.value)}>
          <option value="">All assets</option>
          {assets.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </Select>
        <Select value={frequency} onChange={(e) => setFrequency(e.target.value)}>
          <option value="">All frequencies</option>
          {frequencies.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </Select>
        <Select value={technicianId} onChange={(e) => setTechnicianId(e.target.value)}>
          <option value="">All technicians</option>
          {technicians.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All plan statuses</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="archived">Archived</option>
        </Select>
        <Select value={dueStatus} onChange={(e) => setDueStatus(e.target.value)}>
          <option value="">All due statuses</option>
          <option value="overdue">Overdue</option>
          <option value="due_today">Due Today</option>
          <option value="due_soon">Due Soon</option>
          <option value="upcoming">Upcoming</option>
        </Select>
      </FilterContainer>

      {filtered.length === 0 ? (
        <EmptyState
          title={plans.length === 0 ? "No PPM plans yet" : "No plans match your filters"}
          description={
            plans.length === 0
              ? canManage
                ? "Create your first preventive maintenance plan to start scheduling recurring work automatically."
                : "Preventive maintenance plans will appear here once they are created."
              : "Try adjusting or clearing the filters above."
          }
          action={
            canManage && plans.length === 0 ? (
              <Link href="/preventive-maintenance/new">
                <Button>New PPM Plan</Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <TableShell>
          <TableHead>
            <TableHeaderCell>PPM #</TableHeaderCell>
            <TableHeaderCell>Plan</TableHeaderCell>
            <TableHeaderCell>Asset</TableHeaderCell>
            <TableHeaderCell>Location / Area</TableHeaderCell>
            <TableHeaderCell>Frequency</TableHeaderCell>
            <TableHeaderCell>Next Due</TableHeaderCell>
            <TableHeaderCell>Technician</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
          </TableHead>
          <TableBody>
            {filtered.map((p) => {
              const due = deriveDueStatus(p.status, p.next_due_date, today) as DueStatus;
              const dueMeta = DUE_STATUS_META[due];
              const planMeta = PLAN_STATUS_META[p.status as PpmPlanStatus];
              return (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link href={`/preventive-maintenance/${p.id}`} className="font-medium text-sky-700 hover:underline">
                      {p.ppm_number}
                    </Link>
                  </TableCell>
                  <TableCell>{p.name}</TableCell>
                  <TableCell>
                    <span className="block">{p.asset?.name ?? "—"}</span>
                    {p.asset?.asset_code && (
                      <span className="text-xs text-slate-500">{p.asset.asset_code}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="block">{p.asset?.location?.name ?? "—"}</span>
                    {p.asset?.area?.name && (
                      <span className="text-xs text-slate-500">{p.asset.area.name}</span>
                    )}
                  </TableCell>
                  <TableCell>{frequencyLabel(p.frequency_unit, p.frequency_interval)}</TableCell>
                  <TableCell>
                    <span className="block">{formatDate(p.next_due_date)}</span>
                    {planMeta?.label === "Active" && (
                      <Badge variant={dueMeta.tone}>{dueMeta.label}</Badge>
                    )}
                  </TableCell>
                  <TableCell>{p.technician?.full_name || p.technician?.email || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={planMeta?.tone ?? "neutral"}>{planMeta?.label ?? p.status}</Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </TableShell>
      )}
    </div>
  );
}

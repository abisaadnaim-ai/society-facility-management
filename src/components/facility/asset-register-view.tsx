"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type {
  AssetWithRelations,
  AreaWithLocation,
  AssetCategory,
  AssetStatus,
  LocationWithAreaCount,
} from "@/lib/types/facility";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { SearchField } from "@/components/shared/search-field";
import { FilterContainer } from "@/components/shared/filter-container";
import { EmptyState } from "@/components/ui/empty-state";
import { statusVariant } from "@/lib/format";

export function AssetRegisterView({
  initialAssets,
  locations,
  areas,
  categories,
  statuses,
  canManage,
}: {
  initialAssets: AssetWithRelations[];
  locations: LocationWithAreaCount[];
  areas: AreaWithLocation[];
  categories: AssetCategory[];
  statuses: AssetStatus[];
  canManage: boolean;
}) {
  const [search, setSearch] = useState("");
  const [locationId, setLocationId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [statusId, setStatusId] = useState("");

  // Location → Area dependency: the area filter only offers areas belonging to
  // the selected location. Changing location clears an now-invalid area choice.
  const areasForLocation = useMemo(() => {
    if (!locationId) return areas;
    return areas.filter((a) => a.location_id === locationId);
  }, [areas, locationId]);

  function onLocationChange(next: string) {
    setLocationId(next);
    if (next && areaId) {
      const stillValid = areas.some((a) => a.id === areaId && a.location_id === next);
      if (!stillValid) setAreaId("");
    }
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return initialAssets.filter((asset) => {
      if (locationId && asset.location_id !== locationId) return false;
      if (areaId && asset.area_id !== areaId) return false;
      if (categoryId && asset.category_id !== categoryId) return false;
      if (statusId && asset.status_id !== statusId) return false;
      if (term) {
        const haystack = [
          asset.name,
          asset.asset_code,
          asset.manufacturer,
          asset.model,
          asset.serial_number,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [initialAssets, search, locationId, areaId, categoryId, statusId]);

  const hasFilters = !!(search || locationId || areaId || categoryId || statusId);

  function clearFilters() {
    setSearch("");
    setLocationId("");
    setAreaId("");
    setCategoryId("");
    setStatusId("");
  }

  return (
    <div>
      <PageHeader
        title="Asset Register"
        description="All active assets across Society locations."
        actions={
          canManage ? (
            <Link href="/assets/new">
              <Button>Add asset</Button>
            </Link>
          ) : undefined
        }
      />

      {/* KPI summary */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Total assets" value={initialAssets.length} />
        <SummaryCard
          label="Operational"
          value={initialAssets.filter((a) => a.status?.code === "operational").length}
        />
        <SummaryCard
          label="Under maintenance"
          value={initialAssets.filter((a) => a.status?.code === "under_maintenance").length}
        />
        <SummaryCard
          label="Out of service"
          value={initialAssets.filter((a) => a.status?.code === "out_of_service").length}
        />
      </div>

      <FilterContainer>
        <div className="w-full sm:max-w-xs">
          <SearchField
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, code, serial..."
          />
        </div>
        <Select value={locationId} onChange={(e) => onLocationChange(e.target.value)} className="sm:w-44">
          <option value="">All locations</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Select>
        <Select
          value={areaId}
          onChange={(e) => setAreaId(e.target.value)}
          className="sm:w-44"
          disabled={areasForLocation.length === 0}
        >
          <option value="">All areas</option>
          {areasForLocation.map((a) => (
            <option key={a.id} value={a.id}>
              {locationId ? a.name : `${a.name} — ${a.location?.name ?? ""}`}
            </option>
          ))}
        </Select>
        <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="sm:w-44">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select value={statusId} onChange={(e) => setStatusId(e.target.value)} className="sm:w-44">
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear
          </Button>
        )}
      </FilterContainer>

      <p className="mb-3 text-xs text-slate-500">
        {filtered.length} of {initialAssets.length} assets
      </p>

      {filtered.length === 0 ? (
        <EmptyState
          title={initialAssets.length === 0 ? "No assets yet" : "No matching assets"}
          description={
            initialAssets.length === 0
              ? canManage
                ? "Add your first asset to start building the register."
                : "Assets will appear here once they've been added."
              : "Try adjusting or clearing your filters."
          }
          action={
            initialAssets.length === 0 && canManage ? (
              <Link href="/assets/new">
                <Button>Add asset</Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-max text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <Th>Asset</Th>
                    <Th>Code</Th>
                    <Th>Location</Th>
                    <Th>Area</Th>
                    <Th>Category</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((asset) => (
                    <tr key={asset.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/assets/${asset.id}`}
                          className="font-medium text-slate-900 hover:underline"
                        >
                          {asset.name}
                        </Link>
                        {(asset.manufacturer || asset.model) && (
                          <p className="text-xs text-slate-500">
                            {[asset.manufacturer, asset.model].filter(Boolean).join(" ")}
                          </p>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                        {asset.asset_code || "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                        {asset.location?.name ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                        {asset.area?.name ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                        {asset.category?.name ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5">
                        <Badge variant={statusVariant(asset.status?.code)}>
                          {asset.status?.name ?? "—"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="flex flex-col gap-3 md:hidden">
            {filtered.map((asset) => (
              <Link
                key={asset.id}
                href={`/assets/${asset.id}`}
                className="block rounded-lg border border-slate-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{asset.name}</p>
                    {asset.asset_code && (
                      <p className="text-xs text-slate-500">{asset.asset_code}</p>
                    )}
                  </div>
                  <Badge variant={statusVariant(asset.status?.code)}>
                    {asset.status?.name ?? "—"}
                  </Badge>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-slate-400">Location</dt>
                    <dd className="text-slate-700">{asset.location?.name ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Area</dt>
                    <dd className="text-slate-700">{asset.area?.name ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Category</dt>
                    <dd className="text-slate-700">{asset.category?.name ?? "—"}</dd>
                  </div>
                </dl>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <p className="text-2xl font-semibold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </th>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { FilterContainer } from "@/components/shared/filter-container";
import { SearchField } from "@/components/shared/search-field";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { VendorStatusBadge } from "@/components/facility/vendor-badges";
import type { VendorRow, VendorServiceCategory } from "@/lib/types/vendors";

type LocationOpt = { id: string; name: string };

export function VendorsView({
  vendors,
  categories,
  locations,
  canManage,
}: {
  vendors: VendorRow[];
  categories: VendorServiceCategory[];
  locations: LocationOpt[];
  canManage: boolean;
}) {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [status, setStatus] = useState("");
  const [contractState, setContractState] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vendors.filter((v) => {
      if (categoryId && v.service_category_id !== categoryId) return false;
      if (status && v.status !== status) return false;
      if (locationId && !v.location_ids.includes(locationId)) return false;
      if (contractState) {
        const s = v.contract_states;
        if (contractState === "active" && !s.some((x) => x === "active" || x.startsWith("expiring"))) return false;
        if (contractState === "expiring_soon" && !s.some((x) => x.startsWith("expiring"))) return false;
        if (contractState === "expired" && !s.includes("expired")) return false;
      }
      if (q) {
        const hay = `${v.vendor_number} ${v.company_name} ${v.trading_name ?? ""} ${v.contact_person ?? ""} ${v.email ?? ""} ${v.phone ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [vendors, categoryId, status, locationId, contractState, search]);

  return (
    <div>
      <PageHeader
        title="Vendors"
        description="Service providers and maintenance partners across the facility."
        actions={
          canManage ? (
            <Link href="/vendors/new">
              <Button>New Vendor</Button>
            </Link>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/vendors/contracts" className="text-sm font-medium text-slate-700 underline-offset-2 hover:underline">
          View Service Contracts →
        </Link>
      </div>

      <FilterContainer>
        <SearchField
          placeholder="Search code, company, contact, email, phone"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
        <Select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
          <option value="">All locations</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="suspended">Suspended</option>
        </Select>
        <Select value={contractState} onChange={(e) => setContractState(e.target.value)}>
          <option value="">Any contract status</option>
          <option value="active">Has active contract</option>
          <option value="expiring_soon">Has expiring contract</option>
          <option value="expired">Has expired contract</option>
        </Select>
      </FilterContainer>

      {filtered.length === 0 ? (
        <EmptyState
          title="No vendors found"
          description={vendors.length === 0 ? "Add your first vendor to get started." : "Try adjusting your filters."}
          action={canManage && vendors.length === 0 ? <Link href="/vendors/new"><Button>New Vendor</Button></Link> : undefined}
        />
      ) : (
        <>
          {/* Mobile cards */}
          <div className="grid gap-3 md:hidden">
            {filtered.map((v) => (
              <div key={v.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/vendors/${v.id}`} className="font-medium text-slate-900">{v.company_name}</Link>
                  <VendorStatusBadge status={v.status} />
                </div>
                <p className="mt-0.5 text-xs text-slate-500">{v.vendor_number}{v.category ? ` · ${v.category.name}` : ""}</p>
                {v.contact_person && <p className="mt-2 text-sm text-slate-700">{v.contact_person}</p>}
                {v.phone && (
                  <a href={`tel:${v.phone}`} className="mt-1 inline-block text-sm font-medium text-blue-700">Call {v.phone}</a>
                )}
                <div className="mt-2 flex gap-4 text-xs text-slate-500">
                  <span>{v.active_contract_count} active contract{v.active_contract_count === 1 ? "" : "s"}</span>
                  <span>{v.location_count} location{v.location_count === 1 ? "" : "s"}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Primary Contact</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Contracts</th>
                  <th className="px-4 py-3">Locations</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-600">{v.vendor_number}</td>
                    <td className="px-4 py-3">
                      <Link href={`/vendors/${v.id}`} className="font-medium text-slate-900 hover:underline">{v.company_name}</Link>
                      {v.trading_name && <span className="block text-xs text-slate-400">{v.trading_name}</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{v.category?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{v.contact_person ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {v.phone ? <a href={`tel:${v.phone}`} className="text-blue-700 hover:underline">{v.phone}</a> : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{v.active_contract_count}</td>
                    <td className="px-4 py-3 text-slate-600">{v.location_count}</td>
                    <td className="px-4 py-3"><VendorStatusBadge status={v.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

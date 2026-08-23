"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { FilterContainer } from "@/components/shared/filter-container";
import { SearchField } from "@/components/shared/search-field";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ContractStateBadge } from "@/components/facility/vendor-badges";
import { formatDate } from "@/lib/format";
import type { ContractRow } from "@/lib/types/vendors";

type LocationOpt = { id: string; name: string };
type VendorOpt = { id: string; company_name: string; vendor_number: string };

export function ContractsView({
  contracts,
  vendors,
  locations,
  canManage,
}: {
  contracts: ContractRow[];
  vendors: VendorOpt[];
  locations: LocationOpt[];
  canManage: boolean;
}) {
  const [search, setSearch] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [type, setType] = useState("");
  const [state, setState] = useState("");

  const types = useMemo(
    () => [...new Set(contracts.map((c) => c.contract_type).filter((t): t is string => !!t))].sort(),
    [contracts]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contracts.filter((c) => {
      if (vendorId && c.vendor_id !== vendorId) return false;
      if (locationId && !c.location_ids.includes(locationId)) return false;
      if (type && c.contract_type !== type) return false;
      if (state) {
        if (state === "active" && !(c.state === "active" || c.state.startsWith("expiring"))) return false;
        if (state === "expiring_soon" && !c.state.startsWith("expiring")) return false;
        if (state === "expired" && c.state !== "expired") return false;
      }
      if (q) {
        const hay = `${c.contract_number} ${c.name} ${c.vendor?.company_name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [contracts, vendorId, locationId, type, state, search]);

  return (
    <div>
      <PageHeader
        title="Service Contracts"
        description="AMCs, service agreements, warranties, and support contracts."
        actions={canManage ? <Link href="/vendors/contracts/new"><Button>New Contract</Button></Link> : undefined}
      />

      <div className="mb-4">
        <Link href="/vendors" className="text-sm font-medium text-slate-700 underline-offset-2 hover:underline">← Back to Vendors</Link>
      </div>

      <FilterContainer>
        <SearchField placeholder="Search contract #, name, vendor" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
          <option value="">All vendors</option>
          {vendors.map((v) => <option key={v.id} value={v.id}>{v.company_name}</option>)}
        </Select>
        <Select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
          <option value="">All locations</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </Select>
        <Select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </Select>
        <Select value={state} onChange={(e) => setState(e.target.value)}>
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="expiring_soon">Expiring soon</option>
          <option value="expired">Expired</option>
          <option value="draft">Draft</option>
          <option value="terminated">Terminated</option>
          <option value="archived">Archived</option>
        </Select>
      </FilterContainer>

      {filtered.length === 0 ? (
        <EmptyState
          title="No contracts found"
          description={contracts.length === 0 ? "Create your first service contract." : "Try adjusting your filters."}
          action={canManage && contracts.length === 0 ? <Link href="/vendors/contracts/new"><Button>New Contract</Button></Link> : undefined}
        />
      ) : (
        <>
          <div className="grid gap-3 md:hidden">
            {filtered.map((c) => (
              <Link key={c.id} href={`/vendors/contracts/${c.id}`} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-slate-900">{c.name}</span>
                  <ContractStateBadge state={c.state} />
                </div>
                <p className="mt-0.5 text-xs text-slate-500">{c.contract_number}{c.contract_type ? ` · ${c.contract_type}` : ""}</p>
                <p className="mt-1 text-sm text-slate-700">{c.vendor?.company_name ?? "—"}</p>
                <p className="mt-1 text-xs text-slate-500">{formatDate(c.start_date)} – {formatDate(c.end_date)}</p>
              </Link>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Contract #</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Start</th>
                  <th className="px-4 py-3">End</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Locations</th>
                  <th className="px-4 py-3">Assets</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-600">{c.contract_number}</td>
                    <td className="px-4 py-3">
                      <Link href={`/vendors/contracts/${c.id}`} className="font-medium text-slate-900 hover:underline">{c.name}</Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {c.vendor ? <Link href={`/vendors/${c.vendor.id}`} className="hover:underline">{c.vendor.company_name}</Link> : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.contract_type ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(c.start_date)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(c.end_date)}</td>
                    <td className="px-4 py-3"><ContractStateBadge state={c.state} /></td>
                    <td className="px-4 py-3 text-slate-600">{c.location_count}</td>
                    <td className="px-4 py-3 text-slate-600">{c.asset_count}</td>
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

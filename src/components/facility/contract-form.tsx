"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { createContract, type ContractInput } from "@/lib/actions/vendors";
import type { ContractStatus } from "@/lib/types/vendors";

type VendorOpt = { id: string; company_name: string; vendor_number: string };
type LocationOpt = { id: string; name: string };
type AssetOpt = { id: string; name: string; location_id: string; area_id: string | null };
type ContactLite = { id: string; vendor_id: string; full_name: string };

const CONTRACT_TYPES = [
  "AMC", "Service Agreement", "Warranty", "Preventive Maintenance Agreement",
  "Specialist Support", "Emergency Call-Out Agreement", "Other",
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

export function ContractForm({
  vendors, locations, assets, contacts, defaultVendorId,
}: {
  vendors: VendorOpt[];
  locations: LocationOpt[];
  assets: AssetOpt[];
  contacts: ContactLite[];
  defaultVendorId?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState<ContractInput>({
    vendor_id: defaultVendorId ?? "",
    name: "",
    contract_type: "AMC",
    description: "",
    start_date: "",
    end_date: "",
    status: "active" as ContractStatus,
    contract_value: "",
    currency: "",
    contact_person_id: "",
    response_time_notes: "",
    service_scope: "",
    renewal_notes: "",
    termination_notice_days: "",
    notes: "",
    location_ids: [],
    asset_ids: [],
  });

  function set<K extends keyof ContractInput>(k: K, v: ContractInput[K]) {
    setF((prev) => ({ ...prev, [k]: v }));
  }
  function toggle(list: "location_ids" | "asset_ids", id: string) {
    setF((prev) => {
      const has = prev[list].includes(id);
      return { ...prev, [list]: has ? prev[list].filter((x) => x !== id) : [...prev[list], id] };
    });
  }

  const vendorContacts = useMemo(
    () => contacts.filter((c) => c.vendor_id === f.vendor_id),
    [contacts, f.vendor_id]
  );

  async function submit() {
    setError(null);
    if (!f.vendor_id) { setError("Select a vendor."); return; }
    if (!f.name.trim()) { setError("A contract name is required."); return; }
    if (!f.start_date || !f.end_date) { setError("Start and end dates are required."); return; }
    setBusy(true);
    const res = await createContract(f);
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    router.push(`/vendors/contracts/${(res.data as { id: string }).id}`);
  }

  return (
    <div className="space-y-6">
      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-900">Contract</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contract name *"><Input value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Contract type">
            <Select value={f.contract_type ?? ""} onChange={(e) => set("contract_type", e.target.value)}>
              {CONTRACT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Vendor *">
            <Select value={f.vendor_id} onChange={(e) => { set("vendor_id", e.target.value); set("contact_person_id", ""); }} disabled={!!defaultVendorId}>
              <option value="">Select a vendor…</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.company_name}</option>)}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={f.status} onChange={(e) => set("status", e.target.value as ContractStatus)}>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="terminated">Terminated</option>
              <option value="archived">Archived</option>
            </Select>
          </Field>
          <Field label="Start date *"><Input type="date" value={f.start_date} onChange={(e) => set("start_date", e.target.value)} /></Field>
          <Field label="End date *"><Input type="date" value={f.end_date} onChange={(e) => set("end_date", e.target.value)} /></Field>
        </div>
        <Field label="Description"><Textarea rows={2} value={f.description ?? ""} onChange={(e) => set("description", e.target.value)} /></Field>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Coverage</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-sm font-medium text-slate-700">Locations</p>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-slate-200 p-2">
              {locations.map((l) => (
                <label key={l.id} className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={f.location_ids.includes(l.id)} onChange={() => toggle("location_ids", l.id)} />
                  {l.name}
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-sm font-medium text-slate-700">Covered assets</p>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-slate-200 p-2">
              {assets.length === 0 && <p className="text-xs text-slate-400">No assets available.</p>}
              {assets.map((a) => (
                <label key={a.id} className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={f.asset_ids.includes(a.id)} onChange={() => toggle("asset_ids", a.id)} />
                  {a.name}
                </label>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-900">Service Information</h3>
        <Field label="Service scope"><Textarea rows={2} value={f.service_scope ?? ""} onChange={(e) => set("service_scope", e.target.value)} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Response-time notes"><Input value={f.response_time_notes ?? ""} onChange={(e) => set("response_time_notes", e.target.value)} /></Field>
          <Field label="Main contact">
            <Select value={f.contact_person_id ?? ""} onChange={(e) => set("contact_person_id", e.target.value)} disabled={!f.vendor_id}>
              <option value="">— None —</option>
              {vendorContacts.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Renewal notes"><Textarea rows={2} value={f.renewal_notes ?? ""} onChange={(e) => set("renewal_notes", e.target.value)} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Termination notice (days)"><Input type="number" value={f.termination_notice_days ?? ""} onChange={(e) => set("termination_notice_days", e.target.value)} /></Field>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-900">Commercial Reference <span className="font-normal text-slate-400">(informational only)</span></h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contract value"><Input type="number" value={f.contract_value ?? ""} onChange={(e) => set("contract_value", e.target.value)} /></Field>
          <Field label="Currency"><Input value={f.currency ?? ""} onChange={(e) => set("currency", e.target.value)} placeholder="e.g. QAR" /></Field>
        </div>
      </section>

      <p className="text-xs text-slate-400">You can upload signed contracts and other documents after creating the contract.</p>

      <div className="flex justify-end">
        <Button onClick={submit} isLoading={busy}>Create contract</Button>
      </div>
    </div>
  );
}

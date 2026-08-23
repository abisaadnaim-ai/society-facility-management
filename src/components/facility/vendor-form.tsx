"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { createVendor, updateVendor, type VendorInput } from "@/lib/actions/vendors";
import type { Vendor, VendorServiceCategory, VendorStatus } from "@/lib/types/vendors";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

export function VendorForm({
  categories,
  vendor,
  onDone,
}: {
  categories: VendorServiceCategory[];
  vendor?: Vendor;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState<VendorInput>({
    company_name: vendor?.company_name ?? "",
    trading_name: vendor?.trading_name ?? "",
    service_category_id: vendor?.service_category_id ?? "",
    status: (vendor?.status ?? "active") as VendorStatus,
    contact_person: vendor?.contact_person ?? "",
    phone: vendor?.phone ?? "",
    mobile: vendor?.mobile ?? "",
    email: vendor?.email ?? "",
    website: vendor?.website ?? "",
    address: vendor?.address ?? "",
    notes: vendor?.notes ?? "",
  });

  function set<K extends keyof VendorInput>(k: K, v: VendorInput[K]) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  async function submit() {
    setError(null);
    if (!f.company_name.trim()) { setError("A company name is required."); return; }
    setBusy(true);
    const res = vendor ? await updateVendor(vendor.id, f) : await createVendor(f);
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    if (vendor) {
      router.refresh();
      onDone?.();
    } else {
      router.push(`/vendors/${(res.data as { id: string }).id}`);
    }
  }

  return (
    <div className="space-y-6">
      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-900">Company</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Company name *">
            <Input value={f.company_name} onChange={(e) => set("company_name", e.target.value)} />
          </Field>
          <Field label="Trading name">
            <Input value={f.trading_name ?? ""} onChange={(e) => set("trading_name", e.target.value)} />
          </Field>
          <Field label="Service category">
            <Select value={f.service_category_id ?? ""} onChange={(e) => set("service_category_id", e.target.value)}>
              <option value="">— None —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={f.status} onChange={(e) => set("status", e.target.value as VendorStatus)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </Select>
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-900">Primary Contact</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contact person"><Input value={f.contact_person ?? ""} onChange={(e) => set("contact_person", e.target.value)} /></Field>
          <Field label="Email"><Input type="email" value={f.email ?? ""} onChange={(e) => set("email", e.target.value)} /></Field>
          <Field label="Phone"><Input value={f.phone ?? ""} onChange={(e) => set("phone", e.target.value)} /></Field>
          <Field label="Mobile"><Input value={f.mobile ?? ""} onChange={(e) => set("mobile", e.target.value)} /></Field>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-900">Details</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Website"><Input value={f.website ?? ""} onChange={(e) => set("website", e.target.value)} /></Field>
          <Field label="Address"><Input value={f.address ?? ""} onChange={(e) => set("address", e.target.value)} /></Field>
        </div>
        <Field label="Notes"><Textarea rows={3} value={f.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></Field>
      </section>

      <div className="flex justify-end gap-2">
        {onDone && <Button variant="outline" onClick={onDone} disabled={busy}>Cancel</Button>}
        <Button onClick={submit} isLoading={busy}>{vendor ? "Save changes" : "Create vendor"}</Button>
      </div>
    </div>
  );
}

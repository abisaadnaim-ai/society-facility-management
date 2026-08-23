"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { VendorStatusBadge, ContractStateBadge, DocValidityBadge } from "@/components/facility/vendor-badges";
import { VendorForm } from "@/components/facility/vendor-form";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatDateTime, formatFileSize } from "@/lib/format";
import {
  contractExpiryState, docValidity,
  type VendorDetail, type VendorServiceCategory, type VendorStatus,
} from "@/lib/types/vendors";
import type { VendorWorkOrderRow } from "@/lib/queries/vendors";
import {
  setVendorStatus, addVendorContact, linkVendorLocation, unlinkVendorLocation,
  linkVendorAsset, unlinkVendorAsset, recordVendorDocument, deleteVendorDocument, getDocumentSignedUrl,
} from "@/lib/actions/vendors";

type LocationOpt = { id: string; name: string };
type AssetOpt = { id: string; name: string; location_id: string; area_id: string | null };
const REL_TYPES = ["Maintenance Provider", "Warranty Provider", "Installer", "Specialist Support", "Other"];
const TABS = ["Overview", "Contacts", "Locations", "Assets", "Contracts", "Documents", "Work Orders", "Activity"] as const;
type Tab = (typeof TABS)[number];

export function VendorDetailView({
  vendor, workOrders, categories, locationOptions, assetOptions, canManage, orgId,
}: {
  vendor: VendorDetail;
  workOrders: VendorWorkOrderRow[];
  categories: VendorServiceCategory[];
  locationOptions: LocationOpt[];
  assetOptions: AssetOpt[];
  canManage: boolean;
  orgId: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("Overview");
  const [editOpen, setEditOpen] = useState(false);
  const linkedLocationIds = new Set(vendor.locations.map((l) => l.location_id));
  const availableLocations = locationOptions.filter((l) => !linkedLocationIds.has(l.id));

  return (
    <div>
      <PageHeader
        title={vendor.company_name}
        description={`${vendor.vendor_number}${vendor.category ? ` · ${vendor.category.name}` : ""}`}
        actions={
          <div className="flex items-center gap-2">
            <VendorStatusBadge status={vendor.status} />
            {canManage && <Button variant="outline" onClick={() => setEditOpen(true)}>Edit</Button>}
          </div>
        }
      />

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              "whitespace-nowrap px-3 py-2 text-sm font-medium",
              tab === t ? "border-b-2 border-slate-900 text-slate-900" : "text-slate-500 hover:text-slate-700",
            ].join(" ")}
          >
            {t}
            {t === "Contacts" && vendor.contacts.length > 0 && <span className="ml-1 text-xs text-slate-400">{vendor.contacts.length}</span>}
            {t === "Work Orders" && vendor.workOrderCount > 0 && <span className="ml-1 text-xs text-slate-400">{vendor.workOrderCount}</span>}
          </button>
        ))}
      </div>

      {tab === "Overview" && <OverviewTab vendor={vendor} canManage={canManage} onChanged={() => router.refresh()} />}
      {tab === "Contacts" && <ContactsTab vendor={vendor} canManage={canManage} />}
      {tab === "Locations" && (
        <LocationsTab vendor={vendor} canManage={canManage} available={availableLocations} />
      )}
      {tab === "Assets" && <AssetsTab vendor={vendor} canManage={canManage} assetOptions={assetOptions} />}
      {tab === "Contracts" && <ContractsTab vendor={vendor} canManage={canManage} />}
      {tab === "Documents" && <DocumentsTab vendor={vendor} canManage={canManage} orgId={orgId} />}
      {tab === "Work Orders" && <WorkOrdersTab workOrders={workOrders} />}
      {tab === "Activity" && <ActivityTab vendor={vendor} />}

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} title="Edit vendor">
        <VendorForm categories={categories} vendor={vendor} onDone={() => setEditOpen(false)} />
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-4">
      <span className="w-40 shrink-0 text-sm text-slate-500">{label}</span>
      <span className="text-sm text-slate-900">{value || "—"}</span>
    </div>
  );
}

function OverviewTab({ vendor, canManage, onChanged }: { vendor: VendorDetail; canManage: boolean; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  async function change(status: VendorStatus) {
    setBusy(true);
    await setVendorStatus(vendor.id, status);
    setBusy(false);
    onChanged();
  }
  return (
    <Card>
      <CardContent className="divide-y divide-slate-100 p-5">
        <Row label="Vendor Code" value={<span className="font-mono text-xs">{vendor.vendor_number}</span>} />
        <Row label="Company" value={vendor.company_name} />
        <Row label="Trading Name" value={vendor.trading_name} />
        <Row label="Category" value={vendor.category?.name} />
        <Row label="Status" value={<VendorStatusBadge status={vendor.status} />} />
        <Row label="Contact Person" value={vendor.contact_person} />
        <Row label="Phone" value={vendor.phone ? <a className="text-blue-700 hover:underline" href={`tel:${vendor.phone}`}>{vendor.phone}</a> : null} />
        <Row label="Mobile" value={vendor.mobile ? <a className="text-blue-700 hover:underline" href={`tel:${vendor.mobile}`}>{vendor.mobile}</a> : null} />
        <Row label="Email" value={vendor.email ? <a className="text-blue-700 hover:underline" href={`mailto:${vendor.email}`}>{vendor.email}</a> : null} />
        <Row label="Website" value={vendor.website} />
        <Row label="Address" value={vendor.address} />
        <Row label="Notes" value={vendor.notes} />
        {canManage && (
          <div className="flex flex-wrap gap-2 pt-4">
            {vendor.status !== "active" && <Button size="sm" variant="outline" onClick={() => change("active")} isLoading={busy}>Set Active</Button>}
            {vendor.status !== "inactive" && <Button size="sm" variant="outline" onClick={() => change("inactive")} isLoading={busy}>Set Inactive</Button>}
            {vendor.status !== "suspended" && <Button size="sm" variant="outline" onClick={() => change("suspended")} isLoading={busy}>Suspend</Button>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ContactsTab({ vendor, canManage }: { vendor: VendorDetail; canManage: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [full_name, setName] = useState("");
  const [contact_type, setType] = useState("");
  const [phone, setPhone] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [is_primary, setPrimary] = useState(false);

  async function add() {
    setErr(null);
    if (!full_name.trim()) { setErr("Name is required."); return; }
    setBusy(true);
    const res = await addVendorContact(vendor.id, { full_name, job_title: null, contact_type: contact_type || null, phone, mobile, email, is_primary, is_active: true, notes: null });
    setBusy(false);
    if (!res.ok) { setErr(res.error); return; }
    setOpen(false); setName(""); setType(""); setPhone(""); setMobile(""); setEmail(""); setPrimary(false);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {canManage && <div className="flex justify-end"><Button size="sm" onClick={() => setOpen(true)}>Add contact</Button></div>}
      {vendor.contacts.length === 0 ? (
        <EmptyState title="No contacts yet" description="Add a primary, technical, or emergency contact." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {vendor.contacts.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-900">{c.full_name}</span>
                  {c.is_primary && <Badge variant="info">Primary</Badge>}
                </div>
                {c.contact_type && <p className="text-xs text-slate-500">{c.contact_type}</p>}
                {c.phone && <p className="mt-1 text-sm"><a className="text-blue-700 hover:underline" href={`tel:${c.phone}`}>{c.phone}</a></p>}
                {c.mobile && <p className="text-sm"><a className="text-blue-700 hover:underline" href={`tel:${c.mobile}`}>{c.mobile}</a></p>}
                {c.email && <p className="text-sm"><a className="text-blue-700 hover:underline" href={`mailto:${c.email}`}>{c.email}</a></p>}
                {!c.is_active && <Badge variant="neutral">Inactive</Badge>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={open} onClose={() => setOpen(false)} title="Add contact"
        footer={<><Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button><Button onClick={add} isLoading={busy}>Add</Button></>}
      >
        <div className="space-y-3">
          {err && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
          <Input placeholder="Full name *" value={full_name} onChange={(e) => setName(e.target.value)} />
          <Select value={contact_type} onChange={(e) => setType(e.target.value)}>
            <option value="">Contact type</option>
            <option>Primary</option><option>Technical</option><option>Emergency</option><option>Account / Administrative</option>
          </Select>
          <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input placeholder="Mobile" value={mobile} onChange={(e) => setMobile(e.target.value)} />
          <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={is_primary} onChange={(e) => setPrimary(e.target.checked)} /> Primary contact
          </label>
        </div>
      </Dialog>
    </div>
  );
}

function LocationsTab({ vendor, canManage, available }: { vendor: VendorDetail; canManage: boolean; available: LocationOpt[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [locId, setLocId] = useState("");
  async function link() {
    if (!locId) return;
    setBusy(true); await linkVendorLocation(vendor.id, locId); setBusy(false); setLocId(""); router.refresh();
  }
  async function remove(id: string) {
    setBusy(true); await unlinkVendorLocation(id, vendor.id); setBusy(false); router.refresh();
  }
  return (
    <div className="space-y-3">
      {canManage && available.length > 0 && (
        <div className="flex gap-2">
          <Select value={locId} onChange={(e) => setLocId(e.target.value)}>
            <option value="">Select a location to add…</option>
            {available.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </Select>
          <Button onClick={link} isLoading={busy} disabled={!locId}>Link</Button>
        </div>
      )}
      {vendor.locations.length === 0 ? (
        <EmptyState title="No locations linked" description="Link the Society locations this vendor serves." />
      ) : (
        <Card><CardContent className="divide-y divide-slate-100 p-2">
          {vendor.locations.map((l) => (
            <div key={l.id} className="flex items-center justify-between px-2 py-2">
              <span className="text-sm text-slate-900">{l.location?.name ?? "—"}</span>
              {canManage && <Button size="sm" variant="ghost" onClick={() => remove(l.id)}>Remove</Button>}
            </div>
          ))}
        </CardContent></Card>
      )}
    </div>
  );
}

function AssetsTab({ vendor, canManage, assetOptions }: { vendor: VendorDetail; canManage: boolean; assetOptions: AssetOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [assetId, setAssetId] = useState("");
  const [rel, setRel] = useState(REL_TYPES[0]);
  const [contractId, setContractId] = useState("");

  async function add() {
    setErr(null);
    if (!assetId) { setErr("Select an asset."); return; }
    setBusy(true);
    const res = await linkVendorAsset(vendor.id, { asset_id: assetId, relationship_type: rel, service_contract_id: contractId || null, notes: null });
    setBusy(false);
    if (!res.ok) { setErr(res.error); return; }
    setOpen(false); setAssetId(""); setContractId(""); router.refresh();
  }
  async function remove(id: string) { setBusy(true); await unlinkVendorAsset(id, vendor.id); setBusy(false); router.refresh(); }

  return (
    <div className="space-y-3">
      {canManage && <div className="flex justify-end"><Button size="sm" onClick={() => setOpen(true)}>Link asset</Button></div>}
      {vendor.assets.length === 0 ? (
        <EmptyState title="No assets linked" description="Link the assets this vendor is responsible for." />
      ) : (
        <Card><CardContent className="divide-y divide-slate-100 p-2">
          {vendor.assets.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-2 px-2 py-2">
              <div>
                <Link href={`/assets/${a.asset?.id ?? ""}`} className="text-sm font-medium text-slate-900 hover:underline">{a.asset?.name ?? "—"}</Link>
                <p className="text-xs text-slate-500">
                  {a.relationship_type ?? "—"}{a.contract ? ` · ${a.contract.contract_number}` : ""}
                </p>
              </div>
              {canManage && <Button size="sm" variant="ghost" onClick={() => remove(a.id)}>Remove</Button>}
            </div>
          ))}
        </CardContent></Card>
      )}
      <Dialog
        open={open} onClose={() => setOpen(false)} title="Link asset"
        footer={<><Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button><Button onClick={add} isLoading={busy}>Link</Button></>}
      >
        <div className="space-y-3">
          {err && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
          <Select value={assetId} onChange={(e) => setAssetId(e.target.value)}>
            <option value="">Select an asset…</option>
            {assetOptions.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
          <Select value={rel} onChange={(e) => setRel(e.target.value)}>
            {REL_TYPES.map((r) => <option key={r} value={r}>{r}</option>)}
          </Select>
          <Select value={contractId} onChange={(e) => setContractId(e.target.value)}>
            <option value="">No linked contract</option>
            {vendor.contracts.map((c) => <option key={c.id} value={c.id}>{c.contract_number} — {c.name}</option>)}
          </Select>
        </div>
      </Dialog>
    </div>
  );
}

function ContractsTab({ vendor, canManage }: { vendor: VendorDetail; canManage: boolean }) {
  return (
    <div className="space-y-3">
      {canManage && (
        <div className="flex justify-end">
          <Link href={`/vendors/contracts/new?vendor=${vendor.id}`}><Button size="sm">New contract</Button></Link>
        </div>
      )}
      {vendor.contracts.length === 0 ? (
        <EmptyState title="No contracts" description="Create a service contract for this vendor." />
      ) : (
        <Card><CardContent className="divide-y divide-slate-100 p-2">
          {vendor.contracts.map((c) => (
            <Link key={c.id} href={`/vendors/contracts/${c.id}`} className="flex items-center justify-between gap-2 px-2 py-3 hover:bg-slate-50">
              <div>
                <span className="text-sm font-medium text-slate-900">{c.name}</span>
                <p className="text-xs text-slate-500">{c.contract_number}{c.contract_type ? ` · ${c.contract_type}` : ""} · {formatDate(c.start_date)} – {formatDate(c.end_date)}</p>
              </div>
              <ContractStateBadge state={contractExpiryState(c.status, c.end_date)} />
            </Link>
          ))}
        </CardContent></Card>
      )}
    </div>
  );
}

function DocumentsTab({ vendor, canManage, orgId }: { vendor: VendorDetail; canManage: boolean; orgId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [docType, setDocType] = useState("");
  const [expiry, setExpiry] = useState("");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErr(null); setBusy(true);
    try {
      const supabase = createClient();
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${orgId}/vendors/${vendor.id}/${Date.now()}-${safe}`;
      const up = await supabase.storage.from("vendor-documents").upload(path, file);
      if (up.error) { setErr(up.error.message); setBusy(false); return; }
      const res = await recordVendorDocument({
        vendor_id: vendor.id, document_type: docType || null, document_name: file.name,
        file_name: file.name, file_path: path, file_type: file.type || null, file_size: file.size,
        issue_date: null, expiry_date: expiry || null,
      });
      if (!res.ok) setErr(res.error);
      setDocType(""); setExpiry("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
  async function download(path: string) {
    const res = await getDocumentSignedUrl(path);
    if (res.ok) window.open(res.data.url, "_blank");
  }
  async function remove(id: string, path: string) {
    setBusy(true); await deleteVendorDocument(id, path, vendor.id); setBusy(false); router.refresh();
  }

  return (
    <div className="space-y-3">
      {canManage && (
        <Card><CardContent className="flex flex-wrap items-end gap-3 p-4">
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500">Document type</span>
            <Input value={docType} onChange={(e) => setDocType(e.target.value)} placeholder="e.g. Trade License" className="w-48" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500">Expiry date</span>
            <Input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} className="w-44" />
          </label>
          <label className="inline-flex">
            <span className="cursor-pointer rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
              {busy ? "Uploading…" : "Upload file"}
              <input type="file" className="hidden" onChange={onFile} disabled={busy} />
            </span>
          </label>
        </CardContent></Card>
      )}
      {err && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
      {vendor.documents.length === 0 ? (
        <EmptyState title="No documents" description="Upload registration, licences, insurance, or certificates." />
      ) : (
        <Card><CardContent className="divide-y divide-slate-100 p-2">
          {vendor.documents.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-3 px-2 py-2">
              <div className="min-w-0">
                <button onClick={() => download(d.file_path)} className="truncate text-left text-sm font-medium text-blue-700 hover:underline">{d.document_name}</button>
                <p className="text-xs text-slate-500">
                  {d.document_type ? `${d.document_type} · ` : ""}{formatFileSize(d.file_size)}
                  {d.expiry_date ? ` · expires ${formatDate(d.expiry_date)}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <DocValidityBadge validity={docValidity(d.expiry_date)} />
                {canManage && <Button size="sm" variant="ghost" onClick={() => remove(d.id, d.file_path)}>Delete</Button>}
              </div>
            </div>
          ))}
        </CardContent></Card>
      )}
    </div>
  );
}

function WorkOrdersTab({ workOrders }: { workOrders: VendorWorkOrderRow[] }) {
  const open = workOrders.filter((w) => !["completed", "verified", "closed", "cancelled"].includes(w.status_code ?? "")).length;
  const completed = workOrders.filter((w) => ["completed", "verified", "closed"].includes(w.status_code ?? "")).length;
  return (
    <div className="space-y-3">
      <div className="flex gap-3 text-sm text-slate-600">
        <span>Total: <strong>{workOrders.length}</strong></span>
        <span>Open: <strong>{open}</strong></span>
        <span>Completed: <strong>{completed}</strong></span>
      </div>
      {workOrders.length === 0 ? (
        <EmptyState title="No work orders" description="No work orders reference this vendor yet." />
      ) : (
        <Card><CardContent className="divide-y divide-slate-100 p-2">
          {workOrders.map((w) => (
            <Link key={w.id} href={`/work-orders/${w.id}`} className="flex items-center justify-between gap-2 px-2 py-3 hover:bg-slate-50">
              <div>
                <span className="text-sm font-medium text-slate-900">{w.title}</span>
                <p className="text-xs text-slate-500">{w.work_order_number} · {formatDate(w.created_at)}</p>
              </div>
              <Badge variant="neutral">{w.status_name ?? "—"}</Badge>
            </Link>
          ))}
        </CardContent></Card>
      )}
    </div>
  );
}

function ActivityTab({ vendor }: { vendor: VendorDetail }) {
  if (vendor.activity.length === 0) return <EmptyState title="No activity" description="Vendor changes will appear here." />;
  return (
    <Card><CardContent className="p-4">
      <ol className="space-y-3">
        {vendor.activity.map((a) => (
          <li key={a.id} className="flex gap-3 text-sm">
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-slate-300" />
            <div>
              <p className="text-slate-900">{a.detail ?? a.action}</p>
              <p className="text-xs text-slate-400">
                {formatDateTime(a.created_at)}{a.actor?.full_name ? ` · ${a.actor.full_name}` : ""}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </CardContent></Card>
  );
}

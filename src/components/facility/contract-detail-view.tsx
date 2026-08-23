"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { ContractStateBadge } from "@/components/facility/vendor-badges";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatFileSize } from "@/lib/format";
import {
  contractExpiryState, daysUntil, type ContractDetail, type ContractStatus,
} from "@/lib/types/vendors";
import {
  setContractStatus, recordContractDocument, deleteContractDocument, getDocumentSignedUrl,
} from "@/lib/actions/vendors";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-4">
      <span className="w-44 shrink-0 text-sm text-slate-500">{label}</span>
      <span className="text-sm text-slate-900">{value || "—"}</span>
    </div>
  );
}

export function ContractDetailView({
  contract, canManage, orgId,
}: {
  contract: ContractDetail;
  canManage: boolean;
  orgId: string;
}) {
  const router = useRouter();
  const state = contractExpiryState(contract.status, contract.end_date);
  const remaining = daysUntil(contract.end_date);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [docType, setDocType] = useState("");

  async function changeStatus(status: ContractStatus) {
    setBusy(true); await setContractStatus(contract.id, status); setBusy(false); router.refresh();
  }
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErr(null); setBusy(true);
    try {
      const supabase = createClient();
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${orgId}/contracts/${contract.id}/${Date.now()}-${safe}`;
      const up = await supabase.storage.from("vendor-documents").upload(path, file);
      if (up.error) { setErr(up.error.message); setBusy(false); return; }
      const res = await recordContractDocument({
        contract_id: contract.id, document_type: docType || null, document_name: file.name,
        file_name: file.name, file_path: path, file_type: file.type || null, file_size: file.size,
      });
      if (!res.ok) setErr(res.error);
      setDocType("");
      router.refresh();
    } finally { setBusy(false); }
  }
  async function download(path: string) {
    const res = await getDocumentSignedUrl(path);
    if (res.ok) window.open(res.data.url, "_blank");
  }
  async function removeDoc(id: string, path: string) {
    setBusy(true); await deleteContractDocument(id, path, contract.id); setBusy(false); router.refresh();
  }

  return (
    <div>
      <PageHeader
        title={contract.name}
        description={`${contract.contract_number}${contract.contract_type ? ` · ${contract.contract_type}` : ""}`}
        actions={<ContractStateBadge state={state} />}
      />
      <div className="mb-4">
        <Link href="/vendors/contracts" className="text-sm font-medium text-slate-700 underline-offset-2 hover:underline">← Back to Contracts</Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card><CardContent className="divide-y divide-slate-100 p-5">
            <Row label="Contract Number" value={<span className="font-mono text-xs">{contract.contract_number}</span>} />
            <Row label="Vendor" value={contract.vendor ? <Link href={`/vendors/${contract.vendor.id}`} className="text-blue-700 hover:underline">{contract.vendor.company_name}</Link> : null} />
            <Row label="Type" value={contract.contract_type} />
            <Row label="Status" value={<ContractStateBadge state={state} />} />
            <Row label="Start" value={formatDate(contract.start_date)} />
            <Row label="End" value={formatDate(contract.end_date)} />
            <Row label="Remaining" value={remaining === null ? null : remaining < 0 ? `Expired ${Math.abs(remaining)} days ago` : `${remaining} days`} />
            <Row label="Service scope" value={contract.service_scope} />
            <Row label="Response time" value={contract.response_time_notes} />
            <Row label="Main contact" value={contract.contact?.full_name} />
            <Row label="Renewal notes" value={contract.renewal_notes} />
            <Row label="Contract value" value={contract.contract_value != null ? `${contract.contract_value}${contract.currency ? ` ${contract.currency}` : ""}` : null} />
            <Row label="Notes" value={contract.notes} />
          </CardContent></Card>

          <Card><CardContent className="p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Documents</h3>
            {canManage && (
              <div className="mb-3 flex flex-wrap items-end gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs text-slate-500">Document type</span>
                  <Input value={docType} onChange={(e) => setDocType(e.target.value)} placeholder="e.g. Signed Contract" className="w-48" />
                </label>
                <label className="inline-flex">
                  <span className="cursor-pointer rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
                    {busy ? "Uploading…" : "Upload file"}
                    <input type="file" className="hidden" onChange={onFile} disabled={busy} />
                  </span>
                </label>
              </div>
            )}
            {err && <div className="mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
            {contract.documents.length === 0 ? (
              <p className="text-sm text-slate-500">No documents uploaded.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {contract.documents.map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <button onClick={() => download(d.file_path)} className="truncate text-left text-sm font-medium text-blue-700 hover:underline">{d.document_name}</button>
                      <p className="text-xs text-slate-500">{d.document_type ? `${d.document_type} · ` : ""}{formatFileSize(d.file_size)}</p>
                    </div>
                    {canManage && <Button size="sm" variant="ghost" onClick={() => removeDoc(d.id, d.file_path)}>Delete</Button>}
                  </div>
                ))}
              </div>
            )}
          </CardContent></Card>
        </div>

        <div className="space-y-4">
          <Card><CardContent className="p-5">
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Locations covered</h3>
            {contract.locations.length === 0 ? <p className="text-sm text-slate-500">All / none specified.</p> : (
              <ul className="space-y-1 text-sm text-slate-700">
                {contract.locations.map((l) => <li key={l.id}>{l.location?.name ?? "—"}</li>)}
              </ul>
            )}
          </CardContent></Card>

          <Card><CardContent className="p-5">
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Assets covered</h3>
            {contract.assets.length === 0 ? <p className="text-sm text-slate-500">None specified.</p> : (
              <ul className="space-y-1 text-sm">
                {contract.assets.map((a) => (
                  <li key={a.id}>
                    <Link href={`/assets/${a.asset?.id ?? ""}`} className="text-blue-700 hover:underline">{a.asset?.name ?? "—"}</Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent></Card>

          {canManage && (
            <Card><CardContent className="p-5">
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Lifecycle</h3>
              <div className="flex flex-wrap gap-2">
                {contract.status !== "active" && <Button size="sm" variant="outline" onClick={() => changeStatus("active")} isLoading={busy}>Set Active</Button>}
                {contract.status !== "terminated" && <Button size="sm" variant="outline" onClick={() => changeStatus("terminated")} isLoading={busy}>Terminate</Button>}
                {contract.status !== "archived" && <Button size="sm" variant="outline" onClick={() => changeStatus("archived")} isLoading={busy}>Archive</Button>}
              </div>
              <p className="mt-2 text-xs text-slate-400">Expiring / Expired states are derived automatically from the end date.</p>
            </CardContent></Card>
          )}
        </div>
      </div>

      {contract.documents.length === 0 && contract.locations.length === 0 && contract.assets.length === 0 && (
        <div className="mt-4"><EmptyState title="No coverage or documents yet" description="Add locations, assets, and documents as they become available." /></div>
      )}
    </div>
  );
}

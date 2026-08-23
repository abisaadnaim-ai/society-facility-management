"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatDateTime } from "@/lib/format";
import { VENDOR_NOTE_TYPES, VENDOR_NOTE_LABEL, type WorkOrderVendorInfo, type WorkOrderVendorNoteRow } from "@/lib/types/vendors";
import { assignWorkOrderVendor, clearWorkOrderVendor, addWorkOrderVendorNote } from "@/lib/actions/vendors";

type VendorOpt = { id: string; company_name: string; vendor_number: string };
type ContactLite = { id: string; vendor_id: string; full_name: string };
type ContractLite = { id: string; vendor_id: string; contract_number: string; name: string };

export function WorkOrderVendorPanel({
  workOrderId, info, notes, vendors, contacts, contracts, canManage, canWriteNotes,
}: {
  workOrderId: string;
  info: WorkOrderVendorInfo | null;
  notes: WorkOrderVendorNoteRow[];
  vendors: VendorOpt[];
  contacts: ContactLite[];
  contracts: ContractLite[];
  canManage: boolean;
  canWriteNotes: boolean;
}) {
  const router = useRouter();
  const [assignOpen, setAssignOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [vendorId, setVendorId] = useState(info?.vendor?.id ?? "");
  const [contactId, setContactId] = useState(info?.contact?.id ?? "");
  const [contractId, setContractId] = useState(info?.contract?.id ?? "");
  const [reference, setReference] = useState(info?.vendor_reference ?? "");
  const [expected, setExpected] = useState(info?.vendor_expected_date ?? "");

  const vendorContacts = useMemo(() => contacts.filter((c) => c.vendor_id === vendorId), [contacts, vendorId]);
  const vendorContracts = useMemo(() => contracts.filter((c) => c.vendor_id === vendorId), [contracts, vendorId]);

  // notes composer
  const [noteType, setNoteType] = useState("contacted");
  const [noteText, setNoteText] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);

  async function assign() {
    setErr(null);
    if (!vendorId) { setErr("Select a vendor."); return; }
    setBusy(true);
    const res = await assignWorkOrderVendor(workOrderId, {
      vendor_id: vendorId,
      vendor_contact_id: contactId || null,
      service_contract_id: contractId || null,
      vendor_reference: reference || null,
      vendor_expected_date: expected || null,
    });
    setBusy(false);
    if (!res.ok) { setErr(res.error); return; }
    setAssignOpen(false);
    router.refresh();
  }
  async function clear() {
    setBusy(true); await clearWorkOrderVendor(workOrderId); setBusy(false); router.refresh();
  }
  async function addNote() {
    if (!noteText.trim()) return;
    setNoteBusy(true);
    const res = await addWorkOrderVendorNote(workOrderId, { note_type: noteType, note: noteText });
    setNoteBusy(false);
    if (res.ok) { setNoteText(""); router.refresh(); }
  }

  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">External Vendor</h3>
          {canManage && (
            info?.vendor
              ? <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)}>Change</Button>
              : <Button size="sm" onClick={() => setAssignOpen(true)}>Assign Vendor</Button>
          )}
        </div>

        {info?.vendor ? (
          <div className="space-y-1 text-sm">
            <p>
              <span className="text-slate-500">Vendor: </span>
              <Link href={`/vendors/${info.vendor.id}`} className="font-medium text-blue-700 hover:underline">{info.vendor.company_name}</Link>
              {info.vendor.phone && <a href={`tel:${info.vendor.phone}`} className="ml-2 text-blue-700 hover:underline">{info.vendor.phone}</a>}
            </p>
            {info.contact && (
              <p><span className="text-slate-500">Contact: </span>{info.contact.full_name}
                {info.contact.phone && <a href={`tel:${info.contact.phone}`} className="ml-2 text-blue-700 hover:underline">{info.contact.phone}</a>}
              </p>
            )}
            {info.contract && (
              <p><span className="text-slate-500">Contract: </span>
                <Link href={`/vendors/contracts/${info.contract.id}`} className="text-blue-700 hover:underline">{info.contract.contract_number}</Link>
                {" — "}{info.contract.name}
              </p>
            )}
            {info.vendor_reference && <p><span className="text-slate-500">External reference: </span>{info.vendor_reference}</p>}
            {info.vendor_expected_date && <p><span className="text-slate-500">Expected attendance: </span>{formatDate(info.vendor_expected_date)}</p>}
            {canManage && <Button size="sm" variant="ghost" onClick={clear} isLoading={busy} className="mt-1">Remove vendor</Button>}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No external vendor assigned to this work order.</p>
        )}

        {/* Vendor service notes (§22) */}
        {(info?.vendor || notes.length > 0) && (
          <div className="mt-5 border-t border-slate-100 pt-4">
            <h4 className="mb-2 text-sm font-semibold text-slate-900">Vendor service notes</h4>
            {canWriteNotes && (
              <div className="mb-3 space-y-2">
                <div className="flex gap-2">
                  <Select value={noteType} onChange={(e) => setNoteType(e.target.value)} className="w-56">
                    {VENDOR_NOTE_TYPES.map((t) => <option key={t} value={t}>{VENDOR_NOTE_LABEL[t]}</option>)}
                  </Select>
                </div>
                <Textarea rows={2} placeholder="Record vendor interaction…" value={noteText} onChange={(e) => setNoteText(e.target.value)} />
                <div className="flex justify-end"><Button size="sm" onClick={addNote} isLoading={noteBusy} disabled={!noteText.trim()}>Add note</Button></div>
              </div>
            )}
            {notes.length === 0 ? (
              <p className="text-sm text-slate-500">No service notes yet.</p>
            ) : (
              <ol className="space-y-2">
                {notes.map((n) => (
                  <li key={n.id} className="text-sm">
                    <span className="font-medium text-slate-900">{n.note_type ? VENDOR_NOTE_LABEL[n.note_type] ?? n.note_type : "Note"}</span>
                    <span className="text-slate-700">: {n.note}</span>
                    <p className="text-xs text-slate-400">{formatDateTime(n.created_at)}{n.author?.full_name ? ` · ${n.author.full_name}` : ""}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </CardContent>

      <Dialog
        open={assignOpen} onClose={() => setAssignOpen(false)} title="Assign external vendor"
        footer={<><Button variant="outline" onClick={() => setAssignOpen(false)} disabled={busy}>Cancel</Button><Button onClick={assign} isLoading={busy}>Save</Button></>}
      >
        <div className="space-y-3">
          {err && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Vendor *</span>
            <Select value={vendorId} onChange={(e) => { setVendorId(e.target.value); setContactId(""); setContractId(""); }}>
              <option value="">Select a vendor…</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.company_name}</option>)}
            </Select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Contact</span>
            <Select value={contactId} onChange={(e) => setContactId(e.target.value)} disabled={!vendorId}>
              <option value="">— None —</option>
              {vendorContacts.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </Select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Service contract</span>
            <Select value={contractId} onChange={(e) => setContractId(e.target.value)} disabled={!vendorId}>
              <option value="">— None —</option>
              {vendorContracts.map((c) => <option key={c.id} value={c.id}>{c.contract_number} — {c.name}</option>)}
            </Select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Expected attendance date</span>
            <Input type="date" value={expected} onChange={(e) => setExpected(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">External reference / ticket</span>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Vendor ticket or reference number" />
          </label>
        </div>
      </Dialog>
    </Card>
  );
}

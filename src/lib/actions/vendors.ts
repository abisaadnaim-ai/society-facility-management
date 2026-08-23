"use server";

import { revalidatePath } from "next/cache";
import { getActionContext, friendlyDbError, logActionError, type ActionResult } from "@/lib/actions/context";
import { idb, type VendorStatus, type ContractStatus } from "@/lib/types/vendors";

const BUCKET = "vendor-documents";

function clean(s: string | null | undefined): string | null {
  const t = (s ?? "").trim();
  return t.length ? t : null;
}

// ============================ VENDORS ============================
export type VendorInput = {
  company_name: string;
  trading_name: string | null;
  service_category_id: string | null;
  status: VendorStatus;
  contact_person: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  notes: string | null;
};

export async function createVendor(input: VendorInput): Promise<ActionResult<{ id: string }>> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  if (!input.company_name.trim()) return { ok: false, error: "A company name is required." };
  const db = idb(ctx.supabase);
  const { data, error } = await db
    .from("vendors")
    .insert({
      organization_id: ctx.profile.organization_id,
      company_name: input.company_name.trim(),
      trading_name: clean(input.trading_name),
      service_category_id: input.service_category_id || null,
      status: input.status,
      contact_person: clean(input.contact_person),
      phone: clean(input.phone),
      mobile: clean(input.mobile),
      email: clean(input.email),
      website: clean(input.website),
      address: clean(input.address),
      notes: clean(input.notes),
      created_by: ctx.profile.id,
    })
    .select("id")
    .single();
  if (error) {
    logActionError("createVendor", error);
    return { ok: false, error: friendlyDbError(error.message) };
  }
  revalidatePath("/vendors");
  return { ok: true, data: { id: (data as { id: string }).id } };
}

export async function updateVendor(id: string, input: VendorInput): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  const db = idb(ctx.supabase);
  const { error } = await db
    .from("vendors")
    .update({
      company_name: input.company_name.trim(),
      trading_name: clean(input.trading_name),
      service_category_id: input.service_category_id || null,
      status: input.status,
      contact_person: clean(input.contact_person),
      phone: clean(input.phone),
      mobile: clean(input.mobile),
      email: clean(input.email),
      website: clean(input.website),
      address: clean(input.address),
      notes: clean(input.notes),
    })
    .eq("id", id);
  if (error) {
    logActionError("updateVendor", error);
    return { ok: false, error: friendlyDbError(error.message) };
  }
  revalidatePath(`/vendors/${id}`);
  revalidatePath("/vendors");
  return { ok: true, data: undefined };
}

export async function setVendorStatus(id: string, status: VendorStatus): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  const { error } = await idb(ctx.supabase).from("vendors").update({ status }).eq("id", id);
  if (error) {
    logActionError("setVendorStatus", error);
    return { ok: false, error: friendlyDbError(error.message) };
  }
  revalidatePath(`/vendors/${id}`);
  revalidatePath("/vendors");
  return { ok: true, data: undefined };
}

// ============================ CONTACTS ============================
export type ContactInput = {
  full_name: string;
  job_title: string | null;
  contact_type: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  is_primary: boolean;
  is_active: boolean;
  notes: string | null;
};

export async function addVendorContact(vendorId: string, input: ContactInput): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  if (!input.full_name.trim()) return { ok: false, error: "A contact name is required." };
  const { error } = await idb(ctx.supabase).from("vendor_contacts").insert({
    organization_id: ctx.profile.organization_id,
    vendor_id: vendorId,
    full_name: input.full_name.trim(),
    job_title: clean(input.job_title),
    contact_type: clean(input.contact_type),
    phone: clean(input.phone),
    mobile: clean(input.mobile),
    email: clean(input.email),
    is_primary: input.is_primary,
    is_active: input.is_active,
    notes: clean(input.notes),
  });
  if (error) {
    logActionError("addVendorContact", error);
    return { ok: false, error: friendlyDbError(error.message) };
  }
  revalidatePath(`/vendors/${vendorId}`);
  return { ok: true, data: undefined };
}

export async function updateVendorContact(id: string, vendorId: string, input: ContactInput): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  const { error } = await idb(ctx.supabase).from("vendor_contacts").update({
    full_name: input.full_name.trim(),
    job_title: clean(input.job_title),
    contact_type: clean(input.contact_type),
    phone: clean(input.phone),
    mobile: clean(input.mobile),
    email: clean(input.email),
    is_primary: input.is_primary,
    is_active: input.is_active,
    notes: clean(input.notes),
  }).eq("id", id);
  if (error) {
    logActionError("updateVendorContact", error);
    return { ok: false, error: friendlyDbError(error.message) };
  }
  revalidatePath(`/vendors/${vendorId}`);
  return { ok: true, data: undefined };
}

// ============================ LOCATION / ASSET LINKS ============================
export async function linkVendorLocation(vendorId: string, locationId: string): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  if (!locationId) return { ok: false, error: "Select a location." };
  const { error } = await idb(ctx.supabase).from("vendor_locations").insert({
    organization_id: ctx.profile.organization_id, vendor_id: vendorId, location_id: locationId,
  });
  if (error) {
    logActionError("linkVendorLocation", error);
    return { ok: false, error: friendlyDbError(error.message) };
  }
  revalidatePath(`/vendors/${vendorId}`);
  return { ok: true, data: undefined };
}

export async function unlinkVendorLocation(id: string, vendorId: string): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  const { error } = await idb(ctx.supabase).from("vendor_locations").delete().eq("id", id);
  if (error) {
    logActionError("unlinkVendorLocation", error);
    return { ok: false, error: friendlyDbError(error.message) };
  }
  revalidatePath(`/vendors/${vendorId}`);
  return { ok: true, data: undefined };
}

export async function linkVendorAsset(
  vendorId: string,
  input: { asset_id: string; relationship_type: string | null; service_contract_id: string | null; notes: string | null }
): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  if (!input.asset_id) return { ok: false, error: "Select an asset." };
  const { error } = await idb(ctx.supabase).from("vendor_assets").insert({
    organization_id: ctx.profile.organization_id,
    vendor_id: vendorId,
    asset_id: input.asset_id,
    relationship_type: clean(input.relationship_type),
    service_contract_id: input.service_contract_id || null,
    notes: clean(input.notes),
  });
  if (error) {
    logActionError("linkVendorAsset", error);
    return { ok: false, error: friendlyDbError(error.message) };
  }
  revalidatePath(`/vendors/${vendorId}`);
  return { ok: true, data: undefined };
}

export async function unlinkVendorAsset(id: string, vendorId: string): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  const { error } = await idb(ctx.supabase).from("vendor_assets").delete().eq("id", id);
  if (error) {
    logActionError("unlinkVendorAsset", error);
    return { ok: false, error: friendlyDbError(error.message) };
  }
  revalidatePath(`/vendors/${vendorId}`);
  return { ok: true, data: undefined };
}

// ============================ CONTRACTS ============================
export type ContractInput = {
  vendor_id: string;
  name: string;
  contract_type: string | null;
  description: string | null;
  start_date: string;
  end_date: string;
  status: ContractStatus;
  contract_value: string | null;
  currency: string | null;
  contact_person_id: string | null;
  response_time_notes: string | null;
  service_scope: string | null;
  renewal_notes: string | null;
  termination_notice_days: string | null;
  notes: string | null;
  location_ids: string[];
  asset_ids: string[];
};

export async function createContract(input: ContractInput): Promise<ActionResult<{ id: string }>> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  if (!input.vendor_id) return { ok: false, error: "Select a vendor." };
  if (!input.name.trim()) return { ok: false, error: "A contract name is required." };
  if (!input.start_date || !input.end_date) return { ok: false, error: "Start and end dates are required." };
  if (input.end_date < input.start_date) return { ok: false, error: "End date must be on or after the start date." };

  const db = idb(ctx.supabase);
  const orgId = ctx.profile.organization_id;
  const { data, error } = await db.from("service_contracts").insert({
    organization_id: orgId,
    vendor_id: input.vendor_id,
    name: input.name.trim(),
    contract_type: clean(input.contract_type),
    description: clean(input.description),
    start_date: input.start_date,
    end_date: input.end_date,
    status: input.status,
    contract_value: input.contract_value ? Number(input.contract_value) : null,
    currency: clean(input.currency),
    contact_person_id: input.contact_person_id || null,
    response_time_notes: clean(input.response_time_notes),
    service_scope: clean(input.service_scope),
    renewal_notes: clean(input.renewal_notes),
    termination_notice_days: input.termination_notice_days ? Number(input.termination_notice_days) : null,
    notes: clean(input.notes),
    created_by: ctx.profile.id,
  }).select("id").single();
  if (error) {
    logActionError("createContract", error);
    return { ok: false, error: friendlyDbError(error.message) };
  }
  const contractId = (data as { id: string }).id;

  if (input.location_ids.length) {
    const rows = input.location_ids.map((location_id) => ({ organization_id: orgId, contract_id: contractId, location_id }));
    const { error: le } = await db.from("service_contract_locations").insert(rows);
    if (le) logActionError("createContract:locations", le);
  }
  if (input.asset_ids.length) {
    const rows = input.asset_ids.map((asset_id) => ({ organization_id: orgId, contract_id: contractId, asset_id }));
    const { error: ae } = await db.from("service_contract_assets").insert(rows);
    if (ae) logActionError("createContract:assets", ae);
  }
  revalidatePath("/vendors/contracts");
  revalidatePath(`/vendors/${input.vendor_id}`);
  return { ok: true, data: { id: contractId } };
}

export async function updateContract(
  id: string,
  input: Omit<ContractInput, "vendor_id" | "location_ids" | "asset_ids">
): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  if (input.end_date < input.start_date) return { ok: false, error: "End date must be on or after the start date." };
  const { error } = await idb(ctx.supabase).from("service_contracts").update({
    name: input.name.trim(),
    contract_type: clean(input.contract_type),
    description: clean(input.description),
    start_date: input.start_date,
    end_date: input.end_date,
    status: input.status,
    contract_value: input.contract_value ? Number(input.contract_value) : null,
    currency: clean(input.currency),
    contact_person_id: input.contact_person_id || null,
    response_time_notes: clean(input.response_time_notes),
    service_scope: clean(input.service_scope),
    renewal_notes: clean(input.renewal_notes),
    termination_notice_days: input.termination_notice_days ? Number(input.termination_notice_days) : null,
    notes: clean(input.notes),
  }).eq("id", id);
  if (error) {
    logActionError("updateContract", error);
    return { ok: false, error: friendlyDbError(error.message) };
  }
  revalidatePath(`/vendors/contracts/${id}`);
  return { ok: true, data: undefined };
}

export async function setContractStatus(id: string, status: ContractStatus): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  const { error } = await idb(ctx.supabase).from("service_contracts").update({ status }).eq("id", id);
  if (error) {
    logActionError("setContractStatus", error);
    return { ok: false, error: friendlyDbError(error.message) };
  }
  revalidatePath(`/vendors/contracts/${id}`);
  return { ok: true, data: undefined };
}

// ============================ DOCUMENTS ============================
export async function recordVendorDocument(input: {
  vendor_id: string; document_type: string | null; document_name: string;
  file_name: string; file_path: string; file_type: string | null; file_size: number | null;
  issue_date: string | null; expiry_date: string | null;
}): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  const { error } = await idb(ctx.supabase).from("vendor_documents").insert({
    organization_id: ctx.profile.organization_id,
    vendor_id: input.vendor_id,
    document_type: clean(input.document_type),
    document_name: input.document_name.trim() || input.file_name,
    file_name: input.file_name,
    file_path: input.file_path,
    file_type: input.file_type,
    file_size: input.file_size,
    issue_date: input.issue_date || null,
    expiry_date: input.expiry_date || null,
    uploaded_by: ctx.profile.id,
  });
  if (error) {
    logActionError("recordVendorDocument", error);
    return { ok: false, error: friendlyDbError(error.message) };
  }
  revalidatePath(`/vendors/${input.vendor_id}`);
  return { ok: true, data: undefined };
}

export async function recordContractDocument(input: {
  contract_id: string; document_type: string | null; document_name: string;
  file_name: string; file_path: string; file_type: string | null; file_size: number | null;
}): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  const { error } = await idb(ctx.supabase).from("service_contract_documents").insert({
    organization_id: ctx.profile.organization_id,
    contract_id: input.contract_id,
    document_type: clean(input.document_type),
    document_name: input.document_name.trim() || input.file_name,
    file_name: input.file_name,
    file_path: input.file_path,
    file_type: input.file_type,
    file_size: input.file_size,
    uploaded_by: ctx.profile.id,
  });
  if (error) {
    logActionError("recordContractDocument", error);
    return { ok: false, error: friendlyDbError(error.message) };
  }
  revalidatePath(`/vendors/contracts/${input.contract_id}`);
  return { ok: true, data: undefined };
}

export async function getDocumentSignedUrl(filePath: string): Promise<ActionResult<{ url: string }>> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  const { data, error } = await ctx.supabase.storage.from(BUCKET).createSignedUrl(filePath, 60);
  if (error || !data) {
    logActionError("getDocumentSignedUrl", error);
    return { ok: false, error: "Could not generate a download link." };
  }
  return { ok: true, data: { url: data.signedUrl } };
}

export async function deleteVendorDocument(id: string, filePath: string, vendorId: string): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  const { error } = await idb(ctx.supabase).from("vendor_documents").delete().eq("id", id);
  if (error) {
    logActionError("deleteVendorDocument", error);
    return { ok: false, error: friendlyDbError(error.message) };
  }
  await ctx.supabase.storage.from(BUCKET).remove([filePath]);
  revalidatePath(`/vendors/${vendorId}`);
  return { ok: true, data: undefined };
}

export async function deleteContractDocument(id: string, filePath: string, contractId: string): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  const { error } = await idb(ctx.supabase).from("service_contract_documents").delete().eq("id", id);
  if (error) {
    logActionError("deleteContractDocument", error);
    return { ok: false, error: friendlyDbError(error.message) };
  }
  await ctx.supabase.storage.from(BUCKET).remove([filePath]);
  revalidatePath(`/vendors/contracts/${contractId}`);
  return { ok: true, data: undefined };
}

// ============================ WORK ORDER INTEGRATION ============================
export async function assignWorkOrderVendor(
  workOrderId: string,
  input: {
    vendor_id: string; vendor_contact_id: string | null; service_contract_id: string | null;
    vendor_reference: string | null; vendor_expected_date: string | null;
  }
): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  if (!input.vendor_id) return { ok: false, error: "Select a vendor." };
  const { error } = await idb(ctx.supabase).from("work_orders").update({
    vendor_id: input.vendor_id,
    vendor_contact_id: input.vendor_contact_id || null,
    service_contract_id: input.service_contract_id || null,
    vendor_reference: clean(input.vendor_reference),
    vendor_expected_date: input.vendor_expected_date || null,
  }).eq("id", workOrderId);
  if (error) {
    logActionError("assignWorkOrderVendor", error);
    return { ok: false, error: friendlyDbError(error.message) };
  }
  revalidatePath(`/work-orders/${workOrderId}`);
  return { ok: true, data: undefined };
}

export async function clearWorkOrderVendor(workOrderId: string): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  const { error } = await idb(ctx.supabase).from("work_orders").update({
    vendor_id: null, vendor_contact_id: null, service_contract_id: null,
    vendor_reference: null, vendor_expected_date: null,
  }).eq("id", workOrderId);
  if (error) {
    logActionError("clearWorkOrderVendor", error);
    return { ok: false, error: friendlyDbError(error.message) };
  }
  revalidatePath(`/work-orders/${workOrderId}`);
  return { ok: true, data: undefined };
}

export async function addWorkOrderVendorNote(
  workOrderId: string,
  input: { note_type: string | null; note: string }
): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  if (!input.note.trim()) return { ok: false, error: "Enter a note." };
  const { error } = await idb(ctx.supabase).from("work_order_vendor_notes").insert({
    organization_id: ctx.profile.organization_id,
    work_order_id: workOrderId,
    note_type: clean(input.note_type),
    note: input.note.trim(),
    created_by: ctx.profile.id,
  });
  if (error) {
    logActionError("addWorkOrderVendorNote", error);
    return { ok: false, error: friendlyDbError(error.message) };
  }
  revalidatePath(`/work-orders/${workOrderId}`);
  return { ok: true, data: undefined };
}

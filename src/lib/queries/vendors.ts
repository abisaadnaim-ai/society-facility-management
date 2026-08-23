import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import {
  idb,
  contractExpiryState,
  todayISO,
  type VendorStatus,
  type VendorServiceCategory,
  type VendorRow,
  type VendorDetail,
  type VendorContact,
  type VendorLocationRow,
  type VendorAssetRow,
  type VendorDocument,
  type VendorActivityRow,
  type ContractRow,
  type ContractDetail,
  type ContractLocationRow,
  type ContractAssetRow,
  type ServiceContractDocument,
  type ServiceContract,
  type WorkOrderVendorInfo,
  type WorkOrderVendorNoteRow,
  type VendorDashboardMetrics,
  type ExpiringContractRow,
} from "@/lib/types/vendors";

function sanitize(term: string): string {
  return term.replace(/[,()%]/g, " ").trim();
}

export type VendorListFilters = {
  categoryId?: string;
  locationId?: string;
  status?: string;
  contractState?: string; // active | expiring_soon | expired
  search?: string;
};

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
export async function getVendorCategories(
  supabase: SupabaseClient<Database>
): Promise<VendorServiceCategory[]> {
  const { data, error } = await idb(supabase)
    .from("vendor_service_categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) {
    console.error("getVendorCategories failed:", error.message);
    return [];
  }
  return (data ?? []) as VendorServiceCategory[];
}

/** Active vendors as lightweight options (WO assign, contract form). */
export async function getVendorOptions(
  supabase: SupabaseClient<Database>
): Promise<{ id: string; company_name: string; vendor_number: string }[]> {
  const { data, error } = await idb(supabase)
    .from("vendors")
    .select("id, company_name, vendor_number")
    .eq("status", "active")
    .order("company_name", { ascending: true });
  if (error) {
    console.error("getVendorOptions failed:", error.message);
    return [];
  }
  return (data ?? []) as { id: string; company_name: string; vendor_number: string }[];
}

export async function getContactsForVendor(
  supabase: SupabaseClient<Database>,
  vendorId: string
): Promise<VendorContact[]> {
  const { data, error } = await idb(supabase)
    .from("vendor_contacts")
    .select("*")
    .eq("vendor_id", vendorId)
    .order("is_primary", { ascending: false })
    .order("full_name", { ascending: true });
  if (error) {
    console.error("getContactsForVendor failed:", error.message);
    return [];
  }
  return (data ?? []) as VendorContact[];
}

export async function getContractsForVendor(
  supabase: SupabaseClient<Database>,
  vendorId: string
): Promise<ServiceContract[]> {
  const { data, error } = await idb(supabase)
    .from("service_contracts")
    .select("*")
    .eq("vendor_id", vendorId)
    .order("end_date", { ascending: false });
  if (error) {
    console.error("getContractsForVendor failed:", error.message);
    return [];
  }
  return (data ?? []) as ServiceContract[];
}

/** All contacts (lite) for the org, for client-side filtering in forms. */
export async function getVendorContactsLite(
  supabase: SupabaseClient<Database>
): Promise<{ id: string; vendor_id: string; full_name: string }[]> {
  const { data, error } = await idb(supabase)
    .from("vendor_contacts")
    .select("id, vendor_id, full_name")
    .eq("is_active", true)
    .order("full_name", { ascending: true });
  if (error) {
    console.error("getVendorContactsLite failed:", error.message);
    return [];
  }
  return (data ?? []) as { id: string; vendor_id: string; full_name: string }[];
}

/** All contracts (lite) for the org, for dependent selects in the WO panel. */
export async function getContractsLite(
  supabase: SupabaseClient<Database>
): Promise<{ id: string; vendor_id: string; contract_number: string; name: string }[]> {
  const { data, error } = await idb(supabase)
    .from("service_contracts")
    .select("id, vendor_id, contract_number, name")
    .order("end_date", { ascending: false });
  if (error) {
    console.error("getContractsLite failed:", error.message);
    return [];
  }
  return (data ?? []) as { id: string; vendor_id: string; contract_number: string; name: string }[];
}

// ---------------------------------------------------------------------------
// Vendor register (§26)
// ---------------------------------------------------------------------------
export async function getVendors(
  supabase: SupabaseClient<Database>,
  filters: VendorListFilters = {}
): Promise<VendorRow[]> {
  const db = idb(supabase);

  let vendorIdsForLocation: Set<string> | null = null;
  if (filters.locationId) {
    const { data: vl } = await db
      .from("vendor_locations")
      .select("vendor_id")
      .eq("location_id", filters.locationId);
    vendorIdsForLocation = new Set((vl ?? []).map((r) => (r as { vendor_id: string }).vendor_id));
    if (vendorIdsForLocation.size === 0) return [];
  }

  let query = db.from("vendors").select("*").order("company_name", { ascending: true });
  if (filters.categoryId) query = query.eq("service_category_id", filters.categoryId);
  if (filters.status) query = query.eq("status", filters.status as VendorStatus);
  const term = filters.search ? sanitize(filters.search) : "";
  if (term) {
    query = query.or(
      `vendor_number.ilike.%${term}%,company_name.ilike.%${term}%,trading_name.ilike.%${term}%,contact_person.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`
    );
  }
  const { data, error } = await query;
  if (error) {
    console.error("getVendors failed:", error.message);
    return [];
  }
  let vendors = (data ?? []) as VendorRow[];
  if (vendorIdsForLocation) vendors = vendors.filter((v) => vendorIdsForLocation!.has(v.id));
  if (vendors.length === 0) return [];

  const ids = vendors.map((v) => v.id);
  // categories
  const { data: cats } = await db.from("vendor_service_categories").select("id, name");
  const catMap = new Map((cats ?? []).map((c) => [(c as { id: string }).id, c as { id: string; name: string }]));
  // locations (count + membership)
  const { data: locs } = await db.from("vendor_locations").select("vendor_id, location_id").in("vendor_id", ids);
  const locCount = new Map<string, number>();
  const locIds = new Map<string, string[]>();
  (locs ?? []).forEach((l) => {
    const row = l as { vendor_id: string; location_id: string };
    locCount.set(row.vendor_id, (locCount.get(row.vendor_id) ?? 0) + 1);
    if (!locIds.has(row.vendor_id)) locIds.set(row.vendor_id, []);
    locIds.get(row.vendor_id)!.push(row.location_id);
  });
  // contracts (for active count + contract-state filter)
  const { data: cons } = await db
    .from("service_contracts")
    .select("vendor_id, status, end_date")
    .in("vendor_id", ids);
  const today = todayISO();
  const activeCount = new Map<string, number>();
  const stateByVendor = new Map<string, Set<string>>();
  (cons ?? []).forEach((c) => {
    const row = c as { vendor_id: string; status: ServiceContract["status"]; end_date: string };
    const st = contractExpiryState(row.status, row.end_date, today);
    if (!stateByVendor.has(row.vendor_id)) stateByVendor.set(row.vendor_id, new Set());
    stateByVendor.get(row.vendor_id)!.add(st);
    if (st === "active" || st.startsWith("expiring")) activeCount.set(row.vendor_id, (activeCount.get(row.vendor_id) ?? 0) + 1);
  });

  let rows: VendorRow[] = vendors.map((v) => ({
    ...v,
    category: v.service_category_id ? catMap.get(v.service_category_id) ?? null : null,
    active_contract_count: activeCount.get(v.id) ?? 0,
    location_count: locCount.get(v.id) ?? 0,
    location_ids: locIds.get(v.id) ?? [],
    contract_states: [...(stateByVendor.get(v.id) ?? [])] as VendorRow["contract_states"],
  }));

  if (filters.contractState) {
    rows = rows.filter((v) => {
      const set = stateByVendor.get(v.id);
      if (!set) return false;
      if (filters.contractState === "active") return [...set].some((s) => s === "active" || s.startsWith("expiring"));
      if (filters.contractState === "expiring_soon") return [...set].some((s) => s.startsWith("expiring"));
      if (filters.contractState === "expired") return set.has("expired");
      return true;
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Vendor detail (§27)
// ---------------------------------------------------------------------------
export async function getVendorById(
  supabase: SupabaseClient<Database>,
  id: string
): Promise<VendorDetail | null> {
  const db = idb(supabase);
  const { data: vendor, error } = await db.from("vendors").select("*").eq("id", id).maybeSingle();
  if (error) {
    console.error("getVendorById failed:", error.message);
    return null;
  }
  if (!vendor) return null;
  const v = vendor as VendorDetail;

  const [cat, contacts, locs, vAssets, contracts, docs, activityRes, woCount] = await Promise.all([
    v.service_category_id
      ? db.from("vendor_service_categories").select("id, name").eq("id", v.service_category_id).maybeSingle()
      : Promise.resolve({ data: null }),
    db.from("vendor_contacts").select("*").eq("vendor_id", id).order("is_primary", { ascending: false }).order("full_name"),
    db.from("vendor_locations").select("*, location:location_id(id,name)").eq("vendor_id", id),
    db.from("vendor_assets").select("*, asset:asset_id(id,name,asset_code)").eq("vendor_id", id),
    getContractRowsForVendor(supabase, id),
    db.from("vendor_documents").select("*").eq("vendor_id", id).order("created_at", { ascending: false }),
    db.from("vendor_activity").select("*").eq("vendor_id", id).order("created_at", { ascending: false }).limit(100),
    db.from("work_orders").select("id", { count: "exact", head: true }).eq("vendor_id", id),
  ]);

  // Stitch contract summary onto vendor_assets (composite FK -> no PostgREST embed).
  const contractSummary = new Map(contracts.map((c) => [c.id, { id: c.id, contract_number: c.contract_number, name: c.name }]));
  const assets = ((vAssets.data ?? []) as unknown as VendorAssetRow[]).map((a) => ({
    ...a,
    contract: a.service_contract_id ? contractSummary.get(a.service_contract_id) ?? null : null,
  }));

  // Stitch actor names onto activity (actor_id has no FK to profiles).
  const activityRaw = (activityRes.data ?? []) as unknown as VendorActivityRow[];
  const actorIds = [...new Set(activityRaw.map((a) => a.actor_id).filter((x): x is string => !!x))];
  const actorMap = new Map<string, { full_name: string | null; email: string | null }>();
  if (actorIds.length) {
    const { data: ppl } = await db.from("profiles").select("id, full_name, email").in("id", actorIds);
    (ppl ?? []).forEach((p) => {
      const row = p as { id: string; full_name: string | null; email: string | null };
      actorMap.set(row.id, { full_name: row.full_name, email: row.email });
    });
  }
  const activity = activityRaw.map((a) => ({ ...a, actor: a.actor_id ? actorMap.get(a.actor_id) ?? null : null }));

  return {
    ...v,
    category: (cat.data as { id: string; name: string } | null) ?? null,
    contacts: (contacts.data ?? []) as VendorContact[],
    locations: (locs.data ?? []) as unknown as VendorLocationRow[],
    assets,
    contracts,
    documents: (docs.data ?? []) as VendorDocument[],
    activity,
    workOrderCount: (woCount as { count: number | null }).count ?? 0,
  };
}

async function getContractRowsForVendor(
  supabase: SupabaseClient<Database>,
  vendorId: string
): Promise<ContractRow[]> {
  const db = idb(supabase);
  const { data } = await db.from("service_contracts").select("*").eq("vendor_id", vendorId).order("end_date", { ascending: false });
  const contracts = (data ?? []) as ServiceContract[];
  if (contracts.length === 0) return [];
  const ids = contracts.map((c) => c.id);
  const today = todayISO();
  const { data: locs } = await db.from("service_contract_locations").select("contract_id, location_id").in("contract_id", ids);
  const { data: assets } = await db.from("service_contract_assets").select("contract_id").in("contract_id", ids);
  const lc = new Map<string, number>();
  const locIds = new Map<string, string[]>();
  (locs ?? []).forEach((l) => {
    const row = l as { contract_id: string; location_id: string };
    lc.set(row.contract_id, (lc.get(row.contract_id) ?? 0) + 1);
    if (!locIds.has(row.contract_id)) locIds.set(row.contract_id, []);
    locIds.get(row.contract_id)!.push(row.location_id);
  });
  const ac = new Map<string, number>();
  (assets ?? []).forEach((a) => { const k = (a as { contract_id: string }).contract_id; ac.set(k, (ac.get(k) ?? 0) + 1); });
  return contracts.map((c) => ({
    ...c, vendor: null, location_count: lc.get(c.id) ?? 0, asset_count: ac.get(c.id) ?? 0,
    location_ids: locIds.get(c.id) ?? [], state: contractExpiryState(c.status, c.end_date, today),
  }));
}

// ---------------------------------------------------------------------------
// Contracts list + detail (§28, §29)
// ---------------------------------------------------------------------------
export type ContractListFilters = {
  vendorId?: string;
  locationId?: string;
  contractType?: string;
  state?: string; // active | expiring_soon | expired | draft | terminated | archived
  search?: string;
};

export async function getContracts(
  supabase: SupabaseClient<Database>,
  filters: ContractListFilters = {}
): Promise<ContractRow[]> {
  const db = idb(supabase);

  let contractIdsForLocation: Set<string> | null = null;
  if (filters.locationId) {
    const { data } = await db.from("service_contract_locations").select("contract_id").eq("location_id", filters.locationId);
    contractIdsForLocation = new Set((data ?? []).map((r) => (r as { contract_id: string }).contract_id));
    if (contractIdsForLocation.size === 0) return [];
  }

  let query = db.from("service_contracts").select("*").order("end_date", { ascending: false });
  if (filters.vendorId) query = query.eq("vendor_id", filters.vendorId);
  if (filters.contractType) query = query.eq("contract_type", filters.contractType);
  const term = filters.search ? sanitize(filters.search) : "";
  if (term) query = query.or(`contract_number.ilike.%${term}%,name.ilike.%${term}%`);
  const { data, error } = await query;
  if (error) {
    console.error("getContracts failed:", error.message);
    return [];
  }
  let contracts = (data ?? []) as ServiceContract[];
  if (contractIdsForLocation) contracts = contracts.filter((c) => contractIdsForLocation!.has(c.id));
  if (contracts.length === 0) return [];

  const today = todayISO();
  if (filters.state) {
    contracts = contracts.filter((c) => {
      const st = contractExpiryState(c.status, c.end_date, today);
      if (filters.state === "active") return st === "active" || st.startsWith("expiring");
      if (filters.state === "expiring_soon") return st.startsWith("expiring");
      if (filters.state === "expired") return st === "expired";
      return st === filters.state;
    });
  }

  const ids = contracts.map((c) => c.id);
  const vendorIds = [...new Set(contracts.map((c) => c.vendor_id))];
  const { data: vendors } = await db.from("vendors").select("id, company_name, vendor_number").in("id", vendorIds);
  const vMap = new Map((vendors ?? []).map((v) => [(v as { id: string }).id, v as { id: string; company_name: string; vendor_number: string }]));
  const { data: locs } = await db.from("service_contract_locations").select("contract_id, location_id").in("contract_id", ids);
  const { data: assets } = await db.from("service_contract_assets").select("contract_id").in("contract_id", ids);
  const lc = new Map<string, number>();
  const locIds = new Map<string, string[]>();
  (locs ?? []).forEach((l) => {
    const row = l as { contract_id: string; location_id: string };
    lc.set(row.contract_id, (lc.get(row.contract_id) ?? 0) + 1);
    if (!locIds.has(row.contract_id)) locIds.set(row.contract_id, []);
    locIds.get(row.contract_id)!.push(row.location_id);
  });
  const ac = new Map<string, number>();
  (assets ?? []).forEach((a) => { const k = (a as { contract_id: string }).contract_id; ac.set(k, (ac.get(k) ?? 0) + 1); });

  return contracts.map((c) => ({
    ...c,
    vendor: vMap.get(c.vendor_id) ?? null,
    location_count: lc.get(c.id) ?? 0,
    asset_count: ac.get(c.id) ?? 0,
    location_ids: locIds.get(c.id) ?? [],
    state: contractExpiryState(c.status, c.end_date, today),
  }));
}

export async function getContractById(
  supabase: SupabaseClient<Database>,
  id: string
): Promise<ContractDetail | null> {
  const db = idb(supabase);
  const { data: contract, error } = await db.from("service_contracts").select("*").eq("id", id).maybeSingle();
  if (error) {
    console.error("getContractById failed:", error.message);
    return null;
  }
  if (!contract) return null;
  const c = contract as ContractDetail;

  const [vendor, contact, locs, assets, docs] = await Promise.all([
    db.from("vendors").select("id, company_name, vendor_number").eq("id", c.vendor_id).maybeSingle(),
    c.contact_person_id
      ? db.from("vendor_contacts").select("*").eq("id", c.contact_person_id).maybeSingle()
      : Promise.resolve({ data: null }),
    db.from("service_contract_locations").select("*, location:location_id(id,name)").eq("contract_id", id),
    db.from("service_contract_assets").select("*, asset:asset_id(id,name,asset_code)").eq("contract_id", id),
    db.from("service_contract_documents").select("*").eq("contract_id", id).order("created_at", { ascending: false }),
  ]);

  return {
    ...c,
    vendor: (vendor.data as { id: string; company_name: string; vendor_number: string } | null) ?? null,
    contact: (contact.data as VendorContact | null) ?? null,
    locations: (locs.data ?? []) as unknown as ContractLocationRow[],
    assets: (assets.data ?? []) as unknown as ContractAssetRow[],
    documents: (docs.data ?? []) as ServiceContractDocument[],
  };
}

// ---------------------------------------------------------------------------
// Asset coverage (§18) and Work Order integration (§34)
// ---------------------------------------------------------------------------
export type AssetVendorCoverage = {
  id: string;
  vendor: { id: string; company_name: string; vendor_number: string; phone: string | null; mobile: string | null } | null;
  relationship_type: string | null;
  contract: { id: string; contract_number: string; name: string; end_date: string; status: ServiceContract["status"] } | null;
};

export async function getVendorCoverageForAsset(
  supabase: SupabaseClient<Database>,
  assetId: string
): Promise<AssetVendorCoverage[]> {
  const db = idb(supabase);
  const { data, error } = await db
    .from("vendor_assets")
    .select("id, relationship_type, vendor_id, service_contract_id")
    .eq("asset_id", assetId)
    .eq("is_active", true);
  if (error) {
    console.error("getVendorCoverageForAsset failed:", error.message);
    return [];
  }
  const rows = (data ?? []) as { id: string; relationship_type: string | null; vendor_id: string; service_contract_id: string | null }[];
  if (rows.length === 0) return [];

  const vendorIds = [...new Set(rows.map((r) => r.vendor_id))];
  const contractIds = [...new Set(rows.map((r) => r.service_contract_id).filter((x): x is string => !!x))];
  const [{ data: vendors }, contractsData] = await Promise.all([
    db.from("vendors").select("id, company_name, vendor_number, phone, mobile").in("id", vendorIds),
    contractIds.length
      ? db.from("service_contracts").select("id, contract_number, name, end_date, status").in("id", contractIds)
      : Promise.resolve({ data: [] }),
  ]);
  const vMap = new Map((vendors ?? []).map((v) => [(v as { id: string }).id, v as AssetVendorCoverage["vendor"]]));
  const cMap = new Map((contractsData.data ?? []).map((c) => [(c as { id: string }).id, c as AssetVendorCoverage["contract"]]));

  return rows.map((r) => ({
    id: r.id,
    vendor: vMap.get(r.vendor_id) ?? null,
    relationship_type: r.relationship_type,
    contract: r.service_contract_id ? cMap.get(r.service_contract_id) ?? null : null,
  }));
}

export async function getWorkOrderVendorInfo(
  supabase: SupabaseClient<Database>,
  workOrderId: string
): Promise<WorkOrderVendorInfo | null> {
  const db = idb(supabase);
  const { data, error } = await db
    .from("work_orders")
    .select("vendor_id, vendor_contact_id, service_contract_id, vendor_reference, vendor_expected_date")
    .eq("id", workOrderId)
    .maybeSingle();
  if (error || !data) return null;
  const wo = data as {
    vendor_id: string | null; vendor_contact_id: string | null; service_contract_id: string | null;
    vendor_reference: string | null; vendor_expected_date: string | null;
  };
  if (!wo.vendor_id) return null;

  const [vendor, contact, contract] = await Promise.all([
    db.from("vendors").select("id, company_name, vendor_number, phone, mobile").eq("id", wo.vendor_id).maybeSingle(),
    wo.vendor_contact_id
      ? db.from("vendor_contacts").select("id, full_name, phone, mobile, email").eq("id", wo.vendor_contact_id).maybeSingle()
      : Promise.resolve({ data: null }),
    wo.service_contract_id
      ? db.from("service_contracts").select("id, contract_number, name, end_date, status").eq("id", wo.service_contract_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    vendor: (vendor.data as WorkOrderVendorInfo["vendor"]) ?? null,
    contact: (contact.data as WorkOrderVendorInfo["contact"]) ?? null,
    contract: (contract.data as WorkOrderVendorInfo["contract"]) ?? null,
    vendor_reference: wo.vendor_reference,
    vendor_expected_date: wo.vendor_expected_date,
  };
}

export async function getWorkOrderVendorNotes(
  supabase: SupabaseClient<Database>,
  workOrderId: string
): Promise<WorkOrderVendorNoteRow[]> {
  const db = idb(supabase);
  const { data, error } = await db
    .from("work_order_vendor_notes")
    .select("*, author:created_by(full_name,email)")
    .eq("work_order_id", workOrderId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getWorkOrderVendorNotes failed:", error.message);
    return [];
  }
  return (data ?? []) as unknown as WorkOrderVendorNoteRow[];
}

// Vendor work orders (§37 factual metrics + detail tab)
export type VendorWorkOrderRow = {
  id: string; work_order_number: string; title: string; status_name: string | null;
  status_code: string | null; created_at: string; completed_at: string | null;
};

export async function getVendorWorkOrders(
  supabase: SupabaseClient<Database>,
  vendorId: string
): Promise<VendorWorkOrderRow[]> {
  const db = idb(supabase);
  const { data, error } = await db
    .from("work_orders")
    .select("id, work_order_number, title, created_at, completed_at, status:status_id(name,code)")
    .eq("vendor_id", vendorId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getVendorWorkOrders failed:", error.message);
    return [];
  }
  return (data ?? []).map((r) => {
    const row = r as unknown as {
      id: string; work_order_number: string; title: string; created_at: string;
      completed_at: string | null; status: { name: string; code: string } | null;
    };
    return {
      id: row.id, work_order_number: row.work_order_number, title: row.title,
      status_name: row.status?.name ?? null, status_code: row.status?.code ?? null,
      created_at: row.created_at, completed_at: row.completed_at,
    };
  });
}

// ---------------------------------------------------------------------------
// Dashboard (§32, §33)
// ---------------------------------------------------------------------------
export async function getVendorDashboardMetrics(
  supabase: SupabaseClient<Database>
): Promise<VendorDashboardMetrics> {
  const db = idb(supabase);
  const today = todayISO();
  const [{ count: activeVendors }, { data: contracts }, { data: wvStatus }] = await Promise.all([
    db.from("vendors").select("id", { count: "exact", head: true }).eq("status", "active"),
    db.from("service_contracts").select("status, end_date"),
    db.from("work_order_statuses").select("id").eq("code", "waiting_vendor").maybeSingle(),
  ]);

  let activeContracts = 0, expiring30 = 0, expiring60 = 0, expired = 0;
  (contracts ?? []).forEach((c) => {
    const row = c as { status: ServiceContract["status"]; end_date: string };
    const st = contractExpiryState(row.status, row.end_date, today);
    if (st === "active" || st.startsWith("expiring")) activeContracts += 1;
    if (st === "expiring_30") expiring30 += 1;
    if (st === "expiring_30" || st === "expiring_60") expiring60 += 1;
    if (st === "expired") expired += 1;
  });

  let openWorkOrdersWaitingVendor = 0;
  const statusId = (wvStatus as { id: string } | null)?.id;
  if (statusId) {
    const { count } = await db.from("work_orders").select("id", { count: "exact", head: true }).eq("status_id", statusId);
    openWorkOrdersWaitingVendor = count ?? 0;
  }

  return { activeVendors: activeVendors ?? 0, activeContracts, expiring30, expiring60, expired, openWorkOrdersWaitingVendor };
}

export async function getExpiringContracts(
  supabase: SupabaseClient<Database>,
  withinDays = 60
): Promise<ExpiringContractRow[]> {
  const db = idb(supabase);
  const today = todayISO();
  const { data } = await db.from("service_contracts").select("id, contract_number, name, end_date, status, vendor_id").order("end_date", { ascending: true });
  const contracts = (data ?? []) as (Pick<ServiceContract, "id" | "contract_number" | "name" | "end_date" | "status" | "vendor_id">)[];
  const relevant = contracts
    .map((c) => ({ c, st: contractExpiryState(c.status, c.end_date, today) }))
    .filter(({ st }) => st === "expired" || st.startsWith("expiring"))
    .filter(({ c }) => {
      const d = new Date(c.end_date + "T00:00:00Z").getTime();
      const t = new Date(today + "T00:00:00Z").getTime();
      return (d - t) / 86400000 <= withinDays;
    });
  if (relevant.length === 0) return [];
  const vendorIds = [...new Set(relevant.map(({ c }) => c.vendor_id))];
  const { data: vendors } = await db.from("vendors").select("id, company_name").in("id", vendorIds);
  const vMap = new Map((vendors ?? []).map((v) => [(v as { id: string }).id, (v as { company_name: string }).company_name]));
  return relevant.map(({ c, st }) => ({
    id: c.id, contract_number: c.contract_number, name: c.name, end_date: c.end_date,
    vendor_name: vMap.get(c.vendor_id) ?? "—", state: st,
  }));
}

export async function getWorkOrdersWaitingForVendor(
  supabase: SupabaseClient<Database>
): Promise<{ id: string; work_order_number: string; title: string; vendor_name: string | null }[]> {
  const db = idb(supabase);
  const { data: st } = await db.from("work_order_statuses").select("id").eq("code", "waiting_vendor").maybeSingle();
  const statusId = (st as { id: string } | null)?.id;
  if (!statusId) return [];
  const { data } = await db
    .from("work_orders")
    .select("id, work_order_number, title, vendor_id")
    .eq("status_id", statusId)
    .order("created_at", { ascending: false })
    .limit(20);
  const rows = (data ?? []) as { id: string; work_order_number: string; title: string; vendor_id: string | null }[];
  const vendorIds = [...new Set(rows.map((r) => r.vendor_id).filter((x): x is string => !!x))];
  const vMap = new Map<string, string>();
  if (vendorIds.length) {
    const { data: vendors } = await db.from("vendors").select("id, company_name").in("id", vendorIds);
    (vendors ?? []).forEach((v) => vMap.set((v as { id: string }).id, (v as { company_name: string }).company_name));
  }
  return rows.map((r) => ({
    id: r.id, work_order_number: r.work_order_number, title: r.title,
    vendor_name: r.vendor_id ? vMap.get(r.vendor_id) ?? null : null,
  }));
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

// ---------------------------------------------------------------------------
// The generated database.ts is not regenerated in this environment, so (as in
// Phase 5) we augment it with the Phase 6 vendor / service-contract tables via
// a type intersection and a typed client cast. The generated file is untouched.
// ---------------------------------------------------------------------------
type Row<T> = { Row: T; Insert: Partial<T>; Update: Partial<T>; Relationships: [] };

export type VendorStatus = "active" | "inactive" | "suspended";
export type ContractStatus = "draft" | "active" | "terminated" | "archived";

export type VendorServiceCategory = {
  id: string; organization_id: string; name: string; code: string;
  description: string | null; is_active: boolean; sort_order: number;
  created_at: string; updated_at: string;
};
export type Vendor = {
  id: string; organization_id: string; vendor_number: string; vendor_code: string | null;
  company_name: string; trading_name: string | null; service_category_id: string | null;
  contact_person: string | null; phone: string | null; mobile: string | null;
  email: string | null; website: string | null; address: string | null; notes: string | null;
  status: VendorStatus; created_by: string | null; created_at: string; updated_at: string;
};
export type VendorContact = {
  id: string; organization_id: string; vendor_id: string; full_name: string;
  job_title: string | null; department: string | null; contact_type: string | null;
  phone: string | null; mobile: string | null; email: string | null;
  is_primary: boolean; is_active: boolean; notes: string | null;
  created_at: string; updated_at: string;
};
export type VendorDocument = {
  id: string; organization_id: string; vendor_id: string; document_type: string | null;
  document_name: string; file_name: string; file_path: string; file_type: string | null;
  file_size: number | null; issue_date: string | null; expiry_date: string | null;
  uploaded_by: string | null; created_at: string;
};
export type ServiceContract = {
  id: string; organization_id: string; contract_number: string; vendor_id: string;
  name: string; contract_type: string | null; description: string | null;
  start_date: string; end_date: string; status: ContractStatus;
  contract_value: number | null; currency: string | null; contact_person_id: string | null;
  response_time_notes: string | null; service_scope: string | null; renewal_notes: string | null;
  auto_renewal: boolean | null; termination_notice_days: number | null;
  renewed_from_id: string | null; notes: string | null; created_by: string | null;
  created_at: string; updated_at: string;
};
export type ServiceContractDocument = {
  id: string; organization_id: string; contract_id: string; document_type: string | null;
  document_name: string; file_name: string; file_path: string; file_type: string | null;
  file_size: number | null; uploaded_by: string | null; created_at: string;
};
export type VendorLocation = {
  id: string; organization_id: string; vendor_id: string; location_id: string;
  is_active: boolean; created_at: string;
};
export type ServiceContractLocation = {
  id: string; organization_id: string; contract_id: string; location_id: string; created_at: string;
};
export type VendorAsset = {
  id: string; organization_id: string; vendor_id: string; asset_id: string;
  relationship_type: string | null; service_contract_id: string | null;
  is_active: boolean; notes: string | null; created_at: string; updated_at: string;
};
export type ServiceContractAsset = {
  id: string; organization_id: string; contract_id: string; asset_id: string; created_at: string;
};
export type VendorActivity = {
  id: string; organization_id: string; vendor_id: string | null; contract_id: string | null;
  action: string; detail: string | null; actor_id: string | null; created_at: string;
};
export type WorkOrderVendorNote = {
  id: string; organization_id: string; work_order_id: string; note_type: string | null;
  note: string; created_by: string | null; created_at: string;
};

/** The Phase 6 columns added to work_orders (not present in generated types). */
export type WorkOrderVendorFields = {
  vendor_id: string | null;
  vendor_contact_id: string | null;
  service_contract_id: string | null;
  vendor_reference: string | null;
  vendor_expected_date: string | null;
};

type VendorsSchema = {
  Tables: {
    work_orders: Row<Database["public"]["Tables"]["work_orders"]["Row"] & WorkOrderVendorFields>;
    vendor_service_categories: Row<VendorServiceCategory>;
    vendors: Row<Vendor>;
    vendor_contacts: Row<VendorContact>;
    vendor_documents: Row<VendorDocument>;
    service_contracts: Row<ServiceContract>;
    service_contract_documents: Row<ServiceContractDocument>;
    vendor_locations: Row<VendorLocation>;
    service_contract_locations: Row<ServiceContractLocation>;
    vendor_assets: Row<VendorAsset>;
    service_contract_assets: Row<ServiceContractAsset>;
    vendor_activity: Row<VendorActivity>;
    work_order_vendor_notes: Row<WorkOrderVendorNote>;
  };
};

export type VendorsDatabase = Database & {
  public: Database["public"] & {
    Tables: Database["public"]["Tables"] & VendorsSchema["Tables"];
    Functions: Database["public"]["Functions"];
  };
};

/** Cast the RLS-scoped client to one that knows the Phase 6 vendor tables. */
export function idb(supabase: SupabaseClient<Database>): SupabaseClient<VendorsDatabase> {
  return supabase as unknown as SupabaseClient<VendorsDatabase>;
}

// ---------------------------------------------------------------------------
// Small joined shapes
// ---------------------------------------------------------------------------
export type VendorLocationRow = VendorLocation & { location: { id: string; name: string } | null };
export type ContractLocationRow = ServiceContractLocation & { location: { id: string; name: string } | null };
export type VendorAssetRow = VendorAsset & {
  asset: { id: string; name: string; asset_code: string | null } | null;
  contract: { id: string; contract_number: string; name: string } | null;
};
export type ContractAssetRow = ServiceContractAsset & {
  asset: { id: string; name: string; asset_code: string | null } | null;
};
export type VendorActivityRow = VendorActivity & { actor: { full_name: string | null; email: string | null } | null };
export type WorkOrderVendorNoteRow = WorkOrderVendorNote & { author: { full_name: string | null; email: string | null } | null };

/** Register-row: vendor plus lightweight aggregates for the table. */
export type VendorRow = Vendor & {
  category: { id: string; name: string } | null;
  active_contract_count: number;
  location_count: number;
  location_ids: string[];
  contract_states: ExpiryState[];
};

/** Full vendor detail with all related collections. */
export type VendorDetail = Vendor & {
  category: { id: string; name: string } | null;
  contacts: VendorContact[];
  locations: VendorLocationRow[];
  assets: VendorAssetRow[];
  contracts: ContractRow[];
  documents: VendorDocument[];
  activity: VendorActivityRow[];
  workOrderCount: number;
};

/** Contract list row. */
export type ContractRow = ServiceContract & {
  vendor: { id: string; company_name: string; vendor_number: string } | null;
  location_count: number;
  asset_count: number;
  location_ids: string[];
  state: ExpiryState;
};

/** Full contract detail. */
export type ContractDetail = ServiceContract & {
  vendor: { id: string; company_name: string; vendor_number: string } | null;
  contact: VendorContact | null;
  locations: ContractLocationRow[];
  assets: ContractAssetRow[];
  documents: ServiceContractDocument[];
};

/** Work-order-facing vendor summary (for the External Vendor panel). */
export type WorkOrderVendorInfo = {
  vendor: { id: string; company_name: string; vendor_number: string; phone: string | null; mobile: string | null } | null;
  contact: { id: string; full_name: string; phone: string | null; mobile: string | null; email: string | null } | null;
  contract: { id: string; contract_number: string; name: string; end_date: string; status: ContractStatus } | null;
  vendor_reference: string | null;
  vendor_expected_date: string | null;
};

// ---------------------------------------------------------------------------
// Derived expiry (computed from end_date at read time; no scheduler).
// ---------------------------------------------------------------------------
export type ExpiryState =
  | "active" | "expiring_90" | "expiring_60" | "expiring_30" | "expired"
  | "draft" | "terminated" | "archived";

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysUntil(endDate: string | null | undefined, today: string = todayISO()): number | null {
  if (!endDate) return null;
  const e = new Date(endDate + "T00:00:00Z").getTime();
  const t = new Date(today + "T00:00:00Z").getTime();
  return Math.round((e - t) / 86400000);
}

/**
 * Combine the stored lifecycle status with the end_date to produce the display
 * state used across the module. An expired contract never displays as active.
 */
export function contractExpiryState(
  status: ContractStatus,
  endDate: string,
  today: string = todayISO()
): ExpiryState {
  if (status === "draft") return "draft";
  if (status === "terminated") return "terminated";
  if (status === "archived") return "archived";
  const days = daysUntil(endDate, today);
  if (days === null) return "active";
  if (days < 0) return "expired";
  if (days <= 30) return "expiring_30";
  if (days <= 60) return "expiring_60";
  if (days <= 90) return "expiring_90";
  return "active";
}

export const EXPIRY_LABEL: Record<ExpiryState, string> = {
  active: "Active",
  expiring_90: "Expiring in 90 days",
  expiring_60: "Expiring in 60 days",
  expiring_30: "Expiring in 30 days",
  expired: "Expired",
  draft: "Draft",
  terminated: "Terminated",
  archived: "Archived",
};

export const VENDOR_STATUS_LABEL: Record<VendorStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  suspended: "Suspended",
};

export const VENDOR_NOTE_TYPES = [
  "contacted", "scheduled", "attended", "diagnosis", "work_performed", "follow_up",
] as const;

export const VENDOR_NOTE_LABEL: Record<string, string> = {
  contacted: "Vendor contacted",
  scheduled: "Vendor scheduled",
  attended: "Vendor attended",
  diagnosis: "Diagnosis",
  work_performed: "Work performed",
  follow_up: "Follow-up required",
};

/** Document validity from expiry_date (§9). */
export type DocValidity = "valid" | "expiring" | "expired" | "none";
export function docValidity(expiry: string | null, today: string = todayISO()): DocValidity {
  if (!expiry) return "none";
  const days = daysUntil(expiry, today);
  if (days === null) return "none";
  if (days < 0) return "expired";
  if (days <= 30) return "expiring";
  return "valid";
}

// Dashboard metrics (§32)
export type VendorDashboardMetrics = {
  activeVendors: number;
  activeContracts: number;
  expiring30: number;
  expiring60: number;
  expired: number;
  openWorkOrdersWaitingVendor: number;
};

export type ExpiringContractRow = {
  id: string; contract_number: string; name: string; end_date: string;
  vendor_name: string; state: ExpiryState;
};

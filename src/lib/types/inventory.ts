import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

// The generated database.ts is not regenerated here, so we augment it with the
// Phase 7 inventory tables via a type intersection and a typed client cast.
type Row<T> = { Row: T; Insert: Partial<T>; Update: Partial<T>; Relationships: [] };

export type MovementType =
  | "opening_balance" | "stock_in" | "issue" | "return"
  | "adjustment_increase" | "adjustment_decrease" | "transfer_out" | "transfer_in";

export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

export type InventoryCategory = {
  id: string; organization_id: string; name: string; code: string;
  description: string | null; parent_category_id: string | null;
  is_active: boolean; sort_order: number; created_at: string; updated_at: string;
};
export type UnitOfMeasure = {
  id: string; organization_id: string; name: string; abbreviation: string;
  is_active: boolean; sort_order: number; created_at: string; updated_at: string;
};
export type StockLocation = {
  id: string; organization_id: string; location_id: string; area_id: string | null;
  name: string; code: string; description: string | null; is_active: boolean;
  created_by: string | null; created_at: string; updated_at: string;
};
export type InventoryItem = {
  id: string; organization_id: string; item_code: string; name: string;
  description: string | null; category_id: string; unit_of_measure_id: string;
  manufacturer: string | null; part_number: string | null; barcode: string | null;
  preferred_vendor_id: string | null; minimum_stock_level: number | null;
  reorder_reference_level: number | null; is_active: boolean; notes: string | null;
  created_by: string | null; created_at: string; updated_at: string;
};
export type InventoryBalance = {
  id: string; organization_id: string; inventory_item_id: string;
  stock_location_id: string; quantity_on_hand: number; updated_at: string;
};
export type InventoryMovement = {
  id: string; organization_id: string; movement_number: string;
  inventory_item_id: string; stock_location_id: string; movement_type: MovementType;
  quantity: number; work_order_id: string | null; technician_id: string | null;
  transfer_group_id: string | null; reference: string | null; reason: string | null;
  notes: string | null; created_by: string | null; created_at: string;
};
export type AssetSparePart = {
  id: string; organization_id: string; asset_id: string; inventory_item_id: string;
  notes: string | null; is_preferred: boolean; created_by: string | null; created_at: string;
};
export type InventoryActivity = {
  id: string; organization_id: string; inventory_item_id: string | null;
  stock_location_id: string | null; movement_id: string | null;
  action: string; detail: string | null; actor_id: string | null; created_at: string;
};
export type InventoryItemDocument = {
  id: string; organization_id: string; inventory_item_id: string;
  document_type: string | null; document_name: string; file_name: string;
  file_path: string; file_type: string | null; file_size: number | null;
  uploaded_by: string | null; created_at: string;
};

type InventorySchema = {
  Tables: {
    inventory_categories: Row<InventoryCategory>;
    units_of_measure: Row<UnitOfMeasure>;
    stock_locations: Row<StockLocation>;
    inventory_items: Row<InventoryItem>;
    inventory_balances: Row<InventoryBalance>;
    inventory_movements: Row<InventoryMovement>;
    asset_spare_parts: Row<AssetSparePart>;
    inventory_activity: Row<InventoryActivity>;
    inventory_item_documents: Row<InventoryItemDocument>;
  };
  Functions: {
    inv_set_opening_balance: { Args: { p_item: string; p_location: string; p_qty: number; p_reference?: string | null; p_notes?: string | null }; Returns: string };
    inv_stock_in: { Args: { p_item: string; p_location: string; p_qty: number; p_reference?: string | null; p_notes?: string | null }; Returns: string };
    inv_issue_part: { Args: { p_item: string; p_location: string; p_qty: number; p_work_order: string; p_technician?: string | null; p_notes?: string | null }; Returns: string };
    inv_return_part: { Args: { p_item: string; p_location: string; p_qty: number; p_work_order: string; p_notes?: string | null }; Returns: string };
    inv_adjust: { Args: { p_item: string; p_location: string; p_direction: string; p_qty: number; p_reason: string }; Returns: string };
    inv_transfer: { Args: { p_item: string; p_source: string; p_dest: string; p_qty: number; p_notes?: string | null }; Returns: string };
  };
};

export type InventoryDatabase = Database & {
  public: Database["public"] & {
    Tables: Database["public"]["Tables"] & InventorySchema["Tables"];
    Functions: Database["public"]["Functions"] & InventorySchema["Functions"];
  };
};

export function idb(supabase: SupabaseClient<Database>): SupabaseClient<InventoryDatabase> {
  return supabase as unknown as SupabaseClient<InventoryDatabase>;
}

// ---------------------------------------------------------------------------
// Joined / view shapes
// ---------------------------------------------------------------------------
export type InventoryItemRow = InventoryItem & {
  category: { id: string; name: string } | null;
  unit: { abbreviation: string } | null;
  total_stock: number;
  status: StockStatus;
};

export type BalanceByLocation = {
  stock_location_id: string; location_name: string; location_code: string; quantity: number;
};

export type ItemMovementRow = {
  id: string; movement_number: string; movement_type: MovementType; quantity: number;
  stock_location_name: string | null; work_order_id: string | null; work_order_number: string | null;
  reference: string | null; reason: string | null; created_at: string; user_name: string | null;
};

export type ItemWorkOrderUsage = {
  work_order_id: string; work_order_number: string; title: string;
  issued: number; returned: number; net: number;
};

export type InventoryItemDetail = InventoryItem & {
  category: { id: string; name: string } | null;
  unit: { name: string; abbreviation: string } | null;
  preferred_vendor: { id: string; company_name: string; phone: string | null } | null;
  balances: BalanceByLocation[];
  total_stock: number;
  status: StockStatus;
  movements: ItemMovementRow[];
  work_order_usage: ItemWorkOrderUsage[];
  documents: InventoryItemDocument[];
  activity: (InventoryActivity & { actor: { full_name: string | null; email: string | null } | null })[];
};

export type StockLocationRow = StockLocation & {
  location_name: string | null;
  area_name: string | null;
  item_count: number;
  low_stock_count: number;
};

export type StockLocationDetail = StockLocation & {
  location_name: string | null;
  area_name: string | null;
  items: { inventory_item_id: string; item_code: string; name: string; quantity: number; minimum_stock_level: number | null; status: StockStatus }[];
};

export type MovementListRow = {
  id: string; movement_number: string; movement_type: MovementType; quantity: number;
  created_at: string; reference: string | null;
  item: { id: string; item_code: string; name: string } | null;
  stock_location: { id: string; name: string } | null;
  work_order: { id: string; work_order_number: string } | null;
  technician_name: string | null; user_name: string | null;
};

export type WorkOrderPartRow = {
  inventory_item_id: string; item_code: string; name: string; unit: string | null;
  issued: number; returned: number; net: number;
  stock_location_id: string | null; stock_location_name: string | null; last_at: string;
};

export type AssetSparePartRow = AssetSparePart & {
  item: { id: string; item_code: string; name: string; is_active: boolean } | null;
  total_stock: number;
};

export type InventoryDashboardMetrics = {
  totalItems: number;
  lowStockItems: number;
  outOfStockItems: number;
  issuedThisMonth: number;
};

export type LowStockRow = {
  id: string; item_code: string; name: string; total_stock: number;
  minimum_stock_level: number | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
export function deriveStockStatus(total: number, min: number | null): StockStatus {
  if (total <= 0) return "out_of_stock";
  if (min != null && total < min) return "low_stock";
  return "in_stock";
}

export const STOCK_STATUS_LABEL: Record<StockStatus, string> = {
  in_stock: "In Stock",
  low_stock: "Low Stock",
  out_of_stock: "Out of Stock",
};

export const MOVEMENT_TYPE_LABEL: Record<MovementType, string> = {
  opening_balance: "Opening Balance",
  stock_in: "Stock In",
  issue: "Issue",
  return: "Return",
  adjustment_increase: "Adjustment (+)",
  adjustment_decrease: "Adjustment (−)",
  transfer_out: "Transfer Out",
  transfer_in: "Transfer In",
};

/** Number formatting that drops trailing zeros from the numeric(14,3) values. */
export function fmtQty(n: number | null | undefined): string {
  if (n == null) return "—";
  const num = typeof n === "string" ? parseFloat(n) : n;
  if (Number.isNaN(num)) return "—";
  return num.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

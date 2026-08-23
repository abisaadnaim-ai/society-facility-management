"use server";

import { revalidatePath } from "next/cache";
import { getActionContext, friendlyDbError, logActionError, type ActionResult } from "@/lib/actions/context";
import { idb, type StockLocation } from "@/lib/types/inventory";


const BUCKET = "inventory-documents";

function clean(s: string | null | undefined): string | null {
  const t = (s ?? "").trim();
  return t.length ? t : null;
}

/**
 * Stock RPCs raise deliberate, user-facing sentences (e.g. "Insufficient stock
 * available."). friendlyDbError would mis-map some of these, so surface known
 * clean messages verbatim and only fall back for genuinely opaque errors.
 */
function inventoryError(message: string): string {
  const known = [
    "Insufficient stock available.",
    "Cannot return more than",
    "Not authorized",
    "A reason is required",
    "A work order is required",
    "Quantity must be greater than zero.",
    "This item is inactive",
    "Inventory item not found.",
    "Stock location not found.",
    "Stock location is inactive.",
    "Work order not found.",
    "Source and destination",
    "Invalid adjustment direction.",
  ];
  if (known.some((k) => message.includes(k))) return message;
  return friendlyDbError(message);
}

// ============================ ITEMS ============================
export type InventoryItemInput = {
  name: string;
  description: string | null;
  category_id: string;
  unit_of_measure_id: string;
  manufacturer: string | null;
  part_number: string | null;
  barcode: string | null;
  preferred_vendor_id: string | null;
  minimum_stock_level: number | null;
  reorder_reference_level: number | null;
  notes: string | null;
};

export async function createInventoryItem(input: InventoryItemInput): Promise<ActionResult<{ id: string }>> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  if (!input.name.trim()) return { ok: false, error: "An item name is required." };
  if (!input.category_id) return { ok: false, error: "A category is required." };
  if (!input.unit_of_measure_id) return { ok: false, error: "A unit of measure is required." };
  const db = idb(ctx.supabase);
  const { data, error } = await db.from("inventory_items").insert({
    organization_id: ctx.profile.organization_id,
    name: input.name.trim(),
    description: clean(input.description),
    category_id: input.category_id,
    unit_of_measure_id: input.unit_of_measure_id,
    manufacturer: clean(input.manufacturer),
    part_number: clean(input.part_number),
    barcode: clean(input.barcode),
    preferred_vendor_id: input.preferred_vendor_id || null,
    minimum_stock_level: input.minimum_stock_level,
    reorder_reference_level: input.reorder_reference_level,
    notes: clean(input.notes),
    created_by: ctx.profile.id,
  }).select("id").single();
  if (error) { logActionError("createInventoryItem", error); return { ok: false, error: friendlyDbError(error.message) }; }
  revalidatePath("/inventory");
  return { ok: true, data: { id: (data as { id: string }).id } };
}

export async function updateInventoryItem(id: string, input: InventoryItemInput): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  if (!input.name.trim()) return { ok: false, error: "An item name is required." };
  const db = idb(ctx.supabase);
  const { error } = await db.from("inventory_items").update({
    name: input.name.trim(),
    description: clean(input.description),
    category_id: input.category_id,
    unit_of_measure_id: input.unit_of_measure_id,
    manufacturer: clean(input.manufacturer),
    part_number: clean(input.part_number),
    barcode: clean(input.barcode),
    preferred_vendor_id: input.preferred_vendor_id || null,
    minimum_stock_level: input.minimum_stock_level,
    reorder_reference_level: input.reorder_reference_level,
    notes: clean(input.notes),
  }).eq("id", id);
  if (error) { logActionError("updateInventoryItem", error); return { ok: false, error: friendlyDbError(error.message) }; }
  revalidatePath("/inventory");
  revalidatePath(`/inventory/${id}`);
  return { ok: true, data: undefined };
}

export async function setItemActive(id: string, active: boolean): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  const { error } = await idb(ctx.supabase).from("inventory_items").update({ is_active: active }).eq("id", id);
  if (error) { logActionError("setItemActive", error); return { ok: false, error: friendlyDbError(error.message) }; }
  revalidatePath("/inventory");
  revalidatePath(`/inventory/${id}`);
  return { ok: true, data: undefined };
}

// ============================ STOCK LOCATIONS ============================
export type StockLocationInput = {
  location_id: string;
  area_id: string | null;
  name: string;
  code: string;
  description: string | null;
};

export async function createStockLocation(input: StockLocationInput): Promise<ActionResult<{ id: string }>> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  if (!input.name.trim()) return { ok: false, error: "A name is required." };
  if (!input.code.trim()) return { ok: false, error: "A code is required." };
  if (!input.location_id) return { ok: false, error: "A society location is required." };
  const db = idb(ctx.supabase);
  const { data, error } = await db.from("stock_locations").insert({
    organization_id: ctx.profile.organization_id,
    location_id: input.location_id,
    area_id: input.area_id || null,
    name: input.name.trim(),
    code: input.code.trim(),
    description: clean(input.description),
    created_by: ctx.profile.id,
  }).select("id").single();
  if (error) { logActionError("createStockLocation", error); return { ok: false, error: friendlyDbError(error.message) }; }
  revalidatePath("/inventory/stock-locations");
  return { ok: true, data: { id: (data as { id: string }).id } };
}

export async function updateStockLocation(id: string, input: StockLocationInput & { is_active?: boolean }): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  const db = idb(ctx.supabase);
  const patch: Partial<StockLocation> = {
    location_id: input.location_id,
    area_id: input.area_id || null,
    name: input.name.trim(),
    code: input.code.trim(),
    description: clean(input.description),
  };
  if (typeof input.is_active === "boolean") patch.is_active = input.is_active;
  const { error } = await db.from("stock_locations").update(patch).eq("id", id);
  if (error) { logActionError("updateStockLocation", error); return { ok: false, error: friendlyDbError(error.message) }; }
  revalidatePath("/inventory/stock-locations");
  revalidatePath(`/inventory/stock-locations/${id}`);
  return { ok: true, data: undefined };
}

// ============================ CATEGORIES / UNITS (super admin) ============================
export async function createCategory(input: { name: string; code: string; description: string | null }): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  if (!input.name.trim() || !input.code.trim()) return { ok: false, error: "Name and code are required." };
  const { error } = await idb(ctx.supabase).from("inventory_categories").insert({
    organization_id: ctx.profile.organization_id,
    name: input.name.trim(), code: input.code.trim().toUpperCase(), description: clean(input.description),
  });
  if (error) { logActionError("createCategory", error); return { ok: false, error: friendlyDbError(error.message) }; }
  revalidatePath("/inventory/setup");
  return { ok: true, data: undefined };
}

export async function updateCategory(id: string, input: { name: string; code: string; description: string | null; is_active: boolean }): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  const { error } = await idb(ctx.supabase).from("inventory_categories").update({
    name: input.name.trim(), code: input.code.trim().toUpperCase(), description: clean(input.description), is_active: input.is_active,
  }).eq("id", id);
  if (error) { logActionError("updateCategory", error); return { ok: false, error: friendlyDbError(error.message) }; }
  revalidatePath("/inventory/setup");
  return { ok: true, data: undefined };
}

export async function createUnit(input: { name: string; abbreviation: string }): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  if (!input.name.trim() || !input.abbreviation.trim()) return { ok: false, error: "Name and abbreviation are required." };
  const { error } = await idb(ctx.supabase).from("units_of_measure").insert({
    organization_id: ctx.profile.organization_id,
    name: input.name.trim(), abbreviation: input.abbreviation.trim(),
  });
  if (error) { logActionError("createUnit", error); return { ok: false, error: friendlyDbError(error.message) }; }
  revalidatePath("/inventory/setup");
  return { ok: true, data: undefined };
}

export async function updateUnit(id: string, input: { name: string; abbreviation: string; is_active: boolean }): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  const { error } = await idb(ctx.supabase).from("units_of_measure").update({
    name: input.name.trim(), abbreviation: input.abbreviation.trim(), is_active: input.is_active,
  }).eq("id", id);
  if (error) { logActionError("updateUnit", error); return { ok: false, error: friendlyDbError(error.message) }; }
  revalidatePath("/inventory/setup");
  return { ok: true, data: undefined };
}

// ============================ STOCK TRANSACTIONS (RPC wrappers) ============================
function revalItem(itemId: string) {
  revalidatePath("/inventory");
  revalidatePath(`/inventory/${itemId}`);
  revalidatePath("/inventory/movements");
  revalidatePath("/inventory/stock-locations");
  revalidatePath("/dashboard");
}

export async function setOpeningBalance(input: { item_id: string; stock_location_id: string; quantity: number; reference: string | null; notes: string | null }): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  if (!(input.quantity > 0)) return { ok: false, error: "Quantity must be greater than zero." };
  const { error } = await idb(ctx.supabase).rpc("inv_set_opening_balance", {
    p_item: input.item_id, p_location: input.stock_location_id, p_qty: input.quantity,
    p_reference: clean(input.reference), p_notes: clean(input.notes),
  });
  if (error) { logActionError("setOpeningBalance", error); return { ok: false, error: inventoryError(error.message) }; }
  revalItem(input.item_id);
  return { ok: true, data: undefined };
}

export async function stockIn(input: { item_id: string; stock_location_id: string; quantity: number; reference: string | null; notes: string | null }): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  if (!(input.quantity > 0)) return { ok: false, error: "Quantity must be greater than zero." };
  const { error } = await idb(ctx.supabase).rpc("inv_stock_in", {
    p_item: input.item_id, p_location: input.stock_location_id, p_qty: input.quantity,
    p_reference: clean(input.reference), p_notes: clean(input.notes),
  });
  if (error) { logActionError("stockIn", error); return { ok: false, error: inventoryError(error.message) }; }
  revalItem(input.item_id);
  return { ok: true, data: undefined };
}

export async function issuePart(input: { item_id: string; stock_location_id: string; quantity: number; work_order_id: string; technician_id: string | null; notes: string | null }): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  if (!(input.quantity > 0)) return { ok: false, error: "Quantity must be greater than zero." };
  const { error } = await idb(ctx.supabase).rpc("inv_issue_part", {
    p_item: input.item_id, p_location: input.stock_location_id, p_qty: input.quantity,
    p_work_order: input.work_order_id, p_technician: input.technician_id || null, p_notes: clean(input.notes),
  });
  if (error) { logActionError("issuePart", error); return { ok: false, error: inventoryError(error.message) }; }
  revalItem(input.item_id);
  revalidatePath(`/work-orders/${input.work_order_id}`);
  return { ok: true, data: undefined };
}

export async function returnPart(input: { item_id: string; stock_location_id: string; quantity: number; work_order_id: string; notes: string | null }): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  if (!(input.quantity > 0)) return { ok: false, error: "Quantity must be greater than zero." };
  const { error } = await idb(ctx.supabase).rpc("inv_return_part", {
    p_item: input.item_id, p_location: input.stock_location_id, p_qty: input.quantity,
    p_work_order: input.work_order_id, p_notes: clean(input.notes),
  });
  if (error) { logActionError("returnPart", error); return { ok: false, error: inventoryError(error.message) }; }
  revalItem(input.item_id);
  revalidatePath(`/work-orders/${input.work_order_id}`);
  return { ok: true, data: undefined };
}

export async function adjustStock(input: { item_id: string; stock_location_id: string; direction: "increase" | "decrease"; quantity: number; reason: string }): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  if (!(input.quantity > 0)) return { ok: false, error: "Quantity must be greater than zero." };
  if (!input.reason.trim()) return { ok: false, error: "A reason is required for stock adjustments." };
  const { error } = await idb(ctx.supabase).rpc("inv_adjust", {
    p_item: input.item_id, p_location: input.stock_location_id, p_direction: input.direction,
    p_qty: input.quantity, p_reason: input.reason.trim(),
  });
  if (error) { logActionError("adjustStock", error); return { ok: false, error: inventoryError(error.message) }; }
  revalItem(input.item_id);
  return { ok: true, data: undefined };
}

export async function transferStock(input: { item_id: string; source_location_id: string; dest_location_id: string; quantity: number; notes: string | null }): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  if (!(input.quantity > 0)) return { ok: false, error: "Quantity must be greater than zero." };
  const { error } = await idb(ctx.supabase).rpc("inv_transfer", {
    p_item: input.item_id, p_source: input.source_location_id, p_dest: input.dest_location_id,
    p_qty: input.quantity, p_notes: clean(input.notes),
  });
  if (error) { logActionError("transferStock", error); return { ok: false, error: inventoryError(error.message) }; }
  revalItem(input.item_id);
  return { ok: true, data: undefined };
}

// ============================ ASSET SPARE PARTS ============================
export async function linkAssetSparePart(input: { asset_id: string; inventory_item_id: string; is_preferred: boolean; notes: string | null }): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  const { error } = await idb(ctx.supabase).from("asset_spare_parts").insert({
    organization_id: ctx.profile.organization_id,
    asset_id: input.asset_id,
    inventory_item_id: input.inventory_item_id,
    is_preferred: input.is_preferred,
    notes: clean(input.notes),
    created_by: ctx.profile.id,
  });
  if (error) { logActionError("linkAssetSparePart", error); return { ok: false, error: friendlyDbError(error.message) }; }
  revalidatePath(`/assets/${input.asset_id}`);
  return { ok: true, data: undefined };
}

export async function unlinkAssetSparePart(id: string, assetId: string): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  const { error } = await idb(ctx.supabase).from("asset_spare_parts").delete().eq("id", id);
  if (error) { logActionError("unlinkAssetSparePart", error); return { ok: false, error: friendlyDbError(error.message) }; }
  revalidatePath(`/assets/${assetId}`);
  return { ok: true, data: undefined };
}

export async function setSparePartPreferred(id: string, assetId: string, preferred: boolean): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  const { error } = await idb(ctx.supabase).from("asset_spare_parts").update({ is_preferred: preferred }).eq("id", id);
  if (error) { logActionError("setSparePartPreferred", error); return { ok: false, error: friendlyDbError(error.message) }; }
  revalidatePath(`/assets/${assetId}`);
  return { ok: true, data: undefined };
}

// ============================ ITEM DOCUMENTS ============================
export async function recordItemDocument(input: {
  inventory_item_id: string; document_type: string | null; document_name: string;
  file_name: string; file_path: string; file_type: string | null; file_size: number | null;
}): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  const { error } = await idb(ctx.supabase).from("inventory_item_documents").insert({
    organization_id: ctx.profile.organization_id,
    inventory_item_id: input.inventory_item_id,
    document_type: clean(input.document_type),
    document_name: input.document_name.trim() || input.file_name,
    file_name: input.file_name,
    file_path: input.file_path,
    file_type: input.file_type,
    file_size: input.file_size,
    uploaded_by: ctx.profile.id,
  });
  if (error) { logActionError("recordItemDocument", error); return { ok: false, error: friendlyDbError(error.message) }; }
  revalidatePath(`/inventory/${input.inventory_item_id}`);
  return { ok: true, data: undefined };
}

export async function getItemDocumentSignedUrl(path: string): Promise<ActionResult<{ url: string }>> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  const { data, error } = await ctx.supabase.storage.from(BUCKET).createSignedUrl(path, 60);
  if (error || !data) { logActionError("getItemDocumentSignedUrl", error); return { ok: false, error: "Could not open that file." }; }
  return { ok: true, data: { url: data.signedUrl } };
}

export async function deleteItemDocument(id: string, path: string, itemId: string): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  await ctx.supabase.storage.from(BUCKET).remove([path]);
  const { error } = await idb(ctx.supabase).from("inventory_item_documents").delete().eq("id", id);
  if (error) { logActionError("deleteItemDocument", error); return { ok: false, error: friendlyDbError(error.message) }; }
  revalidatePath(`/inventory/${itemId}`);
  return { ok: true, data: undefined };
}

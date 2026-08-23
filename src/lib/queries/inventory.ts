import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { idb as vendorDb } from "@/lib/types/vendors";
import {
  idb,
  deriveStockStatus,
  type InventoryCategory,
  type UnitOfMeasure,
  type InventoryItemRow,
  type InventoryItemDetail,
  type StockLocationRow,
  type StockLocationDetail,
  type MovementListRow,
  type WorkOrderPartRow,
  type AssetSparePartRow,
  type InventoryDashboardMetrics,
  type LowStockRow,
  type MovementType,
  type ItemMovementRow,
  type ItemWorkOrderUsage,
  type BalanceByLocation,
  type InventoryItemDocument,
  type InventoryActivity,
} from "@/lib/types/inventory";

const num = (x: unknown): number => (x == null ? 0 : Number(x));
const numOrNull = (x: unknown): number | null => (x == null ? null : Number(x));

// ---------------------------------------------------------------------------
// Configuration lookups
// ---------------------------------------------------------------------------
export async function getInventoryCategories(
  supabase: SupabaseClient<Database>,
  opts: { includeInactive?: boolean } = {}
): Promise<InventoryCategory[]> {
  let q = idb(supabase).from("inventory_categories").select("*").order("sort_order").order("name");
  if (!opts.includeInactive) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) { console.error("getInventoryCategories:", error.message); return []; }
  return (data ?? []) as InventoryCategory[];
}

export async function getUnits(
  supabase: SupabaseClient<Database>,
  opts: { includeInactive?: boolean } = {}
): Promise<UnitOfMeasure[]> {
  let q = idb(supabase).from("units_of_measure").select("*").order("sort_order").order("name");
  if (!opts.includeInactive) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) { console.error("getUnits:", error.message); return []; }
  return (data ?? []) as UnitOfMeasure[];
}

export async function getStockLocationOptions(
  supabase: SupabaseClient<Database>
): Promise<{ id: string; name: string; code: string }[]> {
  const { data, error } = await idb(supabase)
    .from("stock_locations").select("id, name, code").eq("is_active", true).order("name");
  if (error) { console.error("getStockLocationOptions:", error.message); return []; }
  return (data ?? []) as { id: string; name: string; code: string }[];
}

export async function getItemOptionsForIssue(
  supabase: SupabaseClient<Database>
): Promise<{ id: string; item_code: string; name: string }[]> {
  const { data, error } = await idb(supabase)
    .from("inventory_items").select("id, item_code, name").eq("is_active", true).order("name");
  if (error) { console.error("getItemOptionsForIssue:", error.message); return []; }
  return (data ?? []) as { id: string; item_code: string; name: string }[];
}

// ---------------------------------------------------------------------------
// Inventory register
// ---------------------------------------------------------------------------
export async function getInventoryItems(
  supabase: SupabaseClient<Database>
): Promise<InventoryItemRow[]> {
  const db = idb(supabase);
  const [items, cats, units, balances] = await Promise.all([
    db.from("inventory_items").select("*").order("item_code"),
    db.from("inventory_categories").select("id, name"),
    db.from("units_of_measure").select("id, abbreviation"),
    db.from("inventory_balances").select("inventory_item_id, quantity_on_hand"),
  ]);
  const catMap = new Map((cats.data ?? []).map((c) => [(c as { id: string }).id, c as { id: string; name: string }]));
  const unitMap = new Map((units.data ?? []).map((u) => [(u as { id: string }).id, u as { id: string; abbreviation: string }]));
  const totals = new Map<string, number>();
  (balances.data ?? []).forEach((b) => {
    const row = b as { inventory_item_id: string; quantity_on_hand: string | number };
    totals.set(row.inventory_item_id, (totals.get(row.inventory_item_id) ?? 0) + num(row.quantity_on_hand));
  });
  return (items.data ?? []).map((raw) => {
    const it = raw as InventoryItemRow;
    const total = totals.get(it.id) ?? 0;
    const min = numOrNull(it.minimum_stock_level);
    return {
      ...it,
      category: catMap.get(it.category_id) ?? null,
      unit: unitMap.get(it.unit_of_measure_id) ? { abbreviation: unitMap.get(it.unit_of_measure_id)!.abbreviation } : null,
      total_stock: total,
      status: deriveStockStatus(total, min),
    };
  });
}

// ---------------------------------------------------------------------------
// Inventory item detail
// ---------------------------------------------------------------------------
export async function getInventoryItemById(
  supabase: SupabaseClient<Database>,
  id: string
): Promise<InventoryItemDetail | null> {
  const db = idb(supabase);
  const { data: itemRaw, error } = await db.from("inventory_items").select("*").eq("id", id).maybeSingle();
  if (error) { console.error("getInventoryItemById:", error.message); return null; }
  if (!itemRaw) return null;
  const item = itemRaw as InventoryItemDetail;

  const [cat, unit, balancesRes, movementsRes, docsRes, activityRes] = await Promise.all([
    db.from("inventory_categories").select("id, name").eq("id", item.category_id).maybeSingle(),
    db.from("units_of_measure").select("name, abbreviation").eq("id", item.unit_of_measure_id).maybeSingle(),
    db.from("inventory_balances").select("stock_location_id, quantity_on_hand").eq("inventory_item_id", id),
    db.from("inventory_movements").select("*").eq("inventory_item_id", id).order("created_at", { ascending: false }).limit(200),
    db.from("inventory_item_documents").select("*").eq("inventory_item_id", id).order("created_at", { ascending: false }),
    db.from("inventory_activity").select("*").eq("inventory_item_id", id).order("created_at", { ascending: false }).limit(100),
  ]);

  // Preferred vendor (composite FK -> stitch)
  let preferred_vendor: InventoryItemDetail["preferred_vendor"] = null;
  if (item.preferred_vendor_id) {
    const { data: v } = await vendorDb(supabase).from("vendors").select("id, company_name, phone").eq("id", item.preferred_vendor_id).maybeSingle();
    if (v) preferred_vendor = v as InventoryItemDetail["preferred_vendor"];
  }

  // Balances by location
  const balRows = (balancesRes.data ?? []) as { stock_location_id: string; quantity_on_hand: string | number }[];
  const locIds = [...new Set(balRows.map((b) => b.stock_location_id))];
  const slMap = new Map<string, { name: string; code: string }>();
  if (locIds.length) {
    const { data: sls } = await db.from("stock_locations").select("id, name, code").in("id", locIds);
    (sls ?? []).forEach((s) => slMap.set((s as { id: string }).id, s as { name: string; code: string }));
  }
  const balances: BalanceByLocation[] = balRows.map((b) => ({
    stock_location_id: b.stock_location_id,
    location_name: slMap.get(b.stock_location_id)?.name ?? "—",
    location_code: slMap.get(b.stock_location_id)?.code ?? "",
    quantity: num(b.quantity_on_hand),
  })).sort((a, b) => a.location_name.localeCompare(b.location_name));
  const total_stock = balances.reduce((s, b) => s + b.quantity, 0);

  // Movements (stitch location/WO/user)
  const movesRaw = (movementsRes.data ?? []) as {
    id: string; movement_number: string; movement_type: MovementType; quantity: string | number;
    stock_location_id: string; work_order_id: string | null; reference: string | null; reason: string | null;
    created_by: string | null; created_at: string;
  }[];
  const woIds = [...new Set(movesRaw.map((m) => m.work_order_id).filter((x): x is string => !!x))];
  const userIds = [...new Set(movesRaw.map((m) => m.created_by).filter((x): x is string => !!x))];
  const [woMap, userMap] = await Promise.all([
    fetchWorkOrderMap(db, woIds),
    fetchProfileNameMap(db, userIds),
  ]);
  const movements: ItemMovementRow[] = movesRaw.map((m) => ({
    id: m.id, movement_number: m.movement_number, movement_type: m.movement_type, quantity: num(m.quantity),
    stock_location_name: slMapAll(m.stock_location_id, slMap),
    work_order_id: m.work_order_id, work_order_number: m.work_order_id ? woMap.get(m.work_order_id)?.work_order_number ?? null : null,
    reference: m.reference, reason: m.reason, created_at: m.created_at, user_name: m.created_by ? userMap.get(m.created_by) ?? null : null,
  }));

  // Work order usage (aggregate issue/return per WO)
  const usageAgg = new Map<string, { issued: number; returned: number }>();
  movesRaw.forEach((m) => {
    if (!m.work_order_id) return;
    if (m.movement_type !== "issue" && m.movement_type !== "return") return;
    const cur = usageAgg.get(m.work_order_id) ?? { issued: 0, returned: 0 };
    if (m.movement_type === "issue") cur.issued += num(m.quantity);
    else cur.returned += num(m.quantity);
    usageAgg.set(m.work_order_id, cur);
  });
  const work_order_usage: ItemWorkOrderUsage[] = [...usageAgg.entries()].map(([wo, agg]) => ({
    work_order_id: wo,
    work_order_number: woMap.get(wo)?.work_order_number ?? "—",
    title: woMap.get(wo)?.title ?? "",
    issued: agg.issued, returned: agg.returned, net: agg.issued - agg.returned,
  }));

  // Activity actor stitch
  const actRaw = (activityRes.data ?? []) as InventoryActivity[];
  const actorIds = [...new Set(actRaw.map((a) => a.actor_id).filter((x): x is string => !!x))];
  const actorMap = new Map<string, { full_name: string | null; email: string | null }>();
  if (actorIds.length) {
    const { data: ppl } = await db.from("profiles").select("id, full_name, email").in("id", actorIds);
    (ppl ?? []).forEach((p) => {
      const r = p as { id: string; full_name: string | null; email: string | null };
      actorMap.set(r.id, { full_name: r.full_name, email: r.email });
    });
  }
  const activity = actRaw.map((a) => ({ ...a, actor: a.actor_id ? actorMap.get(a.actor_id) ?? null : null }));

  const min = numOrNull(item.minimum_stock_level);
  return {
    ...item,
    category: (cat.data as { id: string; name: string } | null) ?? null,
    unit: (unit.data as { name: string; abbreviation: string } | null) ?? null,
    preferred_vendor,
    balances,
    total_stock,
    status: deriveStockStatus(total_stock, min),
    movements,
    work_order_usage,
    documents: (docsRes.data ?? []) as InventoryItemDocument[],
    activity,
  };
}

function slMapAll(id: string, map: Map<string, { name: string; code: string }>): string | null {
  return map.get(id)?.name ?? null;
}

async function fetchWorkOrderMap(
  db: SupabaseClient<import("@/lib/types/inventory").InventoryDatabase>,
  ids: string[]
): Promise<Map<string, { work_order_number: string; title: string }>> {
  const map = new Map<string, { work_order_number: string; title: string }>();
  if (!ids.length) return map;
  const { data } = await db.from("work_orders").select("id, work_order_number, title").in("id", ids);
  (data ?? []).forEach((w) => {
    const r = w as { id: string; work_order_number: string; title: string };
    map.set(r.id, { work_order_number: r.work_order_number, title: r.title });
  });
  return map;
}

async function fetchProfileNameMap(
  db: SupabaseClient<import("@/lib/types/inventory").InventoryDatabase>,
  ids: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!ids.length) return map;
  const { data } = await db.from("profiles").select("id, full_name, email").in("id", ids);
  (data ?? []).forEach((p) => {
    const r = p as { id: string; full_name: string | null; email: string | null };
    map.set(r.id, r.full_name ?? r.email ?? "—");
  });
  return map;
}

// ---------------------------------------------------------------------------
// Stock locations
// ---------------------------------------------------------------------------
export async function getStockLocations(
  supabase: SupabaseClient<Database>
): Promise<StockLocationRow[]> {
  const db = idb(supabase);
  const [locsRes, balancesRes, itemsRes] = await Promise.all([
    db.from("stock_locations").select("*").order("name"),
    db.from("inventory_balances").select("inventory_item_id, stock_location_id, quantity_on_hand"),
    db.from("inventory_items").select("id, minimum_stock_level"),
  ]);
  const locs = (locsRes.data ?? []) as StockLocationRow[];
  // society location + area names
  const societyLocIds = [...new Set(locs.map((l) => l.location_id))];
  const areaIds = [...new Set(locs.map((l) => l.area_id).filter((x): x is string => !!x))];
  const [locNameMap, areaNameMap] = await Promise.all([
    fetchNameMap(db, "locations", societyLocIds),
    fetchNameMap(db, "areas", areaIds),
  ]);

  const balRows = (balancesRes.data ?? []) as { inventory_item_id: string; stock_location_id: string; quantity_on_hand: string | number }[];
  const minMap = new Map<string, number | null>();
  (itemsRes.data ?? []).forEach((i) => {
    const r = i as { id: string; minimum_stock_level: string | number | null };
    minMap.set(r.id, numOrNull(r.minimum_stock_level));
  });
  // global totals per item (for low-stock determination)
  const itemTotals = new Map<string, number>();
  balRows.forEach((b) => itemTotals.set(b.inventory_item_id, (itemTotals.get(b.inventory_item_id) ?? 0) + num(b.quantity_on_hand)));

  return locs.map((l) => {
    const here = balRows.filter((b) => b.stock_location_id === l.id && num(b.quantity_on_hand) > 0);
    let low = 0;
    here.forEach((b) => {
      const total = itemTotals.get(b.inventory_item_id) ?? 0;
      const min = minMap.get(b.inventory_item_id) ?? null;
      if (deriveStockStatus(total, min) !== "in_stock") low += 1;
    });
    return {
      ...l,
      location_name: locNameMap.get(l.location_id) ?? null,
      area_name: l.area_id ? areaNameMap.get(l.area_id) ?? null : null,
      item_count: here.length,
      low_stock_count: low,
    };
  });
}

export async function getStockLocationById(
  supabase: SupabaseClient<Database>,
  id: string
): Promise<StockLocationDetail | null> {
  const db = idb(supabase);
  const { data: locRaw, error } = await db.from("stock_locations").select("*").eq("id", id).maybeSingle();
  if (error) { console.error("getStockLocationById:", error.message); return null; }
  if (!locRaw) return null;
  const loc = locRaw as StockLocationDetail;

  const [balancesRes, locName, areaName] = await Promise.all([
    db.from("inventory_balances").select("inventory_item_id, quantity_on_hand").eq("stock_location_id", id),
    db.from("locations").select("name").eq("id", loc.location_id).maybeSingle(),
    loc.area_id ? db.from("areas").select("name").eq("id", loc.area_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const balRows = (balancesRes.data ?? []) as { inventory_item_id: string; quantity_on_hand: string | number }[];
  const itemIds = balRows.map((b) => b.inventory_item_id);
  const itemMap = new Map<string, { item_code: string; name: string; minimum_stock_level: number | null }>();
  const globalTotals = new Map<string, number>();
  if (itemIds.length) {
    const [{ data: items }, { data: allBal }] = await Promise.all([
      db.from("inventory_items").select("id, item_code, name, minimum_stock_level").in("id", itemIds),
      db.from("inventory_balances").select("inventory_item_id, quantity_on_hand").in("inventory_item_id", itemIds),
    ]);
    (items ?? []).forEach((i) => {
      const r = i as { id: string; item_code: string; name: string; minimum_stock_level: string | number | null };
      itemMap.set(r.id, { item_code: r.item_code, name: r.name, minimum_stock_level: numOrNull(r.minimum_stock_level) });
    });
    (allBal ?? []).forEach((b) => {
      const r = b as { inventory_item_id: string; quantity_on_hand: string | number };
      globalTotals.set(r.inventory_item_id, (globalTotals.get(r.inventory_item_id) ?? 0) + num(r.quantity_on_hand));
    });
  }
  const items = balRows.map((b) => {
    const meta = itemMap.get(b.inventory_item_id);
    const min = meta?.minimum_stock_level ?? null;
    return {
      inventory_item_id: b.inventory_item_id,
      item_code: meta?.item_code ?? "—",
      name: meta?.name ?? "—",
      quantity: num(b.quantity_on_hand),
      minimum_stock_level: min,
      status: deriveStockStatus(globalTotals.get(b.inventory_item_id) ?? 0, min),
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  return {
    ...loc,
    location_name: (locName.data as { name: string } | null)?.name ?? null,
    area_name: (areaName.data as { name: string } | null)?.name ?? null,
    items,
  };
}

async function fetchNameMap(
  db: SupabaseClient<import("@/lib/types/inventory").InventoryDatabase>,
  table: "locations" | "areas",
  ids: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!ids.length) return map;
  const { data } = await db.from(table).select("id, name").in("id", ids);
  (data ?? []).forEach((r) => map.set((r as { id: string }).id, (r as { name: string }).name));
  return map;
}

// ---------------------------------------------------------------------------
// Stock movements view
// ---------------------------------------------------------------------------
export async function getMovements(
  supabase: SupabaseClient<Database>,
  opts: { limit?: number } = {}
): Promise<MovementListRow[]> {
  const db = idb(supabase);
  const { data, error } = await db.from("inventory_movements").select("*")
    .order("created_at", { ascending: false }).limit(opts.limit ?? 500);
  if (error) { console.error("getMovements:", error.message); return []; }
  const rows = (data ?? []) as {
    id: string; movement_number: string; movement_type: MovementType; quantity: string | number;
    inventory_item_id: string; stock_location_id: string; work_order_id: string | null;
    technician_id: string | null; created_by: string | null; reference: string | null; created_at: string;
  }[];
  const itemIds = [...new Set(rows.map((r) => r.inventory_item_id))];
  const locIds = [...new Set(rows.map((r) => r.stock_location_id))];
  const woIds = [...new Set(rows.map((r) => r.work_order_id).filter((x): x is string => !!x))];
  const peopleIds = [...new Set([...rows.map((r) => r.created_by), ...rows.map((r) => r.technician_id)].filter((x): x is string => !!x))];
  const [itemMap, locMap, woMap, peopleMap] = await Promise.all([
    fetchItemLite(db, itemIds),
    fetchNameMap(db, "stock_locations" as never, locIds) as unknown as Promise<Map<string, string>>,
    fetchWorkOrderMap(db, woIds),
    fetchProfileNameMap(db, peopleIds),
  ]);
  return rows.map((r) => ({
    id: r.id, movement_number: r.movement_number, movement_type: r.movement_type, quantity: num(r.quantity),
    created_at: r.created_at, reference: r.reference,
    item: itemMap.get(r.inventory_item_id) ?? null,
    stock_location: locMap.get(r.stock_location_id) ? { id: r.stock_location_id, name: locMap.get(r.stock_location_id)! } : null,
    work_order: r.work_order_id && woMap.get(r.work_order_id) ? { id: r.work_order_id, work_order_number: woMap.get(r.work_order_id)!.work_order_number } : null,
    technician_name: r.technician_id ? peopleMap.get(r.technician_id) ?? null : null,
    user_name: r.created_by ? peopleMap.get(r.created_by) ?? null : null,
  }));
}

async function fetchItemLite(
  db: SupabaseClient<import("@/lib/types/inventory").InventoryDatabase>,
  ids: string[]
): Promise<Map<string, { id: string; item_code: string; name: string }>> {
  const map = new Map<string, { id: string; item_code: string; name: string }>();
  if (!ids.length) return map;
  const { data } = await db.from("inventory_items").select("id, item_code, name").in("id", ids);
  (data ?? []).forEach((i) => {
    const r = i as { id: string; item_code: string; name: string };
    map.set(r.id, r);
  });
  return map;
}

// ---------------------------------------------------------------------------
// Work order parts (for WO detail panel)
// ---------------------------------------------------------------------------
export async function getWorkOrderParts(
  supabase: SupabaseClient<Database>,
  workOrderId: string
): Promise<WorkOrderPartRow[]> {
  const db = idb(supabase);
  const { data, error } = await db.from("inventory_movements")
    .select("inventory_item_id, stock_location_id, movement_type, quantity, created_at")
    .eq("work_order_id", workOrderId)
    .in("movement_type", ["issue", "return"])
    .order("created_at", { ascending: false });
  if (error) { console.error("getWorkOrderParts:", error.message); return []; }
  const rows = (data ?? []) as { inventory_item_id: string; stock_location_id: string; movement_type: MovementType; quantity: string | number; created_at: string }[];
  if (!rows.length) return [];
  const agg = new Map<string, { issued: number; returned: number; last_at: string; location: string | null }>();
  rows.forEach((r) => {
    const cur = agg.get(r.inventory_item_id) ?? { issued: 0, returned: 0, last_at: r.created_at, location: r.stock_location_id };
    if (r.movement_type === "issue") cur.issued += num(r.quantity);
    else cur.returned += num(r.quantity);
    if (r.created_at > cur.last_at) cur.last_at = r.created_at;
    agg.set(r.inventory_item_id, cur);
  });
  const itemIds = [...agg.keys()];
  const locIds = [...new Set(rows.map((r) => r.stock_location_id))];
  const [items, unitsByItem, locMap] = await Promise.all([
    fetchItemLite(db, itemIds),
    fetchItemUnits(db, itemIds),
    fetchNameMap(db, "stock_locations" as never, locIds) as unknown as Promise<Map<string, string>>,
  ]);
  return [...agg.entries()].map(([itemId, a]) => {
    const it = items.get(itemId);
    return {
      inventory_item_id: itemId,
      item_code: it?.item_code ?? "—",
      name: it?.name ?? "—",
      unit: unitsByItem.get(itemId) ?? null,
      issued: a.issued, returned: a.returned, net: a.issued - a.returned,
      stock_location_id: a.location,
      stock_location_name: a.location ? locMap.get(a.location) ?? null : null,
      last_at: a.last_at,
    };
  }).sort((x, y) => (y.last_at > x.last_at ? 1 : -1));
}

async function fetchItemUnits(
  db: SupabaseClient<import("@/lib/types/inventory").InventoryDatabase>,
  ids: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!ids.length) return map;
  const { data: items } = await db.from("inventory_items").select("id, unit_of_measure_id").in("id", ids);
  const unitIds = [...new Set((items ?? []).map((i) => (i as { unit_of_measure_id: string }).unit_of_measure_id))];
  if (!unitIds.length) return map;
  const { data: units } = await db.from("units_of_measure").select("id, abbreviation").in("id", unitIds);
  const unitMap = new Map((units ?? []).map((u) => [(u as { id: string }).id, (u as { abbreviation: string }).abbreviation]));
  (items ?? []).forEach((i) => {
    const r = i as { id: string; unit_of_measure_id: string };
    map.set(r.id, unitMap.get(r.unit_of_measure_id) ?? "");
  });
  return map;
}

// ---------------------------------------------------------------------------
// Asset spare parts (for asset detail card)
// ---------------------------------------------------------------------------
export async function getAssetSpareParts(
  supabase: SupabaseClient<Database>,
  assetId: string
): Promise<AssetSparePartRow[]> {
  const db = idb(supabase);
  const { data, error } = await db.from("asset_spare_parts").select("*").eq("asset_id", assetId).order("created_at");
  if (error) { console.error("getAssetSpareParts:", error.message); return []; }
  const rows = (data ?? []) as AssetSparePartRow[];
  if (!rows.length) return [];
  const itemIds = [...new Set(rows.map((r) => r.inventory_item_id))];
  const [{ data: items }, { data: balances }] = await Promise.all([
    db.from("inventory_items").select("id, item_code, name, is_active").in("id", itemIds),
    db.from("inventory_balances").select("inventory_item_id, quantity_on_hand").in("inventory_item_id", itemIds),
  ]);
  const itemMap = new Map((items ?? []).map((i) => [(i as { id: string }).id, i as { id: string; item_code: string; name: string; is_active: boolean }]));
  const totals = new Map<string, number>();
  (balances ?? []).forEach((b) => {
    const r = b as { inventory_item_id: string; quantity_on_hand: string | number };
    totals.set(r.inventory_item_id, (totals.get(r.inventory_item_id) ?? 0) + num(r.quantity_on_hand));
  });
  return rows.map((r) => ({
    ...r,
    item: itemMap.get(r.inventory_item_id) ?? null,
    total_stock: totals.get(r.inventory_item_id) ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// Dashboard metrics + low stock
// ---------------------------------------------------------------------------
export async function getInventoryDashboardMetrics(
  supabase: SupabaseClient<Database>
): Promise<InventoryDashboardMetrics> {
  const db = idb(supabase);
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const [items, balances, issued] = await Promise.all([
    db.from("inventory_items").select("id, minimum_stock_level").eq("is_active", true),
    db.from("inventory_balances").select("inventory_item_id, quantity_on_hand"),
    db.from("inventory_movements").select("id").eq("movement_type", "issue").gte("created_at", startOfMonth),
  ]);
  const totals = new Map<string, number>();
  (balances.data ?? []).forEach((b) => {
    const r = b as { inventory_item_id: string; quantity_on_hand: string | number };
    totals.set(r.inventory_item_id, (totals.get(r.inventory_item_id) ?? 0) + num(r.quantity_on_hand));
  });
  let low = 0, out = 0;
  (items.data ?? []).forEach((i) => {
    const r = i as { id: string; minimum_stock_level: string | number | null };
    const st = deriveStockStatus(totals.get(r.id) ?? 0, numOrNull(r.minimum_stock_level));
    if (st === "out_of_stock") out += 1;
    else if (st === "low_stock") low += 1;
  });
  return {
    totalItems: (items.data ?? []).length,
    lowStockItems: low,
    outOfStockItems: out,
    issuedThisMonth: (issued.data ?? []).length,
  };
}

export async function getLowStockItems(
  supabase: SupabaseClient<Database>,
  limit = 8
): Promise<LowStockRow[]> {
  const db = idb(supabase);
  const [items, balances] = await Promise.all([
    db.from("inventory_items").select("id, item_code, name, minimum_stock_level").eq("is_active", true),
    db.from("inventory_balances").select("inventory_item_id, quantity_on_hand"),
  ]);
  const totals = new Map<string, number>();
  (balances.data ?? []).forEach((b) => {
    const r = b as { inventory_item_id: string; quantity_on_hand: string | number };
    totals.set(r.inventory_item_id, (totals.get(r.inventory_item_id) ?? 0) + num(r.quantity_on_hand));
  });
  const rows: LowStockRow[] = [];
  (items.data ?? []).forEach((i) => {
    const r = i as { id: string; item_code: string; name: string; minimum_stock_level: string | number | null };
    const total = totals.get(r.id) ?? 0;
    const min = numOrNull(r.minimum_stock_level);
    if (deriveStockStatus(total, min) !== "in_stock") {
      rows.push({ id: r.id, item_code: r.item_code, name: r.name, total_stock: total, minimum_stock_level: min });
    }
  });
  return rows.sort((a, b) => a.total_stock - b.total_stock).slice(0, limit);
}

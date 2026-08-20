"use server";

import { revalidatePath } from "next/cache";
import { getActionContext, friendlyDbError, type ActionResult } from "@/lib/actions/context";

export type AssetInput = {
  name: string;
  asset_code: string | null;
  location_id: string;
  area_id: string;
  category_id: string;
  status_id: string;
  description: string | null;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  supplier_name: string | null;
  purchase_date: string | null;
  installation_date: string | null;
  warranty_expiry: string | null;
  expected_life_years: number | null;
  notes: string | null;
  is_active: boolean;
};

function validate(input: AssetInput): string | null {
  if (!input.name.trim()) return "Asset name is required.";
  if (!input.location_id) return "Location is required.";
  if (!input.area_id) return "Area is required.";
  if (!input.category_id) return "Category is required.";
  if (!input.status_id) return "Status is required.";
  if (input.expected_life_years != null && input.expected_life_years < 0)
    return "Expected life must be a positive number.";
  return null;
}

export async function createAsset(input: AssetInput): Promise<ActionResult<{ id: string }>> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;

  const validationError = validate(input);
  if (validationError) return { ok: false, error: validationError };

  const { data, error } = await ctx.supabase
    .from("assets")
    .insert({
      organization_id: ctx.profile.organization_id,
      name: input.name.trim(),
      asset_code: input.asset_code?.trim() || null,
      location_id: input.location_id,
      area_id: input.area_id,
      category_id: input.category_id,
      status_id: input.status_id,
      description: input.description?.trim() || null,
      manufacturer: input.manufacturer?.trim() || null,
      model: input.model?.trim() || null,
      serial_number: input.serial_number?.trim() || null,
      supplier_name: input.supplier_name?.trim() || null,
      purchase_date: input.purchase_date || null,
      installation_date: input.installation_date || null,
      warranty_expiry: input.warranty_expiry || null,
      expected_life_years: input.expected_life_years,
      notes: input.notes?.trim() || null,
      is_active: input.is_active,
      created_by: ctx.profile.id,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: friendlyDbError(error.message) };

  // Best-effort audit log; never fail the create if logging hiccups.
  await ctx.supabase.rpc("log_asset_activity", {
    p_asset_id: data.id,
    p_action: "created",
  });

  revalidatePath("/assets");
  return { ok: true, data: { id: data.id } };
}

export async function updateAsset(id: string, input: AssetInput): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;

  const validationError = validate(input);
  if (validationError) return { ok: false, error: validationError };

  // Fetch the current row so we can log meaningful field-level changes.
  const { data: before } = await ctx.supabase
    .from("assets")
    .select("status_id, location_id, area_id, is_active")
    .eq("id", id)
    .maybeSingle();

  const { error } = await ctx.supabase
    .from("assets")
    .update({
      name: input.name.trim(),
      asset_code: input.asset_code?.trim() || null,
      location_id: input.location_id,
      area_id: input.area_id,
      category_id: input.category_id,
      status_id: input.status_id,
      description: input.description?.trim() || null,
      manufacturer: input.manufacturer?.trim() || null,
      model: input.model?.trim() || null,
      serial_number: input.serial_number?.trim() || null,
      supplier_name: input.supplier_name?.trim() || null,
      purchase_date: input.purchase_date || null,
      installation_date: input.installation_date || null,
      warranty_expiry: input.warranty_expiry || null,
      expected_life_years: input.expected_life_years,
      notes: input.notes?.trim() || null,
      is_active: input.is_active,
    })
    .eq("id", id);

  if (error) return { ok: false, error: friendlyDbError(error.message) };

  // Log notable changes.
  if (before) {
    if (before.status_id !== input.status_id) {
      await ctx.supabase.rpc("log_asset_activity", {
        p_asset_id: id,
        p_action: "status_changed",
        p_field_name: "status_id",
        p_old_value: before.status_id,
        p_new_value: input.status_id,
      });
    }
    if (before.location_id !== input.location_id || before.area_id !== input.area_id) {
      await ctx.supabase.rpc("log_asset_activity", {
        p_asset_id: id,
        p_action: "moved",
        p_field_name: "location_area",
        p_old_value: `${before.location_id}/${before.area_id}`,
        p_new_value: `${input.location_id}/${input.area_id}`,
      });
    }
    if (before.is_active !== input.is_active) {
      await ctx.supabase.rpc("log_asset_activity", {
        p_asset_id: id,
        p_action: input.is_active ? "reactivated" : "deactivated",
      });
    }
    if (
      before.status_id === input.status_id &&
      before.location_id === input.location_id &&
      before.area_id === input.area_id &&
      before.is_active === input.is_active
    ) {
      await ctx.supabase.rpc("log_asset_activity", { p_asset_id: id, p_action: "updated" });
    }
  }

  revalidatePath("/assets");
  revalidatePath(`/assets/${id}`);
  return { ok: true, data: undefined };
}

export async function setAssetActive(id: string, isActive: boolean): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;

  const { error } = await ctx.supabase
    .from("assets")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) return { ok: false, error: friendlyDbError(error.message) };

  await ctx.supabase.rpc("log_asset_activity", {
    p_asset_id: id,
    p_action: isActive ? "reactivated" : "deactivated",
  });

  revalidatePath("/assets");
  revalidatePath(`/assets/${id}`);
  return { ok: true, data: undefined };
}

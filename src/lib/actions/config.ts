"use server";

import { revalidatePath } from "next/cache";
import { getActionContext, friendlyDbError, type ActionResult } from "@/lib/actions/context";

// --- Asset Categories -------------------------------------------------------

export type CategoryInput = { name: string; code: string | null; description: string | null; is_active: boolean };

export async function createCategory(input: CategoryInput): Promise<ActionResult<{ id: string }>> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  if (!input.name.trim()) return { ok: false, error: "Name is required." };

  const { data, error } = await ctx.supabase
    .from("asset_categories")
    .insert({
      organization_id: ctx.profile.organization_id,
      name: input.name.trim(),
      code: input.code?.trim() || null,
      description: input.description?.trim() || null,
      is_active: input.is_active,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: friendlyDbError(error.message) };
  revalidatePath("/settings/asset-categories");
  return { ok: true, data: { id: data.id } };
}

export async function updateCategory(id: string, input: CategoryInput): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  if (!input.name.trim()) return { ok: false, error: "Name is required." };

  const { error } = await ctx.supabase
    .from("asset_categories")
    .update({
      name: input.name.trim(),
      code: input.code?.trim() || null,
      description: input.description?.trim() || null,
      is_active: input.is_active,
    })
    .eq("id", id);

  if (error) return { ok: false, error: friendlyDbError(error.message) };
  revalidatePath("/settings/asset-categories");
  return { ok: true, data: undefined };
}

// --- Asset Statuses ---------------------------------------------------------

export type StatusInput = { name: string; code: string; description: string | null; is_active: boolean };

export async function createStatus(input: StatusInput): Promise<ActionResult<{ id: string }>> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  if (!input.name.trim()) return { ok: false, error: "Name is required." };
  if (!input.code.trim()) return { ok: false, error: "Code is required." };

  const { data, error } = await ctx.supabase
    .from("asset_statuses")
    .insert({
      organization_id: ctx.profile.organization_id,
      name: input.name.trim(),
      code: input.code.trim().toLowerCase().replace(/\s+/g, "_"),
      description: input.description?.trim() || null,
      is_active: input.is_active,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: friendlyDbError(error.message) };
  revalidatePath("/settings/asset-statuses");
  return { ok: true, data: { id: data.id } };
}

export async function updateStatus(id: string, input: StatusInput): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  if (!input.name.trim()) return { ok: false, error: "Name is required." };

  const { error } = await ctx.supabase
    .from("asset_statuses")
    .update({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      is_active: input.is_active,
    })
    .eq("id", id);

  if (error) return { ok: false, error: friendlyDbError(error.message) };
  revalidatePath("/settings/asset-statuses");
  return { ok: true, data: undefined };
}

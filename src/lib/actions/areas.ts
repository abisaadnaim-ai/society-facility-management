"use server";

import { revalidatePath } from "next/cache";
import { getActionContext, friendlyDbError, type ActionResult } from "@/lib/actions/context";

export type AreaInput = {
  location_id: string;
  name: string;
  code: string | null;
  description: string | null;
  floor_or_level: string | null;
  area_type: string | null;
  is_active: boolean;
};

export async function createArea(input: AreaInput): Promise<ActionResult<{ id: string }>> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;

  if (!input.location_id) return { ok: false, error: "A location is required." };
  if (!input.name.trim()) return { ok: false, error: "Name is required." };

  const { data, error } = await ctx.supabase
    .from("areas")
    .insert({
      organization_id: ctx.profile.organization_id,
      location_id: input.location_id,
      name: input.name.trim(),
      code: input.code?.trim() || null,
      description: input.description?.trim() || null,
      floor_or_level: input.floor_or_level?.trim() || null,
      area_type: input.area_type?.trim() || null,
      is_active: input.is_active,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: friendlyDbError(error.message) };

  revalidatePath(`/locations/${input.location_id}`);
  return { ok: true, data: { id: data.id } };
}

export async function updateArea(id: string, input: AreaInput): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;

  if (!input.name.trim()) return { ok: false, error: "Name is required." };

  const { error } = await ctx.supabase
    .from("areas")
    .update({
      name: input.name.trim(),
      code: input.code?.trim() || null,
      description: input.description?.trim() || null,
      floor_or_level: input.floor_or_level?.trim() || null,
      area_type: input.area_type?.trim() || null,
      is_active: input.is_active,
    })
    .eq("id", id);

  if (error) return { ok: false, error: friendlyDbError(error.message) };

  revalidatePath(`/locations/${input.location_id}`);
  return { ok: true, data: undefined };
}

export async function setAreaActive(
  id: string,
  isActive: boolean,
  locationId: string
): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;

  const { error } = await ctx.supabase
    .from("areas")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) return { ok: false, error: friendlyDbError(error.message) };

  revalidatePath(`/locations/${locationId}`);
  return { ok: true, data: undefined };
}

"use server";

import { revalidatePath } from "next/cache";
import { getActionContext, friendlyDbError, type ActionResult } from "@/lib/actions/context";

export type LocationInput = {
  name: string;
  code: string | null;
  location_type: string | null;
  is_active: boolean;
};

export async function createLocation(input: LocationInput): Promise<ActionResult<{ id: string }>> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;

  if (!input.name.trim()) return { ok: false, error: "Name is required." };

  const { data, error } = await ctx.supabase
    .from("locations")
    .insert({
      organization_id: ctx.profile.organization_id,
      name: input.name.trim(),
      code: input.code?.trim() || null,
      location_type: input.location_type?.trim() || null,
      is_active: input.is_active,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: friendlyDbError(error.message) };

  revalidatePath("/locations");
  return { ok: true, data: { id: data.id } };
}

export async function updateLocation(
  id: string,
  input: LocationInput
): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;

  if (!input.name.trim()) return { ok: false, error: "Name is required." };

  const { error } = await ctx.supabase
    .from("locations")
    .update({
      name: input.name.trim(),
      code: input.code?.trim() || null,
      location_type: input.location_type?.trim() || null,
      is_active: input.is_active,
    })
    .eq("id", id);

  if (error) return { ok: false, error: friendlyDbError(error.message) };

  revalidatePath("/locations");
  revalidatePath(`/locations/${id}`);
  return { ok: true, data: undefined };
}

export async function setLocationActive(
  id: string,
  isActive: boolean
): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;

  const { error } = await ctx.supabase
    .from("locations")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) return { ok: false, error: friendlyDbError(error.message) };

  revalidatePath("/locations");
  revalidatePath(`/locations/${id}`);
  return { ok: true, data: undefined };
}

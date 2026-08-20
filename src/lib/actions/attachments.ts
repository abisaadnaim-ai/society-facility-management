"use server";

import { revalidatePath } from "next/cache";
import { getActionContext, friendlyDbError, type ActionResult } from "@/lib/actions/context";

/**
 * Records the metadata row for an attachment whose bytes were already uploaded
 * to Storage by the browser client (which is RLS-gated the same way). Splitting
 * it this way keeps large file bytes off the server action payload while still
 * enforcing permissions on both the Storage object and this metadata row.
 */
export async function recordAttachment(input: {
  asset_id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  attachment_type: string | null;
}): Promise<ActionResult<{ id: string }>> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;

  const { data, error } = await ctx.supabase
    .from("asset_attachments")
    .insert({
      organization_id: ctx.profile.organization_id,
      asset_id: input.asset_id,
      file_name: input.file_name,
      file_path: input.file_path,
      file_type: input.file_type,
      file_size: input.file_size,
      attachment_type: input.attachment_type,
      uploaded_by: ctx.profile.id,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: friendlyDbError(error.message) };

  await ctx.supabase.rpc("log_asset_activity", {
    p_asset_id: input.asset_id,
    p_action: "attachment_added",
    p_new_value: input.file_name,
  });

  revalidatePath(`/assets/${input.asset_id}`);
  return { ok: true, data: { id: data.id } };
}

/** Returns a short-lived signed URL for downloading a private attachment. */
export async function getAttachmentDownloadUrl(
  filePath: string
): Promise<ActionResult<{ url: string }>> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;

  const { data, error } = await ctx.supabase.storage
    .from("asset-attachments")
    .createSignedUrl(filePath, 60); // valid 60s

  if (error || !data) {
    return { ok: false, error: "Couldn't generate a download link." };
  }
  return { ok: true, data: { url: data.signedUrl } };
}

export async function deleteAttachment(input: {
  id: string;
  asset_id: string;
  file_path: string;
  file_name: string;
}): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;

  // Remove the Storage object first (RLS-gated), then the metadata row.
  const { error: storageError } = await ctx.supabase.storage
    .from("asset-attachments")
    .remove([input.file_path]);

  if (storageError) return { ok: false, error: friendlyDbError(storageError.message) };

  const { error } = await ctx.supabase
    .from("asset_attachments")
    .delete()
    .eq("id", input.id);

  if (error) return { ok: false, error: friendlyDbError(error.message) };

  await ctx.supabase.rpc("log_asset_activity", {
    p_asset_id: input.asset_id,
    p_action: "attachment_removed",
    p_old_value: input.file_name,
  });

  revalidatePath(`/assets/${input.asset_id}`);
  return { ok: true, data: undefined };
}

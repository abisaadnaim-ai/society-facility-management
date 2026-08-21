"use server";

import { revalidatePath } from "next/cache";
import { getActionContext, friendlyDbError, type ActionResult } from "@/lib/actions/context";

const FM_BUCKET = "fm-request-attachments";
const WO_BUCKET = "work-order-attachments";

// ===================== FM REQUEST ATTACHMENTS =====================

export async function recordFmRequestAttachment(input: {
  request_id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  attachment_type: string | null;
}): Promise<ActionResult<{ id: string }>> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;

  const { data, error } = await ctx.supabase
    .from("fm_request_attachments")
    .insert({
      organization_id: ctx.profile.organization_id,
      request_id: input.request_id,
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

  await ctx.supabase.rpc("log_fm_request_activity", {
    p_request_id: input.request_id,
    p_action: "attachment_added",
    p_new_value: input.file_name,
  });

  revalidatePath(`/fm-requests/${input.request_id}`);
  return { ok: true, data: { id: data.id } };
}

export async function getFmRequestAttachmentUrl(
  filePath: string
): Promise<ActionResult<{ url: string }>> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  const { data, error } = await ctx.supabase.storage
    .from(FM_BUCKET)
    .createSignedUrl(filePath, 60);
  if (error || !data) return { ok: false, error: "Couldn't generate a download link." };
  return { ok: true, data: { url: data.signedUrl } };
}

export async function deleteFmRequestAttachment(input: {
  id: string;
  request_id: string;
  file_path: string;
  file_name: string;
}): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;

  const { error: storageError } = await ctx.supabase.storage
    .from(FM_BUCKET)
    .remove([input.file_path]);
  if (storageError) return { ok: false, error: friendlyDbError(storageError.message) };

  const { error } = await ctx.supabase
    .from("fm_request_attachments")
    .delete()
    .eq("id", input.id);
  if (error) return { ok: false, error: friendlyDbError(error.message) };

  await ctx.supabase.rpc("log_fm_request_activity", {
    p_request_id: input.request_id,
    p_action: "attachment_removed",
    p_old_value: input.file_name,
  });

  revalidatePath(`/fm-requests/${input.request_id}`);
  return { ok: true, data: undefined };
}

// ===================== WORK ORDER ATTACHMENTS =====================

export async function recordWorkOrderAttachment(input: {
  work_order_id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  attachment_type: string | null;
}): Promise<ActionResult<{ id: string }>> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;

  const { data, error } = await ctx.supabase
    .from("work_order_attachments")
    .insert({
      organization_id: ctx.profile.organization_id,
      work_order_id: input.work_order_id,
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

  await ctx.supabase.rpc("log_work_order_activity", {
    p_work_order_id: input.work_order_id,
    p_action: "attachment_added",
    p_new_value: input.file_name,
    p_metadata: input.attachment_type ? { attachment_type: input.attachment_type } : undefined,
  });

  revalidatePath(`/work-orders/${input.work_order_id}`);
  return { ok: true, data: { id: data.id } };
}

export async function getWorkOrderAttachmentUrl(
  filePath: string
): Promise<ActionResult<{ url: string }>> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  const { data, error } = await ctx.supabase.storage
    .from(WO_BUCKET)
    .createSignedUrl(filePath, 60);
  if (error || !data) return { ok: false, error: "Couldn't generate a download link." };
  return { ok: true, data: { url: data.signedUrl } };
}

export async function deleteWorkOrderAttachment(input: {
  id: string;
  work_order_id: string;
  file_path: string;
  file_name: string;
}): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;

  const { error: storageError } = await ctx.supabase.storage
    .from(WO_BUCKET)
    .remove([input.file_path]);
  if (storageError) return { ok: false, error: friendlyDbError(storageError.message) };

  const { error } = await ctx.supabase
    .from("work_order_attachments")
    .delete()
    .eq("id", input.id);
  if (error) return { ok: false, error: friendlyDbError(error.message) };

  await ctx.supabase.rpc("log_work_order_activity", {
    p_work_order_id: input.work_order_id,
    p_action: "attachment_removed",
    p_old_value: input.file_name,
  });

  revalidatePath(`/work-orders/${input.work_order_id}`);
  return { ok: true, data: undefined };
}

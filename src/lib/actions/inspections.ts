"use server";

import { revalidatePath } from "next/cache";
import { getActionContext, friendlyDbError, logActionError, type ActionResult } from "@/lib/actions/context";
import { idb } from "@/lib/types/inspections";

const BUCKET = "inspection-attachments";
const VALID_UNITS = ["day", "week", "month", "year"];

// ===================== TEMPLATES =====================

export type TemplateItemInput = {
  item_text: string;
  instructions: string | null;
  is_required: boolean;
  allow_na: boolean;
  require_comment_on_fail: boolean;
  require_photo_on_fail: boolean;
  failure_category_id: string | null;
  failure_priority_id: string | null;
};
export type TemplateSectionInput = {
  name: string;
  description: string | null;
  items: TemplateItemInput[];
};
export type TemplateCreateInput = {
  name: string;
  description: string | null;
  instructions: string | null;
  requires_manager_review: boolean;
  sections: TemplateSectionInput[];
};

export async function createInspectionTemplate(
  input: TemplateCreateInput
): Promise<ActionResult<{ id: string }>> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  if (!input.name.trim()) return { ok: false, error: "A template name is required." };
  const cleanSections = input.sections
    .map((s) => ({ ...s, name: s.name.trim(), items: s.items.filter((i) => i.item_text.trim()) }))
    .filter((s) => s.name.length > 0 && s.items.length > 0);
  if (cleanSections.length === 0)
    return { ok: false, error: "Add at least one section with at least one checklist item." };

  const db = idb(ctx.supabase);
  const orgId = ctx.profile.organization_id;

  const { data: tmpl, error } = await db
    .from("inspection_templates")
    .insert({
      organization_id: orgId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      instructions: input.instructions?.trim() || null,
      requires_manager_review: input.requires_manager_review,
      created_by: ctx.profile.id,
    })
    .select("id")
    .single();
  if (error || !tmpl) {
    logActionError("createInspectionTemplate", error);
    return { ok: false, error: friendlyDbError(error?.message ?? "") };
  }

  let itemSort = 0;
  for (let s = 0; s < cleanSections.length; s++) {
    const sec = cleanSections[s];
    const { data: section, error: secErr } = await db
      .from("inspection_template_sections")
      .insert({
        organization_id: orgId,
        template_id: tmpl.id,
        name: sec.name,
        description: sec.description?.trim() || null,
        sort_order: s + 1,
      })
      .select("id")
      .single();
    if (secErr || !section) {
      logActionError("createInspectionTemplate.section", secErr);
      return { ok: false, error: "The template was created but a section failed to save. Edit it from the template page." };
    }
    const itemRows = sec.items.map((it) => {
      itemSort += 1;
      return {
        organization_id: orgId,
        template_id: tmpl.id,
        section_id: section.id,
        item_text: it.item_text.trim(),
        instructions: it.instructions?.trim() || null,
        is_required: it.is_required,
        allow_na: it.allow_na,
        require_comment_on_fail: it.require_comment_on_fail,
        require_photo_on_fail: it.require_photo_on_fail,
        failure_category_id: it.failure_category_id || null,
        failure_priority_id: it.failure_priority_id || null,
        sort_order: itemSort,
      };
    });
    const { error: itemErr } = await db.from("inspection_template_items").insert(itemRows);
    if (itemErr) {
      logActionError("createInspectionTemplate.items", itemErr);
      return { ok: false, error: "The template was created but some items failed to save. Edit it from the template page." };
    }
  }

  revalidatePath("/inspections/templates");
  return { ok: true, data: { id: tmpl.id } };
}

export async function updateInspectionTemplate(
  id: string,
  input: { name: string; description: string | null; instructions: string | null; requires_manager_review: boolean }
): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  if (!input.name.trim()) return { ok: false, error: "A template name is required." };
  const { error } = await idb(ctx.supabase)
    .from("inspection_templates")
    .update({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      instructions: input.instructions?.trim() || null,
      requires_manager_review: input.requires_manager_review,
    })
    .eq("id", id);
  if (error) return { ok: false, error: friendlyDbError(error.message) };
  revalidatePath(`/inspections/templates/${id}`);
  revalidatePath("/inspections/templates");
  return { ok: true, data: undefined };
}

export async function setInspectionTemplateStatus(
  id: string,
  status: "active" | "archived"
): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  const { error } = await idb(ctx.supabase).from("inspection_templates").update({ status }).eq("id", id);
  if (error) return { ok: false, error: friendlyDbError(error.message) };
  revalidatePath(`/inspections/templates/${id}`);
  revalidatePath("/inspections/templates");
  return { ok: true, data: undefined };
}

// ---- granular section/item editing (affects FUTURE inspections only) ----
export async function addTemplateSection(templateId: string, name: string, description: string | null): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  if (!name.trim()) return { ok: false, error: "A section name is required." };
  const db = idb(ctx.supabase);
  const { data: last } = await db.from("inspection_template_sections").select("sort_order")
    .eq("template_id", templateId).order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const next = ((last as { sort_order: number } | null)?.sort_order ?? 0) + 1;
  const { error } = await db.from("inspection_template_sections").insert({
    organization_id: ctx.profile.organization_id, template_id: templateId,
    name: name.trim(), description: description?.trim() || null, sort_order: next,
  });
  if (error) return { ok: false, error: friendlyDbError(error.message) };
  revalidatePath(`/inspections/templates/${templateId}`);
  return { ok: true, data: undefined };
}

export async function deleteTemplateSection(templateId: string, sectionId: string): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  const { error } = await idb(ctx.supabase).from("inspection_template_sections").delete().eq("id", sectionId);
  if (error) return { ok: false, error: friendlyDbError(error.message) };
  revalidatePath(`/inspections/templates/${templateId}`);
  return { ok: true, data: undefined };
}

export async function addTemplateItem(
  templateId: string,
  sectionId: string | null,
  input: TemplateItemInput
): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  if (!input.item_text.trim()) return { ok: false, error: "Item text is required." };
  const db = idb(ctx.supabase);
  const { data: last } = await db.from("inspection_template_items").select("sort_order")
    .eq("template_id", templateId).order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const next = ((last as { sort_order: number } | null)?.sort_order ?? 0) + 1;
  const { error } = await db.from("inspection_template_items").insert({
    organization_id: ctx.profile.organization_id, template_id: templateId, section_id: sectionId,
    item_text: input.item_text.trim(), instructions: input.instructions?.trim() || null,
    is_required: input.is_required, allow_na: input.allow_na,
    require_comment_on_fail: input.require_comment_on_fail, require_photo_on_fail: input.require_photo_on_fail,
    failure_category_id: input.failure_category_id || null, failure_priority_id: input.failure_priority_id || null,
    sort_order: next,
  });
  if (error) return { ok: false, error: friendlyDbError(error.message) };
  revalidatePath(`/inspections/templates/${templateId}`);
  return { ok: true, data: undefined };
}

export async function updateTemplateItem(
  templateId: string,
  itemId: string,
  input: TemplateItemInput
): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  if (!input.item_text.trim()) return { ok: false, error: "Item text is required." };
  const { error } = await idb(ctx.supabase).from("inspection_template_items").update({
    item_text: input.item_text.trim(), instructions: input.instructions?.trim() || null,
    is_required: input.is_required, allow_na: input.allow_na,
    require_comment_on_fail: input.require_comment_on_fail, require_photo_on_fail: input.require_photo_on_fail,
    failure_category_id: input.failure_category_id || null, failure_priority_id: input.failure_priority_id || null,
  }).eq("id", itemId);
  if (error) return { ok: false, error: friendlyDbError(error.message) };
  revalidatePath(`/inspections/templates/${templateId}`);
  return { ok: true, data: undefined };
}

export async function deleteTemplateItem(templateId: string, itemId: string): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  const { error } = await idb(ctx.supabase).from("inspection_template_items").delete().eq("id", itemId);
  if (error) return { ok: false, error: friendlyDbError(error.message) };
  revalidatePath(`/inspections/templates/${templateId}`);
  return { ok: true, data: undefined };
}

// ===================== SCHEDULES =====================

export type ScheduleCreateInput = {
  template_id: string;
  location_id: string;
  area_id: string | null;
  asset_id: string | null;
  assigned_to: string | null;
  frequency_unit: string;
  frequency_interval: number;
  start_date: string;
  scheduled_time: string | null;
};

export async function createInspectionSchedule(
  input: ScheduleCreateInput
): Promise<ActionResult<{ id: string }>> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  if (!input.template_id) return { ok: false, error: "A template is required." };
  if (!input.location_id) return { ok: false, error: "A location is required." };
  if (!VALID_UNITS.includes(input.frequency_unit)) return { ok: false, error: "Invalid frequency." };
  if (!Number.isInteger(input.frequency_interval) || input.frequency_interval < 1)
    return { ok: false, error: "Frequency interval must be a positive whole number." };
  if (!input.start_date) return { ok: false, error: "A start date is required." };

  const { data, error } = await idb(ctx.supabase)
    .from("inspection_schedules")
    .insert({
      organization_id: ctx.profile.organization_id,
      template_id: input.template_id,
      location_id: input.location_id,
      area_id: input.area_id || null,
      asset_id: input.asset_id || null,
      assigned_to: input.assigned_to || null,
      frequency_unit: input.frequency_unit,
      frequency_interval: input.frequency_interval,
      start_date: input.start_date,
      scheduled_time: input.scheduled_time || null,
      next_due_date: input.start_date,
      created_by: ctx.profile.id,
    })
    .select("id")
    .single();
  if (error || !data) {
    logActionError("createInspectionSchedule", error);
    return { ok: false, error: friendlyDbError(error?.message ?? "") };
  }
  revalidatePath("/inspections/schedules");
  revalidatePath("/inspections");
  return { ok: true, data: { id: data.id } };
}

export async function setInspectionScheduleStatus(
  id: string,
  status: "active" | "paused" | "archived"
): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  const { error } = await idb(ctx.supabase).rpc("inspection_set_schedule_status", { p_schedule_id: id, p_status: status });
  if (error) return { ok: false, error: friendlyDbError(error.message) };
  revalidatePath("/inspections/schedules");
  revalidatePath("/inspections");
  return { ok: true, data: undefined };
}

// ===================== EXECUTION =====================

export async function startInspection(id: string): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  const { error } = await idb(ctx.supabase).rpc("inspection_start", { p_occurrence_id: id });
  if (error) return { ok: false, error: friendlyDbError(error.message) };
  revalidatePath(`/inspections/${id}`);
  revalidatePath("/inspections");
  return { ok: true, data: undefined };
}

export async function saveInspectionResponse(
  inspectionId: string,
  responseId: string,
  input: { result: "pass" | "fail" | "na" | null; comment: string | null }
): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  const { error } = await idb(ctx.supabase)
    .from("inspection_responses")
    .update({ result: input.result, comment: input.comment?.trim() || null })
    .eq("id", responseId);
  if (error) return { ok: false, error: friendlyDbError(error.message) };
  revalidatePath(`/inspections/${inspectionId}`);
  return { ok: true, data: undefined };
}

export async function submitInspection(id: string): Promise<ActionResult<{ overall: string }>> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  const { data, error } = await idb(ctx.supabase).rpc("inspection_submit", { p_occurrence_id: id });
  if (error) return { ok: false, error: friendlyDbError(error.message) };
  revalidatePath(`/inspections/${id}`);
  revalidatePath("/inspections");
  revalidatePath("/inspections/findings");
  return { ok: true, data: { overall: (data as unknown as string) ?? "" } };
}

export async function reviewInspection(id: string, notes: string | null): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  const { error } = await idb(ctx.supabase).rpc("inspection_review", { p_occurrence_id: id, p_notes: notes?.trim() || null });
  if (error) return { ok: false, error: friendlyDbError(error.message) };
  revalidatePath(`/inspections/${id}`);
  revalidatePath("/inspections");
  return { ok: true, data: undefined };
}

export async function closeInspection(id: string): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  const { error } = await idb(ctx.supabase).rpc("inspection_close", { p_occurrence_id: id });
  if (error) return { ok: false, error: friendlyDbError(error.message) };
  revalidatePath(`/inspections/${id}`);
  revalidatePath("/inspections");
  return { ok: true, data: undefined };
}

export async function skipInspection(id: string, reason: string): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  if (!reason.trim()) return { ok: false, error: "A reason is required to skip." };
  const { error } = await idb(ctx.supabase).rpc("inspection_skip", { p_occurrence_id: id, p_reason: reason.trim() });
  if (error) return { ok: false, error: friendlyDbError(error.message) };
  revalidatePath(`/inspections/${id}`);
  revalidatePath("/inspections");
  return { ok: true, data: undefined };
}

export async function assignInspection(id: string, userId: string | null): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  const { error } = await idb(ctx.supabase).rpc("inspection_assign", { p_occurrence_id: id, p_user_id: userId });
  if (error) return { ok: false, error: friendlyDbError(error.message) };
  revalidatePath(`/inspections/${id}`);
  revalidatePath("/inspections");
  return { ok: true, data: undefined };
}

// ===================== FINDINGS / CORRECTIVE ACTIONS =====================

export async function createFmRequestFromFinding(
  findingId: string,
  input: { title: string; description: string | null; category_id: string | null; priority_id: string | null }
): Promise<ActionResult<{ id: string }>> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  const { data, error } = await idb(ctx.supabase).rpc("inspection_finding_create_fm_request", {
    p_finding_id: findingId,
    p_title: input.title?.trim() || "Inspection finding",
    p_description: input.description?.trim() || null,
    p_category_id: input.category_id || null,
    p_priority_id: input.priority_id || null,
  });
  if (error) return { ok: false, error: friendlyDbError(error.message) };
  revalidatePath("/inspections/findings");
  revalidatePath("/fm-requests");
  return { ok: true, data: { id: (data as unknown as string) ?? "" } };
}

export async function createWorkOrderFromFinding(
  findingId: string,
  input: { title: string; description: string | null; category_id: string | null; priority_id: string | null; assigned_to: string | null }
): Promise<ActionResult<{ id: string }>> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  const { data, error } = await idb(ctx.supabase).rpc("inspection_finding_create_work_order", {
    p_finding_id: findingId,
    p_title: input.title?.trim() || "Inspection finding",
    p_description: input.description?.trim() || null,
    p_category_id: input.category_id || null,
    p_priority_id: input.priority_id || null,
    p_assigned_to: input.assigned_to || null,
  });
  if (error) return { ok: false, error: friendlyDbError(error.message) };
  revalidatePath("/inspections/findings");
  revalidatePath("/work-orders");
  return { ok: true, data: { id: (data as unknown as string) ?? "" } };
}

export async function resolveFinding(findingId: string, notes: string | null): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  const { error } = await idb(ctx.supabase).rpc("inspection_finding_resolve", { p_finding_id: findingId, p_notes: notes?.trim() || null });
  if (error) return { ok: false, error: friendlyDbError(error.message) };
  revalidatePath("/inspections/findings");
  return { ok: true, data: undefined };
}

export async function dismissFinding(findingId: string, reason: string): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  if (!reason.trim()) return { ok: false, error: "A reason is required to dismiss a finding." };
  const { error } = await idb(ctx.supabase).rpc("inspection_finding_dismiss", { p_finding_id: findingId, p_reason: reason.trim() });
  if (error) return { ok: false, error: friendlyDbError(error.message) };
  revalidatePath("/inspections/findings");
  return { ok: true, data: undefined };
}

// ===================== RESPONSE ATTACHMENTS =====================

export async function recordInspectionAttachment(input: {
  inspection_id: string;
  response_id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
}): Promise<ActionResult<{ id: string }>> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  const { data, error } = await idb(ctx.supabase)
    .from("inspection_response_attachments")
    .insert({
      organization_id: ctx.profile.organization_id,
      inspection_id: input.inspection_id,
      response_id: input.response_id,
      file_name: input.file_name,
      file_path: input.file_path,
      file_type: input.file_type,
      file_size: input.file_size,
      uploaded_by: ctx.profile.id,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: friendlyDbError(error?.message ?? "") };
  revalidatePath(`/inspections/${input.inspection_id}`);
  return { ok: true, data: { id: data.id } };
}

export async function getInspectionAttachmentUrl(filePath: string): Promise<ActionResult<{ url: string }>> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  const { data, error } = await ctx.supabase.storage.from(BUCKET).createSignedUrl(filePath, 60);
  if (error || !data) return { ok: false, error: "Couldn't generate a download link." };
  return { ok: true, data: { url: data.signedUrl } };
}

export async function deleteInspectionAttachment(input: {
  id: string;
  inspection_id: string;
  file_path: string;
}): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx.ok) return ctx;
  await ctx.supabase.storage.from(BUCKET).remove([input.file_path]);
  const { error } = await idb(ctx.supabase).from("inspection_response_attachments").delete().eq("id", input.id);
  if (error) return { ok: false, error: friendlyDbError(error.message) };
  revalidatePath(`/inspections/${input.inspection_id}`);
  return { ok: true, data: undefined };
}

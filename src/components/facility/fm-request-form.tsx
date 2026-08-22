"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { LocationAreaAssetPicker } from "@/components/facility/location-area-asset-picker";
import { createFmRequest } from "@/lib/actions/fm-requests";
import { recordFmRequestAttachment } from "@/lib/actions/fm-attachments";
import type { FmCategory, FmPriority } from "@/lib/types/fm";
import type { AssetOption } from "@/lib/queries/fm-config";

type LocationOpt = { id: string; name: string };
type AreaOpt = { id: string; name: string; location_id: string; is_active: boolean };

const MAX_BYTES = 20 * 1024 * 1024;

export function FmRequestForm({
  locations,
  areas,
  assets,
  categories,
  priorities,
  canSetPriority,
  organizationId,
}: {
  locations: LocationOpt[];
  areas: AreaOpt[];
  assets: AssetOption[];
  categories: FmCategory[];
  priorities: FmPriority[];
  canSetPriority: boolean;
  organizationId: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [assetId, setAssetId] = useState("");
  const [notes, setNotes] = useState("");
  const [priorityId, setPriorityId] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function onFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(e.target.files ?? []).filter((f) => f.size <= MAX_BYTES);
    setFiles((prev) => {
      const merged = [...prev];
      for (const f of incoming) {
        if (!merged.some((m) => m.name === f.name && m.size === f.size)) merged.push(f);
      }
      return merged;
    });
    // Reset so the same file (or another camera shot) can be selected again.
    e.target.value = "";
  }

  async function uploadEvidence(requestId: string) {
    if (files.length === 0) return;
    const supabase = createClient();
    for (const file of files) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${organizationId}/${requestId}/${Date.now()}_${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("fm-request-attachments")
        .upload(path, file, { upsert: false, contentType: file.type || undefined });
      if (upErr) continue;
      await recordFmRequestAttachment({
        request_id: requestId,
        file_name: file.name,
        file_path: path,
        file_type: file.type || null,
        file_size: file.size,
        attachment_type: null,
      });
    }
  }

  async function submit() {
    setError(null);
    if (!title.trim()) return setError("Please give the issue a short title.");
    if (!locationId) return setError("Please choose a location.");
    if (!categoryId) return setError("Please choose a category.");

    setSubmitting(true);
    const res = await createFmRequest({
      title,
      description: description || null,
      category_id: categoryId,
      location_id: locationId,
      area_id: areaId || null,
      asset_id: assetId || null,
      exact_location_notes: notes || null,
      priority_id: canSetPriority ? priorityId || null : null,
    });

    if (!res.ok) {
      setSubmitting(false);
      setError(res.error);
      return;
    }
    try {
      await uploadEvidence(res.data.id);
    } catch {
      /* request already created; ignore evidence upload issues */
    }
    router.push(`/fm-requests/${res.data.id}`);
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-4">
        <Link href="/fm-requests" className="text-sm text-slate-500 hover:text-slate-900">
          &larr; Back to FM Requests
        </Link>
      </div>

      <div className="space-y-6 rounded-lg border border-slate-200 bg-white p-6">
        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Issue</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Title <span className="text-red-500">*</span>
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Water leak in ladies changing room"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
              <Textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what's wrong, when it started, and any impact."
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Category <span className="text-red-500">*</span>
                </label>
                <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">Select a category...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
              </div>
              {canSetPriority && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Priority</label>
                  <Select value={priorityId} onChange={(e) => setPriorityId(e.target.value)}>
                    <option value="">Set during review</option>
                    {priorities.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </Select>
                </div>
              )}
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Location</h2>
          <LocationAreaAssetPicker
            locations={locations}
            areas={areas}
            assets={assets}
            locationId={locationId}
            areaId={areaId}
            assetId={assetId}
            onLocationChange={setLocationId}
            onAreaChange={setAreaId}
            onAssetChange={setAssetId}
          />
          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Exact location / additional details
            </label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Ladies changing room, shower beside the sauna"
            />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Evidence</h2>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onFilesSelected}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => cameraInputRef.current?.click()}>
              Take photo
            </Button>
            <label className="inline-flex cursor-pointer items-center rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">
              Choose photos or files
              <input
                type="file"
                multiple
                onChange={onFilesSelected}
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                className="hidden"
              />
            </label>
          </div>
          {files.length > 0 && (
            <ul className="mt-3 space-y-1">
              {files.map((f, i) => (
                <li key={`${f.name}-${f.size}-${i}`} className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  <span className="truncate">{f.name}</span>
                  <button
                    type="button"
                    onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                    className="shrink-0 text-slate-400 hover:text-red-600"
                    aria-label={`Remove ${f.name}`}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-slate-400">Photos are uploaded after you submit. Max 20 MB each.</p>
        </section>

        {error && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
          <Link href="/fm-requests">
            <Button variant="outline" disabled={submitting}>Cancel</Button>
          </Link>
          <Button onClick={submit} isLoading={submitting}>Submit request</Button>
        </div>
      </div>
    </div>
  );
}

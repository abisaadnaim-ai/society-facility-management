"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { LocationAreaAssetPicker } from "@/components/facility/location-area-asset-picker";
import { personName } from "@/components/facility/status-badges";
import { createWorkOrder } from "@/lib/actions/work-orders";
import type { FmCategory, FmPriority, PersonOption } from "@/lib/types/fm";
import type { AssetOption } from "@/lib/queries/fm-config";

type LocationOpt = { id: string; name: string };
type AreaOpt = { id: string; name: string; location_id: string; is_active: boolean };

export type WorkOrderPrefill = {
  fm_request_id: string | null;
  request_number?: string | null;
  title: string;
  description: string;
  location_id: string;
  area_id: string;
  asset_id: string;
  category_id: string;
  priority_id: string;
};

export function WorkOrderForm({
  locations,
  areas,
  assets,
  categories,
  priorities,
  technicians,
  prefill,
}: {
  locations: LocationOpt[];
  areas: AreaOpt[];
  assets: AssetOption[];
  categories: FmCategory[];
  priorities: FmPriority[];
  technicians: PersonOption[];
  prefill?: WorkOrderPrefill;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(prefill?.title ?? "");
  const [description, setDescription] = useState(prefill?.description ?? "");
  const [locationId, setLocationId] = useState(prefill?.location_id ?? "");
  const [areaId, setAreaId] = useState(prefill?.area_id ?? "");
  const [assetId, setAssetId] = useState(prefill?.asset_id ?? "");
  const [categoryId, setCategoryId] = useState(prefill?.category_id ?? "");
  const [priorityId, setPriorityId] = useState(prefill?.priority_id ?? "");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setError(null);
    if (!title.trim()) return setError("A title is required.");
    if (!locationId) return setError("Location is required.");
    if (!categoryId) return setError("Category is required.");
    if (!priorityId) return setError("Priority is required.");

    setSubmitting(true);
    const res = await createWorkOrder({
      fm_request_id: prefill?.fm_request_id ?? null,
      title,
      description: description || null,
      location_id: locationId,
      area_id: areaId || null,
      asset_id: assetId || null,
      category_id: categoryId,
      priority_id: priorityId,
      assigned_to: assignedTo || null,
      due_date: dueDate || null,
    });
    if (!res.ok) {
      setSubmitting(false);
      setError(res.error);
      return;
    }
    router.push(`/work-orders/${res.data.id}`);
  }

  const backHref = prefill?.fm_request_id ? `/fm-requests/${prefill.fm_request_id}` : "/work-orders";

  return (
    <div className="max-w-3xl">
      <div className="mb-4">
        <Link href={backHref} className="text-sm text-slate-500 hover:text-slate-900">
          &larr; Back
        </Link>
      </div>

      <div className="space-y-6 rounded-lg border border-slate-200 bg-white p-6">
        {prefill?.fm_request_id && (
          <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800">
            Creating a work order from request {prefill.request_number ?? ""}. Review the details below before creating.
          </p>
        )}

        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Job</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Title <span className="text-red-500">*</span>
              </label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Repair leaking shower valve" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
              <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Category <span className="text-red-500">*</span>
                </label>
                <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">Select...</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Priority <span className="text-red-500">*</span>
                </label>
                <Select value={priorityId} onChange={(e) => setPriorityId(e.target.value)}>
                  <option value="">Select...</option>
                  {priorities.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              </div>
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
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Assignment</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Technician</label>
              <Select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
                <option value="">Assign later</option>
                {technicians.map((t) => <option key={t.id} value={t.id}>{personName(t)}</option>)}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Due date</label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
        </section>

        {error && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
          <Link href={backHref}>
            <Button variant="outline" disabled={submitting}>Cancel</Button>
          </Link>
          <Button onClick={submit} isLoading={submitting}>Create work order</Button>
        </div>
      </div>
    </div>
  );
}

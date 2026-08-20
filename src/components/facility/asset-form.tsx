"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AreaWithLocation,
  AssetCategory,
  AssetStatus,
  AssetWithRelations,
  LocationWithAreaCount,
} from "@/lib/types/facility";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createAsset, updateAsset, type AssetInput } from "@/lib/actions/assets";

export function AssetForm({
  mode,
  asset,
  locations,
  areas,
  categories,
  statuses,
}: {
  mode: "create" | "edit";
  asset?: AssetWithRelations;
  locations: LocationWithAreaCount[];
  areas: AreaWithLocation[];
  categories: AssetCategory[];
  statuses: AssetStatus[];
}) {
  const router = useRouter();

  const [name, setName] = useState(asset?.name ?? "");
  const [assetCode, setAssetCode] = useState(asset?.asset_code ?? "");
  const [locationId, setLocationId] = useState(asset?.location_id ?? "");
  const [areaId, setAreaId] = useState(asset?.area_id ?? "");
  const [categoryId, setCategoryId] = useState(asset?.category_id ?? "");
  const [statusId, setStatusId] = useState(
    asset?.status_id ?? statuses.find((s) => s.code === "operational")?.id ?? ""
  );
  const [description, setDescription] = useState(asset?.description ?? "");
  const [manufacturer, setManufacturer] = useState(asset?.manufacturer ?? "");
  const [model, setModel] = useState(asset?.model ?? "");
  const [serial, setSerial] = useState(asset?.serial_number ?? "");
  const [supplier, setSupplier] = useState(asset?.supplier_name ?? "");
  const [purchaseDate, setPurchaseDate] = useState(asset?.purchase_date ?? "");
  const [installDate, setInstallDate] = useState(asset?.installation_date ?? "");
  const [warrantyExpiry, setWarrantyExpiry] = useState(asset?.warranty_expiry ?? "");
  const [expectedLife, setExpectedLife] = useState(
    asset?.expected_life_years != null ? String(asset.expected_life_years) : ""
  );
  const [notes, setNotes] = useState(asset?.notes ?? "");
  const [isActive, setIsActive] = useState(asset?.is_active ?? true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dependent select: only areas belonging to the chosen location.
  const areasForLocation = useMemo(
    () => (locationId ? areas.filter((a) => a.location_id === locationId) : []),
    [areas, locationId]
  );

  function onLocationChange(next: string) {
    setLocationId(next);
    // Clear the area if it no longer belongs to the newly chosen location.
    if (areaId && !areas.some((a) => a.id === areaId && a.location_id === next)) {
      setAreaId("");
    }
  }

  async function submit() {
    setError(null);
    setSaving(true);
    const input: AssetInput = {
      name,
      asset_code: assetCode || null,
      location_id: locationId,
      area_id: areaId,
      category_id: categoryId,
      status_id: statusId,
      description: description || null,
      manufacturer: manufacturer || null,
      model: model || null,
      serial_number: serial || null,
      supplier_name: supplier || null,
      purchase_date: purchaseDate || null,
      installation_date: installDate || null,
      warranty_expiry: warrantyExpiry || null,
      expected_life_years: expectedLife.trim() ? Number(expectedLife) : null,
      notes: notes || null,
      is_active: isActive,
    };

    const res =
      mode === "edit" && asset
        ? await updateAsset(asset.id, input)
        : await createAsset(input);

    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    const id = mode === "edit" && asset ? asset.id : (res.data as { id: string }).id;
    router.push(`/assets/${id}`);
    router.refresh();
  }

  return (
    <div className="max-w-3xl">
      <div className="flex flex-col gap-6">
        <Section title="Identification">
          <Field label="Asset name" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <Field label="Asset code" hint="Unique across Society (optional)">
            <Input value={assetCode} onChange={(e) => setAssetCode(e.target.value)} />
          </Field>
          <Field label="Description">
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </Section>

        <Section title="Placement">
          <Field label="Location" required>
            <Select value={locationId} onChange={(e) => onLocationChange(e.target.value)}>
              <option value="">Select a location…</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Area"
            required
            hint={!locationId ? "Select a location first" : undefined}
          >
            <Select
              value={areaId}
              onChange={(e) => setAreaId(e.target.value)}
              disabled={!locationId}
            >
              <option value="">
                {!locationId
                  ? "Select a location first"
                  : areasForLocation.length === 0
                    ? "No areas in this location"
                    : "Select an area…"}
              </option>
              {areasForLocation.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Category" required>
              <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">Select…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Status" required>
              <Select value={statusId} onChange={(e) => setStatusId(e.target.value)}>
                <option value="">Select…</option>
                {statuses.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Section>

        <Section title="Equipment details">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Manufacturer">
              <Input value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} />
            </Field>
            <Field label="Model">
              <Input value={model} onChange={(e) => setModel(e.target.value)} />
            </Field>
            <Field label="Serial number">
              <Input value={serial} onChange={(e) => setSerial(e.target.value)} />
            </Field>
            <Field label="Supplier">
              <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} />
            </Field>
          </div>
        </Section>

        <Section title="Lifecycle & dates">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Purchase date">
              <Input type="date" value={purchaseDate ?? ""} onChange={(e) => setPurchaseDate(e.target.value)} />
            </Field>
            <Field label="Installation date">
              <Input type="date" value={installDate ?? ""} onChange={(e) => setInstallDate(e.target.value)} />
            </Field>
            <Field label="Warranty expiry">
              <Input type="date" value={warrantyExpiry ?? ""} onChange={(e) => setWarrantyExpiry(e.target.value)} />
            </Field>
          </div>
          <Field label="Expected life (years)">
            <Input
              type="number"
              min={0}
              value={expectedLife}
              onChange={(e) => setExpectedLife(e.target.value)}
              className="sm:w-40"
            />
          </Field>
        </Section>

        <Section title="Additional">
          <Field label="Notes">
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Active (uncheck to retire this asset from the register)
          </label>
        </Section>

        {error && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex items-center gap-2">
          <Button onClick={submit} isLoading={saving}>
            {mode === "edit" ? "Save changes" : "Create asset"}
          </Button>
          <Button variant="outline" onClick={() => router.back()} disabled={saving}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="mb-4 text-sm font-semibold text-slate-900">{title}</h2>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

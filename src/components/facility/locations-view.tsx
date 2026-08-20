"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { LocationWithAreaCount } from "@/lib/types/facility";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import {
  createLocation,
  updateLocation,
  setLocationActive,
  type LocationInput,
} from "@/lib/actions/locations";

export function LocationsView({
  locations,
  canManage,
}: {
  locations: LocationWithAreaCount[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<LocationWithAreaCount | null>(null);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function toggleActive(loc: LocationWithAreaCount) {
    setBusyId(loc.id);
    const res = await setLocationActive(loc.id, !loc.is_active);
    setBusyId(null);
    if (!res.ok) alert(res.error);
    else router.refresh();
  }

  return (
    <div>
      <PageHeader
        title="Locations"
        description="Society sites. Open a location to manage its areas."
        actions={
          canManage ? (
            <Button onClick={() => setCreating(true)}>Add location</Button>
          ) : undefined
        }
      />

      {locations.length === 0 ? (
        <EmptyState title="No locations yet" description="Add your first location to get started." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {locations.map((loc) => (
            <div
              key={loc.id}
              className={[
                "flex flex-col rounded-lg border bg-white p-4",
                loc.is_active ? "border-slate-200" : "border-slate-200 opacity-70",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    href={`/locations/${loc.id}`}
                    className="block truncate font-semibold text-slate-900 hover:underline"
                  >
                    {loc.name}
                  </Link>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {loc.location_type || "—"}
                    {loc.code ? ` · ${loc.code}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {loc.is_protected && <Badge variant="info">Core</Badge>}
                  {!loc.is_active && <Badge variant="neutral">Inactive</Badge>}
                </div>
              </div>

              <p className="mt-3 text-sm text-slate-600">
                {loc.active_area_count} area{loc.active_area_count === 1 ? "" : "s"}
              </p>

              <div className="mt-4 flex items-center gap-2">
                <Link href={`/locations/${loc.id}`} className="flex-1">
                  <Button variant="outline" size="sm" className="w-full">
                    Manage areas
                  </Button>
                </Link>
                {canManage && (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => setEditing(loc)}>
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      isLoading={busyId === loc.id}
                      onClick={() => toggleActive(loc)}
                    >
                      {loc.is_active ? "Deactivate" : "Activate"}
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {canManage && (creating || editing) && (
        <LocationDialog
          location={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function LocationDialog({
  location,
  onClose,
  onSaved,
}: {
  location: LocationWithAreaCount | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!location;
  const [name, setName] = useState(location?.name ?? "");
  const [code, setCode] = useState(location?.code ?? "");
  const [type, setType] = useState(location?.location_type ?? "");
  const [isActive, setIsActive] = useState(location?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    setSaving(true);
    const input: LocationInput = {
      name,
      code: code || null,
      location_type: type || null,
      is_active: isActive,
    };
    const res = isEdit ? await updateLocation(location!.id, input) : await createLocation(input);
    setSaving(false);
    if (!res.ok) setError(res.error);
    else onSaved();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={isEdit ? "Edit location" : "Add location"}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={save} isLoading={saving}>
            {isEdit ? "Save changes" : "Create"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {location?.is_protected && (
          <p className="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-800">
            This is a core Society location. Only a Super Admin can rename it.
          </p>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Code</label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Type</label>
            <Input value={type} onChange={(e) => setType(e.target.value)} placeholder="e.g. Gym" />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Active
        </label>
        {error && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}

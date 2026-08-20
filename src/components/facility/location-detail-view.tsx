"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Area, Location } from "@/lib/types/facility";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SearchField } from "@/components/shared/search-field";
import { EmptyState } from "@/components/ui/empty-state";
import {
  createArea,
  updateArea,
  setAreaActive,
  type AreaInput,
} from "@/lib/actions/areas";

export function LocationDetailView({
  location,
  areas,
  canManage,
}: {
  location: Location;
  areas: Area[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Area | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return areas;
    return areas.filter(
      (a) =>
        a.name.toLowerCase().includes(term) ||
        (a.code ?? "").toLowerCase().includes(term) ||
        (a.area_type ?? "").toLowerCase().includes(term)
    );
  }, [areas, search]);

  async function toggleActive(area: Area) {
    setBusyId(area.id);
    const res = await setAreaActive(area.id, !area.is_active, location.id);
    setBusyId(null);
    if (!res.ok) alert(res.error);
    else router.refresh();
  }

  return (
    <div>
      <div className="mb-4">
        <Link href="/locations" className="text-sm text-slate-500 hover:text-slate-900">
          ← Back to locations
        </Link>
      </div>

      <PageHeader
        title={location.name}
        description={[location.location_type, location.code].filter(Boolean).join(" · ") || "Location"}
        actions={
          canManage ? <Button onClick={() => setCreating(true)}>Add area</Button> : undefined
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {location.is_protected && <Badge variant="info">Core Society location</Badge>}
        <Badge variant={location.is_active ? "success" : "neutral"}>
          {location.is_active ? "Active" : "Inactive"}
        </Badge>
        <Link href={`/assets?location=${location.id}`}>
          <Button variant="outline" size="sm">
            View assets here
          </Button>
        </Link>
      </div>

      <div className="mb-4 max-w-xs">
        <SearchField
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search areas..."
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={areas.length === 0 ? "No areas yet" : "No matching areas"}
          description={
            areas.length === 0
              ? "Add areas like Reception, Men's Gym, or Pool to organize this location."
              : "Try a different search."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <ul className="divide-y divide-slate-100">
            {filtered.map((area) => (
              <li key={area.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-slate-900">{area.name}</span>
                    {!area.is_active && <Badge variant="neutral">Inactive</Badge>}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {[area.area_type, area.floor_or_level, area.code]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </p>
                </div>
                {canManage && (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(area)}>
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      isLoading={busyId === area.id}
                      onClick={() => toggleActive(area)}
                    >
                      {area.is_active ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {canManage && (creating || editing) && (
        <AreaDialog
          locationId={location.id}
          area={editing}
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

function AreaDialog({
  locationId,
  area,
  onClose,
  onSaved,
}: {
  locationId: string;
  area: Area | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!area;
  const [name, setName] = useState(area?.name ?? "");
  const [code, setCode] = useState(area?.code ?? "");
  const [areaType, setAreaType] = useState(area?.area_type ?? "");
  const [floor, setFloor] = useState(area?.floor_or_level ?? "");
  const [description, setDescription] = useState(area?.description ?? "");
  const [isActive, setIsActive] = useState(area?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    setSaving(true);
    const input: AreaInput = {
      location_id: locationId,
      name,
      code: code || null,
      area_type: areaType || null,
      floor_or_level: floor || null,
      description: description || null,
      is_active: isActive,
    };
    const res = isEdit ? await updateArea(area!.id, input) : await createArea(input);
    setSaving(false);
    if (!res.ok) setError(res.error);
    else onSaved();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={isEdit ? "Edit area" : "Add area"}
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
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Type</label>
            <Input value={areaType} onChange={(e) => setAreaType(e.target.value)} placeholder="e.g. Gym" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Floor / Level</label>
            <Input value={floor} onChange={(e) => setFloor(e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Code</label>
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Optional" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
          <Textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional"
          />
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

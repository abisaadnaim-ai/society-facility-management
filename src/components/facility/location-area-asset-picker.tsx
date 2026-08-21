"use client";

import { useMemo } from "react";
import { Select } from "@/components/ui/select";

type LocationOpt = { id: string; name: string };
type AreaOpt = { id: string; name: string; location_id: string; is_active: boolean };
type AssetOpt = { id: string; name: string; location_id: string; area_id: string | null };

/**
 * Dependent Location -> Area -> Asset selector. Location is required; area and
 * asset are optional. Selecting a location clears an incompatible area/asset;
 * selecting an area clears an incompatible asset. When a location has no areas,
 * a clear message is shown instead of an empty dropdown.
 */
export function LocationAreaAssetPicker({
  locations,
  areas,
  assets,
  locationId,
  areaId,
  assetId,
  onLocationChange,
  onAreaChange,
  onAssetChange,
  disabled,
}: {
  locations: LocationOpt[];
  areas: AreaOpt[];
  assets: AssetOpt[];
  locationId: string;
  areaId: string;
  assetId: string;
  onLocationChange: (v: string) => void;
  onAreaChange: (v: string) => void;
  onAssetChange: (v: string) => void;
  disabled?: boolean;
}) {
  const locationAreas = useMemo(
    () => areas.filter((a) => a.is_active && a.location_id === locationId),
    [areas, locationId]
  );

  const locationAssets = useMemo(() => {
    if (!locationId) return [];
    return assets.filter((as) => {
      if (as.location_id !== locationId) return false;
      if (areaId) return as.area_id === areaId;
      return true;
    });
  }, [assets, locationId, areaId]);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Location <span className="text-red-500">*</span>
        </label>
        <Select
          value={locationId}
          disabled={disabled}
          onChange={(e) => {
            onLocationChange(e.target.value);
            onAreaChange("");
            onAssetChange("");
          }}
        >
          <option value="">Select a location...</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Area</label>
        {locationId && locationAreas.length === 0 ? (
          <p className="flex h-9 items-center text-sm text-slate-500">
            No Areas have been configured for this Location.
          </p>
        ) : (
          <Select
            value={areaId}
            disabled={disabled || !locationId}
            onChange={(e) => {
              onAreaChange(e.target.value);
              onAssetChange("");
            }}
          >
            <option value="">Whole location / not specified</option>
            {locationAreas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Asset</label>
        <Select
          value={assetId}
          disabled={disabled || !locationId}
          onChange={(e) => onAssetChange(e.target.value)}
        >
          <option value="">Not asset-specific</option>
          {locationAssets.map((as) => (
            <option key={as.id} value={as.id}>
              {as.name}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}

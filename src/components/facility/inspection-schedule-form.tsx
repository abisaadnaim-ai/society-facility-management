"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { LocationAreaAssetPicker } from "@/components/facility/location-area-asset-picker";
import { createInspectionSchedule } from "@/lib/actions/inspections";
import { FREQUENCY_PRESETS } from "@/lib/types/ppm";
import type { PersonOption } from "@/lib/types/fm";

type LocationOpt = { id: string; name: string };
type AreaOpt = { id: string; name: string; location_id: string; is_active: boolean };
type AssetOpt = { id: string; name: string; location_id: string; area_id: string | null };
type TemplateOpt = { id: string; name: string; template_number: string };

export function InspectionScheduleForm({
  templates, locations, areas, assets, inspectors,
}: {
  templates: TemplateOpt[];
  locations: LocationOpt[];
  areas: AreaOpt[];
  assets: AssetOpt[];
  inspectors: PersonOption[];
}) {
  const router = useRouter();
  const [templateId, setTemplateId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [assetId, setAssetId] = useState("");
  const [assignee, setAssignee] = useState("");
  const [freqKey, setFreqKey] = useState("daily");
  const [customInterval, setCustomInterval] = useState(1);
  const [customUnit, setCustomUnit] = useState("month");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true); setError(null);
    const preset = FREQUENCY_PRESETS.find((p) => p.key === freqKey);
    const unit = preset && !preset.custom ? preset.unit : customUnit;
    const interval = preset && !preset.custom ? preset.interval : customInterval;
    const res = await createInspectionSchedule({
      template_id: templateId, location_id: locationId, area_id: areaId || null, asset_id: assetId || null,
      assigned_to: assignee || null, frequency_unit: unit, frequency_interval: interval,
      start_date: startDate, scheduled_time: time || null,
    });
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    router.push("/inspections/schedules");
  }

  const isCustom = freqKey === "custom";

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div><Link href="/inspections/schedules" className="text-sm text-slate-500 hover:text-slate-900">&larr; Schedules</Link></div>
      <Card>
        <CardHeader><CardTitle>New inspection schedule</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Template <span className="text-red-500">*</span></label>
            <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              <option value="">Select a template...</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.template_number})</option>)}
            </Select>
          </div>

          <LocationAreaAssetPicker
            locations={locations} areas={areas} assets={assets}
            locationId={locationId} areaId={areaId} assetId={assetId}
            onLocationChange={setLocationId} onAreaChange={setAreaId} onAssetChange={setAssetId}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Frequency</label>
              <Select value={freqKey} onChange={(e) => setFreqKey(e.target.value)}>
                {FREQUENCY_PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </Select>
            </div>
            {isCustom && (
              <div className="flex items-end gap-2">
                <div className="w-24">
                  <label className="mb-1 block text-sm font-medium text-slate-700">Every</label>
                  <Input type="number" min={1} value={customInterval} onChange={(e) => setCustomInterval(parseInt(e.target.value || "1", 10))} />
                </div>
                <Select value={customUnit} onChange={(e) => setCustomUnit(e.target.value)}>
                  <option value="day">days</option>
                  <option value="week">weeks</option>
                  <option value="month">months</option>
                  <option value="year">years</option>
                </Select>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Start date <span className="text-red-500">*</span></label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Time (optional)</label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Default inspector</label>
              <Select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                <option value="">Unassigned</option>
                {inspectors.map((i) => <option key={i.id} value={i.id}>{i.full_name || i.email}</option>)}
              </Select>
            </div>
          </div>

          {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <Link href="/inspections/schedules"><Button variant="outline">Cancel</Button></Link>
            <Button isLoading={busy} onClick={submit}>Create schedule</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

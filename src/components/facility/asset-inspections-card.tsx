import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OccurrenceStatusBadge, OverallResultBadge } from "@/components/facility/inspection-badges";
import { formatDate } from "@/lib/format";
import type { InspectionOccurrenceRow } from "@/lib/types/inspections";

/** Light read-only list of recent inspections that touched this asset. */
export function AssetInspectionsCard({ inspections }: { inspections: InspectionOccurrenceRow[] }) {
  if (inspections.length === 0) return null;
  return (
    <Card className="mt-6">
      <CardHeader><CardTitle>Inspections</CardTitle></CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-slate-100">
          {inspections.map((o) => (
            <li key={o.id}>
              <Link href={`/inspections/${o.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{o.template?.name ?? "Inspection"}</p>
                  <p className="text-xs text-slate-500">{o.inspection_number} · {formatDate(o.scheduled_date)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <OverallResultBadge result={o.overall_result} />
                  <OccurrenceStatusBadge status={o.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

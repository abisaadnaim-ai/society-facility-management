import { Badge } from "@/components/ui/badge";
import {
  OCC_STATUS_META,
  RESULT_META,
  FINDING_STATUS_META,
  SCHEDULE_STATUS_META,
  type OccurrenceStatus,
  type OverallResult,
  type FindingStatus,
  type ScheduleStatus,
} from "@/lib/types/inspections";

export function OccurrenceStatusBadge({ status }: { status: string | null }) {
  const meta = OCC_STATUS_META[(status ?? "scheduled") as OccurrenceStatus];
  return <Badge variant={meta?.tone ?? "neutral"}>{meta?.label ?? status ?? "-"}</Badge>;
}

export function OverallResultBadge({ result }: { result: string | null }) {
  if (!result) return null;
  const meta = RESULT_META[result as OverallResult];
  return <Badge variant={meta?.tone ?? "neutral"}>{meta?.label ?? result}</Badge>;
}

export function FindingStatusBadge({ status }: { status: string | null }) {
  const meta = FINDING_STATUS_META[(status ?? "open") as FindingStatus];
  return <Badge variant={meta?.tone ?? "neutral"}>{meta?.label ?? status ?? "-"}</Badge>;
}

export function ScheduleStatusBadge({ status }: { status: string | null }) {
  const meta = SCHEDULE_STATUS_META[(status ?? "active") as ScheduleStatus];
  return <Badge variant={meta?.tone ?? "neutral"}>{meta?.label ?? status ?? "-"}</Badge>;
}

export function ResultChip({ result }: { result: string | null }) {
  if (result === "pass") return <Badge variant="success">Pass</Badge>;
  if (result === "fail") return <Badge variant="danger">Fail</Badge>;
  if (result === "na") return <Badge variant="neutral">N/A</Badge>;
  return <Badge variant="neutral">Not answered</Badge>;
}

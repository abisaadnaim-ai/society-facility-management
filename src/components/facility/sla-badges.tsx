import { Badge } from "@/components/ui/badge";
import {
  liveSlaStatus,
  slaVariant,
  slaLabel,
  type SlaLiveStatus,
} from "@/lib/types/notifications";

/**
 * Response SLA badge for an FM request. Derives the live status from the
 * snapshot columns so open items show Within / Due Soon / Overdue and finalized
 * items show Met / Breached (§9).
 */
export function ResponseSlaBadge(props: {
  targetMinutes: number | null;
  createdAt: string | null;
  responseDueAt: string | null;
  firstRespondedAt: string | null;
  cancelled?: boolean;
}) {
  const status = liveSlaStatus({
    targetMinutes: props.targetMinutes,
    start: props.createdAt,
    due: props.responseDueAt,
    done: props.firstRespondedAt,
    cancelled: props.cancelled ?? false,
  });
  return <SlaBadge status={status} />;
}

/** Resolution SLA badge for a work order (resolution = closed_at). */
export function ResolutionSlaBadge(props: {
  targetMinutes: number | null;
  createdAt: string | null;
  resolutionDueAt: string | null;
  closedAt: string | null;
  cancelled?: boolean;
}) {
  const status = liveSlaStatus({
    targetMinutes: props.targetMinutes,
    start: props.createdAt,
    due: props.resolutionDueAt,
    done: props.closedAt,
    cancelled: props.cancelled ?? false,
  });
  return <SlaBadge status={status} />;
}

export function SlaBadge({ status }: { status: SlaLiveStatus }) {
  if (status === "not_applicable") return <span className="text-xs text-slate-400">—</span>;
  return <Badge variant={slaVariant(status)}>{slaLabel(status)}</Badge>;
}

/** Small "Escalated Ln" indicator for lists/detail. */
export function EscalatedBadge({ level }: { level: number | null | undefined }) {
  if (!level || level < 1) return null;
  return <Badge variant="danger">Escalated L{level}</Badge>;
}

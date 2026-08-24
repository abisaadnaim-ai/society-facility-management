/** Formats an ISO date string as a short human date, or a dash if empty. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** Formats an ISO timestamp as date + time. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Society operates in Qatar; SLA/notification timestamps display in Asia/Qatar (§49). */
const QATAR_TZ = "Asia/Qatar";

/** Formats an ISO timestamp as date + time in Asia/Qatar (UTC+3). */
export function formatDateTimeQatar(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    timeZone: QATAR_TZ,
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/** Compact relative time ("5m", "3h", "2d") for notification lists. */
export function formatRelativeTime(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const secs = Math.round((Date.now() - d.getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDateTimeQatar(value);
}

/** Human-friendly duration from minutes, e.g. 30 → "30m", 240 → "4h", 1440 → "1d". */
export function formatMinutes(mins: number | null | undefined): string {
  if (mins == null) return "—";
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) {
    const h = mins / 60;
    return Number.isInteger(h) ? `${h}h` : `${(mins / 60).toFixed(1)}h`;
  }
  const d = mins / 1440;
  return Number.isInteger(d) ? `${d}d` : `${d.toFixed(1)}d`;
}

/** Human-readable file size. */
export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let i = 0;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Maps an asset status code to a Badge variant. */
export function statusVariant(
  code: string | null | undefined
): "success" | "warning" | "danger" | "neutral" | "info" {
  switch (code) {
    case "operational":
      return "success";
    case "under_maintenance":
    case "awaiting_parts":
    case "awaiting_vendor":
      return "warning";
    case "out_of_service":
      return "danger";
    case "decommissioned":
      return "neutral";
    default:
      return "info";
  }
}

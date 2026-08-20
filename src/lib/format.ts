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

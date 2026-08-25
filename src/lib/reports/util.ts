/** Coerces PostgREST values (numeric columns arrive as strings) to number. */
export function num(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Human duration from seconds: 45m, 2h 30m, 3d 4h, or — when null. */
export function formatDuration(seconds: number | string | null | undefined): string {
  if (seconds == null || seconds === "") return "—";
  const s = Math.round(typeof seconds === "number" ? seconds : Number(seconds));
  if (!Number.isFinite(s) || s < 0) return "—";
  if (s < 60) return `${s}s`;
  const mins = Math.floor(s / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remMin = mins % 60;
  if (hrs < 24) return remMin ? `${hrs}h ${remMin}m` : `${hrs}h`;
  const days = Math.floor(hrs / 24);
  const remHr = hrs % 24;
  return remHr ? `${days}d ${remHr}h` : `${days}d`;
}

/** Formats a percentage value (0–100) or — when null. */
export function formatPct(v: number | string | null | undefined): string {
  if (v == null || v === "") return "—";
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${n % 1 === 0 ? n.toFixed(0) : n.toFixed(1)}%`;
}

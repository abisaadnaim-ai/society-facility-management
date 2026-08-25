/**
 * Phase 9 reporting — global filter + date-range utilities.
 *
 * Timezone handling (spec §36/§37): all timestamps are stored in UTC. Society
 * operates in Asia/Qatar (UTC+3, no DST). A "Qatar-local" reporting day range
 * such as Aug 1 → Aug 31 must be converted to UTC boundaries so records are not
 * dropped at the day edges. We use a half-open interval [fromUtc, toUtc):
 *   fromUtc = Qatar-local 00:00 of the first day
 *   toUtc   = Qatar-local 00:00 of the day AFTER the last day (exclusive)
 */

export const QATAR_TZ = "Asia/Qatar";
const QATAR_OFFSET = "+03:00";

export type DatePreset =
  | "today"
  | "last_7_days"
  | "current_month"
  | "last_30_days"
  | "current_quarter"
  | "current_year"
  | "custom";

export const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "last_7_days", label: "Last 7 Days" },
  { value: "current_month", label: "Current Month" },
  { value: "last_30_days", label: "Last 30 Days" },
  { value: "current_quarter", label: "Current Quarter" },
  { value: "current_year", label: "Current Year" },
  { value: "custom", label: "Custom Range" },
];

export type ReportFilters = {
  preset: DatePreset;
  /** Inclusive Qatar-local calendar dates, YYYY-MM-DD. */
  fromDate: string;
  toDate: string;
  /** Half-open UTC ISO boundaries for created_at/closed_at filtering. */
  fromUtc: string;
  toUtc: string;
  locationId: string | null;
  areaId: string | null;
  priorityId: string | null;
  categoryId: string | null;
};

/** Current calendar date in Asia/Qatar as YYYY-MM-DD. */
export function qatarToday(): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: QATAR_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Adds `days` to a YYYY-MM-DD calendar date, returning YYYY-MM-DD. */
function addDays(isoDate: string, days: number): string {
  // Anchor at noon UTC to avoid any tz/DST edge effects on pure date math.
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** UTC ISO instant for Qatar-local 00:00 of the given calendar date. */
function qatarDayStartUtc(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00${QATAR_OFFSET}`).toISOString();
}

/** Resolves a preset into inclusive Qatar-local {fromDate, toDate}. */
export function presetRange(
  preset: DatePreset,
  customFrom?: string | null,
  customTo?: string | null
): { fromDate: string; toDate: string } {
  const today = qatarToday();
  switch (preset) {
    case "today":
      return { fromDate: today, toDate: today };
    case "last_7_days":
      return { fromDate: addDays(today, -6), toDate: today };
    case "last_30_days":
      return { fromDate: addDays(today, -29), toDate: today };
    case "current_month": {
      const first = `${today.slice(0, 7)}-01`;
      return { fromDate: first, toDate: today };
    }
    case "current_quarter": {
      const [y, m] = today.split("-").map(Number);
      const qStartMonth = Math.floor((m - 1) / 3) * 3 + 1;
      const first = `${y}-${String(qStartMonth).padStart(2, "0")}-01`;
      return { fromDate: first, toDate: today };
    }
    case "current_year":
      return { fromDate: `${today.slice(0, 4)}-01-01`, toDate: today };
    case "custom": {
      const f = customFrom && /^\d{4}-\d{2}-\d{2}$/.test(customFrom) ? customFrom : today;
      const t = customTo && /^\d{4}-\d{2}-\d{2}$/.test(customTo) ? customTo : today;
      // Guard against reversed ranges.
      return f <= t ? { fromDate: f, toDate: t } : { fromDate: t, toDate: f };
    }
  }
}

const VALID_PRESETS = new Set<DatePreset>(DATE_PRESETS.map((p) => p.value));

function cleanId(v: string | undefined | null): string | null {
  if (!v) return null;
  return /^[0-9a-fA-F-]{36}$/.test(v) ? v : null;
}

export type RawSearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Builds fully-resolved ReportFilters from URL search params. */
export function resolveFilters(sp: RawSearchParams): ReportFilters {
  const rawPreset = first(sp.range) as DatePreset | undefined;
  const preset: DatePreset =
    rawPreset && VALID_PRESETS.has(rawPreset) ? rawPreset : "current_month";
  const { fromDate, toDate } = presetRange(preset, first(sp.from), first(sp.to));
  return {
    preset,
    fromDate,
    toDate,
    fromUtc: qatarDayStartUtc(fromDate),
    toUtc: qatarDayStartUtc(addDays(toDate, 1)),
    locationId: cleanId(first(sp.location)),
    areaId: cleanId(first(sp.area)),
    priorityId: cleanId(first(sp.priority)),
    categoryId: cleanId(first(sp.category)),
  };
}

/** Serialises the filter-relevant params into a query string (no leading ?). */
export function filtersToQuery(f: ReportFilters): string {
  const p = new URLSearchParams();
  p.set("range", f.preset);
  if (f.preset === "custom") {
    p.set("from", f.fromDate);
    p.set("to", f.toDate);
  }
  if (f.locationId) p.set("location", f.locationId);
  if (f.areaId) p.set("area", f.areaId);
  if (f.priorityId) p.set("priority", f.priorityId);
  if (f.categoryId) p.set("category", f.categoryId);
  return p.toString();
}

/** Human label for the active range, e.g. "1 Aug 2026 – 24 Aug 2026". */
export function rangeLabel(f: ReportFilters): string {
  const fmt = (d: string) =>
    new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  return f.fromDate === f.toDate
    ? fmt(f.fromDate)
    : `${fmt(f.fromDate)} – ${fmt(f.toDate)}`;
}

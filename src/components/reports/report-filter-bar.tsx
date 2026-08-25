"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DATE_PRESETS } from "@/lib/reports/filters";

type Opt = { id: string; name: string; locationId?: string | null };

const STORAGE_KEY = "society-reports-filters";

export function ReportFilterBar({
  locations,
  areas,
  priorities,
  categories,
}: {
  locations: Opt[];
  areas: Opt[];
  priorities: Opt[];
  categories: Opt[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const range = sp.get("range") ?? "current_month";
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  const location = sp.get("location") ?? "";
  const area = sp.get("area") ?? "";
  const priority = sp.get("priority") ?? "";
  const category = sp.get("category") ?? "";

  // Session persistence (spec §5): when arriving with no filters, restore the
  // last selection used this session; otherwise remember the current one.
  useEffect(() => {
    const current = sp.toString();
    if (!current) {
      const saved = typeof window !== "undefined" ? sessionStorage.getItem(STORAGE_KEY) : null;
      if (saved) router.replace(`${pathname}?${saved}`, { scroll: false });
    } else {
      sessionStorage.setItem(STORAGE_KEY, current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp, pathname]);

  function apply(next: Record<string, string>) {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    // Clear custom dates unless the range is custom.
    if ((next.range ?? range) !== "custom") {
      p.delete("from");
      p.delete("to");
    }
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  }

  const selCls =
    "rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-slate-400 focus:outline-none";
  const visibleAreas = location ? areas.filter((a) => !a.locationId || a.locationId === location) : areas;

  return (
    <div className="mb-6 rounded-lg border border-slate-200 bg-white p-3 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <select className={selCls} value={range} onChange={(e) => apply({ range: e.target.value })} aria-label="Date range">
          {DATE_PRESETS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>

        {range === "custom" && (
          <>
            <input type="date" className={selCls} value={from} max={to || undefined} onChange={(e) => apply({ from: e.target.value })} aria-label="From date" />
            <span className="text-slate-400">–</span>
            <input type="date" className={selCls} value={to} min={from || undefined} onChange={(e) => apply({ to: e.target.value })} aria-label="To date" />
          </>
        )}

        <select className={selCls} value={location} onChange={(e) => apply({ location: e.target.value, area: "" })} aria-label="Location">
          <option value="">All locations</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>

        <select className={selCls} value={area} onChange={(e) => apply({ area: e.target.value })} aria-label="Area">
          <option value="">All areas</option>
          {visibleAreas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>

        <select className={selCls} value={priority} onChange={(e) => apply({ priority: e.target.value })} aria-label="Priority">
          <option value="">All priorities</option>
          {priorities.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <select className={selCls} value={category} onChange={(e) => apply({ category: e.target.value })} aria-label="Category">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {(location || area || priority || category || range !== "current_month") && (
          <button
            type="button"
            onClick={() => router.replace(pathname, { scroll: false })}
            className="rounded-md px-2.5 py-1.5 text-sm text-slate-500 hover:text-slate-900"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}

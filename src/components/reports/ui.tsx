import Link from "next/link";
import type { ReactNode } from "react";

type Tone = "default" | "danger" | "warning" | "success" | "info";

const toneValue: Record<Tone, string> = {
  default: "text-slate-900",
  danger: "text-red-600",
  warning: "text-amber-600",
  success: "text-emerald-600",
  info: "text-slate-900",
};
const toneBorder: Record<Tone, string> = {
  default: "border-slate-200",
  danger: "border-red-200",
  warning: "border-amber-200",
  success: "border-emerald-200",
  info: "border-slate-200",
};

/** A single KPI card. Drill-down when `href` is set (spec §45). */
export function KpiCard({
  label,
  value,
  href,
  tone = "default",
  hint,
  sub,
}: {
  label: string;
  value: number | string;
  href?: string;
  tone?: Tone;
  hint?: string;
  sub?: string;
}) {
  const active = typeof value === "number" ? value > 0 : Boolean(value);
  const effectiveTone: Tone = tone !== "default" && active ? tone : "default";
  const inner = (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500" title={hint}>
        {label}
      </p>
      <p className={["mt-1 text-2xl font-semibold", toneValue[effectiveTone]].join(" ")}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </>
  );
  const cls = [
    "block rounded-lg border bg-white p-4",
    toneBorder[effectiveTone],
    href ? "transition-colors hover:bg-slate-50" : "",
  ].join(" ");
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

export function KpiGrid({ children, cols = 4 }: { children: ReactNode; cols?: 3 | 4 | 6 }) {
  const map = { 3: "sm:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4", 6: "sm:grid-cols-3 lg:grid-cols-6" };
  return <div className={`grid grid-cols-2 gap-3 ${map[cols]}`}>{children}</div>;
}

export function ReportSection({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

export function Empty({ message = "No data available for the selected period." }: { message?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}

export type BarItem = { label: string; value: number; href?: string };

/** Horizontal proportional bar list for a breakdown (spec §24, factual). */
export function BarList({ items, empty }: { items: BarItem[]; empty?: string }) {
  if (!items || items.length === 0) return <Empty message={empty} />;
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <ul className="space-y-2.5">
        {items.map((it, idx) => {
          const pct = Math.round((it.value / max) * 100);
          const row = (
            <div className="flex items-center gap-3">
              <span className="w-40 shrink-0 truncate text-sm text-slate-700" title={it.label}>
                {it.label}
              </span>
              <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <span
                  className="absolute inset-y-0 left-0 rounded-full bg-slate-400"
                  style={{ width: `${pct}%` }}
                />
              </span>
              <span className="w-10 shrink-0 text-right text-sm font-medium text-slate-900">{it.value}</span>
            </div>
          );
          return (
            <li key={`${it.label}-${idx}`}>
              {it.href ? (
                <Link href={it.href} className="block hover:opacity-80">
                  {row}
                </Link>
              ) : (
                row
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export type Column<T> = {
  key: string;
  label: string;
  align?: "left" | "right";
  render?: (row: T) => ReactNode;
};

/** Responsive data table with horizontal scroll on mobile (spec §43). */
export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  getKey,
  empty,
}: {
  columns: Column<T>[];
  rows: T[];
  getKey: (row: T, i: number) => string;
  empty?: string;
}) {
  if (!rows || rows.length === 0) return <Empty message={empty} />;
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            {columns.map((c) => (
              <th
                key={c.key}
                className={["px-3 py-2 font-medium", c.align === "right" ? "text-right" : "text-left"].join(" ")}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, i) => (
            <tr key={getKey(row, i)} className="hover:bg-slate-50">
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={["px-3 py-2 text-slate-700", c.align === "right" ? "text-right tabular-nums" : "text-left"].join(" ")}
                >
                  {c.render ? c.render(row) : String(row[c.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

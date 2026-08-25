"use client";

import { useRouter } from "next/navigation";

/** Triggers the browser print dialog (Print → Save as PDF, spec §30/§31). */
export function PrintButton({ label = "Print / PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50 print:hidden"
    >
      {label}
    </button>
  );
}

/** Navigates to the CSV export route for the current dataset + filters. */
export function ExportCsvButton({ dataset, query }: { dataset: string; query: string }) {
  const router = useRouter();
  const href = `/reports/export?dataset=${dataset}${query ? `&${query}` : ""}`;
  return (
    <button
      type="button"
      onClick={() => router.push(href)}
      className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50 print:hidden"
    >
      Export CSV
    </button>
  );
}

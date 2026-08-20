import type { ReactNode } from "react";

export function TableShell({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-left text-sm">{children}</table>
      </div>
    </div>
  );
}

export function TableHead({ children }: { children: ReactNode }) {
  return <thead className="border-b border-slate-200 bg-slate-50">{children}</thead>;
}

export function TableHeaderCell({ children }: { children: ReactNode }) {
  return (
    <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </th>
  );
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-slate-100">{children}</tbody>;
}

export function TableRow({ children }: { children: ReactNode }) {
  return <tr className="hover:bg-slate-50">{children}</tr>;
}

export function TableCell({ children }: { children: ReactNode }) {
  return <td className="whitespace-nowrap px-4 py-2.5 text-slate-700">{children}</td>;
}

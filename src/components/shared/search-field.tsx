import type { InputHTMLAttributes } from "react";

export function SearchField(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        placeholder="Search..."
        className="h-9 w-full rounded-md border border-slate-300 bg-white pl-8 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
        {...props}
      />
    </div>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="m20 20-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

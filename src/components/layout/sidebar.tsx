import Link from "next/link";
import { NAV_ITEMS } from "@/lib/nav-items";

export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white md:block">
      <div className="flex h-14 items-center border-b border-slate-200 px-4">
        <span className="text-sm font-semibold text-slate-900">
          Society Facility Management
        </span>
      </div>
      <nav className="flex flex-col gap-0.5 p-2">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

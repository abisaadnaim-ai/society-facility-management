import { NavLinks } from "@/components/layout/nav-links";

export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white md:block">
      <div className="flex h-14 items-center border-b border-slate-200 px-4">
        <span className="text-sm font-semibold text-slate-900">
          Society Facility Management
        </span>
      </div>
      <NavLinks />
    </aside>
  );
}

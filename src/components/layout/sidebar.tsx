import { NavLinks } from "@/components/layout/nav-links";
import { BrandLogo } from "@/components/layout/brand-logo";

export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white md:block">
      <div className="flex h-14 items-center gap-2 border-b border-slate-200 px-4">
        <BrandLogo size={26} withWordmark wordmarkClassName="text-sm font-semibold leading-tight text-slate-900" />
      </div>
      <NavLinks />
    </aside>
  );
}

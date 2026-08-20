export function Header() {
  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4">
      <span className="text-sm font-medium text-slate-500 md:hidden">
        Society Facility Management
      </span>
      <div className="ml-auto flex items-center gap-3">
        <span className="text-sm text-slate-500">Profile menu — Phase 1</span>
      </div>
    </header>
  );
}

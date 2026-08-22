"use client";

import { useSession } from "@/lib/auth/session-context";
import { usePageTitle } from "@/lib/use-page-title";
import { displayRoleName } from "@/lib/auth/permissions";
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { SignOutMenuItem } from "@/components/shared/sign-out-menu-item";
import { BrandLogo } from "@/components/layout/brand-logo";

export function Header({ onOpenMobileNav }: { onOpenMobileNav?: () => void }) {
  const profile = useSession();
  const pageTitle = usePageTitle();
  const initials = getInitials(profile.full_name ?? profile.email ?? "?");

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4">
      {onOpenMobileNav && (
        <button
          onClick={onOpenMobileNav}
          aria-label="Open menu"
          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 md:hidden"
        >
          <MenuIcon />
        </button>
      )}

      <span className="md:hidden">
        <BrandLogo size={24} />
      </span>

      <h1 className="truncate text-sm font-semibold text-slate-900">{pageTitle}</h1>

      <div className="ml-auto flex items-center gap-3">
        <button
          type="button"
          aria-label="Notifications (coming soon)"
          disabled
          className="hidden rounded-md p-2 text-slate-400 sm:block"
          title="Notifications will be available in a future phase"
        >
          <BellIcon />
        </button>

        <DropdownMenu
          trigger={
            <span className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-slate-100">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                {initials}
              </span>
              <span className="hidden text-left sm:block">
                <span className="block text-sm font-medium leading-tight text-slate-900">
                  {profile.full_name ?? profile.email}
                </span>
                <span className="block text-xs leading-tight text-slate-500">
                  {displayRoleName(profile)}
                </span>
              </span>
            </span>
          }
        >
          <div className="px-3 py-2 sm:hidden">
            <p className="text-sm font-medium text-slate-900">{profile.full_name ?? profile.email}</p>
            <p className="text-xs text-slate-500">{displayRoleName(profile)}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem>Profile settings (coming soon)</DropdownMenuItem>
          <DropdownMenuSeparator />
          <SignOutMenuItem />
        </DropdownMenu>
      </div>
    </header>
  );
}

function getInitials(nameOrEmail: string): string {
  const trimmed = nameOrEmail.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

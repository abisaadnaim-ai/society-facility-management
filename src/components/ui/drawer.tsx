"use client";

import { useEffect, type ReactNode } from "react";

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  side?: "left" | "right";
  children?: ReactNode;
}

/**
 * Lightweight slide-in panel with a backdrop. Used for the mobile nav drawer
 * and can be reused for any future side-panel needs. Not built on <dialog>
 * because we want a persistent, animatable off-canvas panel rather than a
 * centered modal.
 */
export function Drawer({ open, onClose, title, side = "left", children }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <div
        className="absolute inset-0 bg-slate-900/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={[
          "absolute top-0 h-full w-72 max-w-[85vw] bg-white shadow-xl",
          side === "left" ? "left-0" : "right-0",
        ].join(" ")}
      >
        {title && (
          <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4">
            <span className="text-sm font-semibold text-slate-900">{title}</span>
            <button
              onClick={onClose}
              aria-label="Close menu"
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            >
              <CloseIcon />
            </button>
          </div>
        )}
        <div className="h-[calc(100%-3.5rem)] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

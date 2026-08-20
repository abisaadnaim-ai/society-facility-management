"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export interface DropdownMenuProps {
  trigger: ReactNode;
  align?: "left" | "right";
  children: ReactNode;
}

export function DropdownMenu({ trigger, align = "right", children }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center"
      >
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          className={[
            "absolute z-40 mt-2 min-w-[12rem] rounded-md border border-slate-200 bg-white py-1 shadow-lg",
            align === "right" ? "right-0" : "left-0",
          ].join(" ")}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function DropdownMenuItem({
  children,
  onClick,
  danger,
}: {
  children: ReactNode;
  onClick?: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={[
        "block w-full px-3 py-2 text-left text-sm hover:bg-slate-50",
        danger ? "text-red-600" : "text-slate-700",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export function DropdownMenuSeparator() {
  return <div className="my-1 border-t border-slate-200" role="separator" />;
}

"use client";

import { useEffect, useRef, type ReactNode } from "react";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
}

/**
 * Built on the native <dialog> element, which gives us focus trapping,
 * Escape-to-close, and backdrop rendering for free, without pulling in a
 * dependency for something this standard already does well.
 */
export function Dialog({ open, onClose, title, description, children, footer }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={[
        "w-full max-w-md rounded-lg border border-slate-200 bg-white p-0 shadow-lg",
        "backdrop:bg-slate-900/40",
      ].join(" ")}
      aria-labelledby="dialog-title"
    >
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 id="dialog-title" className="text-sm font-semibold text-slate-900">
          {title}
        </h2>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {children && <div className="px-5 py-4">{children}</div>}
      {footer && <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">{footer}</div>}
    </dialog>
  );
}

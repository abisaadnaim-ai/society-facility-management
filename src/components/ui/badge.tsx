import type { HTMLAttributes } from "react";

type BadgeVariant = "neutral" | "success" | "warning" | "danger" | "info";

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  neutral: "bg-slate-100 text-slate-700",
  success: "bg-emerald-100 text-emerald-800",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-red-100 text-red-800",
  info: "bg-blue-100 text-blue-800",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ variant = "neutral", className = "", children, ...props }: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        VARIANT_CLASSES[variant],
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </span>
  );
}

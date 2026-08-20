import { forwardRef, type SelectHTMLAttributes } from "react";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ error, className = "", children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={[
          "h-9 w-full rounded-md border bg-white px-3 text-sm text-slate-900",
          "focus:outline-none focus:ring-2 focus:ring-offset-0",
          error
            ? "border-red-400 focus:ring-red-300"
            : "border-slate-300 focus:ring-slate-400",
          "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
          className,
        ].join(" ")}
        {...props}
      >
        {children}
      </select>
    );
  }
);

Select.displayName = "Select";

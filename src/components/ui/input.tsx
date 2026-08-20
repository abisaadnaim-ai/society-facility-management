import { forwardRef, type InputHTMLAttributes } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error, className = "", ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={[
          "h-9 w-full rounded-md border bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400",
          "focus:outline-none focus:ring-2 focus:ring-offset-0",
          error
            ? "border-red-400 focus:ring-red-300"
            : "border-slate-300 focus:ring-slate-400",
          "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
          className,
        ].join(" ")}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";

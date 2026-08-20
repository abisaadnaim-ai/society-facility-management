import { forwardRef, type TextareaHTMLAttributes } from "react";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error, className = "", ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={[
          "w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400",
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

Textarea.displayName = "Textarea";

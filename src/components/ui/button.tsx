import { forwardRef, type ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "destructive";
type ButtonSize = "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-300",
  secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200 disabled:bg-slate-50 disabled:text-slate-400",
  outline: "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 disabled:text-slate-400",
  ghost: "text-slate-700 hover:bg-slate-100 disabled:text-slate-300",
  destructive: "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-9 px-4 text-sm",
  lg: "h-10 px-5 text-base",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", isLoading, disabled, className = "", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={[
          "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900",
          "disabled:cursor-not-allowed",
          VARIANT_CLASSES[variant],
          SIZE_CLASSES[size],
          className,
        ].join(" ")}
        {...props}
      >
        {isLoading && (
          <span
            className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden="true"
          />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

import type { HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={["rounded-lg border border-slate-200 bg-white", className].join(" ")}
      {...props}
    />
  );
}

export function CardHeader({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={["border-b border-slate-200 px-5 py-4", className].join(" ")}
      {...props}
    />
  );
}

export function CardTitle({ className = "", ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={["text-sm font-semibold text-slate-900", className].join(" ")}
      {...props}
    />
  );
}

export function CardContent({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={["px-5 py-4", className].join(" ")} {...props} />;
}

export function CardFooter({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={["border-t border-slate-200 px-5 py-3", className].join(" ")}
      {...props}
    />
  );
}

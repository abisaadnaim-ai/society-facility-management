import type { ReactNode } from "react";

export function ErrorState({
  title = "Something went wrong",
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-6 py-16 text-center">
      <h3 className="text-sm font-semibold text-red-800">{title}</h3>
      {description && <p className="max-w-sm text-sm text-red-700">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

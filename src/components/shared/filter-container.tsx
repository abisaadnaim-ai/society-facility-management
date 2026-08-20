import type { ReactNode } from "react";

export function FilterContainer({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      {children}
    </div>
  );
}

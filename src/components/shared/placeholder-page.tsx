export function PlaceholderPage({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
      <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
      <p className="mt-1 text-sm text-slate-500">
        {description ?? "This module hasn't been built yet."}
      </p>
    </div>
  );
}

export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <span
        className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900"
        aria-hidden="true"
      />
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}

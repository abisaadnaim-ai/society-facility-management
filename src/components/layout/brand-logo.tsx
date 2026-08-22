import Image from "next/image";

/**
 * Society brand mark. Uses the official logo asset in /public; do not restyle
 * or recolor it. `withWordmark` adds the application name beside the mark.
 */
export function BrandLogo({
  size = 28,
  withWordmark = false,
  wordmarkClassName = "text-sm font-semibold text-slate-900",
  label = "Society Facility Management",
}: {
  size?: number;
  withWordmark?: boolean;
  wordmarkClassName?: string;
  label?: string;
}) {
  return (
    <span className="flex items-center gap-2">
      <Image
        src="/society-logo.png"
        alt="Society"
        width={size}
        height={size}
        priority
        className="shrink-0"
      />
      {withWordmark && <span className={wordmarkClassName}>{label}</span>}
    </span>
  );
}

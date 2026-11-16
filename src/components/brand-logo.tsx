import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

type BrandLogoProps = {
  href?: string;
  showTagline?: boolean;
  compact?: boolean;
  hideWordmark?: boolean;
};

export function BrandLogo({
  href,
  showTagline = false,
  compact = false,
  hideWordmark = false,
}: BrandLogoProps) {
  const content = (
    <div className="flex items-center gap-3">
      <BrandMark className={compact ? "h-10 w-10 shrink-0" : "h-12 w-12 shrink-0"} />

      {!hideWordmark ? (
        <span className="min-w-0">
          <span className={`${compact ? "text-base" : "text-lg"} brand-wordmark block font-bold tracking-[-0.05em] text-slate-100`}>
            GoHostlyx
          </span>
          {showTagline ? (
            <span className="block text-[11px] uppercase tracking-[0.22em] text-slate-500">
              Finance OS
            </span>
          ) : null}
        </span>
      ) : null}
    </div>
  );

  if (!href) {
    return content;
  }

  return (
    <Link href={href} className="inline-flex" aria-label={hideWordmark ? "GoHostlyx" : undefined}>
      {content}
    </Link>
  );
}

import Link from "next/link";

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
      <span className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-[20px] border border-[color:var(--accent-soft-strong)] bg-[linear-gradient(180deg,rgba(88,196,182,0.2)_0%,rgba(10,21,36,0.98)_100%)] shadow-[0_14px_30px_rgba(7,17,28,0.32)]">
        <span className="absolute inset-[1px] rounded-[15px] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_48%),linear-gradient(180deg,rgba(9,17,29,0.12)_0%,rgba(9,17,29,0.5)_100%)]" />
        <svg
          viewBox="0 0 64 64"
          aria-hidden="true"
          className="relative h-8 w-8"
          fill="none"
        >
          <path
            d="M13 30L32 15L51 30"
            stroke="rgba(216,251,245,0.96)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M18 30V46C18 48.2 19.8 50 22 50H42C44.2 50 46 48.2 46 46V30"
            stroke="rgba(216,251,245,0.9)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect x="23" y="40" width="5" height="8" rx="1.6" fill="rgba(88,196,182,0.98)" />
          <rect x="29.5" y="36" width="5" height="12" rx="1.6" fill="rgba(88,196,182,0.98)" />
          <rect x="36" y="31.5" width="5" height="16.5" rx="1.6" fill="rgba(216,251,245,0.96)" />
        </svg>
      </span>

      {!hideWordmark ? (
        <span className="min-w-0">
          <span className={`${compact ? "text-base" : "text-lg"} block font-semibold tracking-[-0.05em] text-slate-100`}>
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
    <Link href={href} className="inline-flex">
      {content}
    </Link>
  );
}

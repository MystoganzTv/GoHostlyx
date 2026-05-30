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
            d="M14 30L32 16L50 30"
            stroke="rgba(216,251,245,0.96)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M19 29V45C19 47.2 20.8 49 23 49H41C43.2 49 45 47.2 45 45V29"
            stroke="rgba(88,196,182,0.98)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M27 49V39C27 37.3 28.3 36 30 36H34C35.7 36 37 37.3 37 39V49"
            stroke="rgba(216,251,245,0.9)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M32 24L36 28L32 32L28 28L32 24Z"
            stroke="rgba(216,251,245,0.9)"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          <path
            d="M47 15L48.1 18.1L51.2 19.2L48.1 20.3L47 23.4L45.9 20.3L42.8 19.2L45.9 18.1L47 15Z"
            fill="rgba(216,251,245,0.96)"
          />
        </svg>
      </span>

      {!hideWordmark ? (
        <span className="min-w-0">
          <span className={`${compact ? "text-base" : "text-lg"} block font-semibold tracking-[-0.05em] text-slate-100`}>
            Hostlyx
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

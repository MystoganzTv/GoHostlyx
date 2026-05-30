import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { LanguageToggle } from "@/components/language-toggle";
import { MarketingFooter } from "@/components/marketing-footer";
import type { AppLocale } from "@/lib/i18n";

export function LegalPageShell({
  eyebrow,
  title,
  description,
  children,
  locale = "en",
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  locale?: AppLocale;
}) {
  const isSpanish = locale === "es";

  return (
    <>
      <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-10 sm:px-6 xl:px-8">
        <div className="rounded-[34px] border border-white/8 bg-[linear-gradient(180deg,rgba(12,23,39,0.86)_0%,rgba(8,17,28,0.78)_100%)] p-6 shadow-[0_24px_60px_rgba(3,8,16,0.24)] sm:p-8">
          <div className="flex flex-col gap-8 border-b border-white/8 pb-8 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-5">
              <BrandLogo href="/" showTagline />
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                {isSpanish ? "Volver al inicio" : "Back to home"}
              </Link>
              <LanguageToggle compact />
            </div>

            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent-text)]">
                {eyebrow}
              </p>
              <h1 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-slate-100 sm:text-5xl">
                {title}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-8 text-slate-300">
                {description}
              </p>
            </div>
          </div>

          <div className="mt-8 space-y-8 text-[15px] leading-8 text-slate-300">
            {children}
          </div>
        </div>
      </main>

      <MarketingFooter locale={locale} />
    </>
  );
}

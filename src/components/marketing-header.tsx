"use client";

import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { LanguageToggle } from "@/components/language-toggle";
import { useLocale } from "@/components/locale-provider";

function navLinkClassName(active: boolean) {
  return active
    ? "text-slate-100"
    : "text-slate-400 transition hover:text-slate-100";
}

export function MarketingHeader({
  activePage,
  signedIn,
}: {
  activePage: "home" | "pricing" | "showcase";
  signedIn: boolean;
}) {
  const { t } = useLocale();

  return (
    <header className="mx-auto w-full max-w-7xl px-4 pt-5 sm:px-6 xl:px-8">
      <div className="flex flex-col gap-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <BrandLogo href="/" showTagline />
          <span className="hidden text-sm text-slate-400 lg:inline">
            {t("marketing.tagline")}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-5">
          <LanguageToggle />
          <nav className="flex flex-wrap items-center gap-4 text-sm">
            <Link href="/" className={navLinkClassName(activePage === "home")}>
              {t("nav.home")}
            </Link>
            <Link href="/pricing" className={navLinkClassName(activePage === "pricing")}>
              {t("nav.pricing")}
            </Link>
            <Link href="/showcase" className={navLinkClassName(activePage === "showcase")}>
              {t("nav.showcase")}
            </Link>
          </nav>

          <Link
            href={signedIn ? "/dashboard" : "/login"}
            className="brand-button rounded-2xl px-4 py-3 text-sm font-semibold transition"
          >
            {signedIn ? t("marketing.openDashboard") : t("marketing.signIn")}
          </Link>
        </div>
      </div>
    </header>
  );
}

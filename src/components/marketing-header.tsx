import Link from "next/link";
import { Menu } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { LanguageToggle } from "@/components/language-toggle";
import type { AppLocale } from "@/lib/i18n";

function navLinkClassName(active: boolean) {
  return active
    ? "text-slate-100"
    : "text-slate-400 transition hover:text-slate-100";
}

export function MarketingHeader({
  activePage,
  signedIn,
  primaryHref,
  locale,
}: {
  activePage: "home" | "pricing";
  signedIn: boolean;
  primaryHref: string;
  locale: AppLocale;
}) {
  const isSpanish = locale === "es";
  const navItems = [
    { label: isSpanish ? "Inicio" : "Home", href: activePage === "home" ? "#hero" : "/#hero", active: activePage === "home" },
    { label: isSpanish ? "Problema" : "Problem", href: activePage === "home" ? "#problem" : "/#problem", active: false },
    { label: isSpanish ? "Solución" : "Solution", href: activePage === "home" ? "#solution" : "/#solution", active: false },
    { label: isSpanish ? "Funciones" : "Features", href: activePage === "home" ? "#features" : "/#features", active: false },
    { label: isSpanish ? "Precios" : "Pricing", href: activePage === "pricing" ? "/pricing" : "#pricing", active: activePage === "pricing" },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-white/8 bg-[rgba(9,16,28,0.82)] backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1680px] items-center justify-between gap-8 px-4 py-4 sm:px-6 xl:px-8">
        <div className="shrink-0">
          <BrandLogo href="/" showTagline />
        </div>

        <nav className="hidden flex-1 items-center justify-center gap-10 text-sm font-medium lg:flex xl:gap-14">
          {navItems.map((item) => (
            <Link key={item.label} href={item.href} className={navLinkClassName(item.active)}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden shrink-0 items-center gap-3 lg:flex">
          <LanguageToggle compact />
          <Link
            href={signedIn ? primaryHref : "/login"}
            className="rounded-2xl px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.04] hover:text-slate-100"
          >
            {signedIn ? "Dashboard" : isSpanish ? "Iniciar sesión" : "Sign in"}
          </Link>
          <Link
            href={primaryHref}
            className="brand-button inline-flex items-center justify-center rounded-2xl px-5 py-2.5 text-sm font-semibold transition"
          >
            {signedIn ? (isSpanish ? "Abrir app" : "Open app") : isSpanish ? "Empieza gratis" : "Start free"}
          </Link>
        </div>

        <details className="relative ml-auto lg:hidden">
          <summary
            aria-label={isSpanish ? "Abrir menú" : "Open menu"}
            className="flex list-none items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-slate-200 transition hover:bg-white/[0.08] [&::-webkit-details-marker]:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </summary>

          <div className="absolute right-0 top-[calc(100%+0.75rem)] w-72 rounded-[24px] border border-white/10 bg-[rgba(9,16,28,0.96)] p-4 shadow-[0_24px_60px_rgba(2,6,23,0.32)] backdrop-blur-xl">
            <div className="mb-4">
              <LanguageToggle compact className="w-full justify-center" />
            </div>

            <nav className="space-y-2">
              {navItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="block rounded-2xl px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/[0.04] hover:text-slate-100"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="mt-4 grid gap-2">
              <Link
                href={signedIn ? primaryHref : "/login"}
                className="rounded-2xl border border-white/10 px-4 py-3 text-center text-sm font-semibold text-slate-200 transition hover:bg-white/[0.04]"
              >
                {signedIn ? "Dashboard" : isSpanish ? "Iniciar sesión" : "Sign in"}
              </Link>
              <Link
                href={primaryHref}
                className="brand-button inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition"
              >
                {signedIn ? (isSpanish ? "Abrir app" : "Open app") : isSpanish ? "Empieza gratis" : "Start free"}
              </Link>
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}

"use client";

import { useRef } from "react";
import Link from "next/link";
import { ArrowUpRight, Menu } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { LanguageToggle } from "@/components/language-toggle";
import type { AppLocale } from "@/lib/i18n";

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
  const mobileMenu = useRef<HTMLDetailsElement>(null);
  const isSpanish = locale === "es";
  const home = activePage === "home";
  const ctaLabel = signedIn
    ? (isSpanish ? "Abrir app" : "Open app")
    : (isSpanish ? "Probar gratis" : "Start free trial");
  const signInLabel = isSpanish ? "Iniciar sesión" : "Sign in";
  const navLabel = isSpanish ? "Navegación principal" : "Main navigation";
  const navItems = [
    { label: isSpanish ? "Producto" : "Product", href: home ? "#features" : "/#features" },
    { label: isSpanish ? "Cómo funciona" : "How it works", href: home ? "#preview" : "/#preview" },
    { label: isSpanish ? "Precios" : "Pricing", href: "/pricing" },
  ];

  function closeMenu() {
    if (mobileMenu.current) mobileMenu.current.open = false;
  }

  return (
    <header className="marketing-header sticky top-0 z-40 border-b border-white/8 bg-[rgba(9,16,28,0.88)] backdrop-blur-xl">
      <div className="mx-auto flex min-h-[72px] w-full max-w-[1320px] items-center justify-between gap-4 px-5 sm:px-8 xl:px-10">
        <BrandLogo href="/" compact />

        <nav aria-label={navLabel} className="hidden items-center gap-8 text-sm font-semibold lg:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={!home && item.href === "/pricing" ? "page" : undefined}
              className="marketing-header-link text-slate-300 transition hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden shrink-0 items-center gap-4 lg:flex">
          <LanguageToggle compact variant="marketing" />
          {!signedIn ? (
            <Link href="/login" className="marketing-header-link text-sm font-semibold text-slate-300 hover:text-white">
              {signInLabel}
            </Link>
          ) : null}
          <Link href={primaryHref} className="brand-button inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition">
            {ctaLabel}
            <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </div>

        <details ref={mobileMenu} className="relative ml-auto lg:hidden">
          <summary
            aria-label={isSpanish ? "Menú principal" : "Main menu"}
            className="marketing-header-menu flex size-11 cursor-pointer list-none items-center justify-center rounded-full border border-white/15 text-slate-200 [&::-webkit-details-marker]:hidden"
          >
            <Menu size={21} aria-hidden="true" />
          </summary>

          <div className="marketing-header-popover absolute right-0 top-[calc(100%+0.65rem)] w-[min(17rem,calc(100vw-2.5rem))] rounded-2xl border border-white/10 bg-[#101c29] p-4 shadow-xl">
            <nav aria-label={navLabel} className="grid gap-1 text-sm font-semibold">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMenu}
                  aria-current={!home && item.href === "/pricing" ? "page" : undefined}
                  className="marketing-header-link rounded-xl px-3 py-2.5 text-slate-200 hover:bg-white/5"
                >
                  {item.label}
                </Link>
              ))}
              {!signedIn ? (
                <Link href="/login" onClick={closeMenu} className="marketing-header-link rounded-xl px-3 py-2.5 text-slate-200 hover:bg-white/5">
                  {signInLabel}
                </Link>
              ) : null}
            </nav>
            <Link href={primaryHref} onClick={closeMenu} className="brand-button mb-4 mt-3 flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold">
              {ctaLabel}
              <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
            <LanguageToggle compact variant="marketing" />
          </div>
        </details>
      </div>
    </header>
  );
}

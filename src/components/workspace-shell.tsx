"use client";

import { type ReactNode, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  Shield,
  BookOpenText,
  Building2,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronsLeft,
  ChevronsRight,
  DatabaseZap,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  X,
  ReceiptText,
  FileText,
  Scale,
  Settings2,
  Wallet,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { LanguageToggle } from "@/components/language-toggle";
import { useLocale } from "@/components/locale-provider";
import { SignOutButton } from "@/components/auth-buttons";
import { isAdminOwnerEmail } from "@/lib/admin";
import { formatDateLabel } from "@/lib/format";
import type { CurrencyCode, ImportSummary } from "@/lib/types";

type ActivePage =
  | "dashboard"
  | "calendar"
  | "monthly"
  | "bookings"
  | "expenses"
  | "payouts"
  | "cashflow"
  | "reconcile"
  | "performance"
  | "reports"
  | "admin"
  | "imports"
  | "properties"
  | "settings";
const sidebarStorageKey = "gohostlyx:sidebar-collapsed";

type SubscriptionBadge = {
  label: string;
  detail?: string;
  tone?: "trial" | "expired" | "starter" | "pro" | "portfolio";
};

type ReconcileBadge = {
  label: string;
  tone?: "caution" | "neutral";
};

const baseNavItems: Array<{
  id: ActivePage;
  label: { en: string; es: string };
  href: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: "dashboard", label: { en: "Dashboard", es: "Dashboard" }, href: "/dashboard", icon: LayoutDashboard },
  { id: "calendar", label: { en: "Calendar", es: "Calendario" }, href: "/dashboard/calendar", icon: CalendarDays },
  { id: "bookings", label: { en: "Bookings", es: "Reservas" }, href: "/dashboard/bookings", icon: BookOpenText },
  { id: "expenses", label: { en: "Expenses", es: "Gastos" }, href: "/dashboard/expenses", icon: ReceiptText },
  { id: "payouts", label: { en: "Payouts", es: "Liquidaciones" }, href: "/dashboard/payouts", icon: Landmark },
  { id: "cashflow", label: { en: "Operating Flow", es: "Flujo operativo" }, href: "/dashboard/cashflow", icon: Wallet },
  { id: "reconcile", label: { en: "Reconcile", es: "Conciliar" }, href: "/dashboard/reconcile", icon: Scale },
  { id: "performance", label: { en: "Performance", es: "Rendimiento" }, href: "/dashboard/performance", icon: ChartNoAxesCombined },
  { id: "reports", label: { en: "Reports", es: "Informes" }, href: "/dashboard/reports", icon: FileText },
  { id: "imports", label: { en: "Import Center", es: "Centro de importación" }, href: "/dashboard/imports", icon: DatabaseZap },
];

function navClassName(active: boolean) {
  return active
    ? "workspace-sidebar-link-active flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold"
    : "workspace-sidebar-link flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition";
}

const sidebarPreferenceEvent = "gohostlyx:sidebar-preference";

function readSidebarPreference() {
  try {
    return window.localStorage.getItem(sidebarStorageKey) === "true";
  } catch {
    return false;
  }
}

function writeSidebarPreference(collapsed: boolean) {
  try {
    window.localStorage.setItem(sidebarStorageKey, String(collapsed));
  } catch {
    // Storage unavailable (private mode): the toggle still works for this event.
  }
  window.dispatchEvent(new Event(sidebarPreferenceEvent));
}

function subscribeToSidebarPreference(onChange: () => void) {
  window.addEventListener(sidebarPreferenceEvent, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(sidebarPreferenceEvent, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function WorkspaceShell({
  activePage,
  pageTitle,
  pageSubtitle,
  businessName,
  userName,
  userEmail,
  currencyCode,
  latestImport,
  subscriptionBadge,
  reconcileBadge,
  stickyHeader = false,
  stickyContent,
  contentScrollable = true,
  actions,
  children,
}: {
  activePage: ActivePage;
  pageTitle: string;
  pageSubtitle: string;
  businessName: string;
  userName: string;
  userEmail: string;
  currencyCode: CurrencyCode;
  latestImport: ImportSummary | null;
  subscriptionBadge?: SubscriptionBadge;
  reconcileBadge?: ReconcileBadge | null;
  stickyHeader?: boolean;
  stickyContent?: ReactNode;
  contentScrollable?: boolean;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { locale } = useLocale();
  const isSpanish = locale === "es";
  // The collapsed preference lives in localStorage. useSyncExternalStore renders
  // "expanded" on the server and during hydration, then the saved value, so the
  // server and client HTML always match (reading storage during the first
  // render caused a hydration error).
  const isSidebarCollapsed = useSyncExternalStore(
    subscribeToSidebarPreference,
    readSidebarPreference,
    () => false,
  );
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // The mobile drawer always shows the full menu.
  const isCollapsed = isSidebarCollapsed && !isMobileMenuOpen;

  function toggleSidebar() {
    writeSidebarPreference(!isSidebarCollapsed);
  }

  function subscriptionBadgeClassName(tone: SubscriptionBadge["tone"]) {
    if (tone === "expired") {
      return "border-rose-300/20 bg-rose-400/10 text-rose-100";
    }

    if (tone === "pro" || tone === "portfolio") {
      return "border-emerald-300/20 bg-emerald-400/10 text-emerald-100";
    }

    return "border-white/10 bg-white/[0.05] text-white";
  }

  function subscriptionTimerClassName(tone: SubscriptionBadge["tone"]) {
    if (tone === "expired") {
      return "border-rose-300/16 bg-rose-400/10 text-rose-100";
    }

    return "border-amber-300/16 bg-amber-400/10 text-amber-50";
  }

  const mainNavItems = baseNavItems;
  const adminNavItem = isAdminOwnerEmail(userEmail)
    ? {
        id: "admin" as const,
        label: isSpanish ? "Panel admin" : "Admin Panel",
        href: "/dashboard/admin",
        icon: Shield,
      }
    : null;

  return (
    <main className="min-h-screen bg-[var(--workspace-bg)] px-4 py-5 sm:px-6 xl:h-screen xl:overflow-hidden xl:p-0">
      <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-5 xl:h-screen xl:flex-row xl:items-stretch xl:gap-0">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--workspace-border)] pb-3 xl:hidden">
          <BrandLogo href="/dashboard" compact />
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label={isSpanish ? "Abrir menú" : "Open menu"}
            aria-expanded={isMobileMenuOpen}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
          >
            <Menu className="h-4 w-4" />
            {isSpanish ? "Menú" : "Menu"}
          </button>
        </div>

        {isMobileMenuOpen ? (
          <button
            type="button"
            aria-label={isSpanish ? "Cerrar menú" : "Close menu"}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 z-40 bg-[rgba(2,6,23,0.7)] backdrop-blur-sm xl:hidden"
          />
        ) : null}

        <aside
          className={`border-[var(--workspace-sidebar-border)] bg-[var(--workspace-bg)] max-xl:rounded-[24px] max-xl:border xl:static xl:rounded-none xl:border-0 xl:border-r xl:bg-transparent xl:z-auto xl:block xl:max-h-full xl:w-auto xl:shrink-0 xl:self-stretch xl:overflow-y-auto xl:overscroll-contain ${
            isMobileMenuOpen ? "fixed inset-y-3 left-3 z-50 block w-[min(320px,calc(100vw-1.5rem))] overflow-y-auto" : "hidden"
          } ${isCollapsed ? "p-4 xl:w-[104px]" : "p-5 xl:w-[272px]"}`}
        >
          <div className="border-b border-white/8 pb-5">
            <div
              className={`flex ${isCollapsed ? "flex-col items-center justify-center" : "items-center justify-between"} gap-3`}
            >
              <BrandLogo href="/dashboard" compact hideWordmark={isCollapsed} />
              <button
                type="button"
                onClick={toggleSidebar}
                aria-label={isCollapsed ? (isSpanish ? "Expandir sidebar" : "Expand sidebar") : isSpanish ? "Contraer sidebar" : "Collapse sidebar"}
                className="hidden xl:inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] p-2.5 text-white transition hover:bg-white/[0.08]"
                title={isCollapsed ? (isSpanish ? "Expandir sidebar" : "Expand sidebar") : isSpanish ? "Contraer sidebar" : "Collapse sidebar"}
              >
                {isCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                aria-label={isSpanish ? "Cerrar menú" : "Close menu"}
                className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] p-2.5 text-white transition hover:bg-white/[0.08] xl:hidden"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {!isCollapsed ? (
              <div className="mt-4">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{businessName}</p>
                    <p className="mt-1 text-xs text-[var(--workspace-sidebar-muted)]">
                      {currencyCode} {isSpanish ? "espacio de trabajo" : "workspace"}
                    </p>
                  </div>
                  {subscriptionBadge &&
                  subscriptionBadge.tone !== "trial" &&
                  subscriptionBadge.tone !== "expired" ? (
                    <span
                      className={`max-w-full shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${subscriptionBadgeClassName(subscriptionBadge.tone)}`}
                    >
                      {subscriptionBadge.label}
                    </span>
                  ) : null}
                </div>
                {subscriptionBadge?.detail &&
                subscriptionBadge.tone !== "trial" &&
                subscriptionBadge.tone !== "expired" ? (
                  <p className="mt-3 text-xs text-[var(--workspace-sidebar-muted)]">
                    {subscriptionBadge.detail}
                  </p>
                ) : null}
                {subscriptionBadge && (subscriptionBadge.tone === "trial" || subscriptionBadge.tone === "expired") ? (
                  <div
                    className={`mt-4 rounded-[18px] border p-3 ${subscriptionTimerClassName(subscriptionBadge.tone)}`}
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">
                      {isSpanish
                        ? subscriptionBadge.tone === "expired"
                          ? "Prueba terminada"
                          : "Cuenta regresiva"
                        : subscriptionBadge.tone === "expired"
                          ? "Trial ended"
                          : "Trial countdown"}
                    </p>
                    <p className="mt-2 text-sm font-semibold">
                      {subscriptionBadge.detail}
                    </p>
                    <p className="mt-1 text-xs text-inherit/80">
                      {subscriptionBadge.tone === "expired"
                        ? isSpanish
                          ? "Actualiza para seguir usando el dashboard."
                          : "Upgrade to keep using the dashboard."
                        : isSpanish
                          ? "Actualiza antes de que termine para no perder acceso."
                          : "Upgrade before it ends so access stays uninterrupted."}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <nav className="mt-6 grid grid-cols-1 gap-2">
            {mainNavItems.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`${navClassName(activePage === item.id)} ${isCollapsed ? "justify-center px-3" : ""}`}
                  title={item.label[locale]}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!isCollapsed ? <span className="min-w-0 truncate">{item.label[locale]}</span> : null}
                  {!isCollapsed && item.id === "payouts" && reconcileBadge ? (
                    <span
                      className={`ml-auto shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                        reconcileBadge.tone === "caution"
                          ? "border border-amber-200/14 bg-amber-300/10 text-amber-50"
                          : "border border-white/10 bg-white/[0.04] text-[var(--workspace-muted)]"
                      }`}
                    >
                      {reconcileBadge.label}
                    </span>
                  ) : activePage === item.id && !isCollapsed ? (
                    <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-[var(--workspace-accent)]" />
                  ) : null}
                </Link>
              );
            })}

            {adminNavItem ? (
              <div className={isCollapsed ? "mt-2 pt-2" : "mt-3 pt-3"}>
                <div className="mb-2 border-t border-white/8" />
                <Link
                  href={adminNavItem.href}
                  className={`${navClassName(activePage === adminNavItem.id)} ${isCollapsed ? "justify-center px-3" : ""}`}
                  title={adminNavItem.label}
                >
                  <Shield className="h-4 w-4 shrink-0" />
                  {!isCollapsed ? <span className="min-w-0 truncate">{adminNavItem.label}</span> : null}
                  {activePage === adminNavItem.id && !isCollapsed ? (
                    <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-[var(--workspace-accent)]" />
                  ) : null}
                </Link>
              </div>
            ) : null}
          </nav>

          <div className={`mt-10 border-t border-white/8 ${isCollapsed ? "pt-4" : "space-y-4 pt-8"}`}>
            {!isCollapsed ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/dashboard/properties"
                    className={`workspace-button-secondary inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold transition ${
                      activePage === "properties" ? "workspace-sidebar-link-active" : ""
                    }`}
                  >
                    <Building2 className="h-3.5 w-3.5" />
                    {isSpanish ? "Listings" : "Listings"}
                  </Link>
                  <Link
                    href="/settings"
                    className={`workspace-button-secondary inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold transition ${
                      activePage === "settings" ? "workspace-sidebar-link-active" : ""
                    }`}
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                      {isSpanish ? "Ajustes" : "Settings"}
                    </Link>
                  <LanguageToggle compact />
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--workspace-sidebar-muted)]">
                    {isSpanish ? "Última importación" : "Last import"}
                  </p>
                  <p className="mt-2 text-sm font-medium text-white">
                    {latestImport?.fileName ?? (isSpanish ? "Todavía sin archivo" : "No workbook yet")}
                  </p>
                  <p className="mt-1 text-xs text-[var(--workspace-sidebar-muted)]">
                    {latestImport
                      ? `${latestImport.propertyName} • ${formatDateLabel(latestImport.importedAt.slice(0, 10), locale)}`
                      : isSpanish
                        ? "Importa un archivo si necesitas traer datos anteriores"
                        : "Import a workbook if you need to bring old data in"}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium text-white">{userName}</p>
                  <p className="mt-1 text-xs text-[var(--workspace-sidebar-muted)]">
                    {userEmail}
                  </p>
                </div>

                <SignOutButton className="flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.08]" />
              </>
            ) : (
              <div className="flex justify-center">
                <SignOutButton
                  label=""
                  ariaLabel={isSpanish ? "Cerrar sesión" : "Sign out"}
                  icon={<LogOut className="h-4 w-4" />}
                  className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white transition hover:bg-white/[0.08]"
                />
              </div>
            )}
          </div>
        </aside>

        <div className="min-w-0 flex-1 xl:min-h-0 xl:overflow-hidden">
          <div
            data-workspace-scroll-region={contentScrollable ? "true" : undefined}
            className={`min-h-full px-1 py-2 sm:px-2 xl:flex xl:h-full xl:flex-col xl:px-10 xl:py-8 ${
              contentScrollable ? "xl:overflow-y-auto xl:overscroll-contain" : "xl:overflow-hidden"
            }`}
          >
            <div
              className={
                stickyHeader
                  ? "mb-8 xl:sticky xl:top-0 xl:z-20 xl:-mx-10 xl:-mt-8 xl:bg-[var(--workspace-bg)] xl:px-10 xl:pt-8 xl:pb-6 xl:border-b xl:border-[var(--workspace-border)]"
                  : "mb-8"
              }
            >
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[var(--workspace-text)] sm:text-4xl">
                    {pageTitle}
                  </h1>
                  <p className="mt-3 max-w-2xl text-base leading-8 text-[var(--workspace-muted)]">{pageSubtitle}</p>
                </div>
                {actions ? (
                  <div className="flex flex-wrap items-center gap-3 xl:justify-end">{actions}</div>
                ) : null}
              </div>

              {stickyContent ? (
                <div className="mt-6 space-y-6">
                  {stickyContent}
                </div>
              ) : null}
            </div>

            <div className="min-w-0 xl:min-h-0 xl:flex-1">{children}</div>
          </div>
        </div>
      </div>
    </main>
  );
}

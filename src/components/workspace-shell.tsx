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

type NavItem = {
  id: ActivePage;
  label: { en: string; es: string };
  href: string;
  icon: typeof LayoutDashboard;
};

const navGroups: Array<{ label: { en: string; es: string }; items: NavItem[] }> = [
  {
    label: { en: "Operate", es: "Operar" },
    items: [
      { id: "dashboard", label: { en: "Dashboard", es: "Dashboard" }, href: "/dashboard", icon: LayoutDashboard },
      { id: "calendar", label: { en: "Calendar", es: "Calendario" }, href: "/dashboard/calendar", icon: CalendarDays },
      { id: "bookings", label: { en: "Bookings", es: "Reservas" }, href: "/dashboard/bookings", icon: BookOpenText },
      { id: "expenses", label: { en: "Expenses", es: "Gastos" }, href: "/dashboard/expenses", icon: ReceiptText },
      { id: "properties", label: { en: "Listings", es: "Listings" }, href: "/dashboard/properties", icon: Building2 },
    ],
  },
  {
    label: { en: "Money", es: "Dinero" },
    items: [
      { id: "payouts", label: { en: "Payouts", es: "Liquidaciones" }, href: "/dashboard/payouts", icon: Landmark },
      { id: "cashflow", label: { en: "Operating Flow", es: "Flujo operativo" }, href: "/dashboard/cashflow", icon: Wallet },
      { id: "reconcile", label: { en: "Reconcile", es: "Conciliar" }, href: "/dashboard/reconcile", icon: Scale },
    ],
  },
  {
    label: { en: "Intelligence", es: "Análisis" },
    items: [
      { id: "performance", label: { en: "Performance", es: "Rendimiento" }, href: "/dashboard/performance", icon: ChartNoAxesCombined },
      { id: "reports", label: { en: "Reports", es: "Informes" }, href: "/dashboard/reports", icon: FileText },
    ],
  },
  {
    label: { en: "System", es: "Sistema" },
    items: [
      { id: "imports", label: { en: "Import Center", es: "Centro de importación" }, href: "/dashboard/imports", icon: DatabaseZap },
      { id: "settings", label: { en: "Settings", es: "Ajustes" }, href: "/settings", icon: Settings2 },
    ],
  },
];

function navClassName(active: boolean) {
  return active
    ? "workspace-sidebar-link-active flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium"
    : "workspace-sidebar-link flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition";
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
  toolbar,
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
  /** Full-width row under the title, used for filters. */
  toolbar?: ReactNode;
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

  const visibleNavGroups = isAdminOwnerEmail(userEmail)
    ? navGroups.map((group) =>
        group.label.en === "System"
          ? {
              ...group,
              items: [
                ...group.items,
                {
                  id: "admin" as const,
                  label: { en: "Admin Panel", es: "Panel admin" },
                  href: "/dashboard/admin",
                  icon: Shield,
                },
              ],
            }
          : group,
      )
    : navGroups;

  return (
    <main className="workspace-app min-h-screen bg-[var(--workspace-bg)] px-4 py-4 sm:px-6 xl:h-screen xl:overflow-hidden xl:p-0">
      <div className="flex w-full flex-col gap-4 xl:h-screen xl:flex-row xl:items-stretch xl:gap-0">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--workspace-border)] pb-3 xl:hidden">
          <BrandLogo href="/dashboard" compact />
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label={isSpanish ? "Abrir menú" : "Open menu"}
            aria-expanded={isMobileMenuOpen}
            className="workspace-button-secondary inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition"
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
          className={`flex-col border-[var(--workspace-sidebar-border)] bg-[var(--workspace-sidebar)] max-xl:rounded-lg max-xl:border xl:static xl:z-auto xl:flex xl:max-h-full xl:shrink-0 xl:self-stretch xl:overflow-y-auto xl:overscroll-contain xl:rounded-none xl:border-0 xl:border-r ${
            isMobileMenuOpen ? "fixed inset-y-3 left-3 z-50 flex w-[min(300px,calc(100vw-1.5rem))] overflow-y-auto" : "hidden"
          } ${isCollapsed ? "xl:w-[68px]" : "xl:w-[248px]"}`}
        >
          <div className={`shrink-0 border-b border-[var(--workspace-sidebar-border)] ${isCollapsed ? "p-2.5" : "p-3"}`}>
            <div
              className={`flex ${isCollapsed ? "flex-col items-center justify-center" : "items-center justify-between"} gap-3`}
            >
              <BrandLogo href="/dashboard" compact hideWordmark={isCollapsed} />
              <button
                type="button"
                onClick={toggleSidebar}
                aria-label={isCollapsed ? (isSpanish ? "Expandir sidebar" : "Expand sidebar") : isSpanish ? "Contraer sidebar" : "Collapse sidebar"}
                className="hidden h-8 w-8 items-center justify-center rounded-md text-[var(--workspace-sidebar-muted)] transition hover:bg-[var(--workspace-sidebar-active)] hover:text-white xl:inline-flex"
                title={isCollapsed ? (isSpanish ? "Expandir sidebar" : "Expand sidebar") : isSpanish ? "Contraer sidebar" : "Collapse sidebar"}
              >
                {isCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                aria-label={isSpanish ? "Cerrar menú" : "Close menu"}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--workspace-sidebar-muted)] transition hover:bg-[var(--workspace-sidebar-active)] hover:text-white xl:hidden"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {!isCollapsed ? (
              <div className="mt-3 px-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold uppercase tracking-[0.12em] text-white">{businessName}</p>
                    <p className="mt-0.5 text-xs text-[var(--workspace-sidebar-muted)]">
                      {currencyCode} {isSpanish ? "espacio de trabajo" : "workspace"}
                    </p>
                  </div>
                  {subscriptionBadge &&
                  subscriptionBadge.tone !== "trial" &&
                  subscriptionBadge.tone !== "expired" ? (
                    <span
                      className={`max-w-full shrink-0 whitespace-nowrap rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${subscriptionBadgeClassName(subscriptionBadge.tone)}`}
                    >
                      {subscriptionBadge.label}
                    </span>
                  ) : null}
                </div>
                {subscriptionBadge?.detail &&
                subscriptionBadge.tone !== "trial" &&
                subscriptionBadge.tone !== "expired" ? (
                  <p className="mt-1 text-xs text-[var(--workspace-sidebar-muted)]">
                    {subscriptionBadge.detail}
                  </p>
                ) : null}
                {subscriptionBadge && (subscriptionBadge.tone === "trial" || subscriptionBadge.tone === "expired") ? (
                  <div
                    className={`mt-3 rounded-md border p-2.5 ${subscriptionTimerClassName(subscriptionBadge.tone)}`}
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em]">
                      {isSpanish
                        ? subscriptionBadge.tone === "expired"
                          ? "Prueba terminada"
                          : "Cuenta regresiva"
                        : subscriptionBadge.tone === "expired"
                          ? "Trial ended"
                          : "Trial countdown"}
                    </p>
                    <p className="mt-1 text-sm font-semibold">
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

          <nav
            className={`flex-1 space-y-4 overflow-y-auto ${isCollapsed ? "p-2" : "p-2.5"}`}
            aria-label={isSpanish ? "Navegación principal" : "Main navigation"}
          >
            {visibleNavGroups.map((group, index) => (
              <div key={group.label.en}>
                {isCollapsed ? (
                  index > 0 ? <div className="mx-2 mb-3 border-t border-[var(--workspace-sidebar-border)]" /> : null
                ) : (
                  <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--workspace-sidebar-muted)]/70">
                    {group.label[locale]}
                  </p>
                )}
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activePage === item.id;

                    return (
                      <li key={item.id}>
                        <Link
                          href={item.href}
                          aria-current={isActive ? "page" : undefined}
                          className={`${navClassName(isActive)} ${isCollapsed ? "justify-center px-0" : ""}`}
                          title={item.label[locale]}
                        >
                          <Icon
                            className={`h-[18px] w-[18px] shrink-0 ${isActive ? "text-[var(--workspace-accent)]" : "opacity-70"}`}
                          />
                          {!isCollapsed ? <span className="min-w-0 truncate">{item.label[locale]}</span> : null}
                          {!isCollapsed && item.id === "payouts" && reconcileBadge ? (
                            <span
                              className={`ml-auto shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${
                                reconcileBadge.tone === "caution"
                                  ? "border-amber-300/25 bg-amber-300/10 text-amber-200"
                                  : "border-[var(--workspace-sidebar-border)] text-[var(--workspace-sidebar-muted)]"
                              }`}
                            >
                              {reconcileBadge.label}
                            </span>
                          ) : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          <div className={`shrink-0 border-t border-[var(--workspace-sidebar-border)] ${isCollapsed ? "p-2" : "space-y-3 p-3"}`}>
            {!isCollapsed ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{userName}</p>
                    <p className="truncate text-xs text-[var(--workspace-sidebar-muted)]">{userEmail}</p>
                  </div>
                  <LanguageToggle compact />
                </div>
                <SignOutButton
                  icon={<LogOut className="h-3.5 w-3.5" />}
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-[var(--workspace-sidebar-muted)] transition hover:bg-[var(--workspace-sidebar-active)] hover:text-white"
                />
              </>
            ) : (
              <div className="flex justify-center">
                <SignOutButton
                  label=""
                  ariaLabel={isSpanish ? "Cerrar sesión" : "Sign out"}
                  icon={<LogOut className="h-4 w-4" />}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[var(--workspace-sidebar-muted)] transition hover:bg-[var(--workspace-sidebar-active)] hover:text-white"
                />
              </div>
            )}
          </div>
        </aside>

        <div className="min-w-0 flex-1 xl:min-h-0 xl:overflow-hidden">
          <div
            data-workspace-scroll-region={contentScrollable ? "true" : undefined}
            className={`min-h-full xl:flex xl:h-full xl:flex-col xl:px-7 xl:py-6 ${
              contentScrollable ? "xl:overflow-y-auto xl:overscroll-contain" : "xl:overflow-hidden"
            }`}
          >
            <div
              className={
                stickyHeader
                  ? "mb-5 xl:sticky xl:top-0 xl:z-20 xl:-mx-7 xl:-mt-6 xl:bg-[var(--workspace-bg)] xl:px-7 xl:pt-6 xl:pb-4 xl:border-b xl:border-[var(--workspace-border)]"
                  : "mb-5"
              }
            >
              <div
                className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${
                  stickyHeader ? "" : "border-b border-[var(--workspace-border)] pb-4"
                }`}
              >
                <div className="min-w-0">
                  <h1 className="text-[22px] font-semibold leading-tight tracking-tight text-[var(--workspace-text)]">
                    {pageTitle}
                  </h1>
                  <p className="mt-1 max-w-3xl text-sm text-[var(--workspace-muted)]">{pageSubtitle}</p>
                </div>
                {actions ? (
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>
                ) : null}
              </div>

              {toolbar ? <div className="mt-4">{toolbar}</div> : null}

              {stickyContent ? (
                <div className="mt-4 space-y-4">
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

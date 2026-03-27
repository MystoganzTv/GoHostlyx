"use client";

import { type ReactNode, useState } from "react";
import Link from "next/link";
import {
  BookOpenText,
  Building2,
  ChartNoAxesCombined,
  ChevronsLeft,
  ChevronsRight,
  LayoutDashboard,
  LogOut,
  ReceiptText,
  FileText,
  Settings2,
  Wallet,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { SignOutButton } from "@/components/auth-buttons";
import { LanguageToggle } from "@/components/language-toggle";
import { useLocale } from "@/components/locale-provider";
import { formatDateLabel } from "@/lib/format";
import type { CurrencyCode, ImportSummary } from "@/lib/types";

type ActivePage =
  | "dashboard"
  | "calendar"
  | "monthly"
  | "bookings"
  | "expenses"
  | "cashflow"
  | "performance"
  | "reports"
  | "imports"
  | "properties"
  | "settings";
const sidebarStorageKey = "hostlyx:sidebar-collapsed";

const navItems: Array<{
  id: ActivePage;
  labelKey: string;
  href: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: "dashboard", labelKey: "nav.dashboard", href: "/dashboard", icon: LayoutDashboard },
  { id: "bookings", labelKey: "nav.bookings", href: "/dashboard/bookings", icon: BookOpenText },
  { id: "expenses", labelKey: "nav.expenses", href: "/dashboard/expenses", icon: ReceiptText },
  { id: "cashflow", labelKey: "nav.cashflow", href: "/dashboard/cashflow", icon: Wallet },
  { id: "performance", labelKey: "nav.performance", href: "/dashboard/performance", icon: ChartNoAxesCombined },
  { id: "reports", labelKey: "nav.reports", href: "/dashboard/reports", icon: FileText },
];

function navClassName(active: boolean) {
  return active
    ? "workspace-sidebar-link-active flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold"
    : "workspace-sidebar-link flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition";
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
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useLocale();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.localStorage.getItem(sidebarStorageKey) === "true";
  });

  function toggleSidebar() {
    setIsCollapsed((current) => {
      const nextValue = !current;
      window.localStorage.setItem(sidebarStorageKey, String(nextValue));
      return nextValue;
    });
  }

  return (
    <main className="min-h-screen bg-[var(--workspace-bg)] px-4 py-4 sm:px-6 xl:px-8">
      <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-4 xl:flex-row xl:items-start">
        <aside
          className={`w-full rounded-[30px] border border-[var(--workspace-sidebar-border)] bg-[var(--workspace-sidebar)] shadow-[0_20px_40px_rgba(15,23,42,0.16)] xl:sticky xl:top-4 xl:shrink-0 xl:self-start ${isCollapsed ? "p-4 xl:w-[104px]" : "p-5 xl:w-[272px]"}`}
        >
          <div className="border-b border-white/8 pb-5">
            <div
              className={`flex ${isCollapsed ? "flex-col items-center justify-center" : "items-center justify-between"} gap-3`}
            >
              <BrandLogo href="/dashboard" compact hideWordmark={isCollapsed} />
              <button
                type="button"
                onClick={toggleSidebar}
                aria-label={isCollapsed ? t("workspace.expandSidebar") : t("workspace.collapseSidebar")}
                className="hidden xl:inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] p-2.5 text-white transition hover:bg-white/[0.08]"
                title={isCollapsed ? t("workspace.expandSidebar") : t("workspace.collapseSidebar")}
              >
                {isCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
              </button>
            </div>
            {!isCollapsed ? (
              <div className="mt-4 rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
                <p className="text-sm font-medium text-white">{businessName}</p>
                <p className="mt-1 text-xs text-[var(--workspace-sidebar-muted)]">
                  {t("workspace.workspaceLabel", { currency: currencyCode })}
                </p>
              </div>
            ) : null}
          </div>

          <nav className={`mt-6 grid gap-2 ${isCollapsed ? "xl:grid-cols-1" : "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-1"}`}>
            {navItems.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`${navClassName(activePage === item.id)} ${isCollapsed ? "justify-center px-3" : ""}`}
                  title={t(item.labelKey)}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!isCollapsed ? <span className="min-w-0 truncate">{t(item.labelKey)}</span> : null}
                  {activePage === item.id && !isCollapsed ? (
                    <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-[var(--workspace-accent)]" />
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className={`mt-10 border-t border-white/8 ${isCollapsed ? "pt-4" : "space-y-4 pt-8"}`}>
            {!isCollapsed ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <LanguageToggle />
                  <Link
                    href="/dashboard/properties"
                    className={`workspace-button-secondary inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold transition ${
                      activePage === "properties" ? "workspace-sidebar-link-active" : ""
                    }`}
                  >
                    <Building2 className="h-3.5 w-3.5" />
                    {t("workspace.properties")}
                  </Link>
                  <Link
                    href="/settings"
                    className={`workspace-button-secondary inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold transition ${
                      activePage === "settings" ? "workspace-sidebar-link-active" : ""
                    }`}
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                    {t("workspace.settings")}
                  </Link>
                </div>

                <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--workspace-sidebar-muted)]">
                    {t("workspace.lastImport")}
                  </p>
                  <p className="mt-2 text-sm font-medium text-white">
                    {latestImport?.fileName ?? t("workspace.noWorkbookYet")}
                  </p>
                  <p className="mt-1 text-xs text-[var(--workspace-sidebar-muted)]">
                    {latestImport
                      ? `${latestImport.propertyName} • ${formatDateLabel(latestImport.importedAt.slice(0, 10))}`
                      : t("workspace.importHint")}
                  </p>
                </div>

                <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-sm font-medium text-white">{userName}</p>
                  <p className="mt-1 text-xs text-[var(--workspace-sidebar-muted)]">
                    {userEmail}
                  </p>
                </div>

                <SignOutButton
                  label={t("nav.signOut")}
                  className="flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
                />
              </>
            ) : (
              <div className="flex justify-center">
                <SignOutButton
                  label=""
                  ariaLabel={t("nav.signOut")}
                  icon={<LogOut className="h-4 w-4" />}
                  className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white transition hover:bg-white/[0.08]"
                />
              </div>
            )}
          </div>
        </aside>

        <div className="min-w-0 flex-1 rounded-[34px] border border-[var(--workspace-border)] bg-[rgba(9,17,29,0.7)] shadow-[0_20px_40px_rgba(2,6,23,0.28)]">
          <div className="min-h-full rounded-[34px] bg-[linear-gradient(180deg,rgba(11,22,38,0.92)_0%,rgba(7,17,29,0.98)_100%)] p-5 sm:p-6 xl:p-8">
            <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-[var(--workspace-text)] sm:text-4xl">
                  {pageTitle}
                </h1>
                <p className="mt-2 text-base text-[var(--workspace-muted)]">{pageSubtitle}</p>
              </div>
              {actions ? (
                <div className="flex flex-wrap items-center gap-3">{actions}</div>
              ) : null}
            </div>

            <div className="min-w-0">{children}</div>
          </div>
        </div>
      </div>
    </main>
  );
}

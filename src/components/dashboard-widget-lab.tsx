"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ChartNoAxesCombined,
  CalendarDays,
  FileText,
  LayoutDashboard,
  Percent,
  ReceiptText,
  Sparkles,
  Wallet,
  WalletCards,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { FilterBar } from "@/components/filter-bar";
import { WorkspaceShell } from "@/components/workspace-shell";
import { formatCurrency, formatDateLabel, formatNumber, formatPercent } from "@/lib/format";
import type {
  CurrencyCode,
  DashboardView,
  ImportSummary,
} from "@/lib/types";

function WidgetFrame({
  title,
  subtitle,
  className = "",
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  className?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      className={`workspace-card rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(16,28,46,0.95)_0%,rgba(9,18,31,0.98)_100%)] p-5 shadow-[0_18px_40px_rgba(2,6,23,0.22)] ${className}`}
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold tracking-tight text-[var(--workspace-text)]">{title}</p>
          {subtitle ? <p className="mt-1 text-xs leading-5 text-[var(--workspace-muted)]">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function SparkBars({
  values,
  positive = true,
}: {
  values: number[];
  positive?: boolean;
}) {
  const max = Math.max(...values.map((value) => Math.abs(value)), 1);

  return (
    <div className="flex h-28 items-end gap-2">
      {values.map((value, index) => (
        <div key={`spark-${index}`} className="flex-1 rounded-[18px] bg-white/[0.04] p-1.5">
          <div
            className={`w-full rounded-[14px] ${
              positive
                ? "bg-[linear-gradient(180deg,#67d4c7_0%,#2f8f84_100%)]"
                : "bg-[linear-gradient(180deg,#f2a6ae_0%,#c66474_100%)]"
            }`}
            style={{ height: `${Math.max((Math.abs(value) / max) * 100, 12)}%` }}
          />
        </div>
      ))}
    </div>
  );
}

function StackedCostBars({
  items,
}: {
  items: Array<{ label: string; share: number }>;
}) {
  const colors = ["#67d4c7", "#8ad3ca", "#90a5ef", "#f2bc74", "#ec929a"];

  return (
    <div className="space-y-4">
      <div className="flex h-3 overflow-hidden rounded-full bg-white/[0.06]">
        {items.map((item, index) => (
          <div
            key={item.label}
            style={{ width: `${Math.max(item.share * 100, 3)}%`, backgroundColor: colors[index % colors.length] }}
          />
        ))}
      </div>
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={`cost-${item.label}`} className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: colors[index % colors.length] }}
              />
              <span className="truncate text-sm text-[var(--workspace-text)]">{item.label}</span>
            </div>
            <span className="text-xs font-medium text-[var(--workspace-muted)]">{formatPercent(item.share)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WidgetMetric({
  label,
  value,
  icon,
  accent = "default",
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: "default" | "positive";
}) {
  return (
    <div className="workspace-soft-card rounded-[22px] p-4">
      <div className="flex items-center gap-3">
        <div
          className={`rounded-2xl p-3 ${
            accent === "positive"
              ? "bg-emerald-400/14 text-emerald-200"
              : "workspace-icon-chip"
          }`}
        >
          {icon}
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">{label}</p>
          <p className={`mt-1 text-xl font-semibold ${accent === "positive" ? "text-emerald-300" : "text-[var(--workspace-text)]"}`}>
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

function WidgetGridContent({
  view,
  currencyCode,
}: {
  view: DashboardView;
  currencyCode: CurrencyCode;
}) {
  const monthlySlice = view.monthlySummary.slice(-6);
  const costSlice = view.expensesByCategory.slice(0, 5);
  const totalCost = costSlice.reduce((sum, item) => sum + item.value, 0) || 1;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <FilterBar
          channels={view.availableChannels}
          countries={view.availableCountries}
          selectedRangePreset={view.filters.rangePreset}
          selectedStartDate={view.filters.startDate}
          selectedEndDate={view.filters.endDate}
          selectedChannel={view.filters.channel}
          selectedCountryCode={view.filters.countryCode}
        />
      </div>

      <div className="grid auto-rows-[minmax(160px,auto)] gap-5 xl:grid-cols-12">
        <WidgetFrame
          title="Net Profit"
          subtitle="What the business keeps after payout and expenses."
          className="xl:col-span-4 xl:row-span-2"
          action={<span className="rounded-full bg-emerald-400/14 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200">Core KPI</span>}
        >
          <p className={`text-5xl font-semibold tracking-tight ${view.metrics.netProfit >= 0 ? "text-white" : "text-rose-200"}`}>
            {formatCurrency(view.metrics.netProfit, false, currencyCode)}
          </p>
          <p className="mt-4 max-w-sm text-sm leading-6 text-[var(--workspace-muted)]">
            Profit first, so the business reads like a company instead of a spreadsheet.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <WidgetMetric label="After tax" value={formatCurrency(view.metrics.profitAfterTax, false, currencyCode)} icon={<WalletCards className="h-4 w-4" />} accent="positive" />
            <WidgetMetric label="Margin" value={formatPercent(view.metrics.profitMargin)} icon={<Percent className="h-4 w-4" />} />
          </div>
        </WidgetFrame>

        <WidgetFrame title="Revenue pulse" subtitle="Last 6 months, top-line movement." className="xl:col-span-4">
          <SparkBars values={monthlySlice.map((month) => month.revenue)} />
          <div className="mt-3 grid grid-cols-6 gap-2 text-center text-[11px] uppercase tracking-[0.16em] text-[var(--workspace-muted)]">
            {monthlySlice.map((month) => (
              <span key={`rev-label-${month.key ?? month.label}`}>{month.label.slice(0, 3)}</span>
            ))}
          </div>
        </WidgetFrame>

        <WidgetFrame title="Expense pressure" subtitle="Where cost is clustering right now." className="xl:col-span-4 xl:row-span-2">
          <StackedCostBars
            items={costSlice.map((item) => ({
              label: item.label,
              share: item.value / totalCost,
            }))}
          />
        </WidgetFrame>

        <WidgetFrame title="Revenue vs expenses" subtitle="Quick monthly balance read." className="xl:col-span-4">
          <div className="grid grid-cols-2 gap-3">
            <WidgetMetric label="Revenue" value={formatCurrency(view.metrics.totalRevenue, false, currencyCode)} icon={<Wallet className="h-4 w-4" />} />
            <WidgetMetric label="Expenses" value={formatCurrency(view.metrics.totalExpenses, false, currencyCode)} icon={<ReceiptText className="h-4 w-4" />} />
          </div>
        </WidgetFrame>

        <WidgetFrame title="Bookings" subtitle="Operational throughput." className="xl:col-span-3">
          <div className="space-y-3">
            <WidgetMetric label="Stays" value={formatNumber(view.metrics.bookingsCount)} icon={<CalendarDays className="h-4 w-4" />} />
            <WidgetMetric label="ADR" value={formatCurrency(view.metrics.adr, false, currencyCode)} icon={<ArrowUpRight className="h-4 w-4" />} />
          </div>
        </WidgetFrame>

        <WidgetFrame title="Channels" subtitle="Who is driving the business." className="xl:col-span-3">
          <div className="space-y-3">
            {view.revenueByChannel.slice(0, 3).map((channel) => (
              <div key={channel.label} className="flex items-center justify-between gap-3 rounded-[18px] bg-white/[0.03] px-4 py-3">
                <span className="text-sm text-[var(--workspace-text)]">{channel.label}</span>
                <span className="text-sm font-semibold text-[var(--workspace-text)]">{formatCurrency(channel.revenue, false, currencyCode)}</span>
              </div>
            ))}
          </div>
        </WidgetFrame>

        <WidgetFrame title="Recent bookings" subtitle="Latest revenue-producing stays." className="xl:col-span-6">
          <div className="space-y-3">
            {view.recentBookings.slice(0, 4).map((booking) => (
              <div key={`${booking.id ?? booking.checkIn}-${booking.guestName}`} className="grid gap-3 rounded-[18px] bg-white/[0.03] px-4 py-3 lg:grid-cols-[1.25fr_0.8fr_0.7fr]">
                <div>
                  <p className="text-sm font-semibold text-[var(--workspace-text)]">{booking.guestName}</p>
                  <p className="mt-1 text-xs text-[var(--workspace-muted)]">
                    {booking.channel} • {booking.propertyName}
                  </p>
                </div>
                <p className="text-sm text-[var(--workspace-muted)]">
                  {formatDateLabel(booking.checkIn)} to {formatDateLabel(booking.checkout)}
                </p>
                <p className="text-sm font-semibold text-[var(--workspace-text)]">
                  {formatCurrency(booking.payout, false, currencyCode)}
                </p>
              </div>
            ))}
          </div>
        </WidgetFrame>
      </div>
    </div>
  );
}

function PublicPreviewShell({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[var(--workspace-bg)] px-4 py-4 sm:px-6 xl:px-8">
      <div className="mx-auto grid w-full max-w-[1680px] gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-[30px] border border-[var(--workspace-sidebar-border)] bg-[var(--workspace-sidebar)] p-5 shadow-[0_20px_40px_rgba(15,23,42,0.16)]">
          <div className="border-b border-white/8 pb-5">
            <div className="flex items-center justify-between gap-3">
              <BrandLogo href="/showcase" compact />
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-sidebar-muted)]">
                Lab
              </span>
            </div>
            <div className="mt-4 rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
              <p className="text-sm font-medium text-white">MystoDev concept</p>
              <p className="mt-1 text-xs text-[var(--workspace-sidebar-muted)]">
                Public preview of a widget-grid direction for Hostlyx.
              </p>
            </div>
          </div>

          <nav className="mt-6 space-y-2">
            {[
              { label: "Dashboard", icon: LayoutDashboard },
              { label: "Performance", icon: ChartNoAxesCombined },
              { label: "Reports", icon: FileText },
            ].map((item, index) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium ${
                    index === 0
                      ? "workspace-sidebar-link-active"
                      : "workspace-sidebar-link"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                  {index === 0 ? <span className="ml-auto h-2 w-2 rounded-full bg-[var(--workspace-accent)]" /> : null}
                </div>
              );
            })}
          </nav>

          <div className="mt-10 space-y-4 border-t border-white/8 pt-8">
            <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--workspace-sidebar-muted)]">
                Why this exists
              </p>
              <p className="mt-2 text-sm leading-6 text-white/90">
                To test a denser, more modular command-center direction without replacing the main dashboard.
              </p>
            </div>
            <Link
              href="/showcase"
              className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
            >
              Back to showcase
            </Link>
          </div>
        </aside>

        <div className="rounded-[34px] border border-[var(--workspace-border)] bg-[rgba(9,17,29,0.7)] shadow-[0_20px_40px_rgba(2,6,23,0.28)]">
          <div className="rounded-[34px] bg-[linear-gradient(180deg,rgba(11,22,38,0.92)_0%,rgba(7,17,29,0.98)_100%)] p-5 sm:p-6 xl:p-8">
            <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                  <Sparkles className="h-3.5 w-3.5 text-[var(--workspace-accent)]" />
                  Experimental layout
                </p>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--workspace-text)] sm:text-4xl">
                  Grid-and-widgets dashboard direction
                </h1>
                <p className="mt-2 max-w-3xl text-base text-[var(--workspace-muted)]">
                  Same financial signals, reorganized into modular widgets so we can test a denser operating surface for Hostlyx.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Link href="/dashboard" className="workspace-button-secondary rounded-2xl px-4 py-3 text-sm font-semibold transition">
                  Open live app
                </Link>
              </div>
            </div>

            {children}
          </div>
        </div>
      </div>
    </main>
  );
}

export function DashboardWidgetLab({
  view,
  latestImport,
  userName,
  userEmail,
  businessName,
  currencyCode,
  previewMode = false,
}: {
  view: DashboardView;
  latestImport: ImportSummary | null;
  userName: string;
  userEmail: string;
  businessName: string;
  currencyCode: CurrencyCode;
  previewMode?: boolean;
}) {
  if (previewMode) {
    return (
      <PublicPreviewShell>
        <WidgetGridContent view={view} currencyCode={currencyCode} />
      </PublicPreviewShell>
    );
  }

  return (
    <WorkspaceShell
      activePage="dashboard"
      pageTitle="Widget Grid Lab"
      pageSubtitle="Experimental modular dashboard direction for comparing a grid-and-widgets layout against the current command center."
      businessName={businessName}
      userName={userName}
      userEmail={userEmail}
      currencyCode={currencyCode}
      latestImport={latestImport}
      actions={
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/dashboard" className="workspace-button-secondary rounded-2xl px-4 py-3 text-sm font-semibold transition">
            Back to standard view
          </Link>
        </div>
      }
    >
      <WidgetGridContent view={view} currencyCode={currencyCode} />
    </WorkspaceShell>
  );
}

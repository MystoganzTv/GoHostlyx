"use client";

import { useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  Percent,
  ReceiptText,
  TrendingUp,
  Wallet,
  WalletCards,
} from "lucide-react";
import type {
  CurrencyCode,
  DashboardView,
  ImportSummary,
  PropertyDefinition,
} from "@/lib/types";
import { formatCurrency, formatDateLabel, formatNumber } from "@/lib/format";
import { getMarketDefinition } from "@/lib/markets";
import { ChartsPanel } from "@/components/charts-panel";
import { TaxEstimationCard } from "@/components/dashboard/TaxEstimationCard";
import { FilterBar } from "@/components/filter-bar";
import { ManualEntryPanel } from "@/components/manual-entry-panel";
import { Modal } from "@/components/modal";
import { SectionCard } from "@/components/section-card";
import { UploadPanel } from "@/components/upload-panel";
import { useLocale } from "@/components/locale-provider";
import { WorkspaceShell } from "@/components/workspace-shell";

type DashboardShellProps = {
  view: DashboardView;
  latestImport: ImportSummary | null;
  userName: string;
  userEmail: string;
  businessName: string;
  currencyCode: CurrencyCode;
  properties: PropertyDefinition[];
};

function recordKey(
  record: { id?: number; source?: string },
  fallback: string,
  index: number,
) {
  return record.id ? `${record.source ?? "row"}-${record.id}` : `${fallback}-${index}`;
}

function profitState(netProfit: number) {
  if (netProfit > 0) {
    return {
      chip: "Profitable",
      chipClass: "bg-emerald-400/14 text-emerald-200",
      valueClass: "text-white",
      helper: "Net profit after payout and expenses.",
    };
  }

  if (netProfit < 0) {
    return {
      chip: "Losing money",
      chipClass: "bg-rose-400/14 text-rose-200",
      valueClass: "text-rose-200",
      helper: "Expenses are heavier than payout in this view.",
    };
  }

  return {
    chip: "Break-even",
    chipClass: "bg-slate-400/14 text-slate-200",
    valueClass: "text-white",
    helper: "The business is neither ahead nor behind right now.",
  };
}

export function DashboardShell({
  view,
  latestImport,
  userName,
  userEmail,
  businessName,
  currencyCode,
  properties,
}: DashboardShellProps) {
  const { t } = useLocale();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isEntryOpen, setIsEntryOpen] = useState(false);
  const profitMeta = profitState(view.metrics.netProfit);

  return (
    <>
      <WorkspaceShell
        activePage="dashboard"
        pageTitle={t("dashboard.pageTitle")}
        pageSubtitle={t("dashboard.pageSubtitle")}
        businessName={businessName}
        userName={userName}
        userEmail={userEmail}
        currencyCode={currencyCode}
        latestImport={latestImport}
        actions={
          <>
            <button
              type="button"
              onClick={() => setIsUploadOpen(true)}
              className="workspace-button-secondary rounded-2xl px-4 py-3 text-sm font-semibold transition"
            >
              {t("dashboard.uploadData")}
            </button>
            <button
              type="button"
              onClick={() => setIsEntryOpen(true)}
              className="workspace-button-primary rounded-2xl px-4 py-3 text-sm font-semibold transition"
            >
              {t("dashboard.addEntry")}
            </button>
          </>
        }
      >
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

          {view.mixedCurrencyMode ? (
            <SectionCard
              title={t("dashboard.portfolioTitle")}
              subtitle={t("dashboard.portfolioSubtitle")}
            >
              <div className="grid gap-4 xl:grid-cols-3">
                {view.marketBreakdown.map((market) => {
                  const meta = getMarketDefinition(market.countryCode);

                  return (
                    <article key={market.countryCode} className="workspace-soft-card rounded-[22px] p-5">
                      <p className="text-sm font-semibold text-[var(--workspace-text)]">{meta.countryName}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                        {market.currencyCode}
                      </p>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">{t("dashboard.revenue")}</p>
                          <p className="mt-1 text-sm font-semibold text-[var(--workspace-text)]">
                            {formatCurrency(market.revenue, false, market.currencyCode)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">{t("dashboard.profit")}</p>
                          <p className={`mt-1 text-sm font-semibold ${market.profit >= 0 ? "text-emerald-300" : "text-rose-200"}`}>
                            {formatCurrency(market.profit, false, market.currencyCode)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">{t("dashboard.bookings")}</p>
                          <p className="mt-1 text-sm font-semibold text-[var(--workspace-text)]">{formatNumber(market.bookings)}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">{t("dashboard.expenses")}</p>
                          <p className="mt-1 text-sm font-semibold text-[var(--workspace-text)]">
                            {formatCurrency(market.expenses, false, market.currencyCode)}
                          </p>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </SectionCard>
          ) : (
            <>
              <section className="grid gap-4 xl:grid-cols-[1.35fr_0.9fr_0.9fr_0.9fr]">
                <article className="workspace-card rounded-[28px] bg-[linear-gradient(180deg,rgba(29,78,60,0.22)_0%,rgba(11,22,38,0.98)_100%)] p-6 ring-1 ring-emerald-300/14">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100/80">
                        {t("dashboard.netProfit")}
                      </p>
                      <p className={`mt-5 text-4xl font-semibold tracking-tight sm:text-5xl ${profitMeta.valueClass}`}>
                        {formatCurrency(view.metrics.netProfit, false, currencyCode)}
                      </p>
                      <p className="mt-3 max-w-md text-sm leading-7 text-slate-300">
                        {view.metrics.netProfit > 0
                          ? t("dashboard.netProfitHelperPositive")
                          : view.metrics.netProfit < 0
                            ? t("dashboard.netProfitHelperNegative")
                            : t("dashboard.netProfitHelperZero")}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${profitMeta.chipClass}`}>
                      {view.metrics.netProfit > 0
                        ? t("dashboard.profitable")
                        : view.metrics.netProfit < 0
                          ? t("dashboard.losingMoney")
                          : t("dashboard.breakEven")}
                    </span>
                  </div>
                </article>

                <article className="workspace-card rounded-[28px] p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--workspace-muted)]">{t("dashboard.grossIncome")}</p>
                      <p className="mt-4 text-3xl font-semibold tracking-tight text-[var(--workspace-text)]">
                        {formatCurrency(view.metrics.totalRevenue, false, currencyCode)}
                      </p>
                    </div>
                    <div className="workspace-icon-chip rounded-2xl p-3">
                      <Wallet className="h-5 w-5" />
                    </div>
                  </div>
                </article>

                <article className="workspace-card rounded-[28px] p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--workspace-muted)]">{t("dashboard.totalExpenses")}</p>
                      <p className="mt-4 text-3xl font-semibold tracking-tight text-[var(--workspace-text)]">
                        {formatCurrency(view.metrics.totalExpenses, false, currencyCode)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-rose-400/12 p-3 text-rose-200">
                      <ReceiptText className="h-5 w-5" />
                    </div>
                  </div>
                </article>

                <article className="workspace-card rounded-[28px] p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--workspace-muted)]">{t("dashboard.profitMargin")}</p>
                      <p className={`mt-4 text-3xl font-semibold tracking-tight ${view.metrics.profitMargin >= 0 ? "text-emerald-300" : "text-rose-200"}`}>
                        {(view.metrics.profitMargin * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div className="workspace-icon-chip rounded-2xl p-3">
                      <Percent className="h-5 w-5" />
                    </div>
                  </div>
                </article>
              </section>

              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
                <article className="workspace-soft-card rounded-[24px] p-5">
                  <div className="flex items-center gap-3">
                    <div className="workspace-icon-chip rounded-2xl p-3">
                      <ArrowDownRight className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">{t("dashboard.netIncome")}</p>
                      <p className="mt-1 text-xl font-semibold text-[var(--workspace-text)]">
                        {formatCurrency(view.metrics.totalPayout, false, currencyCode)}
                      </p>
                    </div>
                  </div>
                </article>
                <article className="workspace-soft-card rounded-[24px] p-5">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-white/[0.05] p-3 text-[var(--workspace-text)]">
                      <ReceiptText className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">{t("dashboard.estimatedTaxes")}</p>
                      <p className="mt-1 text-xl font-semibold text-[var(--workspace-text)]">
                        {formatCurrency(view.metrics.estimatedTaxes, false, currencyCode)}
                      </p>
                    </div>
                  </div>
                </article>
                <article className="workspace-soft-card rounded-[24px] p-5">
                  <div className="flex items-center gap-3">
                    <div
                      className={`rounded-2xl p-3 ${
                        view.metrics.profitAfterTax >= 0
                          ? "bg-emerald-400/14 text-emerald-200"
                          : "bg-rose-400/14 text-rose-200"
                      }`}
                    >
                      <WalletCards className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">{t("dashboard.profitAfterTax")}</p>
                      <p
                        className={`mt-1 text-xl font-semibold ${
                          view.metrics.profitAfterTax >= 0 ? "text-emerald-300" : "text-rose-200"
                        }`}
                      >
                        {formatCurrency(view.metrics.profitAfterTax, false, currencyCode)}
                      </p>
                    </div>
                  </div>
                </article>
                <article className="workspace-soft-card rounded-[24px] p-5">
                  <div className="flex items-center gap-3">
                    <div className="workspace-icon-chip rounded-2xl p-3">
                      <CalendarDays className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">{t("dashboard.bookings")}</p>
                      <p className="mt-1 text-xl font-semibold text-[var(--workspace-text)]">{formatNumber(view.metrics.bookingsCount)}</p>
                    </div>
                  </div>
                </article>
                <article className="workspace-soft-card rounded-[24px] p-5">
                  <div className="flex items-center gap-3">
                    <div className="workspace-icon-chip rounded-2xl p-3">
                      <TrendingUp className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">{t("dashboard.adr")}</p>
                      <p className="mt-1 text-xl font-semibold text-[var(--workspace-text)]">
                        {formatCurrency(view.metrics.adr, false, currencyCode)}
                      </p>
                    </div>
                  </div>
                </article>
                <article className="workspace-soft-card rounded-[24px] p-5">
                  <div className="flex items-center gap-3">
                    <div className="workspace-icon-chip rounded-2xl p-3">
                      <ArrowUpRight className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">{t("dashboard.occupancy")}</p>
                      <p className="mt-1 text-xl font-semibold text-[var(--workspace-text)]">
                        {(view.metrics.occupancyRate * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </article>
              </section>
            </>
          )}

          <TaxEstimationCard
            key={`${view.taxSettings.countryCode}-${view.taxSettings.taxRate}-${view.taxSettings.savedCountryCode}`}
            countryCode={view.taxSettings.countryCode}
            savedCountryCode={view.taxSettings.savedCountryCode}
            taxRate={view.taxSettings.taxRate}
            suggestedTaxRate={view.taxSettings.suggestedTaxRate}
            estimatedTaxes={view.metrics.estimatedTaxes}
            profitAfterTax={view.metrics.profitAfterTax}
            currencyCode={currencyCode}
            mixedCurrencyMode={view.mixedCurrencyMode}
            usesSavedSettings={view.taxSettings.usesSavedSettings}
            usesCustomRate={view.taxSettings.usesCustomRate}
          />

          <ChartsPanel
            monthlySummary={view.monthlySummary}
            expensesByCategory={view.expensesByCategory}
            revenueByChannel={view.revenueByChannel}
            currencyCode={currencyCode}
            mixedCurrencyMode={view.mixedCurrencyMode}
          />

          <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
            <SectionCard title={t("dashboard.recentBookingsTitle")} subtitle={t("dashboard.recentBookingsSubtitle")}>
              <div className="space-y-3">
                {view.recentBookings.length === 0 ? (
                  <div className="workspace-soft-card rounded-[22px] p-5 text-sm text-[var(--workspace-muted)]">
                    {t("dashboard.recentBookingsEmpty")}
                  </div>
                ) : (
                  view.recentBookings.map((booking, index) => (
                    <article
                      key={recordKey(booking, `${booking.checkIn}-${booking.guestName}`, index)}
                      className="workspace-soft-card rounded-[22px] p-4"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div>
                            <p className="text-base font-semibold text-[var(--workspace-text)]">{booking.guestName}</p>
                            <p className="mt-1 text-sm text-[var(--workspace-muted)]">
                              {booking.channel} • {booking.propertyName}
                              {booking.unitName ? ` • ${booking.unitName}` : ""}
                            </p>
                          </div>
                          <p className="text-sm text-[var(--workspace-muted)]">
                            {formatDateLabel(booking.checkIn)} to {formatDateLabel(booking.checkout)}
                          </p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[300px]">
                          <div className="workspace-card rounded-[18px] px-3 py-3">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">{t("dashboard.guests")}</p>
                            <p className="mt-1 text-sm font-semibold text-[var(--workspace-text)]">{formatNumber(booking.guestCount)}</p>
                          </div>
                          <div className="workspace-card rounded-[18px] px-3 py-3">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">{t("dashboard.nights")}</p>
                            <p className="mt-1 text-sm font-semibold text-[var(--workspace-text)]">{formatNumber(booking.nights)}</p>
                          </div>
                          <div className="workspace-card rounded-[18px] px-3 py-3">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">{t("dashboard.payout")}</p>
                            <p className="mt-1 text-sm font-semibold text-[var(--workspace-text)]">
                              {formatCurrency(booking.payout, false, currencyCode)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </SectionCard>

            <SectionCard title={t("dashboard.recentExpensesTitle")} subtitle={t("dashboard.recentExpensesSubtitle")}>
              <div className="space-y-3">
                {view.recentExpenses.length === 0 ? (
                  <div className="workspace-soft-card rounded-[22px] p-5 text-sm text-[var(--workspace-muted)]">
                    {t("dashboard.recentExpensesEmpty")}
                  </div>
                ) : (
                  view.recentExpenses.map((expense, index) => (
                    <div
                      key={recordKey(expense, `${expense.date}-${expense.description}`, index)}
                      className="workspace-soft-card rounded-[22px] p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2">
                          <p className="font-semibold text-[var(--workspace-text)]">{expense.description}</p>
                          <p className="text-sm text-[var(--workspace-muted)]">
                            {expense.category} • {expense.propertyName}
                            {expense.unitName ? ` • ${expense.unitName}` : ""}
                          </p>
                          <p className="text-sm text-[var(--workspace-muted)]">{formatDateLabel(expense.date)}</p>
                          {expense.note ? <p className="text-sm text-[var(--workspace-muted)]">{expense.note}</p> : null}
                        </div>
                        <span className="text-sm font-semibold text-[var(--workspace-text)]">
                          {formatCurrency(expense.amount, false, currencyCode)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </SectionCard>
          </div>
        </div>
      </WorkspaceShell>

      <Modal
        open={isUploadOpen}
        title={t("dashboard.uploadData")}
        onClose={() => setIsUploadOpen(false)}
      >
        <UploadPanel properties={properties} />
      </Modal>

      <Modal
        open={isEntryOpen}
        title={t("dashboard.addEntry")}
        onClose={() => setIsEntryOpen(false)}
      >
        <ManualEntryPanel properties={properties} />
      </Modal>
    </>
  );
}

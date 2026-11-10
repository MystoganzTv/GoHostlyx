"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { BookingChannelBadge, BookingStatusBadge } from "@/components/booking-badges";
import { useLocale } from "@/components/locale-provider";
import type {
  CurrencyCode,
  DashboardView,
  ImportSummary,
  PropertyDefinition,
} from "@/lib/types";
import { getBookingStatusState } from "@/lib/booking-status";
import { formatCurrency, formatDateLabel, formatNumber, formatPercent } from "@/lib/format";
import { getMarketLabels } from "@/lib/markets";
import { ChartsPanel } from "@/components/charts-panel";
import { TaxEstimationCard } from "@/components/dashboard/TaxEstimationCard";
import { ExportReportLink } from "@/components/export-report-link";
import { FilterBar } from "@/components/filter-bar";
import { ManualEntryPanel } from "@/components/manual-entry-panel";
import { Modal } from "@/components/modal";
import { ReconcileSummaryCard } from "@/components/reconcile-panel";
import { getReconcileSidebarBadge } from "@/lib/reconcile";
import { SectionCard } from "@/components/section-card";
import { StatStrip } from "@/components/stat-strip";
import { BottomLine } from "@/components/dashboard/bottom-line";
import { WorkspaceShell } from "@/components/workspace-shell";

// Lazy-load the heavy upload panel; it only renders inside a modal.
const UploadPanel = dynamic(
  () => import("@/components/upload-panel").then((m) => m.UploadPanel),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center p-10 text-[var(--workspace-muted)]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
      </div>
    ),
  },
);

type DashboardShellProps = {
  view: DashboardView;
  latestImport: ImportSummary | null;
  userName: string;
  userEmail: string;
  businessName: string;
  currencyCode: CurrencyCode;
  properties: PropertyDefinition[];
  pageTitle?: string;
  pageSubtitle?: string;
  insightsEnabled?: boolean;
  reportExportEnabled?: boolean;
  subscriptionBadge?: {
    label: string;
    detail?: string;
    tone?: "trial" | "expired" | "starter" | "pro" | "portfolio";
  };
  showUpgradeAction?: boolean;
};

type DashboardInsightTone = "positive" | "neutral" | "caution";

type DashboardInsight = {
  title: string;
  body: string;
  tone: DashboardInsightTone;
};

function recordKey(
  record: { id?: number; source?: string },
  fallback: string,
  index: number,
) {
  return record.id ? `${record.source ?? "row"}-${record.id}` : `${fallback}-${index}`;
}

function getTimeContext(view: DashboardView, locale: "en" | "es") {
  const { filters, rangeLabel } = view;
  const formatter = new Intl.DateTimeFormat(locale === "es" ? "es-ES" : "en-US", {
    month: "long",
    year: "numeric",
  });

  if (filters.rangePreset === "this-month") {
    return formatter.format(new Date());
  }

  if (filters.rangePreset === "this-year") {
    return String(new Date().getFullYear());
  }

  if (filters.rangePreset === "last-year") {
    return String(new Date().getFullYear() - 1);
  }

  if (
    filters.rangePreset === "custom" ||
    filters.rangePreset === "last-90-days" ||
    filters.rangePreset === "all-time"
  ) {
    return rangeLabel;
  }

  if (filters.year !== "all" && filters.month !== "all") {
    return formatter.format(new Date(filters.year, filters.month - 1, 1));
  }

  if (filters.year !== "all") {
    return String(filters.year);
  }

  return rangeLabel;
}

function getTimeContextHint(view: DashboardView, locale: "en" | "es") {
  const isSpanish = locale === "es";
  const { filters, rangeLabel } = view;

  if (filters.rangePreset === "this-month") {
    return isSpanish ? "Mes actual" : "Current month";
  }

  if (filters.rangePreset === "this-year" || filters.rangePreset === "last-year") {
    return rangeLabel;
  }

  if (filters.rangePreset === "custom") {
    return isSpanish ? "Rango personalizado" : "Custom date range";
  }

  if (filters.rangePreset === "last-90-days") {
    return isSpanish ? "Periodo móvil" : "Rolling period";
  }

  if (filters.rangePreset === "all-time") {
    return isSpanish ? "Historial importado completo" : "Full imported history";
  }

  if (filters.year !== "all" && filters.month !== "all") {
    return isSpanish ? "Mes seleccionado" : "Selected month";
  }

  if (filters.year !== "all") {
    return isSpanish ? "Año seleccionado" : "Selected year";
  }

  return isSpanish ? "Vista actual" : "Current view";
}

function formatWholePercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function getPrimaryHeroInsight(view: DashboardView, locale: "en" | "es") {
  const isSpanish = locale === "es";
  const { totalRevenue, totalExpenses, profitAfterTax, estimatedTaxes, netProfit } = view.metrics;

  if (totalRevenue <= 0) {
    return null;
  }

  const expenseRatio = totalExpenses / totalRevenue;

  if (expenseRatio >= 0.5) {
    return isSpanish
      ? `Tus gastos están consumiendo ${formatWholePercent(expenseRatio)} de tus ingresos.`
      : `Your expenses are consuming ${formatWholePercent(expenseRatio)} of your revenue.`;
  }

  if (netProfit > 0 && estimatedTaxes > 0) {
    const taxImpact = estimatedTaxes / netProfit;

      if (taxImpact >= 0.2) {
      return isSpanish
        ? `Los impuestos están reduciendo tu take-home en ${formatWholePercent(taxImpact)} del beneficio neto.`
        : `Taxes are reducing your take-home by ${formatWholePercent(taxImpact)} of net profit.`;
      }
  }

  if (profitAfterTax >= 0) {
    return isSpanish
      ? `Te estás quedando con ${formatWholePercent(profitAfterTax / totalRevenue)} de los ingresos después de gastos e impuestos estimados.`
      : `You are keeping ${formatWholePercent(profitAfterTax / totalRevenue)} of revenue after expenses and estimated taxes.`;
  }

  return isSpanish
    ? `Tus gastos están consumiendo ${formatWholePercent(expenseRatio)} de tus ingresos.`
    : `Your expenses are consuming ${formatWholePercent(expenseRatio)} of your revenue.`;
}

function buildDashboardInsights(view: DashboardView, locale: "en" | "es") {
  const isSpanish = locale === "es";
  const insights: DashboardInsight[] = [];
  const { totalRevenue, totalExpenses, estimatedTaxes, netProfit, profitMargin, profitAfterTax } = view.metrics;

  if (totalRevenue > 0) {
    const expenseRatio = totalExpenses / totalRevenue;

    if (expenseRatio > 0.6) {
      insights.push({
        title: isSpanish ? "Los gastos son altos" : "Expenses are high",
        body: isSpanish
          ? "Están consumiendo una gran parte de los ingresos en el periodo seleccionado."
          : "They are consuming a large share of revenue in the selected period.",
        tone: "caution",
      });
    }
  }

  if (netProfit > 0) {
    const taxPressure = estimatedTaxes / netProfit;

    if (taxPressure > 0.2) {
      insights.push({
        title: isSpanish ? "La presión fiscal sube" : "Tax pressure is rising",
        body: isSpanish
          ? "Los impuestos estimados están reduciendo materialmente lo que te llevas."
          : "Estimated taxes are materially reducing your take-home.",
        tone: "caution",
      });
    }
  }

  if (totalRevenue > 0) {
    const topChannel = view.revenueByChannel
      .filter((channel) => channel.revenue > 0)
      .sort((left, right) => right.revenue - left.revenue)[0];

    if (topChannel && topChannel.revenue / totalRevenue > 0.7) {
      insights.push({
        title: isSpanish ? "Los ingresos están concentrados" : "Revenue is concentrated",
        body: isSpanish
          ? "La mayor parte de tus ingresos viene de un solo canal."
          : "Most of your revenue is coming from one channel.",
        tone: "neutral",
      });
    }
  }

  if (totalRevenue > 0 && profitMargin < 0.2) {
    insights.push({
      title: isSpanish ? "El margen está bajo presión" : "Margin is under pressure",
      body: isSpanish
        ? "Tu margen de beneficio es más fino de lo esperado en este periodo."
        : "Your profit margin is thinner than expected in this period.",
      tone: "caution",
    });
  }

  if (insights.length === 0 && profitAfterTax > 0) {
    insights.push({
      title: isSpanish ? "El beneficio después de impuestos siguió positivo" : "After-tax profit stayed positive",
      body: isSpanish
        ? "Tu negocio siguió siendo rentable después de impuestos en el periodo seleccionado."
        : "Your business remained profitable after tax in the selected period.",
      tone: "positive",
    });
  }

  return insights.slice(0, 3);
}

export function DashboardShell({
  view,
  latestImport,
  userName,
  userEmail,
  businessName,
  currencyCode,
  properties,
  pageTitle = "Financial Overview",
  pageSubtitle = "Track what the business earned, spent, and kept during the selected period.",
  insightsEnabled = true,
  reportExportEnabled = true,
  subscriptionBadge,
  showUpgradeAction = false,
}: DashboardShellProps) {
  const { locale } = useLocale();
  const isSpanish = locale === "es";
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isEntryOpen, setIsEntryOpen] = useState(false);
  const timeContext = getTimeContext(view, locale);
  const timeContextHint = getTimeContextHint(view, locale);
  const insights = view.mixedCurrencyMode ? [] : buildDashboardInsights(view, locale);
  const primaryHeroInsight = view.mixedCurrencyMode ? null : getPrimaryHeroInsight(view, locale);
  const expenseRatio =
    view.metrics.totalPayout > 0 ? view.metrics.totalExpenses / view.metrics.totalPayout : null;
  const hasHighExpenseRatio = expenseRatio !== null && expenseRatio > 0.6;
  const taxImpactRatio =
    view.metrics.netProfit > 0 ? view.metrics.estimatedTaxes / view.metrics.netProfit : null;
  const hasSignificantTaxImpact = taxImpactRatio !== null && taxImpactRatio > 0.25;
  const upgradeTone = subscriptionBadge?.tone;
  const highlightUpgrade =
    upgradeTone === "trial" || upgradeTone === "expired" || upgradeTone === "starter";
  const upgradeLabel =
    upgradeTone === "starter"
      ? isSpanish
        ? "Subir a Pro"
        : "Upgrade to Pro"
      : upgradeTone === "trial" || upgradeTone === "expired"
        ? isSpanish
          ? "Elegir un plan"
          : "Choose a Plan"
        : isSpanish
          ? "Actualizar"
          : "Upgrade";

  return (
    <>
      <WorkspaceShell
        activePage="dashboard"
        pageTitle={pageTitle}
        pageSubtitle={pageSubtitle}
        businessName={businessName}
        userName={userName}
        userEmail={userEmail}
        currencyCode={currencyCode}
        latestImport={latestImport}
        reconcileBadge={getReconcileSidebarBadge(view.reconcile, currencyCode)}
        subscriptionBadge={subscriptionBadge}
        actions={
          <>
            {showUpgradeAction ? (
              <Link
                href="/pricing"
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition ${
                  highlightUpgrade
                    ? "border border-amber-200/18 bg-[linear-gradient(135deg,rgba(251,191,36,0.24)_0%,rgba(245,158,11,0.16)_100%)] text-amber-50 shadow-[0_18px_36px_rgba(245,158,11,0.18)] hover:border-amber-200/28 hover:bg-[linear-gradient(135deg,rgba(251,191,36,0.3)_0%,rgba(245,158,11,0.2)_100%)]"
                    : "workspace-button-secondary"
                }`}
              >
                {upgradeLabel}
              </Link>
            ) : null}
            {reportExportEnabled ? (
              <ExportReportLink className="workspace-button-secondary inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition" />
            ) : null}
            <button
              type="button"
              onClick={() => setIsUploadOpen(true)}
              className="workspace-button-secondary rounded-lg px-3.5 py-2 text-sm font-semibold transition"
            >
              {isSpanish ? "Subir datos" : "Upload data"}
            </button>
            <button
              type="button"
              onClick={() => setIsEntryOpen(true)}
              className="workspace-button-primary rounded-lg px-3.5 py-2 text-sm font-semibold transition"
            >
              {isSpanish ? "Añadir entrada" : "Add entry"}
            </button>
          </>
        }
      >
        <div className="space-y-8">
          {view.mixedCurrencyMode ? (
            <div className="rounded-lg border border-amber-200/18 bg-amber-400/10 px-4 py-3 text-sm leading-6 text-amber-50">
              {isSpanish
                ? "Estás viendo varios mercados con monedas distintas. Los totales de abajo suman importes sin convertir, así que no son exactos. Filtra por un país para ver cifras correctas, o usa el desglose por mercado."
                : "You are viewing several markets with different currencies. The totals below add amounts without conversion, so they are not exact. Filter by one country for accurate figures, or use the per-market breakdown."}
            </div>
          ) : null}
          <section className="space-y-5">
            <FilterBar
              channels={view.availableChannels}
              countries={view.availableCountries}
              rangeShortcutYears={view.availableYears}
              selectedRangePreset={view.filters.rangePreset}
              selectedStartDate={view.filters.startDate}
              selectedEndDate={view.filters.endDate}
              selectedChannel={view.filters.channel}
              selectedCountryCode={view.filters.countryCode}
            />
            <div className="flex items-end justify-between gap-3 border-b border-[var(--workspace-border)] pb-1.5">
              <div className="min-w-0">
                <h2 className="label-xs">{isSpanish ? "Resultado" : "The bottom line"}</h2>
                <p className="mt-0.5 truncate text-xs text-[var(--workspace-muted)]">
                  {timeContext} · {timeContextHint} · {formatNumber(view.metrics.bookingsCount, locale)}{" "}
                  {isSpanish ? "reservas" : "bookings"}
                </p>
              </div>
            </div>

            {view.mixedCurrencyMode ? (
              <SectionCard
                title={isSpanish ? "Vista portfolio" : "Portfolio View"}
                subtitle={
                  isSpanish
                    ? "All markets sirve para ver volumen de cartera, pero GoHostlyx no fingirá un beneficio total convertido entre monedas mixtas."
                    : "All markets is useful for portfolio volume, but GoHostlyx will not fake a converted profit total across mixed currencies."
                }
              >
                <div className="grid gap-4 xl:grid-cols-3">
                  {view.marketBreakdown.map((market) => {
                    const meta = getMarketLabels(market.countryCode, locale);

                    return (
                      <article key={market.countryCode} className="workspace-soft-card rounded-xl p-6">
                        <p className="text-sm font-semibold text-[var(--workspace-text)]">{meta.countryName}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                          {market.currencyCode}
                        </p>
                        <div className="mt-5 grid gap-4 sm:grid-cols-2">
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">{isSpanish ? "Ingresos" : "Revenue"}</p>
                            <p className="mt-2 text-sm font-semibold text-[var(--workspace-text)]">
                              {formatCurrency(market.revenue, false, market.currencyCode)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">{isSpanish ? "Beneficio" : "Profit"}</p>
                            <p className={`mt-2 text-sm font-semibold ${market.profit >= 0 ? "text-pos" : "text-neg"}`}>
                              {formatCurrency(market.profit, false, market.currencyCode)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">{isSpanish ? "Reservas" : "Bookings"}</p>
                            <p className="mt-2 text-sm font-semibold text-[var(--workspace-text)]">{formatNumber(market.bookings)}</p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">{isSpanish ? "Gastos" : "Expenses"}</p>
                            <p className="mt-2 text-sm font-semibold text-[var(--workspace-text)]">
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
                <section className="space-y-4">
                  <BottomLine
                    metrics={view.metrics}
                    currencyCode={currencyCode}
                    locale={locale}
                    insight={primaryHeroInsight}
                    highExpenseRatio={hasHighExpenseRatio}
                    significantTaxImpact={hasSignificantTaxImpact}
                  />

                  <StatStrip
                    items={[
                      {
                        label: isSpanish ? "Reservas" : "Bookings",
                        value: formatNumber(view.metrics.bookingsCount, locale),
                        icon: <CalendarDays className="h-4 w-4" />,
                      },
                      {
                        label: "ADR",
                        value: formatCurrency(view.metrics.adr, false, currencyCode, locale),
                        icon: <TrendingUp className="h-4 w-4" />,
                      },
                      {
                        label: isSpanish ? "Ocupación" : "Occupancy",
                        value: formatPercent(view.metrics.occupancyRate, locale),
                        icon: <ArrowUpRight className="h-4 w-4" />,
                      },
                      {
                        label: "RevPAR",
                        value: formatCurrency(view.metrics.revPar, false, currencyCode, locale),
                        icon: <Wallet className="h-4 w-4" />,
                      },
                    ]}
                  />

                  <SectionCard
                    title={isSpanish ? "Insights clave" : "Key Insights"}
                    subtitle={isSpanish ? "Señales que merece la pena vigilar en la vista actual." : "Signals worth watching in the current view."}
                  >
                    {!insightsEnabled ? (
                      <div className="workspace-soft-card rounded-xl p-5">
                        <p className="text-sm font-semibold text-[var(--workspace-text)]">
                          {isSpanish ? "Actualiza a Pro para ver insights clave" : "Upgrade to Pro for key insights"}
                        </p>
                        <p className="mt-2 text-sm leading-7 text-[var(--workspace-muted)]">
                          {isSpanish
                            ? "Pro y Portfolio desbloquean señales concisas sobre presión, concentración y calidad del margen."
                            : "Pro and Portfolio unlock concise signals on pressure, concentration, and margin quality."}
                        </p>
                        <Link
                          href="/pricing"
                          className="workspace-button-secondary mt-4 inline-flex rounded-lg px-3.5 py-2 text-sm font-semibold transition"
                        >
                          {isSpanish ? "Ver planes" : "View plans"}
                        </Link>
                      </div>
                    ) : insights.length === 0 ? (
                      <div className="workspace-soft-card rounded-xl p-5 text-sm leading-7 text-[var(--workspace-muted)]">
                        {isSpanish ? "Todavía no hay suficientes señales significativas para este rango." : "Not enough meaningful signals yet for this time range."}
                      </div>
                    ) : (
                      <ul className="-my-2 divide-y divide-[var(--workspace-border)]">
                        {insights.map((insight) => (
                          <li key={`${insight.title}-${insight.body}`} className="flex items-start gap-3 py-3">
                            <span
                              aria-hidden
                              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                                insight.tone === "positive"
                                  ? "bg-[var(--workspace-pos)]"
                                  : insight.tone === "caution"
                                    ? "bg-[var(--workspace-warn)]"
                                    : "bg-[var(--workspace-info)]"
                              }`}
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-[var(--workspace-text)]">{insight.title}</p>
                              <p className="mt-0.5 text-xs text-[var(--workspace-muted)]">{insight.body}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </SectionCard>

                  {view.reconcile ? (
                    <ReconcileSummaryCard
                      reconcile={view.reconcile}
                      currencyCode={currencyCode}
                    />
                  ) : null}

                </section>
              </>
            )}
          </section>

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
            <SectionCard
              title={isSpanish ? "Reservas recientes" : "Recent Bookings"}
              subtitle={
                isSpanish
                  ? "Las últimas estancias que están entrando ahora mismo en el negocio."
                  : "Latest stays entering the business right now."
              }
            >
              <div className="space-y-3">
                {view.recentBookings.length === 0 ? (
                  <div className="workspace-soft-card rounded-lg p-5 text-sm text-[var(--workspace-muted)]">
                    {isSpanish
                      ? "Todavía no hay reservas. Sube un archivo o añade la primera estancia para empezar a leer el negocio."
                      : "No bookings yet. Upload a workbook or add the first stay to start reading the business."}
                  </div>
                ) : (
                  view.recentBookings.map((booking, index) => {
                    const bookingStatus = getBookingStatusState(booking);

                    return (
                      <article
                        key={recordKey(booking, `${booking.checkIn}-${booking.guestName}`, index)}
                        className="workspace-soft-card rounded-lg p-4"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-2">
                            <div>
                              <p className="text-base font-semibold text-[var(--workspace-text)]">{booking.guestName}</p>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[var(--workspace-muted)]">
                                <span>
                                  {booking.propertyName}
                                  {booking.unitName ? ` • ${booking.unitName}` : ""}
                                </span>
                                <BookingChannelBadge channel={booking.channel} />
                              </div>
                            </div>
                            <p className="text-sm text-[var(--workspace-muted)]">
                              {formatDateLabel(booking.checkIn, locale)} {isSpanish ? "a" : "to"} {formatDateLabel(booking.checkout, locale)}
                            </p>
                          </div>

                          <div className="space-y-3 lg:min-w-[320px]">
                            <div className="flex items-center justify-end">
                              <BookingStatusBadge status={bookingStatus} />
                            </div>
                            <div className="grid gap-3 sm:grid-cols-3">
                              <div className="workspace-card rounded-lg px-3 py-3">
                                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">{isSpanish ? "Huéspedes" : "Guests"}</p>
                                <p className="mt-1 text-sm font-semibold text-[var(--workspace-text)]">{formatNumber(booking.guestCount, locale)}</p>
                              </div>
                              <div className="workspace-card rounded-lg px-3 py-3">
                                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">{isSpanish ? "Noches" : "Nights"}</p>
                                <p className="mt-1 text-sm font-semibold text-[var(--workspace-text)]">{formatNumber(booking.nights, locale)}</p>
                              </div>
                              <div className="workspace-card rounded-lg px-3 py-3">
                                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">Payout</p>
                                <p className="mt-1 text-sm font-semibold text-[var(--workspace-text)]">
                                  {formatCurrency(booking.payout, false, currencyCode, locale)}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </SectionCard>

            <SectionCard
              title={isSpanish ? "Gastos recientes" : "Recent Expenses"}
              subtitle={
                isSpanish
                  ? "Los últimos lugares donde salió dinero del negocio."
                  : "The latest places where money left the business."
              }
            >
              <div className="space-y-3">
                {view.recentExpenses.length === 0 ? (
                  <div className="workspace-soft-card rounded-lg p-5 text-sm text-[var(--workspace-muted)]">
                    {isSpanish
                      ? "Todavía no hay gastos. Añade costes para entender a dónde se va el dinero."
                      : "No expenses yet. Add costs to understand where money is going."}
                  </div>
                ) : (
                  view.recentExpenses.map((expense, index) => (
                    <div
                      key={recordKey(expense, `${expense.date}-${expense.description}`, index)}
                      className="workspace-soft-card rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2">
                          <p className="font-semibold text-[var(--workspace-text)]">{expense.description}</p>
                          <p className="text-sm text-[var(--workspace-muted)]">
                            {expense.category} • {expense.propertyName}
                            {expense.unitName ? ` • ${expense.unitName}` : ""}
                          </p>
                          <p className="text-sm text-[var(--workspace-muted)]">{formatDateLabel(expense.date, locale)}</p>
                          {expense.note ? <p className="text-sm text-[var(--workspace-muted)]">{expense.note}</p> : null}
                        </div>
                        <span className="text-sm font-semibold text-[var(--workspace-text)]">
                          {formatCurrency(expense.amount, false, currencyCode, locale)}
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
        bare
        alignTop
        onClose={() => setIsUploadOpen(false)}
      >
        <UploadPanel properties={properties} onCancel={() => setIsUploadOpen(false)} />
      </Modal>

      <Modal
        open={isEntryOpen}
        title={isSpanish ? "Añadir reserva o gasto" : "Add Booking or Expense"}
        onClose={() => setIsEntryOpen(false)}
      >
        <ManualEntryPanel properties={properties} />
      </Modal>
    </>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  Percent,
  ReceiptText,
  TriangleAlert,
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
import { getMarketDefinition } from "@/lib/markets";
import { ChartsPanel } from "@/components/charts-panel";
import { TaxEstimationCard } from "@/components/dashboard/TaxEstimationCard";
import { ExportReportLink } from "@/components/export-report-link";
import { FilterBar } from "@/components/filter-bar";
import { ManualEntryPanel } from "@/components/manual-entry-panel";
import { Modal } from "@/components/modal";
import { ReconcileSummaryCard } from "@/components/reconcile-panel";
import { getReconcileSidebarBadge } from "@/lib/reconcile";
import { SectionCard } from "@/components/section-card";
import { UploadPanel } from "@/components/upload-panel";
import { WorkspaceShell } from "@/components/workspace-shell";

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

function profitState(netProfit: number, locale: "en" | "es") {
  const isSpanish = locale === "es";
  if (netProfit > 0) {
    return {
      chip: isSpanish ? "Rentable" : "Profitable",
      chipClass: "bg-emerald-400/14 text-emerald-200",
      valueClass: "text-white",
      helper: isSpanish ? "Beneficio neto después de payout y gastos." : "Net profit after payout and expenses.",
    };
  }

  if (netProfit < 0) {
    return {
      chip: isSpanish ? "Perdiendo dinero" : "Losing money",
      chipClass: "bg-rose-400/14 text-rose-200",
      valueClass: "text-rose-200",
      helper: isSpanish ? "Los gastos pesan más que el payout en esta vista." : "Expenses are heavier than payout in this view.",
    };
  }

  return {
    chip: isSpanish ? "Punto de equilibrio" : "Break-even",
    chipClass: "bg-slate-400/14 text-slate-200",
    valueClass: "text-white",
    helper: isSpanish ? "El negocio no está ni por delante ni por detrás ahora mismo." : "The business is neither ahead nor behind right now.",
  };
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
  const profitMeta = profitState(view.metrics.netProfit, locale);
  const timeContext = getTimeContext(view, locale);
  const timeContextHint = getTimeContextHint(view, locale);
  const afterTaxPositive = view.metrics.profitAfterTax >= 0;
  const insights = view.mixedCurrencyMode ? [] : buildDashboardInsights(view, locale);
  const primaryHeroInsight = view.mixedCurrencyMode ? null : getPrimaryHeroInsight(view, locale);
  const expenseRatio =
    view.metrics.totalPayout > 0 ? view.metrics.totalExpenses / view.metrics.totalPayout : null;
  const hasHighExpenseRatio = expenseRatio !== null && expenseRatio > 0.6;
  const netProfitStrength =
    view.metrics.totalPayout > 0 ? view.metrics.netProfit / view.metrics.totalPayout : null;
  const hasStrongNetProfit =
    netProfitStrength !== null && view.metrics.netProfit > 0 && netProfitStrength > 0.2;
  const taxImpactRatio =
    view.metrics.netProfit > 0 ? view.metrics.estimatedTaxes / view.metrics.netProfit : null;
  const hasSignificantTaxImpact = taxImpactRatio !== null && taxImpactRatio > 0.25;
  const afterTaxChipLabel =
    view.metrics.profitAfterTax > 0
      ? isSpanish
        ? "Rentable tras impuestos"
        : "Profitable After Tax"
      : view.metrics.profitAfterTax < 0
        ? isSpanish
          ? "Por debajo del equilibrio"
          : "Below Break-Even"
        : isSpanish
          ? "Equilibrio tras impuestos"
          : "Break-Even After Tax";
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
                className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                  highlightUpgrade
                    ? "border border-amber-200/18 bg-[linear-gradient(135deg,rgba(251,191,36,0.24)_0%,rgba(245,158,11,0.16)_100%)] text-amber-50 shadow-[0_18px_36px_rgba(245,158,11,0.18)] hover:border-amber-200/28 hover:bg-[linear-gradient(135deg,rgba(251,191,36,0.3)_0%,rgba(245,158,11,0.2)_100%)]"
                    : "workspace-button-secondary"
                }`}
              >
                {upgradeLabel}
              </Link>
            ) : null}
            {reportExportEnabled ? (
              <ExportReportLink className="h-14 rounded-[24px] border border-[var(--workspace-accent)]/28 bg-[linear-gradient(180deg,rgba(31,83,93,0.88)_0%,rgba(22,65,74,0.88)_100%)] px-5 text-sm font-semibold text-slate-100 shadow-[0_18px_34px_rgba(6,20,35,0.2),inset_0_1px_0_rgba(255,255,255,0.05)] transition hover:border-[var(--workspace-accent)]/42 hover:bg-[linear-gradient(180deg,rgba(37,94,104,0.92)_0%,rgba(26,72,82,0.92)_100%)]" />
            ) : null}
            <button
              type="button"
              onClick={() => setIsUploadOpen(true)}
              className="workspace-button-secondary rounded-2xl px-4 py-3 text-sm font-semibold transition"
            >
              {isSpanish ? "Subir datos" : "Upload data"}
            </button>
            <button
              type="button"
              onClick={() => setIsEntryOpen(true)}
              className="workspace-button-primary rounded-2xl px-4 py-3 text-sm font-semibold transition"
            >
              {isSpanish ? "Añadir entrada" : "Add entry"}
            </button>
          </>
        }
      >
        <div className="space-y-8">
          <section className="space-y-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--workspace-muted)]">
                  {isSpanish ? "Resumen de rendimiento" : "Performance Overview"}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-semibold tracking-[-0.03em] text-[var(--workspace-text)] sm:text-[2rem]">
                    {timeContext}
                  </h2>
                  <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-xs font-semibold text-[var(--workspace-muted)]">
                    {timeContextHint}
                  </span>
                </div>
                <p className="max-w-2xl text-sm leading-7 text-[var(--workspace-muted)]">
                  {isSpanish
                    ? "Una vista más limpia del periodo seleccionado, con el beneficio después de impuestos en primer plano."
                    : "A cleaner snapshot of the selected period, with after-tax profit front and center."}
                </p>
              </div>

              <div className="xl:flex xl:flex-1 xl:justify-end">
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
              </div>
            </div>

            {view.mixedCurrencyMode ? (
              <SectionCard
                title={isSpanish ? "Vista portfolio" : "Portfolio View"}
                subtitle={
                  isSpanish
                    ? "All markets sirve para ver volumen de cartera, pero Hostlyx no fingirá un beneficio total convertido entre monedas mixtas."
                    : "All markets is useful for portfolio volume, but Hostlyx will not fake a converted profit total across mixed currencies."
                }
              >
                <div className="grid gap-4 xl:grid-cols-3">
                  {view.marketBreakdown.map((market) => {
                    const meta = getMarketDefinition(market.countryCode);

                    return (
                      <article key={market.countryCode} className="workspace-soft-card rounded-[24px] p-6">
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
                            <p className={`mt-2 text-sm font-semibold ${market.profit >= 0 ? "text-emerald-300" : "text-rose-200"}`}>
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
                <section className="grid gap-4">
                  <article className="workspace-card rounded-[32px] p-6 sm:p-7 xl:p-8">
                    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
                      <div className="space-y-5">
                        <div className="flex flex-wrap items-center gap-3">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${afterTaxPositive ? "bg-emerald-400/14 text-emerald-100" : "bg-rose-400/14 text-rose-100"}`}
                          >
                            {afterTaxChipLabel}
                          </span>
                          <span className="text-xs font-medium text-[var(--workspace-muted)]">
                            {timeContext}
                          </span>
                        </div>

                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--workspace-muted)]">
                            {isSpanish ? "Te quedas" : "You Keep"}
                          </p>
                          <p
                            className={`mt-5 text-5xl font-semibold tracking-[-0.05em] sm:text-6xl ${afterTaxPositive ? "text-[var(--workspace-text)]" : "text-rose-100"}`}
                          >
                            {formatCurrency(view.metrics.profitAfterTax, false, currencyCode)}
                          </p>
                            {primaryHeroInsight ? (
                              <p className="mt-4 max-w-2xl text-[15px] font-medium leading-7 text-slate-200">
                                {primaryHeroInsight}
                              </p>
                            ) : null}
                          <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--workspace-muted)]">
                            {isSpanish
                              ? "Después de payout, gastos operativos e impuestos estimados."
                              : "After payout, operating expenses, and estimated taxes."}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-3">
                        <div className="workspace-soft-card rounded-[26px] p-5">
                          <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                              {isSpanish ? "Reserva fiscal" : "Set Aside"}
                            </p>
                            {hasSignificantTaxImpact ? (
                              <span className="rounded-full border border-amber-200/14 bg-amber-300/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-100/90">
                                {isSpanish ? "Impacto fiscal alto" : "Significant tax impact"}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-[var(--workspace-text)]">
                            {formatCurrency(view.metrics.estimatedTaxes, false, currencyCode)}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-[var(--workspace-muted)]">
                            {isSpanish
                              ? "Reservado desde el beneficio neto según la vista fiscal actual y sus ajustes."
                              : "Reserved from net profit based on the current tax view and settings."}
                          </p>
                        </div>

                        <div className="workspace-soft-card rounded-[26px] p-5">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                            {isSpanish ? "Contexto de la vista" : "View Context"}
                          </p>
                          <p className="mt-3 text-xl font-semibold tracking-[-0.03em] text-[var(--workspace-text)]">
                            {timeContext}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-[var(--workspace-muted)]">
                            {timeContextHint}
                          </p>
                        </div>
                      </div>
                    </div>
                  </article>

                  <SectionCard
                    title={isSpanish ? "Insights clave" : "Key Insights"}
                    subtitle={isSpanish ? "Tres señales que merece la pena vigilar en la vista actual." : "Three signals worth watching in the current view."}
                  >
                    {!insightsEnabled ? (
                      <div className="workspace-soft-card rounded-[24px] p-5">
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
                          className="workspace-button-secondary mt-4 inline-flex rounded-2xl px-4 py-3 text-sm font-semibold transition"
                        >
                          {isSpanish ? "Ver planes" : "View plans"}
                        </Link>
                      </div>
                    ) : insights.length === 0 ? (
                      <div className="workspace-soft-card rounded-[24px] p-5 text-sm leading-7 text-[var(--workspace-muted)]">
                        {isSpanish ? "Todavía no hay suficientes señales significativas para este rango." : "Not enough meaningful signals yet for this time range."}
                      </div>
                    ) : (
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {insights.map((insight) => (
                          <article
                            key={`${insight.title}-${insight.body}`}
                            className={`workspace-soft-card rounded-[24px] p-5 ${
                              insight.tone === "positive"
                                ? "border-emerald-300/14 bg-[linear-gradient(180deg,rgba(16,185,129,0.08)_0%,rgba(15,23,42,0.18)_100%)]"
                                : insight.tone === "caution"
                                  ? "border-amber-300/16 bg-[linear-gradient(180deg,rgba(245,158,11,0.08)_0%,rgba(15,23,42,0.18)_100%)]"
                                  : ""
                            }`}
                          >
                            <p
                              className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${
                                insight.tone === "positive"
                                  ? "text-emerald-200"
                                  : insight.tone === "caution"
                                    ? "text-amber-100"
                                    : "text-[var(--workspace-muted)]"
                              }`}
                            >
                              {insight.title}
                            </p>
                            <p className="mt-3 text-sm font-medium leading-7 text-[var(--workspace-text)]">
                              {insight.body}
                            </p>
                          </article>
                        ))}
                      </div>
                    )}
                  </SectionCard>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <article
                      className={`rounded-[28px] p-6 transition ${
                        hasStrongNetProfit
                          ? "workspace-card border-emerald-300/14 bg-[linear-gradient(180deg,rgba(16,185,129,0.08)_0%,rgba(11,22,37,0.98)_100%)] shadow-[0_18px_34px_rgba(2,6,23,0.18),0_0_0_1px_rgba(16,185,129,0.04)]"
                          : "workspace-card"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--workspace-muted)]">
                            {isSpanish ? "Beneficio neto" : "Net Profit"}
                          </p>
                          <p className={`mt-4 text-3xl font-semibold tracking-[-0.04em] ${profitMeta.valueClass}`}>
                            {formatCurrency(view.metrics.netProfit, false, currencyCode)}
                          </p>
                          <p className="mt-3 text-sm leading-6 text-[var(--workspace-muted)]">
                            {isSpanish ? "Basado en payout, no en ingresos brutos." : "Based on payout, not gross revenue."}
                          </p>
                        </div>
                        <div
                          className={`rounded-[18px] p-3 ${
                            hasStrongNetProfit
                              ? "border border-emerald-300/14 bg-emerald-400/10 text-emerald-100"
                              : "workspace-icon-chip"
                          }`}
                        >
                          <TrendingUp className="h-4 w-4" />
                        </div>
                      </div>
                    </article>

                    <article className="workspace-card rounded-[28px] p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--workspace-muted)]">
                            {isSpanish ? "Payout neto" : "Net Payout"}
                          </p>
                          <p className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-[var(--workspace-text)]">
                            {formatCurrency(view.metrics.totalPayout, false, currencyCode)}
                          </p>
                          <p className="mt-3 text-sm leading-6 text-[var(--workspace-muted)]">
                            {isSpanish ? "Caja real recibida después de comisiones de plataforma." : "Actual cash received after platform fees."}
                          </p>
                        </div>
                        <div className="workspace-icon-chip rounded-[18px] p-3">
                          <ArrowDownRight className="h-4 w-4" />
                        </div>
                      </div>
                    </article>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <article className="workspace-soft-card rounded-[26px] p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400/85">
                            {isSpanish ? "Ingresos brutos" : "Gross Revenue"}
                          </p>
                          <p className="mt-3 text-[1.75rem] font-semibold tracking-[-0.04em] text-[var(--workspace-text)]">
                            {formatCurrency(view.metrics.totalRevenue, false, currencyCode, locale)}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-[var(--workspace-muted)]">
                            {isSpanish
                              ? "Valor total de las reservas antes de comisiones de plataforma."
                              : "Total booking value before platform fees."}
                          </p>
                        </div>
                        <div className="workspace-icon-chip rounded-[18px] p-3">
                          <Wallet className="h-4 w-4" />
                        </div>
                      </div>
                    </article>

                    <article
                      className={`rounded-[26px] p-5 transition ${
                        hasHighExpenseRatio
                          ? "workspace-soft-card border-amber-200/16 bg-[linear-gradient(180deg,rgba(245,158,11,0.08)_0%,rgba(10,20,34,0.9)_100%)] shadow-[0_14px_30px_rgba(2,6,23,0.12),0_0_0_1px_rgba(245,158,11,0.04)]"
                          : "workspace-soft-card"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400/85">
                              {isSpanish ? "Gastos totales" : "Total Expenses"}
                            </p>
                            {hasHighExpenseRatio ? (
                              <span className="rounded-full border border-amber-200/14 bg-amber-300/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-100/90">
                                {isSpanish ? "Ratio de costes alto" : "High cost ratio"}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-3 text-[1.75rem] font-semibold tracking-[-0.04em] text-[var(--workspace-text)]">
                            {formatCurrency(view.metrics.totalExpenses, false, currencyCode, locale)}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-[var(--workspace-muted)]">
                            {isSpanish
                              ? "Costes operativos en el periodo seleccionado."
                              : "Operating costs in the selected period."}
                          </p>
                          {hasHighExpenseRatio && expenseRatio !== null ? (
                            <p className="mt-3 text-sm font-medium leading-6 text-amber-100/88">
                              {isSpanish
                                ? `Consume ${formatWholePercent(expenseRatio)} del payout.`
                                : `Consumes ${formatWholePercent(expenseRatio)} of payout.`}
                            </p>
                          ) : null}
                        </div>
                        <div
                          className={`rounded-[18px] p-3 ${
                            hasHighExpenseRatio
                              ? "border border-amber-200/14 bg-amber-300/10 text-amber-100"
                              : "border border-rose-300/10 bg-rose-400/10 text-rose-200"
                          }`}
                        >
                          {hasHighExpenseRatio ? (
                            <TriangleAlert className="h-4 w-4" />
                          ) : (
                            <ReceiptText className="h-4 w-4" />
                          )}
                        </div>
                      </div>
                    </article>

                    <article className="workspace-soft-card rounded-[26px] p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400/85">
                            {isSpanish ? "Margen de beneficio" : "Profit Margin"}
                          </p>
                          <p
                            className={`mt-3 text-[1.75rem] font-semibold tracking-[-0.04em] ${view.metrics.profitMargin >= 0 ? "text-[var(--workspace-text)]" : "text-rose-100"}`}
                          >
                            {formatPercent(view.metrics.profitMargin, locale)}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-[var(--workspace-muted)]">
                            {isSpanish
                              ? "Beneficio neto como parte de los ingresos brutos."
                              : "Net profit as a share of gross revenue."}
                          </p>
                        </div>
                        <div className="workspace-icon-chip rounded-[18px] p-3">
                          <Percent className="h-4 w-4" />
                        </div>
                      </div>
                    </article>
                  </div>

                  {view.reconcile ? (
                    <ReconcileSummaryCard
                      reconcile={view.reconcile}
                      currencyCode={currencyCode}
                    />
                  ) : null}

                  <div className="grid gap-4 border-t border-white/6 pt-4 md:grid-cols-2 xl:grid-cols-4">
                    <article className="workspace-soft-card rounded-[24px] p-5">
                      <div className="flex items-center gap-3">
                        <div className="rounded-[18px] border border-white/8 bg-white/[0.04] p-3 text-[var(--workspace-text)]">
                          <ReceiptText className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                            {isSpanish ? "Impuestos estimados" : "Estimated Taxes"}
                          </p>
                          <p className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[var(--workspace-text)]">
                            {formatCurrency(view.metrics.estimatedTaxes, false, currencyCode, locale)}
                          </p>
                        </div>
                      </div>
                    </article>

                    <article className="workspace-soft-card rounded-[24px] p-5">
                      <div className="flex items-center gap-3">
                        <div className="workspace-icon-chip rounded-[18px] p-3">
                          <CalendarDays className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                            {isSpanish ? "Reservas" : "Bookings"}
                          </p>
                          <p className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[var(--workspace-text)]">
                            {formatNumber(view.metrics.bookingsCount, locale)}
                          </p>
                        </div>
                      </div>
                    </article>

                    <article className="workspace-soft-card rounded-[24px] p-5">
                      <div className="flex items-center gap-3">
                        <div className="workspace-icon-chip rounded-[18px] p-3">
                          <TrendingUp className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">ADR</p>
                          <p className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[var(--workspace-text)]">
                            {formatCurrency(view.metrics.adr, false, currencyCode, locale)}
                          </p>
                        </div>
                      </div>
                    </article>

                    <article className="workspace-soft-card rounded-[24px] p-5">
                      <div className="flex items-center gap-3">
                        <div className="workspace-icon-chip rounded-[18px] p-3">
                          <ArrowUpRight className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                            {isSpanish ? "Ocupación" : "Occupancy"}
                          </p>
                          <p className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[var(--workspace-text)]">
                            {formatPercent(view.metrics.occupancyRate, locale)}
                          </p>
                        </div>
                      </div>
                    </article>
                  </div>
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
                  <div className="workspace-soft-card rounded-[22px] p-5 text-sm text-[var(--workspace-muted)]">
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
                        className="workspace-soft-card rounded-[22px] p-4"
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
                              <div className="workspace-card rounded-[18px] px-3 py-3">
                                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">{isSpanish ? "Huéspedes" : "Guests"}</p>
                                <p className="mt-1 text-sm font-semibold text-[var(--workspace-text)]">{formatNumber(booking.guestCount, locale)}</p>
                              </div>
                              <div className="workspace-card rounded-[18px] px-3 py-3">
                                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">{isSpanish ? "Noches" : "Nights"}</p>
                                <p className="mt-1 text-sm font-semibold text-[var(--workspace-text)]">{formatNumber(booking.nights, locale)}</p>
                              </div>
                              <div className="workspace-card rounded-[18px] px-3 py-3">
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
                  <div className="workspace-soft-card rounded-[22px] p-5 text-sm text-[var(--workspace-muted)]">
                    {isSpanish
                      ? "Todavía no hay gastos. Añade costes para entender a dónde se va el dinero."
                      : "No expenses yet. Add costs to understand where money is going."}
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

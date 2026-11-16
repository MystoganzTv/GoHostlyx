"use client";

import { ArrowDownRight, ArrowUpRight, Landmark, Wallet } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import { MetricCard } from "@/components/metric-card";
import { SectionCard } from "@/components/section-card";
import { formatCurrency, formatNumber, formatPercent, formatMonthLabel } from "@/lib/format";
import type { CurrencyCode, DashboardView } from "@/lib/types";

function averageNetCashflow(view: DashboardView) {
  const months = view.monthlySummary.length;
  return months > 0 ? view.metrics.netProfit / months : 0;
}

export function CashflowPanel({
  view,
  currencyCode,
}: {
  view: DashboardView;
  currencyCode: CurrencyCode;
}) {
  const { locale } = useLocale();
  const isSpanish = locale === "es";
  const coverageRatio =
    view.metrics.totalExpenses > 0 ? view.metrics.netPayout / view.metrics.totalExpenses : 0;

  return (
    <div className="space-y-6">
      <div className={`metric-strip grid ${view.mixedCurrencyMode ? "md:grid-cols-3" : "md:grid-cols-2 xl:grid-cols-4"}`}>
        <MetricCard
          label={isSpanish ? "Payout de entrada" : "Payout In"}
          value={view.metrics.netPayout}
          format="currency"
          currencyCode={currencyCode}
          locale={locale}
          helper={isSpanish ? "Entrada operativa esperada desde payouts de canal" : "Expected operating inflow from channel payouts"}
          icon={<ArrowDownRight className="h-5 w-5" />}
        />
        <MetricCard
          label={isSpanish ? "Gastos de salida" : "Expenses Out"}
          value={view.metrics.totalExpenses}
          format="currency"
          currencyCode={currencyCode}
          locale={locale}
          helper={isSpanish ? "Gasto operativo saliendo del negocio" : "Operating spend leaving the business"}
          icon={<ArrowUpRight className="h-5 w-5" />}
        />
        <MetricCard
          label={isSpanish ? "Flujo operativo neto" : "Net Operating Flow"}
          value={view.metrics.netProfit}
          format="currency"
          currencyCode={currencyCode}
          locale={locale}
          helper={
            isSpanish
              ? "Payout de canal menos gastos en el rango seleccionado"
              : "Channel payout minus expenses in the selected range"
          }
          icon={<Wallet className="h-5 w-5" />}
        />
        {!view.mixedCurrencyMode ? (
          <MetricCard
            label={isSpanish ? "Ratio de cobertura" : "Coverage Ratio"}
            value={coverageRatio}
            format="percent"
            currencyCode={currencyCode}
            locale={locale}
            helper={
              isSpanish
            ? "Cuánto cubren los payouts operativos la carga de gastos"
                : "How much operating payouts cover expense load"
            }
            icon={<Landmark className="h-5 w-5" />}
          />
        ) : null}
      </div>

      {!view.mixedCurrencyMode ? (
        <SectionCard
          title={isSpanish ? "Salud operativa" : "Operating Health"}
          subtitle={
            isSpanish
              ? "Formas rápidas de leer con qué comodidad operativa se sostuvo el periodo seleccionado."
              : "Quick ways to read how comfortably the selected period sustained itself operationally."
          }
        >
          <div className="grid gap-4 md:grid-cols-4">
            <div className="workspace-soft-card rounded-lg p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                {isSpanish ? "Promedio mensual" : "Monthly average"}
              </p>
              <p className="tnum mt-2 text-2xl font-semibold text-[var(--workspace-text)]">
                {formatCurrency(averageNetCashflow(view), false, currencyCode, locale)}
              </p>
            </div>
            <div className="workspace-soft-card rounded-lg p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                {isSpanish ? "Cobertura" : "Coverage"}
              </p>
              <p className="mt-2 text-2xl font-semibold text-[var(--workspace-text)]">
                {formatPercent(coverageRatio, locale)}
              </p>
            </div>
            <div className="workspace-soft-card rounded-lg p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                {isSpanish ? "Peso del gasto" : "Expense Share"}
              </p>
              <p className="mt-2 text-2xl font-semibold text-[var(--workspace-text)]">
                {formatPercent(view.metrics.netPayout > 0 ? view.metrics.totalExpenses / view.metrics.netPayout : 0, locale)}
              </p>
            </div>
            <div className="workspace-soft-card rounded-lg p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                {isSpanish ? "Margen neto" : "Net Margin"}
              </p>
              <p className="mt-2 text-2xl font-semibold text-[var(--workspace-text)]">
                {formatPercent(view.metrics.profitMargin, locale)}
              </p>
            </div>
          </div>
        </SectionCard>
      ) : null}

      {view.mixedCurrencyMode ? (
        <SectionCard
          title={isSpanish ? "Flujo operativo por mercado" : "Operating Flow by Market"}
          subtitle={
            isSpanish
              ? "El modo de todos los mercados mantiene cada mercado en su moneda real en lugar de fingir un total convertido."
              : "All markets mode keeps each market in its real currency instead of faking one converted total."
          }
        >
          <div className="grid gap-4 xl:grid-cols-3">
            {view.marketBreakdown.map((market) => (
              <article key={market.countryCode} className="workspace-soft-card rounded-lg p-4">
                <p className="text-base font-semibold text-[var(--workspace-text)]">{market.countryCode}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                  {market.currencyCode}
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                      {isSpanish ? "Entrada" : "In"}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[var(--workspace-text)]">
                      {formatCurrency(market.payout, false, market.currencyCode, locale)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                      {isSpanish ? "Salida" : "Out"}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[var(--workspace-text)]">
                      {formatCurrency(market.expenses, false, market.currencyCode, locale)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                      {isSpanish ? "Neto" : "Net"}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[var(--workspace-text)]">
                      {formatCurrency(market.profit, false, market.currencyCode, locale)}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </SectionCard>
      ) : (
        <SectionCard
          title={isSpanish ? "Flujo operativo mensual" : "Monthly Operating Flow"}
          subtitle={
            isSpanish
              ? "Sigue payout de entrada, gastos de salida y el flujo operativo neto resultante mes a mes."
              : "Track payout in, expenses out, and resulting net operating flow month by month."
          }
        >
          <div className="space-y-3 md:hidden">
            {view.monthlySummary.map((month) => (
              <article key={month.label} className="workspace-soft-card rounded-lg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-[var(--workspace-text)]">{formatMonthLabel(month, locale)}</p>
                    <p className="mt-1 text-sm text-[var(--workspace-muted)]">
                      {formatNumber(month.bookings, locale)} {isSpanish ? "reservas" : "bookings"} • {formatNumber(month.nights, locale)} {isSpanish ? "noches" : "nights"}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-[var(--workspace-text)]">
                    {formatCurrency(month.profit, false, currencyCode, locale)}
                  </p>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">{isSpanish ? "Entrada" : "Payout In"}</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--workspace-text)]">
                      {formatCurrency(month.payout, false, currencyCode, locale)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">{isSpanish ? "Salida" : "Expenses Out"}</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--workspace-text)]">
                      {formatCurrency(month.expenses, false, currencyCode, locale)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">{isSpanish ? "Neto" : "Net"}</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--workspace-text)]">
                      {formatCurrency(month.profit, false, currencyCode, locale)}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                <tr>
                  <th className="pb-3 pr-4 font-medium">{isSpanish ? "Mes" : "Month"}</th>
                  <th className="pb-3 pr-4 font-medium">{isSpanish ? "Entrada" : "Payout In"}</th>
                  <th className="pb-3 pr-4 font-medium">{isSpanish ? "Salida" : "Expenses Out"}</th>
                  <th className="pb-3 pr-4 font-medium">{isSpanish ? "Neto" : "Net"}</th>
                  <th className="pb-3 pr-4 font-medium">{isSpanish ? "Reservas" : "Bookings"}</th>
                  <th className="pb-3 font-medium">{isSpanish ? "Noches" : "Nights"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--workspace-border)] text-[var(--workspace-text)]">
                {view.monthlySummary.map((month) => (
                  <tr key={month.label}>
                    <td className="py-4 pr-4 font-medium">{formatMonthLabel(month, locale)}</td>
                    <td className="tnum py-4 pr-4 font-medium text-info">{formatCurrency(month.payout, false, currencyCode, locale)}</td>
                    <td className="tnum py-4 pr-4 font-medium text-neg">{formatCurrency(month.expenses, false, currencyCode, locale)}</td>
                    <td className={`tnum py-4 pr-4 font-medium ${month.profit >= 0 ? "text-pos" : "text-neg"}`}>{formatCurrency(month.profit, false, currencyCode, locale)}</td>
                    <td className="py-4 pr-4">{formatNumber(month.bookings, locale)}</td>
                    <td className="py-4">{formatNumber(month.nights, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

    </div>
  );
}

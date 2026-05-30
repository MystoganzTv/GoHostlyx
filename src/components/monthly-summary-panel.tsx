import { SectionCard } from "@/components/section-card";
import { useLocale } from "@/components/locale-provider";
import { MetricCard } from "@/components/metric-card";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import type { CurrencyCode, DashboardView, MonthlyPoint } from "@/lib/types";

function findTopMonth(months: MonthlyPoint[]) {
  return months.reduce<MonthlyPoint | null>((best, month) => {
    if (!best || month.profit > best.profit) {
      return month;
    }

    return best;
  }, null);
}

export function MonthlySummaryPanel({
  view,
  currencyCode,
  rangeLabel,
}: {
  view: DashboardView;
  currencyCode: CurrencyCode;
  rangeLabel: string;
}) {
  const { locale } = useLocale();
  const isSpanish = locale === "es";
  const monthsInView = view.monthlySummary.length;
  const topMonth = findTopMonth(view.monthlySummary);
  const averageRevenue =
    monthsInView > 0 ? view.metrics.grossRevenue / monthsInView : 0;
  const averageProfit =
    monthsInView > 0 ? view.metrics.netProfit / monthsInView : 0;

  const cards = view.mixedCurrencyMode
    ? [
        {
          label: isSpanish ? "Meses en vista" : "Months in View",
          value: monthsInView,
          format: "number" as const,
        },
        {
          label: isSpanish ? "Reservas" : "Bookings",
          value: view.metrics.bookingsCount,
          format: "number" as const,
        },
        {
          label: isSpanish ? "Huéspedes" : "Guests",
          value: view.metrics.guestsCount,
          format: "number" as const,
        },
        {
          label: isSpanish ? "Noches" : "Nights",
          value: view.metrics.nightsBooked,
          format: "number" as const,
        },
      ]
    : [
        {
          label: isSpanish ? "Meses en vista" : "Months in View",
          value: monthsInView,
          format: "number" as const,
        },
        {
          label: isSpanish ? "Ingreso mensual medio" : "Average Monthly Revenue",
          value: averageRevenue,
          format: "currency" as const,
        },
        {
          label: isSpanish ? "Beneficio mensual medio" : "Average Monthly Profit",
          value: averageProfit,
          format: "currency" as const,
        },
        {
          label: isSpanish ? "Reservas" : "Bookings",
          value: view.metrics.bookingsCount,
          format: "number" as const,
        },
        {
          label: isSpanish ? "Huéspedes" : "Guests",
          value: view.metrics.guestsCount,
          format: "number" as const,
        },
      ];

  return (
    <div className="space-y-6">
      <SectionCard
        title={isSpanish ? "Cómo funciona esta vista" : "How This View Works"}
        subtitle={
          isSpanish
            ? "Esta página compara meses entre sí en lugar de hacer zoom en un solo mes."
            : "This page compares months against each other instead of zooming into one single month."
        }
      >
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="workspace-soft-card rounded-[22px] p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
              {isSpanish ? "Ventana de reporte" : "Reporting window"}
            </p>
            <p className="mt-2 text-2xl font-semibold text-[var(--workspace-text)]">
              {rangeLabel}
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--workspace-muted)]">
              {isSpanish
                ? "Hostlyx agrupa tus reservas y gastos guardados mes a mes para que puedas comparar estacionalidad, ritmo y rentabilidad."
                : "Hostlyx groups your saved bookings and expenses month by month so you can compare seasonality, pace, and profitability."}
            </p>
          </div>
          <div className="workspace-soft-card rounded-[22px] p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
              {isSpanish ? "Consejo de lectura" : "Reading tip"}
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--workspace-muted)]">
              {isSpanish
                ? "Ingresos y payout se agrupan por el mes de check-in de la reserva. Los gastos se quedan en su propio mes de gasto. Usa esta página para comparar meses y luego Dashboard o Calendar cuando quieras una vista operativa más cercana."
                : "Revenue and payout are grouped by booking check-in month. Expenses stay in their own expense month. Use this page to compare months, then use Dashboard or Calendar when you want a closer operational view."}
            </p>
          </div>
        </div>
      </SectionCard>

      <div className={`grid gap-4 ${view.mixedCurrencyMode ? "md:grid-cols-3" : "md:grid-cols-2 xl:grid-cols-4"}`}>
        {cards.map((card) => (
          <MetricCard
            key={card.label}
            label={card.label}
            value={card.value}
            format={card.format}
            currencyCode={currencyCode}
            locale={locale}
          />
        ))}
      </div>

      {view.mixedCurrencyMode ? (
        <SectionCard
          title={isSpanish ? "Vista portfolio mensual" : "Monthly Portfolio View"}
          subtitle={
            isSpanish
              ? "Selecciona un mercado para ver valores monetarios exactos por mes."
              : "Select one market to see exact money values by month."
          }
        >
          <div className="workspace-soft-card rounded-[22px] p-4 text-sm leading-6 text-[var(--workspace-muted)]">
            {isSpanish
              ? "`All markets` mezcla monedas reales, así que Hostlyx solo muestra aquí datos mensuales no monetarios hasta que elijas un mercado."
              : "`All markets` mixes real currencies, so Hostlyx only shows non-monetary monthly data here until you choose one market."}
          </div>
        </SectionCard>
      ) : null}

      {topMonth && !view.mixedCurrencyMode ? (
        <SectionCard
          title={isSpanish ? "Mejor mes" : "Best Month"}
          subtitle={
            isSpanish
              ? "Lectura rápida del mes más fuerte en la ventana de filtros actual."
              : "Quick read on the strongest month in the current filter window."
          }
        >
          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="workspace-soft-card rounded-[22px] p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                {isSpanish ? "Mes top" : "Top month"}
              </p>
              <p className="mt-2 text-2xl font-semibold text-[var(--workspace-text)]">
                {topMonth.label}
              </p>
              <p className="mt-2 text-sm text-[var(--workspace-muted)]">
                {isSpanish
                  ? `${formatNumber(topMonth.bookings, locale)} reservas, ${formatNumber(topMonth.guests, locale)} huéspedes y ${formatNumber(topMonth.nights, locale)} noches`
                  : `${formatNumber(topMonth.bookings, locale)} bookings, ${formatNumber(topMonth.guests, locale)} guests, and ${formatNumber(topMonth.nights, locale)} nights`}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="workspace-soft-card rounded-[22px] p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                  {isSpanish ? "Ingresos" : "Revenue"}
                </p>
                <p className="mt-2 text-lg font-semibold text-[var(--workspace-text)]">
                  {formatCurrency(topMonth.revenue, false, currencyCode, locale)}
                </p>
              </div>
              <div className="workspace-soft-card rounded-[22px] p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                  {isSpanish ? "Beneficio" : "Profit"}
                </p>
                <p className="mt-2 text-lg font-semibold text-[var(--workspace-text)]">
                  {formatCurrency(topMonth.profit, false, currencyCode, locale)}
                </p>
              </div>
              <div className="workspace-soft-card rounded-[22px] p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                  Payout
                </p>
                <p className="mt-2 text-lg font-semibold text-[var(--workspace-text)]">
                  {formatCurrency(topMonth.payout, false, currencyCode, locale)}
                </p>
              </div>
              <div className="workspace-soft-card rounded-[22px] p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                  {isSpanish ? "Margen" : "Margin"}
                </p>
                <p className="mt-2 text-lg font-semibold text-[var(--workspace-text)]">
                  {formatPercent(topMonth.revenue > 0 ? topMonth.profit / topMonth.revenue : 0, locale)}
                </p>
              </div>
            </div>
          </div>
        </SectionCard>
      ) : null}

      <SectionCard
        title={isSpanish ? "Desglose mensual" : "Monthly Breakdown"}
        subtitle={
          isSpanish
            ? "Ingresos, payout, gastos, beneficio, reservas y noches agrupados por mes."
            : "Revenue, payout, expenses, profit, bookings, and nights grouped by month."
        }
      >
        <div className="space-y-3 md:hidden">
          {view.monthlySummary.map((month) => {
            const margin = month.revenue > 0 ? month.profit / month.revenue : 0;

            return (
              <article
                key={month.label}
                className="workspace-soft-card rounded-[22px] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-[var(--workspace-text)]">
                      {month.label}
                    </p>
                    <p className="mt-1 text-sm text-[var(--workspace-muted)]">
                      {formatNumber(month.bookings, locale)} {isSpanish ? "reservas" : "bookings"} • {formatNumber(month.guests, locale)} {isSpanish ? "huéspedes" : "guests"} • {formatNumber(month.nights, locale)} {isSpanish ? "noches" : "nights"}
                    </p>
                  </div>
                  {!view.mixedCurrencyMode ? (
                    <p className="text-sm font-semibold text-[var(--workspace-text)]">
                      {formatCurrency(month.profit, false, currencyCode, locale)}
                    </p>
                  ) : null}
                </div>

                {view.mixedCurrencyMode ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                        {isSpanish ? "Reservas" : "Bookings"}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[var(--workspace-text)]">
                        {formatNumber(month.bookings, locale)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                        {isSpanish ? "Huéspedes" : "Guests"}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[var(--workspace-text)]">
                        {formatNumber(month.guests, locale)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                        {isSpanish ? "Noches" : "Nights"}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[var(--workspace-text)]">
                        {formatNumber(month.nights, locale)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                        {isSpanish ? "Ingresos" : "Revenue"}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[var(--workspace-text)]">
                        {formatCurrency(month.revenue, false, currencyCode, locale)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                        Payout
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[var(--workspace-text)]">
                        {formatCurrency(month.payout, false, currencyCode, locale)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                        Expenses
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[var(--workspace-text)]">
                        {formatCurrency(month.expenses, false, currencyCode)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                        Margin
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[var(--workspace-text)]">
                        {formatPercent(margin)}
                      </p>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
              <tr>
                <th className="pb-3 pr-4 font-medium">Month</th>
                <th className="pb-3 pr-4 font-medium">Bookings</th>
                <th className="pb-3 pr-4 font-medium">Guests</th>
                <th className="pb-3 pr-4 font-medium">Nights</th>
                {!view.mixedCurrencyMode ? (
                  <>
                    <th className="pb-3 pr-4 font-medium">Revenue</th>
                    <th className="pb-3 pr-4 font-medium">Payout</th>
                    <th className="pb-3 pr-4 font-medium">Expenses</th>
                    <th className="pb-3 pr-4 font-medium">Profit</th>
                    <th className="pb-3 font-medium">Margin</th>
                  </>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--workspace-border)] text-[var(--workspace-text)]">
              {view.monthlySummary.map((month) => {
                const margin = month.revenue > 0 ? month.profit / month.revenue : 0;

                return (
                  <tr key={month.label}>
                    <td className="py-4 pr-4 font-medium">{month.label}</td>
                    <td className="py-4 pr-4">{formatNumber(month.bookings)}</td>
                    <td className="py-4 pr-4">{formatNumber(month.guests)}</td>
                    <td className="py-4 pr-4">{formatNumber(month.nights)}</td>
                    {!view.mixedCurrencyMode ? (
                      <>
                        <td className="py-4 pr-4">{formatCurrency(month.revenue, false, currencyCode)}</td>
                        <td className="py-4 pr-4">{formatCurrency(month.payout, false, currencyCode)}</td>
                        <td className="py-4 pr-4">{formatCurrency(month.expenses, false, currencyCode)}</td>
                        <td className="py-4 pr-4">{formatCurrency(month.profit, false, currencyCode)}</td>
                        <td className="py-4">{formatPercent(margin)}</td>
                      </>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

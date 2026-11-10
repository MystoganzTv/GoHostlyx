"use client";

import {
  BarChart3,
  CalendarDays,
  House,
  Percent,
  TrendingUp,
  Users,
} from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import { MetricCard } from "@/components/metric-card";
import { SectionCard } from "@/components/section-card";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import type { CurrencyCode, DashboardView } from "@/lib/types";

function topChannel(view: DashboardView) {
  return view.revenueByChannel[0] ?? null;
}

function bestMonth(view: DashboardView) {
  return (
    [...view.monthlySummary].sort(
      (left, right) => right.revenue - left.revenue,
    )[0] ?? null
  );
}

export function PerformancePanel({
  view,
  currencyCode,
}: {
  view: DashboardView;
  currencyCode: CurrencyCode;
}) {
  const { locale } = useLocale();
  const isSpanish = locale === "es";
  const leadingChannel = topChannel(view);
  const strongestMonth = bestMonth(view);

  return (
    <div className="space-y-6">
      <div className="metric-strip grid md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={isSpanish ? "Reservas" : "Bookings"}
          value={view.metrics.bookingsCount}
          format="number"
          currencyCode={currencyCode}
          locale={locale}
          helper={
            isSpanish
              ? "Estancias confirmadas dentro del filtro actual"
              : "Confirmed stays in the current filter window"
          }
          icon={<CalendarDays className="h-5 w-5" />}
        />
        <MetricCard
          label={isSpanish ? "Huéspedes" : "Guests"}
          value={view.metrics.guestsCount}
          format="number"
          currencyCode={currencyCode}
          locale={locale}
          helper={
            isSpanish
              ? "Total de huéspedes en las reservas guardadas"
              : "Total guest count across saved bookings"
          }
          icon={<Users className="h-5 w-5" />}
        />
        <MetricCard
          label={isSpanish ? "Noches" : "Nights"}
          value={view.metrics.nightsBooked}
          format="number"
          currencyCode={currencyCode}
          locale={locale}
          helper={
            isSpanish
              ? "Noches reservadas capturadas en GoHostlyx"
              : "Booked nights captured in GoHostlyx"
          }
          icon={<House className="h-5 w-5" />}
        />
        <MetricCard
          label={isSpanish ? "Ocupación" : "Occupancy"}
          value={view.metrics.occupancyRate}
          format="percent"
          currencyCode={currencyCode}
          locale={locale}
          helper={
            isSpanish
              ? "Noches reservadas frente a la ventana visible del calendario"
              : "Booked nights versus the visible calendar window"
          }
          icon={<Percent className="h-5 w-5" />}
        />
        {!view.mixedCurrencyMode ? (
          <MetricCard
            label="ADR"
            value={view.metrics.adr}
            format="currency"
            currencyCode={currencyCode}
            locale={locale}
            helper={
              isSpanish
                ? "Ingreso medio por noche reservada"
                : "Average rental revenue per booked night"
            }
            icon={<BarChart3 className="h-5 w-5" />}
          />
        ) : null}
        {!view.mixedCurrencyMode ? (
          <>
            <MetricCard
              label="RevPAR"
              value={view.metrics.revPar}
              format="currency"
              currencyCode={currencyCode}
              locale={locale}
              helper={
                isSpanish
                  ? "Ingreso de alquiler repartido entre todas las noches visibles"
                  : "Rental revenue spread across all visible nights"
              }
              icon={<TrendingUp className="h-5 w-5" />}
            />
            <MetricCard
              label={isSpanish ? "Margen de beneficio" : "Profit Margin"}
              value={view.metrics.profitMargin}
              format="percent"
              currencyCode={currencyCode}
              locale={locale}
              helper={
                isSpanish
                  ? "Beneficio neto frente a ingresos brutos"
                  : "Net profit versus gross revenue"
              }
              icon={<Percent className="h-5 w-5" />}
            />
            <MetricCard
              label={isSpanish ? "Ingreso por reserva" : "Revenue per Booking"}
              value={
                view.metrics.bookingsCount > 0
                  ? view.metrics.grossRevenue / view.metrics.bookingsCount
                  : 0
              }
              format="currency"
              currencyCode={currencyCode}
              locale={locale}
              helper={
                isSpanish
                  ? "Ingreso total medio generado por estancia"
                  : "Average total revenue generated per stay"
              }
              icon={<BarChart3 className="h-5 w-5" />}
            />
          </>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.04fr_0.96fr]">
        <SectionCard
          title={isSpanish ? "Impulsores principales" : "Top Drivers"}
          subtitle={
            isSpanish
              ? "Qué está liderando el rendimiento dentro de los filtros actuales."
              : "What is leading performance inside the current filters."
          }
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="workspace-soft-card rounded-lg p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                {isSpanish ? "Mes más fuerte" : "Strongest month"}
              </p>
              <p className="mt-2 text-xl font-semibold text-[var(--workspace-text)]">
                {strongestMonth?.label ??
                  (isSpanish ? "Todavía sin mes" : "No month yet")}
              </p>
              <p className="mt-3 text-sm leading-6 text-[var(--workspace-muted)]">
                {strongestMonth
                  ? isSpanish
                    ? `${formatNumber(strongestMonth.bookings, locale)} reservas, ${formatNumber(strongestMonth.guests, locale)} huéspedes y ${formatNumber(strongestMonth.nights, locale)} noches`
                    : `${formatNumber(strongestMonth.bookings, locale)} bookings, ${formatNumber(strongestMonth.guests, locale)} guests, and ${formatNumber(strongestMonth.nights, locale)} nights`
                  : isSpanish
                    ? "Importa o añade algunas reservas para empezar a leer el rendimiento por mes."
                    : "Import or add some bookings to start reading month-level performance."}
              </p>
            </div>
            <div className="workspace-soft-card rounded-lg p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                {isSpanish ? "Canal líder" : "Leading channel"}
              </p>
              <p className="mt-2 text-xl font-semibold text-[var(--workspace-text)]">
                {leadingChannel?.label ??
                  (isSpanish ? "Todavía sin canal" : "No channel yet")}
              </p>
              <p className="mt-3 text-sm leading-6 text-[var(--workspace-muted)]">
                {leadingChannel
                  ? isSpanish
                    ? `${formatNumber(leadingChannel.bookings, locale)} reservas en la vista actual`
                    : `${formatNumber(leadingChannel.bookings, locale)} bookings in the current view`
                  : isSpanish
                    ? "Las reservas mostrarán automáticamente el canal más fuerte."
                    : "Bookings will surface the strongest channel automatically."}
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title={isSpanish ? "Mezcla por canales" : "Channel Mix"}
          subtitle={
            isSpanish
              ? "Contribución de ingresos por fuente de reserva."
              : "Revenue contribution by booking source."
          }
        >
          <div className="space-y-3">
            {view.revenueByChannel.length === 0 ? (
              <div className="workspace-soft-card rounded-lg p-5 text-sm text-[var(--workspace-muted)]">
                {isSpanish
                  ? "Todavía no hay canales. Añade reservas o importa un archivo para poblar el rendimiento por canal."
                  : "No channels yet. Add bookings or import a workbook to populate channel performance."}
              </div>
            ) : (
              view.revenueByChannel.slice(0, 5).map((channel) => {
                const share =
                  view.metrics.grossRevenue > 0
                    ? channel.revenue / view.metrics.grossRevenue
                    : 0;

                return (
                  <article
                    key={channel.label}
                    className="workspace-soft-card rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-[var(--workspace-text)]">
                          {channel.label}
                        </p>
                        <p className="mt-1 text-sm text-[var(--workspace-muted)]">
                          {formatNumber(channel.bookings, locale)}{" "}
                          {isSpanish ? "reservas" : "bookings"}
                        </p>
                      </div>
                      {!view.mixedCurrencyMode ? (
                        <p className="text-sm font-semibold text-[var(--workspace-text)]">
                          {formatCurrency(
                            channel.revenue,
                            false,
                            currencyCode,
                            locale,
                          )}
                        </p>
                      ) : (
                        <p className="text-sm font-semibold text-[var(--workspace-text)]">
                          {formatNumber(channel.bookings, locale)}
                        </p>
                      )}
                    </div>
                    {!view.mixedCurrencyMode ? (
                      <p className="mt-3 text-xs text-[var(--workspace-muted)]">
                        {formatPercent(share, locale)}{" "}
                        {isSpanish
                          ? "de los ingresos en la vista seleccionada"
                          : "of revenue in the selected view"}
                      </p>
                    ) : null}
                  </article>
                );
              })
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

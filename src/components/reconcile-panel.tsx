"use client";

import Link from "next/link";
import { Scale, TriangleAlert } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import type { CurrencyCode, DashboardView } from "@/lib/types";
import { formatCurrency, formatPercent } from "@/lib/format";

type ReconcileData = NonNullable<DashboardView["reconcile"]>;

function formatSignedCurrency(value: number, currencyCode: CurrencyCode, locale: "en" | "es") {
  const absolute = formatCurrency(Math.abs(value), false, currencyCode, locale);
  if (value > 0) {
    return `+${absolute}`;
  }

  if (value < 0) {
    return `-${absolute}`;
  }

  return absolute;
}

function formatSignedPercent(value: number | null, locale: "en" | "es") {
  if (value === null || !Number.isFinite(value)) {
    return locale === "es" ? "Todavía sin comparación" : "No comparison yet";
  }

  const absolute = formatPercent(Math.abs(value), locale);
  if (value > 0) {
    return `+${absolute}`;
  }

  if (value < 0) {
    return `-${absolute}`;
  }

  return absolute;
}

function getDifferenceTone(value: number) {
  if (value < 0) {
    return "text-amber-100";
  }

  if (value > 0) {
    return "text-emerald-100";
  }

  return "text-[var(--workspace-text)]";
}

export function ReconcileSummaryCard({
  reconcile,
  currencyCode,
}: {
  reconcile: ReconcileData;
  currencyCode: CurrencyCode;
}) {
  const { locale } = useLocale();
  const isSpanish = locale === "es";
  return (
    <article className="workspace-soft-card rounded-[26px] border-[var(--workspace-accent)]/12 bg-[linear-gradient(180deg,rgba(125,211,197,0.06)_0%,rgba(10,20,34,0.92)_100%)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--workspace-muted)]">
            {isSpanish ? "Liquidaciones" : "Payouts"}
          </p>
          <p className="mt-3 text-lg font-semibold tracking-[-0.03em] text-[var(--workspace-text)]">
            {isSpanish ? "Payout esperado vs statement" : "Expected vs statement payout"}
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--workspace-muted)]">
            {reconcile.message}
          </p>
        </div>
        <div className="workspace-icon-chip rounded-[18px] p-3">
          <Scale className="h-4 w-4" />
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-[20px] border border-[var(--workspace-border)] bg-white/[0.02] px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--workspace-muted)]">
            {isSpanish ? "Payout esperado" : "Expected payout"}
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--workspace-text)]">
            {formatCurrency(reconcile.expectedPayout, false, currencyCode, locale)}
          </p>
        </div>
        <div className="rounded-[20px] border border-[var(--workspace-border)] bg-white/[0.02] px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--workspace-muted)]">
            {isSpanish ? "Payout real" : "Actual payout"}
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--workspace-text)]">
            {formatCurrency(reconcile.actualPayout, false, currencyCode, locale)}
          </p>
        </div>
        <div className="rounded-[20px] border border-[var(--workspace-border)] bg-white/[0.02] px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--workspace-muted)]">
            {isSpanish ? "Diferencia" : "Difference"}
          </p>
          <p className={`mt-2 text-2xl font-semibold tracking-[-0.04em] ${getDifferenceTone(reconcile.difference)}`}>
            {formatSignedCurrency(reconcile.difference, currencyCode, locale)}
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--workspace-muted)]">
            {formatSignedPercent(reconcile.mismatchRatio, locale)}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm leading-6 text-[var(--workspace-muted)]">{reconcile.trustLabel}</p>
        <Link
          href="/dashboard/payouts"
          className="workspace-button-secondary inline-flex rounded-2xl px-4 py-3 text-sm font-semibold transition"
        >
          {isSpanish ? "Ver detalles" : "View details"}
        </Link>
      </div>
    </article>
  );
}

export function ReconcilePanel({
  reconcile,
  currencyCode,
}: {
  reconcile: ReconcileData;
  currencyCode: CurrencyCode;
}) {
  const { locale } = useLocale();
  const isSpanish = locale === "es";
  const reconciliationMax = Math.max(
    reconcile.grossRevenue,
    reconcile.totalFees,
    reconcile.totalTaxes,
    Math.abs(reconcile.adjustments),
    reconcile.actualPayout,
    1,
  );

  return (
    <article className="workspace-soft-card rounded-[30px] border-[var(--workspace-accent)]/12 bg-[radial-gradient(circle_at_top,rgba(125,211,197,0.14),transparent_44%),linear-gradient(180deg,rgba(17,31,47,0.98)_0%,rgba(9,19,32,0.98)_100%)] p-6 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--workspace-muted)]">
              {isSpanish ? "Liquidaciones" : "Payouts"}
            </p>
            <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-[11px] font-semibold text-[var(--workspace-muted)]">
              {reconcile.periodLabel}
            </span>
          </div>
          <p className="text-xl font-semibold tracking-[-0.03em] text-[var(--workspace-text)] sm:text-2xl">
            {isSpanish
              ? "Contrasta el payout esperado de tus reservas contra lo que el statement del canal dice que salió."
              : "Compare booking-based expected payout against what the channel statement says was paid out."}
          </p>
          <p className="max-w-3xl text-sm leading-7 text-slate-200/92">
            {reconcile.message}
          </p>
          <p className="text-sm leading-6 text-[var(--workspace-muted)]">
            {reconcile.trustLabel}
          </p>
        </div>
        <div className="workspace-icon-chip rounded-[18px] p-3">
          <Scale className="h-4 w-4" />
        </div>
      </div>

      {reconcile.alertMessage ? (
        <div className="mt-5 flex items-start gap-3 rounded-[22px] border border-amber-200/14 bg-[linear-gradient(135deg,rgba(245,158,11,0.12)_0%,rgba(31,41,55,0.1)_100%)] px-4 py-4">
          <div className="mt-0.5 rounded-full bg-amber-300/12 p-2 text-amber-100">
            <TriangleAlert className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-50">
              {isSpanish ? "Atención necesaria" : "Attention needed"}
            </p>
            <p className="mt-1 text-sm leading-6 text-amber-100/88">
              {reconcile.alertMessage}
            </p>
          </div>
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div className="rounded-[28px] border border-[var(--workspace-border)] bg-[linear-gradient(180deg,rgba(125,211,197,0.08)_0%,rgba(255,255,255,0.02)_100%)] p-6">
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--workspace-muted)]">
            {isSpanish ? "Payout real" : "Actual payout"}
          </p>
          <p className="mt-4 text-center text-5xl font-semibold tracking-[-0.05em] text-[var(--workspace-text)] sm:text-6xl">
            {formatCurrency(reconcile.actualPayout, false, currencyCode, locale)}
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-[20px] border border-white/7 bg-white/[0.02] px-4 py-4 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--workspace-muted)]">
                {isSpanish ? "Payout esperado" : "Expected payout"}
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--workspace-text)]">
                {formatCurrency(reconcile.expectedPayout, false, currencyCode, locale)}
              </p>
            </div>
            <div className="rounded-[20px] border border-white/7 bg-white/[0.02] px-4 py-4 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--workspace-muted)]">
                {isSpanish ? "Diferencia" : "Difference"}
              </p>
              <p className={`mt-2 text-2xl font-semibold tracking-[-0.04em] ${getDifferenceTone(reconcile.difference)}`}>
                {formatSignedCurrency(reconcile.difference, currencyCode, locale)}
              </p>
            </div>
            <div className="rounded-[20px] border border-white/7 bg-white/[0.02] px-4 py-4 text-center sm:col-span-2 xl:col-span-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--workspace-muted)]">
                {isSpanish ? "Desajuste" : "Mismatch"}
              </p>
              <p className={`mt-2 text-2xl font-semibold tracking-[-0.04em] ${getDifferenceTone(reconcile.difference)}`}>
                {formatSignedPercent(reconcile.mismatchRatio, locale)}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-[var(--workspace-border)] bg-white/[0.02] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                {isSpanish ? "Puente del payout" : "Payout bridge"}
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--workspace-muted)]">
                {isSpanish ? "De la expectativa basada en reservas al payout reportado por el canal." : "From booking-based expectation to channel-reported payout."}
              </p>
            </div>
            <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-[11px] font-semibold text-[var(--workspace-muted)]">
              {reconcile.source === "airbnb" ? "Airbnb" : "Booking.com"}
            </span>
          </div>

          <div className="mt-5 space-y-3">
            {[
              {
                label: "Bookings revenue",
                value: reconcile.grossRevenue,
                tone: "text-[var(--workspace-text)]",
                fill: "bg-[linear-gradient(90deg,rgba(125,211,197,0.55)_0%,rgba(125,211,197,0.22)_100%)]",
              },
              {
                label: "Platform fees",
                value: reconcile.totalFees,
                tone: "text-amber-100",
                fill: "bg-[linear-gradient(90deg,rgba(251,191,36,0.42)_0%,rgba(251,191,36,0.12)_100%)]",
              },
              {
                label: "Taxes",
                value: reconcile.totalTaxes,
                tone: "text-rose-100",
                fill: "bg-[linear-gradient(90deg,rgba(251,113,133,0.36)_0%,rgba(251,113,133,0.1)_100%)]",
              },
              {
                label: reconcile.adjustments >= 0 ? "Adjustments" : "Credits",
                value: Math.abs(reconcile.adjustments),
                tone: reconcile.adjustments >= 0 ? "text-amber-100" : "text-emerald-100",
                fill:
                  reconcile.adjustments >= 0
                    ? "bg-[linear-gradient(90deg,rgba(245,158,11,0.32)_0%,rgba(245,158,11,0.08)_100%)]"
                    : "bg-[linear-gradient(90deg,rgba(16,185,129,0.34)_0%,rgba(16,185,129,0.08)_100%)]",
              },
              {
                label: "Actual payout",
                value: reconcile.actualPayout,
                tone: "text-[var(--workspace-text)]",
                fill: "bg-[linear-gradient(90deg,rgba(148,163,184,0.45)_0%,rgba(148,163,184,0.12)_100%)]",
              },
            ].map((row) => (
              <div key={row.label} className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-medium text-[var(--workspace-text)]">{row.label}</p>
                  <p className={`text-sm font-semibold ${row.tone}`}>
                    {formatCurrency(row.value, false, currencyCode, locale)}
                  </p>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.04]">
                  <div
                    className={`h-full rounded-full ${row.fill}`}
                    style={{
                      width: `${Math.max(10, Math.min(100, (row.value / reconciliationMax) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.92fr)]">
        <div className="rounded-[28px] border border-[var(--workspace-border)] bg-white/[0.02] p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
            {isSpanish ? "Desglose" : "Breakdown"}
          </p>
          <div className="mt-4 divide-y divide-white/6">
            {[
              [isSpanish ? "Ingresos brutos" : "Gross revenue", reconcile.grossRevenue],
              [isSpanish ? "Comisiones de plataforma" : "Platform fees", reconcile.totalFees],
              [isSpanish ? "Impuestos" : "Taxes", reconcile.totalTaxes],
              [isSpanish ? "Ajustes" : "Adjustments", reconcile.adjustments],
              [isSpanish ? "Payout esperado" : "Expected payout", reconcile.expectedPayout],
              [isSpanish ? "Payout real" : "Actual payout", reconcile.actualPayout],
            ].map(([label, rawValue]) => {
              const value = Number(rawValue);
              const displayValue =
                label === (isSpanish ? "Ajustes" : "Adjustments")
                  ? formatSignedCurrency(-value, currencyCode, locale)
                  : formatCurrency(value, false, currencyCode, locale);

              return (
                <div key={String(label)} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-[var(--workspace-text)]">{label}</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--workspace-muted)]">
                      {label === (isSpanish ? "Ingresos brutos" : "Gross revenue")
                        ? isSpanish
                          ? "Antes de comisiones e impuestos retenidos."
                          : "Before fees and retained taxes."
                        : label === (isSpanish ? "Comisiones de plataforma" : "Platform fees")
                          ? isSpanish
                            ? "Tomadas por la plataforma antes del payout."
                            : "Taken by the platform before payout."
                          : label === (isSpanish ? "Impuestos" : "Taxes")
                            ? isSpanish
                              ? "Retenidos en origen en el statement."
                              : "Retained at source in the statement."
                            : label === (isSpanish ? "Ajustes" : "Adjustments")
                              ? isSpanish
                                ? "Otros movimientos del statement no explicados por comisiones o impuestos."
                                : "Other statement movements not explained by fees or taxes."
                              : label === (isSpanish ? "Payout esperado" : "Expected payout")
                                ? isSpanish
                                  ? "Lo que los datos de reservas dicen que debería haber caído."
                                  : "What booking data says should have landed."
                                : isSpanish
                                  ? "Lo que el statement confirma que realmente cayó."
                                  : "What the statement confirms actually landed."}
                    </p>
                  </div>
                  <p className={`text-sm font-semibold ${label === (isSpanish ? "Ajustes" : "Adjustments") ? getDifferenceTone(-value) : "text-[var(--workspace-text)]"}`}>
                    {displayValue}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[28px] border border-[var(--workspace-border)] bg-white/[0.02] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
              {isSpanish ? "Análisis de brecha" : "Gap analysis"}
            </p>
            <div className="mt-4 grid gap-3">
              {reconcile.insights.map((insight) => (
                <article
                  key={`${insight.title}-${insight.body}`}
                  className={`rounded-[22px] border px-4 py-4 ${
                    insight.tone === "positive"
                      ? "border-emerald-300/12 bg-emerald-400/[0.06]"
                      : insight.tone === "caution"
                        ? "border-amber-300/12 bg-amber-400/[0.06]"
                        : "border-white/7 bg-white/[0.03]"
                  }`}
                >
                  <p className="text-sm font-semibold text-[var(--workspace-text)]">
                    {insight.title}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--workspace-muted)]">
                    {insight.body}
                  </p>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-[var(--workspace-border)] bg-[linear-gradient(180deg,rgba(125,211,197,0.07)_0%,rgba(255,255,255,0.02)_100%)] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
              {isSpanish ? "Bloque de confianza" : "Trust block"}
            </p>
            <p className="mt-3 text-base font-semibold tracking-[-0.02em] text-[var(--workspace-text)]">
              {reconcile.trustLabel}
            </p>
          <p className="mt-2 text-sm leading-6 text-[var(--workspace-muted)]">
            {isSpanish
              ? "Hostlyx mantiene separadas las reservas y los statements de payout del canal para que esta comparación siga anclada en documentos fuente importados."
              : "Hostlyx keeps bookings and channel payout statements separate so this comparison stays grounded in imported source documents."}
          </p>
          </div>
        </div>
      </div>
    </article>
  );
}

import type { ReactNode } from "react";
import { CircleDollarSign, TrendingDown, TrendingUp, WalletCards } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { AppLocale } from "@/lib/i18n";
import type { CurrencyCode, DashboardView } from "@/lib/types";

type Tone = "pos" | "neg" | "info" | "warn" | "plain";

const toneClass: Record<Tone, string> = {
  pos: "text-pos",
  neg: "text-neg",
  info: "text-info",
  warn: "text-warn",
  plain: "text-[var(--workspace-text)]",
};

function money(value: number, currencyCode: CurrencyCode, locale: AppLocale, negative = false) {
  const formatted = formatCurrency(Math.abs(value), false, currencyCode, locale);
  return negative && value > 0 ? `-${formatted}` : value < 0 ? `-${formatted}` : formatted;
}

/**
 * The top of the dashboard: what the business made next to where the cash
 * went. Profit and cash sit side by side as peers, the same reading order as
 * OnRoad Books.
 */
export function BottomLine({
  metrics,
  currencyCode,
  locale,
  insight,
  highExpenseRatio,
  significantTaxImpact,
}: {
  metrics: DashboardView["metrics"];
  currencyCode: CurrencyCode;
  locale: AppLocale;
  insight: string | null;
  highExpenseRatio: boolean;
  significantTaxImpact: boolean;
}) {
  const isSpanish = locale === "es";
  const profitable = metrics.netProfit >= 0;
  const platformFees = Math.max(0, metrics.totalRevenue - metrics.totalPayout);
  const keepsMoney = metrics.profitAfterTax >= 0;

  return (
    <div className="grid gap-3 xl:grid-cols-[1.08fr_0.92fr]">
      <section
        className={`overflow-hidden rounded-xl border shadow-[0_20px_55px_-42px_rgba(0,0,0,0.85)] ${
          profitable
            ? "border-[rgba(51,194,131,0.3)] bg-[linear-gradient(145deg,rgba(51,194,131,0.14),var(--workspace-panel)_64%)]"
            : "border-[rgba(236,95,95,0.3)] bg-[linear-gradient(145deg,rgba(236,95,95,0.14),var(--workspace-panel)_64%)]"
        }`}
      >
        <header className="flex items-center justify-between gap-3 border-b border-[var(--workspace-border)] px-5 py-4">
          <div className="flex items-center gap-2">
            <CircleDollarSign className={`h-4 w-4 ${profitable ? "text-pos" : "text-neg"}`} />
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--workspace-text)]">
              {isSpanish ? "Rendimiento financiero" : "Financial performance"}
            </h2>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
              profitable
                ? "border-[rgba(51,194,131,0.35)] bg-[var(--workspace-pos-soft)] text-pos"
                : "border-[rgba(236,95,95,0.35)] bg-[var(--workspace-neg-soft)] text-neg"
            }`}
          >
            {profitable ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {profitable ? (isSpanish ? "Rentable" : "Profitable") : isSpanish ? "Pérdida" : "Loss"}
          </span>
        </header>

        <div className="px-5 py-6">
          <p className="label-xs">{isSpanish ? "Tu negocio ganó" : "Your business made"}</p>
          <p
            className={`tnum mt-2 text-[clamp(2.75rem,5vw,4.5rem)] font-semibold leading-none tracking-[-0.05em] ${
              profitable ? "text-pos" : "text-neg"
            }`}
          >
            {money(metrics.netProfit, currencyCode, locale)}
          </p>
          <p className="mt-3 text-xs text-[var(--workspace-muted)]">
            {insight ??
              (isSpanish
                ? "Payout menos gastos operativos, antes de impuestos."
                : "Payout minus operating expenses, before taxes.")}
          </p>
        </div>

        <dl className="grid gap-px border-t border-[var(--workspace-border)] bg-[var(--workspace-border)] sm:grid-cols-3">
          <Fact
            label={isSpanish ? "Ingresos brutos" : "Gross revenue"}
            value={money(metrics.totalRevenue, currencyCode, locale)}
            tone="info"
          />
          <Fact
            label={isSpanish ? "Gastos" : "Expenses"}
            value={money(metrics.totalExpenses, currencyCode, locale, true)}
            tone="neg"
            note={highExpenseRatio ? (isSpanish ? "Ratio de costes alto" : "High cost ratio") : undefined}
          />
          <Fact
            label={isSpanish ? "Margen" : "Margin"}
            value={formatPercent(metrics.profitMargin, locale)}
            tone={metrics.profitMargin >= 0 ? "pos" : "neg"}
          />
        </dl>
      </section>

      <section className="overflow-hidden rounded-xl border border-[var(--workspace-border)] bg-[var(--workspace-panel)] shadow-[0_20px_55px_-42px_rgba(0,0,0,0.85)]">
        <header className="flex items-center gap-2 border-b border-[var(--workspace-border)] px-5 py-4">
          <WalletCards className="h-4 w-4 text-info" />
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--workspace-text)]">
              {isSpanish ? "Tu dinero" : "Your money"}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--workspace-muted)]">
              {isSpanish ? "Lo que entró y lo que tuvo que salir" : "What came in and what had to go out"}
            </p>
          </div>
        </header>

        <dl className="divide-y divide-[var(--workspace-border)] px-5">
          <Row label={isSpanish ? "Payout recibido" : "Payout received"} value={money(metrics.totalPayout, currencyCode, locale)} tone="info" />
          {platformFees > 0 ? (
            <Row
              label={isSpanish ? "Comisiones de plataforma" : "Platform fees"}
              value={money(platformFees, currencyCode, locale, true)}
              tone="neg"
            />
          ) : null}
          <Row
            label={isSpanish ? "Gastos operativos" : "Operating expenses"}
            value={money(metrics.totalExpenses, currencyCode, locale, true)}
            tone="neg"
          />
        </dl>

        <div className="border-t border-[var(--workspace-border)] bg-[rgba(10,14,20,0.45)] px-5 py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="label-xs">{isSpanish ? "Reserva para impuestos" : "Set aside for taxes"}</p>
            <p className="tnum text-sm font-semibold text-warn">
              {money(metrics.estimatedTaxes, currencyCode, locale)}
            </p>
          </div>
          <p className="mt-1.5 text-xs text-[var(--workspace-muted)]">
            {significantTaxImpact
              ? isSpanish
                ? "Impacto fiscal alto: más de una cuarta parte del beneficio neto."
                : "Significant tax impact: more than a quarter of net profit."
              : isSpanish
                ? "Estimado desde el beneficio neto con tus ajustes fiscales."
                : "Estimated from net profit with your tax settings."}
          </p>
        </div>

        <div className="border-t-2 border-[rgba(75,155,248,0.35)] bg-[rgba(75,155,248,0.06)] px-5 py-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="label-xs">{isSpanish ? "Te quedas" : "You keep"}</p>
              <p className="mt-1 text-xs text-[var(--workspace-muted)]">
                {isSpanish ? "Después de gastos e impuestos estimados" : "After expenses and estimated taxes"}
              </p>
            </div>
            <p
              className={`tnum text-4xl font-semibold leading-none tracking-[-0.045em] ${
                keepsMoney ? "text-info" : "text-neg"
              }`}
            >
              {money(metrics.profitAfterTax, currencyCode, locale)}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function Fact({ label, value, tone, note }: { label: string; value: string; tone: Tone; note?: ReactNode }) {
  return (
    <div className="bg-[rgba(19,25,32,0.85)] px-5 py-4">
      <dt className="text-xs font-medium text-[var(--workspace-muted)]">{label}</dt>
      <dd className={`tnum mt-1 text-lg font-semibold tracking-tight ${toneClass[tone]}`}>{value}</dd>
      {note ? <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-warn">{note}</p> : null}
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <dt className="text-xs text-[var(--workspace-muted)]">{label}</dt>
      <dd className={`tnum text-base font-semibold ${toneClass[tone]}`}>{value}</dd>
    </div>
  );
}

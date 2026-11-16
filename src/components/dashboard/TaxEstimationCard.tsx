"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import { SectionCard } from "@/components/section-card";
import { formatCurrency } from "@/lib/format";
import { getMarketLabels } from "@/lib/markets";
import type { CountryCode, CurrencyCode } from "@/lib/types";

export function TaxEstimationCard({
  countryCode,
  savedCountryCode,
  taxRate,
  suggestedTaxRate,
  estimatedTaxes,
  profitAfterTax,
  currencyCode,
  mixedCurrencyMode,
  usesSavedSettings,
  usesCustomRate,
}: {
  countryCode: CountryCode;
  savedCountryCode: CountryCode;
  taxRate: number;
  suggestedTaxRate: number;
  estimatedTaxes: number;
  profitAfterTax: number;
  currencyCode: CurrencyCode;
  mixedCurrencyMode: boolean;
  usesSavedSettings: boolean;
  usesCustomRate: boolean;
}) {
  const { locale } = useLocale();
  const isSpanish = locale === "es";
  const market = getMarketLabels(countryCode, locale);
  const savedMarket = getMarketLabels(savedCountryCode, locale);
  const rateLabel = `${taxRate.toFixed(taxRate % 1 === 0 ? 0 : 1)}%`;

  const rateSource = mixedCurrencyMode
    ? isSpanish
      ? "Elige un solo mercado para estimar lo que te quedas después de impuestos."
      : "Choose a single market to estimate what you keep after taxes."
    : usesSavedSettings
      ? usesCustomRate
        ? isSpanish
          ? `Tu tasa guardada para ${savedMarket.countryName}.`
          : `Your saved ${savedMarket.countryName} rate.`
        : isSpanish
          ? `Base guardada para ${savedMarket.countryName}.`
          : `Saved ${savedMarket.countryName} baseline.`
      : isSpanish
        ? `Estimación por defecto para ${market.countryName} (${suggestedTaxRate}%).`
        : `Default ${market.countryName} estimate (${suggestedTaxRate}%).`;

  return (
    <SectionCard
      title={isSpanish ? "Estimación de impuestos" : "Tax estimate"}
      subtitle={rateSource}
      action={
        <Link
          href="/settings"
          className="workspace-button-secondary inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition"
        >
          {isSpanish ? "Cambiar en Ajustes" : "Edit in Settings"}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      }
    >
      {mixedCurrencyMode ? (
        <p className="text-sm text-[var(--workspace-muted)]">
          {isSpanish
            ? "GoHostlyx no estima beneficio después de impuestos mezclando monedas. Filtra por un país o elige en Ajustes el mercado base."
            : "GoHostlyx will not estimate after-tax profit across mixed currencies. Filter to one country, or choose the baseline market in Settings."}
        </p>
      ) : (
        <dl className="-my-3 divide-y divide-[var(--workspace-border)]">
          <div className="flex items-baseline justify-between gap-4 py-3">
            <dt className="text-xs text-[var(--workspace-muted)]">{isSpanish ? "Mercado" : "Market"}</dt>
            <dd className="text-sm font-semibold text-[var(--workspace-text)]">
              {market.countryName} · {market.currencyCode}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-3">
            <dt className="text-xs text-[var(--workspace-muted)]">{isSpanish ? "Tasa aplicada" : "Rate applied"}</dt>
            <dd className="tnum text-sm font-semibold text-[var(--workspace-text)]">{rateLabel}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-3">
            <dt className="text-xs text-[var(--workspace-muted)]">{isSpanish ? "Impuestos estimados" : "Estimated taxes"}</dt>
            <dd className="tnum text-base font-semibold text-warn">
              {formatCurrency(estimatedTaxes, false, currencyCode, locale)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-3">
            <dt className="text-xs text-[var(--workspace-muted)]">{isSpanish ? "Te quedas" : "You keep"}</dt>
            <dd className={`tnum text-base font-semibold ${profitAfterTax >= 0 ? "text-info" : "text-neg"}`}>
              {formatCurrency(profitAfterTax, false, currencyCode, locale)}
            </dd>
          </div>
        </dl>
      )}

      <p className="mt-4 border-t border-[var(--workspace-border)] pt-3 text-xs leading-5 text-[var(--workspace-muted)]">
        {isSpanish
          ? "Solo es una estimación: GoHostlyx aplica una tasa fija al beneficio neto. Las reglas reales cambian (el IRPF es progresivo, las tasas turísticas no están incluidas y en España los no residentes fuera de la UE tributan sobre el ingreso bruto sin deducir gastos). Confírmalo con tu asesor."
          : "Estimate only: GoHostlyx applies one flat rate to net profit. Real rules differ (income tax is usually progressive, occupancy and tourist taxes are not included, and in Spain non-residents outside the EU are taxed on gross rental income without deducting expenses). Confirm with your accountant."}
      </p>
    </SectionCard>
  );
}

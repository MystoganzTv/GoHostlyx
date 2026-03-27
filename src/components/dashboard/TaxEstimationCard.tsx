"use client";

import Link from "next/link";
import { ArrowRight, Landmark, ShieldAlert } from "lucide-react";
import { SectionCard } from "@/components/section-card";
import { TaxSummaryMetrics } from "@/components/dashboard/TaxSummaryMetrics";
import { useLocale } from "@/components/locale-provider";
import { getMarketDefinition } from "@/lib/markets";
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
  const { t } = useLocale();
  const market = getMarketDefinition(countryCode);
  const savedMarket = getMarketDefinition(savedCountryCode);
  const contextLabel = mixedCurrencyMode
    ? t("tax.selectOneCountry")
    : usesSavedSettings
      ? usesCustomRate
        ? t("tax.usingSavedCustom", { country: savedMarket.countryName, rate: taxRate })
        : t("tax.usingSavedBaseline", { country: savedMarket.countryName, rate: taxRate })
      : t("tax.usingSuggestion", { country: market.countryName, rate: suggestedTaxRate });
  const settingsHint = mixedCurrencyMode
    ? t("tax.settingsDefault", { country: savedMarket.countryName })
    : usesSavedSettings
      ? t("tax.adjustBaseline")
      : t("tax.saveCustomRate");

  return (
    <SectionCard
      title={t("tax.title")}
      subtitle={t("tax.subtitle")}
      action={
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
          <ShieldAlert className="h-4 w-4 text-[var(--workspace-accent)]" />
          {t("tax.estimateOnly")}
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 xl:grid-cols-[0.85fr_0.85fr_auto]">
          <div className="workspace-soft-card rounded-[22px] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
              {t("tax.marketInView")}
            </p>
            <div className="mt-3 flex items-center gap-3">
              <div className="workspace-icon-chip rounded-2xl p-3">
                <Landmark className="h-4 w-4" />
              </div>
              <div>
                <p className="text-base font-semibold text-[var(--workspace-text)]">{market.countryName}</p>
                <p className="text-xs text-[var(--workspace-muted)]">
                  {mixedCurrencyMode ? t("tax.selectOneCountry") : t("tax.reportingContext", { currency: market.currencyCode })}
                </p>
              </div>
            </div>
          </div>

          <div className="workspace-soft-card rounded-[22px] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
              {t("tax.rateApplied")}
            </p>
            <p className="mt-4 text-3xl font-semibold tracking-tight text-[var(--workspace-text)]">
              {taxRate.toFixed(taxRate % 1 === 0 ? 0 : 1)}%
            </p>
            <p className="mt-2 text-xs leading-5 text-[var(--workspace-muted)]">{contextLabel}</p>
          </div>

          <Link
            href="/settings"
            className="workspace-button-secondary inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition xl:self-end"
          >
            {t("tax.editInSettings")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {mixedCurrencyMode ? (
          <div className="workspace-soft-card rounded-[24px] p-5">
            <p className="text-sm font-semibold text-[var(--workspace-text)]">{t("tax.pickOneMarketTitle")}</p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--workspace-muted)]">
              {t("tax.pickOneMarketBody")}
            </p>
          </div>
        ) : (
          <TaxSummaryMetrics
            estimatedTaxes={estimatedTaxes}
            profitAfterTax={profitAfterTax}
            currencyCode={currencyCode}
          />
        )}

        <div className="border-t border-white/8 pt-4">
          <p className="text-xs leading-6 text-[var(--workspace-muted)]">{settingsHint}</p>
          <p className="mt-1 text-xs leading-6 text-[var(--workspace-muted)]">
            {t("tax.disclaimer")}
          </p>
        </div>
      </div>
    </SectionCard>
  );
}

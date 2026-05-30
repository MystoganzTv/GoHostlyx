"use client";

import Link from "next/link";
import { ArrowRight, Landmark, ShieldAlert } from "lucide-react";
import { SectionCard } from "@/components/section-card";
import { TaxSummaryMetrics } from "@/components/dashboard/TaxSummaryMetrics";
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
  const market = getMarketDefinition(countryCode);
  const savedMarket = getMarketDefinition(savedCountryCode);
  const contextLabel = mixedCurrencyMode
    ? `Choose a single market to estimate what you keep after taxes.`
    : usesSavedSettings
      ? usesCustomRate
        ? `Using your saved ${savedMarket.countryName} rate of ${taxRate}% for this view.`
        : `Using the saved ${savedMarket.countryName} baseline at ${taxRate}%.`
      : `Using the active ${market.countryName} default estimate of ${suggestedTaxRate}%.`;
  const settingsHint = mixedCurrencyMode
    ? `Settings currently default to ${savedMarket.countryName}.`
    : usesSavedSettings
      ? "Adjust your baseline in Settings if you want a different estimate."
      : "Save a custom rate in Settings if you want something other than the default estimate.";

  return (
    <SectionCard
      title="Tax Estimation"
      subtitle="Estimate what to set aside and what you actually keep."
      action={
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
          <ShieldAlert className="h-4 w-4 text-[var(--workspace-accent)]" />
          Estimate only
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 xl:grid-cols-[0.85fr_0.85fr_auto]">
          <div className="workspace-soft-card rounded-[22px] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
              Market in view
            </p>
            <div className="mt-3 flex items-center gap-3">
              <div className="workspace-icon-chip rounded-2xl p-3">
                <Landmark className="h-4 w-4" />
              </div>
              <div>
                <p className="text-base font-semibold text-[var(--workspace-text)]">{market.countryName}</p>
                <p className="text-xs text-[var(--workspace-muted)]">
                  {mixedCurrencyMode ? "Select one country to estimate clearly" : `${market.currencyCode} reporting context`}
                </p>
              </div>
            </div>
          </div>

          <div className="workspace-soft-card rounded-[22px] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
              Rate applied
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
            Edit in Settings
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {mixedCurrencyMode ? (
          <div className="workspace-soft-card rounded-[24px] p-5">
            <p className="text-sm font-semibold text-[var(--workspace-text)]">Pick one market for after-tax clarity</p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--workspace-muted)]">
              Hostlyx will not estimate after-tax profit across mixed currencies. Filter to one country, or use Settings to choose the baseline market that should guide your estimate.
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
            Tax values are estimates only and may not reflect your actual tax obligation.
          </p>
        </div>
      </div>
    </SectionCard>
  );
}

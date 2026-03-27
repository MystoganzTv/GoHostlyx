"use client";

import { type FormEvent, useMemo, useState, useTransition } from "react";
import { Landmark, Percent, ReceiptText } from "lucide-react";
import { useRouter } from "next/navigation";
import { WorkspaceSelect } from "@/components/workspace-select";
import { useLocale } from "@/components/locale-provider";
import { getMarketDefinition, marketDefinitions } from "@/lib/markets";
import { getDefaultTaxRateByCountry, normalizeTaxRate } from "@/lib/tax";
import type { CountryCode } from "@/lib/types";

function inputClassName() {
  return "input-surface w-full rounded-2xl px-4 py-3 text-sm";
}

export function TaxSettingsPanel({
  initialTaxCountryCode,
  initialTaxRate,
}: {
  initialTaxCountryCode: CountryCode;
  initialTaxRate: number;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [countryCode, setCountryCode] = useState<CountryCode>(initialTaxCountryCode);
  const [taxRate, setTaxRate] = useState(String(initialTaxRate));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const market = getMarketDefinition(countryCode);
  const normalizedTaxRate = normalizeTaxRate(taxRate);
  const suggestedRate = getDefaultTaxRateByCountry(countryCode);
  const countryOptions = marketDefinitions.map((definition) => ({
    value: definition.countryCode,
    label: definition.countryName,
    description: t("settings.defaultEstimate", {
      rate: getDefaultTaxRateByCountry(definition.countryCode),
    }),
  }));
  const hasCustomRate = normalizedTaxRate !== suggestedRate;
  const hasChanges =
    countryCode !== initialTaxCountryCode ||
    normalizedTaxRate !== normalizeTaxRate(initialTaxRate);
  const behaviorCards = useMemo(
    () => [
      {
        label: t("settings.singleCountryView"),
        value: market.countryName,
        description:
          hasCustomRate
            ? t("settings.singleCountryCustom", { country: market.countryName, rate: normalizedTaxRate })
            : t("settings.singleCountryDefault", { country: market.countryName, rate: suggestedRate }),
      },
      {
        label: t("settings.allCountriesFallback"),
        value: `${market.shortLabel} • ${normalizedTaxRate}%`,
        description: t("settings.allCountriesFallbackBody"),
      },
    ],
    [hasCustomRate, market, normalizedTaxRate, suggestedRate, t],
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    startTransition(() => {
      void (async () => {
        try {
          const formData = new FormData();
          formData.set("taxCountryCode", countryCode);
          formData.set("taxRate", String(normalizedTaxRate));

          const response = await fetch("/api/tax-settings", {
            method: "POST",
            body: formData,
          });
          const payload = (await response.json()) as {
            message?: string;
            error?: string;
          };

          if (!response.ok) {
            setError(payload.error ?? t("settings.taxSaveError"));
            return;
          }

          setMessage(payload.message ?? t("settings.taxSaved"));
          router.refresh();
        } catch {
          setError(t("settings.taxSaveError"));
        }
      })();
    });
  }

  return (
    <div className="workspace-card rounded-[30px] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--workspace-muted)]">
            {t("settings.taxDefaults")}
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--workspace-muted)]">
            {t("settings.taxDefaultsSubtitle")}
          </p>
        </div>
        <div className="workspace-icon-chip rounded-3xl p-3">
          <ReceiptText className="h-6 w-6" />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
          <div className="workspace-soft-card rounded-[24px] p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
              <Landmark className="h-4 w-4 text-[var(--workspace-accent)]" />
              {t("settings.country")}
            </div>
            <WorkspaceSelect
              value={countryCode}
              onChange={(value) => {
                const nextCountryCode = value as CountryCode;
                setCountryCode(nextCountryCode);
                setTaxRate(String(getDefaultTaxRateByCountry(nextCountryCode)));
                setMessage(null);
                setError(null);
              }}
              options={countryOptions}
              helper={t("settings.countryHelper")}
            />
          </div>

          <div className="workspace-soft-card rounded-[24px] p-4">
            <label className="space-y-2">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                <Percent className="h-4 w-4 text-[var(--workspace-accent)]" />
                {t("settings.taxRate")}
              </span>
              <div className="relative">
                <input
                  className={`${inputClassName()} pr-12`}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={100}
                  step="0.1"
                  value={taxRate}
                  onChange={(event) => {
                    setTaxRate(event.target.value);
                    setMessage(null);
                    setError(null);
                  }}
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-[var(--workspace-muted)]">
                  %
                </span>
              </div>
            </label>
            <p className="mt-2 text-xs leading-5 text-[var(--workspace-muted)]">
              {t("settings.taxRateHelper")}
            </p>
          </div>
        </div>

        <div className="workspace-soft-card rounded-[24px] p-4">
          <div className="flex items-center justify-between gap-3 border-b border-white/8 pb-3">
            <div>
              <p className="text-sm font-semibold text-[var(--workspace-text)]">{t("settings.taxHowUsed")}</p>
              <p className="mt-1 text-xs text-[var(--workspace-muted)]">
                {t("settings.taxHowUsedSubtitle")}
              </p>
            </div>
            <span className="rounded-full bg-white/[0.06] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--workspace-muted)]">
              {hasCustomRate ? t("settings.customRate") : t("settings.defaultRate")}
            </span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {behaviorCards.map((card) => (
              <div key={card.label} className="rounded-[18px] bg-white/[0.03] p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                  {card.label}
                </p>
                <p className="mt-3 text-base font-semibold text-[var(--workspace-text)]">{card.value}</p>
                <p className="mt-2 text-xs leading-5 text-[var(--workspace-muted)]">{card.description}</p>
              </div>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending || !hasChanges}
          className="workspace-button-primary inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? t("common.saving") : hasChanges ? t("settings.saveTaxForCountry", { country: market.countryName }) : t("settings.taxUpToDate")}
        </button>
      </form>

      <div className="mt-4 min-h-6">
        {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
        {error ? <p className="text-sm text-rose-500">{error}</p> : null}
      </div>
    </div>
  );
}

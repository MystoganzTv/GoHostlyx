"use client";

import { type FormEvent, useMemo, useState, useTransition } from "react";
import { Landmark, Percent, ReceiptText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/locale-provider";
import { WorkspaceSelect } from "@/components/workspace-select";
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
  const { locale } = useLocale();
  const isSpanish = locale === "es";
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [countryCode, setCountryCode] = useState<CountryCode>(initialTaxCountryCode);
  const [taxRate, setTaxRate] = useState(String(initialTaxRate));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const market = getMarketDefinition(countryCode);
  const normalizedTaxRate = normalizeTaxRate(taxRate);
  const suggestedRate = getDefaultTaxRateByCountry(countryCode);
  const hasCustomRate = normalizedTaxRate !== suggestedRate;
  const hasChanges =
    countryCode !== initialTaxCountryCode ||
    normalizedTaxRate !== normalizeTaxRate(initialTaxRate);
  const countryOptions = marketDefinitions.map((marketDefinition) => ({
    value: marketDefinition.countryCode,
    label: marketDefinition.countryName,
    description: isSpanish
      ? `Estimación por defecto ${getDefaultTaxRateByCountry(marketDefinition.countryCode)}%`
      : `Default estimate ${getDefaultTaxRateByCountry(marketDefinition.countryCode)}%`,
  }));
  const behaviorCards = useMemo(
    () => [
      {
        label: isSpanish ? "Vista de un solo país" : "Single-country view",
        value: market.countryName,
        description:
          hasCustomRate
            ? isSpanish
              ? `Si estás viendo ${market.countryName}, Hostlyx usa tu tipo guardado de ${normalizedTaxRate}%.`
              : `If you are viewing ${market.countryName}, Hostlyx uses your saved ${normalizedTaxRate}% rate.`
            : isSpanish
              ? `Si estás viendo ${market.countryName}, Hostlyx usa la estimación por defecto de ${suggestedRate}%.`
              : `If you are viewing ${market.countryName}, Hostlyx uses the default estimate of ${suggestedRate}%.`,
      },
      {
        label: isSpanish ? "Fallback todos los países" : "All-countries fallback",
        value: `${market.shortLabel} • ${normalizedTaxRate}%`,
        description:
          isSpanish
            ? "Cuando el dashboard no está enfocado en un país, esta se convierte en la estimación base que muestra Hostlyx."
            : "When the dashboard is not focused on one country, this becomes the baseline estimate Hostlyx shows.",
      },
    ],
    [hasCustomRate, isSpanish, market, normalizedTaxRate, suggestedRate],
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
            setError(payload.error ?? (isSpanish ? "No se pudieron guardar los valores fiscales por defecto." : "The tax defaults could not be saved."));
            return;
          }

          setMessage(payload.message ?? (isSpanish ? "Valores fiscales por defecto guardados." : "Tax defaults saved."));
          router.refresh();
        } catch {
          setError(isSpanish ? "No se pudieron guardar los valores fiscales por defecto." : "The tax defaults could not be saved.");
        }
      })();
    });
  }

  return (
    <div className="workspace-card rounded-[30px] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--workspace-muted)]">
            {isSpanish ? "Valores fiscales por defecto" : "Tax Defaults"}
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--workspace-muted)]">
            {isSpanish
              ? "Define el mercado que Hostlyx debe usar cuando estime lo que necesitas apartar."
              : "Set the market Hostlyx should use when it estimates what you need to set aside."}
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
              {isSpanish ? "País" : "Country"}
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
              helper={
                isSpanish
                  ? "Se usa para contexto y estimaciones fallback. Hostlyx usa primero el mercado activo y luego este cuando están seleccionados todos los países."
                  : "Used for context and fallback estimates. Hostlyx uses the active market first, then falls back to this one when all countries are selected."
              }
            />
          </div>

          <div className="workspace-soft-card rounded-[24px] p-4">
            <label className="space-y-2">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                <Percent className="h-4 w-4 text-[var(--workspace-accent)]" />
                {isSpanish ? "Tipo impositivo" : "Tax rate"}
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
              {isSpanish
                ? "Usa tu propio tipo fiscal efectivo estimado. Esto es solo una estimación, nunca asesoría fiscal."
                : "Use your own estimated effective tax rate. This is only an estimate, never tax advice."}
            </p>
          </div>
        </div>

        <div className="workspace-soft-card rounded-[24px] p-4">
          <div className="flex items-center justify-between gap-3 border-b border-white/8 pb-3">
            <div>
              <p className="text-sm font-semibold text-[var(--workspace-text)]">
                {isSpanish ? "Cómo usa esto Hostlyx" : "How Hostlyx uses this"}
              </p>
              <p className="mt-1 text-xs text-[var(--workspace-muted)]">
                {isSpanish
                  ? "Los impuestos se mantienen simples: primero mercado activo, después mercado por defecto."
                  : "Taxes stay lightweight: active market first, default market second."}
              </p>
            </div>
            <span className="rounded-full bg-white/[0.06] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--workspace-muted)]">
              {hasCustomRate
                ? isSpanish
                  ? "Tipo personalizado"
                  : "Custom rate"
                : isSpanish
                  ? "Estimación por defecto"
                  : "Default estimate"}
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
          {isPending
            ? isSpanish
              ? "Guardando valores fiscales..."
              : "Saving tax defaults..."
            : hasChanges
              ? isSpanish
                ? `Guardar valores fiscales para ${market.countryName}`
                : `Save ${market.countryName} tax defaults`
              : isSpanish
                ? "Los valores fiscales están al día"
                : "Tax defaults are up to date"}
        </button>
      </form>

      <div className="mt-4 min-h-6">
        {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
        {error ? <p className="text-sm text-rose-500">{error}</p> : null}
      </div>
    </div>
  );
}

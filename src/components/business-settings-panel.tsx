"use client";

import { type FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Globe2, Settings2 } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import { getMarketDefinition, marketDefinitions } from "@/lib/markets";
import type { CountryCode } from "@/lib/types";

function inputClassName() {
  return "input-surface w-full rounded-2xl px-4 py-3 text-sm";
}

export function BusinessSettingsPanel({
  initialBusinessName,
  initialPrimaryCountryCode,
}: {
  initialBusinessName: string;
  initialPrimaryCountryCode: CountryCode;
}) {
  const { locale } = useLocale();
  const isSpanish = locale === "es";
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [businessName, setBusinessName] = useState(initialBusinessName);
  const [primaryCountryCode, setPrimaryCountryCode] = useState<CountryCode>(initialPrimaryCountryCode);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selectedMarket = getMarketDefinition(primaryCountryCode);
  const hasChanges =
    businessName.trim() !== initialBusinessName.trim() ||
    primaryCountryCode !== initialPrimaryCountryCode;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    startTransition(() => {
      void (async () => {
        try {
          const formData = new FormData();
          formData.set("businessName", businessName);
          formData.set("primaryCountryCode", primaryCountryCode);

          const response = await fetch("/api/settings", {
            method: "POST",
            body: formData,
          });

          const payload = (await response.json()) as {
            error?: string;
            message?: string;
          };

          if (!response.ok) {
            setError(payload.error ?? (isSpanish ? "No se pudieron guardar los ajustes del negocio." : "The business settings could not be saved."));
            return;
          }

          setMessage(payload.message ?? (isSpanish ? "Ajustes del negocio guardados." : "Business settings saved."));
          router.refresh();
        } catch {
          setError(isSpanish ? "No se pudieron guardar los ajustes del negocio." : "The business settings could not be saved.");
        }
      })();
    });
  }

  return (
    <div className="workspace-card rounded-[30px] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--workspace-muted)]">
            {isSpanish ? "Ajustes del negocio" : "Business Settings"}
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--workspace-muted)]">
            {isSpanish
              ? "Cada cuenta mantiene su propia identidad de negocio, mercado de reporting, importaciones y entradas manuales."
              : "Each account keeps its own business identity, reporting market, imports, and manual entries."}
          </p>
        </div>
        <div className="workspace-icon-chip rounded-3xl p-3">
          <Settings2 className="h-6 w-6" />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <label className="space-y-2">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
            {isSpanish ? "Nombre del negocio" : "Business name"}
          </span>
          <div className="relative">
            <Building2 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              className={`${inputClassName()} pl-11`}
              type="text"
              name="businessName"
              value={businessName}
              onChange={(event) => setBusinessName(event.target.value)}
              placeholder={isSpanish ? "PinarSabroso, Demo Hostlyx, Beach Loft..." : "PinarSabroso, Hostlyx Demo, Beach Loft..."}
              required
            />
          </div>
        </label>

        <div className="space-y-2">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
            {isSpanish ? "Mercado principal de reporting" : "Primary reporting market"}
          </span>
          <div className="grid gap-3 sm:grid-cols-3">
            {marketDefinitions.map((market) => {
              const isSelected = primaryCountryCode === market.countryCode;

              return (
                <button
                  key={market.countryCode}
                  type="button"
                  onClick={() => setPrimaryCountryCode(market.countryCode)}
                  className={`rounded-[24px] border px-4 py-4 text-left transition ${
                    isSelected
                      ? "border-[var(--workspace-accent)] bg-[var(--workspace-accent-soft)] text-[var(--workspace-text)] shadow-[0_0_0_1px_rgba(88,196,182,0.16)]"
                      : "border-[var(--workspace-border)] bg-[var(--workspace-panel-soft)] text-[var(--workspace-muted)] hover:border-[var(--workspace-accent)]/40"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="workspace-icon-chip rounded-2xl p-2.5">
                      <Globe2 className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{market.shortLabel}</p>
                      <p className="text-xs text-inherit/80">{market.regionLabel}</p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm font-medium">{market.countryName}</p>
                  <p className="mt-1 text-xs text-inherit/80">
                    {market.currencyCode} • {market.currencyLabel}
                  </p>
                </button>
              );
            })}
          </div>
          <p className="text-xs leading-5 text-[var(--workspace-muted)]">
            {isSpanish
              ? "Este pasa a ser el mercado por defecto que Hostlyx usa cuando tu dashboard muestra todos los países a la vez."
              : "This becomes the default market Hostlyx uses when your dashboard is showing all countries at once."}
          </p>
        </div>

        <div className="workspace-soft-card rounded-[24px] p-4">
          <div className="flex items-center justify-between gap-3 border-b border-white/8 pb-3">
            <div>
              <p className="text-sm font-semibold text-[var(--workspace-text)]">
                {isSpanish ? "Qué cambia cuando guardas" : "What changes when you save"}
              </p>
              <p className="mt-1 text-xs text-[var(--workspace-muted)]">
                {isSpanish
                  ? `Hostlyx tratará ${selectedMarket.countryName} como tu mercado por defecto para reporting.`
                  : `Hostlyx will treat ${selectedMarket.countryName} as your default reporting market.`}
              </p>
            </div>
            <span className="rounded-full bg-white/[0.06] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--workspace-muted)]">
              {selectedMarket.currencyCode}
            </span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-[18px] bg-white/[0.03] p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                {isSpanish ? "Moneda por defecto" : "Default currency"}
              </p>
              <p className="mt-3 text-base font-semibold text-[var(--workspace-text)]">
                {selectedMarket.currencyCode} • {selectedMarket.currencyLabel}
              </p>
              <p className="mt-2 text-xs leading-5 text-[var(--workspace-muted)]">
                {isSpanish
                  ? "Dashboard, informes, flujo operativo, monthly y performance usan esta como moneda fallback de visualización."
                  : "Dashboard, reports, operating flow, monthly, and performance use this as the fallback display currency."}
              </p>
            </div>

            <div className="rounded-[18px] bg-white/[0.03] p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                {isSpanish ? "Vista todos los países" : "All-countries view"}
              </p>
              <p className="mt-3 text-base font-semibold text-[var(--workspace-text)]">
                {selectedMarket.countryName}
              </p>
              <p className="mt-2 text-xs leading-5 text-[var(--workspace-muted)]">
                {isSpanish
                  ? "Cuando los filtros están en `All countries`, Hostlyx usa este mercado como valor por defecto de cartera para labels y resúmenes."
                  : "When filters are on `All countries`, Hostlyx uses this market as the portfolio default for labels and summaries."}
              </p>
            </div>

            <div className="rounded-[18px] bg-white/[0.03] p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                {isSpanish ? "Nuevo valor por defecto para propiedad" : "New property default"}
              </p>
              <p className="mt-3 text-base font-semibold text-[var(--workspace-text)]">
                {isSpanish ? `Empieza en ${selectedMarket.shortLabel}` : `Starts in ${selectedMarket.shortLabel}`}
              </p>
              <p className="mt-2 text-xs leading-5 text-[var(--workspace-muted)]">
                {isSpanish
                  ? "La configuración de nuevas propiedades arrancará desde este mercado para que la estructura de tu cartera coincida con tu reporting por defecto."
                  : "New property setup will start from this market so your portfolio structure matches your reporting default."}
              </p>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending || !hasChanges}
          className="workspace-button-primary inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending
            ? isSpanish
              ? "Guardando ajustes..."
              : "Saving settings..."
            : hasChanges
              ? isSpanish
                ? `Guardar ajustes para ${selectedMarket.countryName}`
                : `Save settings for ${selectedMarket.countryName}`
              : isSpanish
                ? "Los ajustes están al día"
                : "Settings are up to date"}
        </button>
      </form>

      <div className="mt-4 min-h-6">
        {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
        {error ? <p className="text-sm text-rose-500">{error}</p> : null}
      </div>
    </div>
  );
}

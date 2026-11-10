"use client";

import { type FormEvent, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  FileSpreadsheet,
  House,
  LayoutDashboard,
  Layers3,
  ReceiptText,
  Sparkles,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { useLocale } from "@/components/locale-provider";
import { UploadPanel } from "@/components/upload-panel";
import { formatCurrency } from "@/lib/format";
import { getMarketLabels, marketDefinitions } from "@/lib/markets";
import { getDefaultTaxRateByCountry, normalizeTaxRate } from "@/lib/tax";
import type { CountryCode, CurrencyCode, PropertyDefinition, UserSettings } from "@/lib/types";

const onboardingPropertyName = "Main Property";

const steps = [
  { id: "welcome", label: { en: "Welcome", es: "Bienvenida" }, icon: Sparkles },
  { id: "workspace", label: { en: "Workspace", es: "Espacio" }, icon: Building2 },
  { id: "property", label: { en: "Property", es: "Propiedad" }, icon: House },
  { id: "finance", label: { en: "Finance", es: "Finanzas" }, icon: FileSpreadsheet },
  { id: "tax", label: { en: "Tax", es: "Impuestos" }, icon: ReceiptText },
  { id: "dashboard", label: { en: "Dashboard", es: "Dashboard" }, icon: LayoutDashboard },
] as const;

function inputClassName() {
  return "input-surface w-full rounded-lg px-4 py-3 text-sm";
}

type OnboardingPreview = {
  hasData: boolean;
  netProfit: number;
  currencyCode: CurrencyCode;
};

export function OnboardingFlow({
  userName,
  initialSettings,
  initialProperties,
  initialHasData = false,
  defaultPropertyName = onboardingPropertyName,
}: {
  userName: string;
  initialSettings: UserSettings;
  initialProperties: PropertyDefinition[];
  initialHasData?: boolean;
  defaultPropertyName?: string;
}) {
  const router = useRouter();
  const { locale } = useLocale();
  const isSpanish = locale === "es";
  const t = (en: string, es: string) => (isSpanish ? es : en);
  // Step 0 (welcome) was an explainer with no input; the flow starts on the
  // workspace step instead.
  const [currentStep, setCurrentStep] = useState(1);
  const [isWorkspacePending, startWorkspaceTransition] = useTransition();
  const [isPropertyPending, startPropertyTransition] = useTransition();
  const [isTaxPending, startTaxTransition] = useTransition();
  const [businessName, setBusinessName] = useState(initialSettings.businessName);
  const [countryCode, setCountryCode] = useState<CountryCode>(initialSettings.primaryCountryCode);
  const [properties, setProperties] = useState<PropertyDefinition[]>(initialProperties);
  const [propertyName, setPropertyName] = useState(initialProperties[0]?.name ?? defaultPropertyName);
  const [propertyCountryCode, setPropertyCountryCode] = useState<CountryCode>(
    initialProperties[0]?.countryCode ?? initialSettings.primaryCountryCode,
  );
  const [propertyMode, setPropertyMode] = useState<"single" | "multi">(
    initialProperties[0]?.units.length ? "multi" : "single",
  );
  const [unitCount, setUnitCount] = useState(
    String(Math.max(initialProperties[0]?.units.length ?? 2, 2)),
  );
  const [taxCountryCode, setTaxCountryCode] = useState<CountryCode>(initialSettings.taxCountryCode);
  const [taxRate, setTaxRate] = useState(String(initialSettings.taxRate));
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [propertyError, setPropertyError] = useState<string | null>(null);
  const [taxError, setTaxError] = useState<string | null>(null);
  const [hasUploadedData, setHasUploadedData] = useState(initialHasData);
  const [uploadNeedsReview, setUploadNeedsReview] = useState(false);
  const [previewVersion, setPreviewVersion] = useState(initialHasData ? 1 : 0);
  const [previewState, setPreviewState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [preview, setPreview] = useState<OnboardingPreview | null>(null);

  const selectedTaxMarket = getMarketLabels(taxCountryCode, locale);
  const normalizedTaxRate = normalizeTaxRate(taxRate);
  const previewCurrencyCode = preview?.currencyCode ?? initialSettings.currencyCode;
  const previewNetProfit = preview?.netProfit ?? 0;
  const previewSetAside =
    previewNetProfit > 0 ? previewNetProfit * (normalizedTaxRate / 100) : 0;
  const previewYouKeep = previewNetProfit - previewSetAside;

  useEffect(() => {
    if (!hasUploadedData || previewVersion === 0) {
      return;
    }

    let cancelled = false;

    async function loadPreview() {
      setPreviewState("loading");

      try {
        const response = await fetch("/api/onboarding-preview", {
          method: "GET",
          cache: "no-store",
        });
        const payload = (await response.json()) as OnboardingPreview & { error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? "The preview could not be loaded.");
        }

        if (cancelled) {
          return;
        }

        setPreview(payload);
        setPreviewState("ready");
      } catch {
        if (cancelled) {
          return;
        }

        setPreview(null);
        setPreviewState("error");
      }
    }

    void loadPreview();

    return () => {
      cancelled = true;
    };
  }, [hasUploadedData, previewVersion]);

  function renderValueMoment() {
    if (!hasUploadedData) {
      return (
        <div className="workspace-card rounded-xl p-6 sm:p-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--workspace-muted)]">
            {t("Financial snapshot", "Resumen financiero")}
          </p>
          <h3 className="mt-4 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl text-[var(--workspace-text)]">
            {t("Calendar first is completely fine.", "Empezar por el calendario está perfecto.")}
          </h3>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--workspace-muted)]">
            {t("Skip spreadsheets for now if iCal will bring your bookings. You can add statements, expenses, or Excel data later whenever you want richer financial reporting.", "Sáltate los archivos si el iCal va a traer tus reservas. Puedes añadir extractos, gastos o Excel más adelante cuando quieras informes más completos.")}
          </p>
        </div>
      );
    }

    if (previewState === "loading" || previewState === "idle") {
      return (
        <div className="workspace-card rounded-xl p-6 sm:p-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--workspace-muted)]">
            {t("First look", "Primer vistazo")}
          </p>
          <h3 className="mt-4 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl text-[var(--workspace-text)]">
            {t("Here’s what your business looks like right now.", "Así se ve tu negocio ahora mismo.")}
          </h3>
          <p className="mt-4 text-sm leading-7 text-[var(--workspace-muted)]">
            {t("Reading the imported numbers and preparing your first summary.", "Leyendo los números importados y preparando tu primer resumen.")}
          </p>
        </div>
      );
    }

    if (previewState === "error" || !preview?.hasData) {
      return (
        <div className="workspace-card rounded-xl p-6 sm:p-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--workspace-muted)]">
            {t("First look", "Primer vistazo")}
          </p>
          <h3 className="mt-4 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl text-[var(--workspace-text)]">
            {t("Here’s what your business looks like right now.", "Así se ve tu negocio ahora mismo.")}
          </h3>
          <p className="mt-4 text-sm leading-7 text-[var(--workspace-muted)]">
            {t("GoHostlyx imported your file, but there is not enough clean financial data yet to show this summary.", "GoHostlyx importó tu archivo, pero todavía no hay suficientes datos limpios para mostrar este resumen.")}
          </p>
        </div>
      );
    }

    const youKeepPositive = previewYouKeep >= 0;

    return (
      <div className="space-y-5">
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--workspace-muted)]">
            {t("First look", "Primer vistazo")}
          </p>
          <h3 className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl text-[var(--workspace-text)] sm:text-4xl">
            {t("Here’s what your business looks like right now.", "Así se ve tu negocio ahora mismo.")}
          </h3>
          <p className="max-w-2xl text-sm leading-7 text-[var(--workspace-muted)]">
            {t("The estimate below updates as you adjust the tax rate, so the first number you see is what you keep.", "La estimación se actualiza al cambiar la tasa, así que el primer número que ves es lo que te quedas.")}
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.7fr)]">
          <article
            className={`workspace-card rounded-xl p-6 sm:p-7 ring-1 ${
              youKeepPositive
                ? "bg-[linear-gradient(180deg,rgba(29,78,60,0.2)_0%,rgba(11,22,38,0.98)_100%)] ring-emerald-300/14"
                : "bg-[linear-gradient(180deg,rgba(120,28,50,0.16)_0%,rgba(11,22,38,0.98)_100%)] ring-rose-300/12"
            }`}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--workspace-muted)]">
              {t("You Keep", "Te quedas")}
            </p>
            <p
              className={`mt-5 text-5xl font-semibold tracking-[-0.04em] sm:text-6xl ${
                youKeepPositive ? "text-white" : "text-rose-200"
              }`}
            >
              {formatCurrency(previewYouKeep, false, previewCurrencyCode)}
            </p>
            <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300">
              {t("This is roughly what you keep after setting aside estimated taxes.", "Es aproximadamente lo que te quedas después de reservar los impuestos estimados.")}
            </p>
          </article>

          <div className="grid gap-4">
            <article className="workspace-soft-card rounded-xl p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                {t("Set Aside", "Reserva")}
              </p>
              <p className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-[var(--workspace-text)]">
                {formatCurrency(previewSetAside, false, previewCurrencyCode)}
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--workspace-muted)]">
                {t("Based on the tax rate in this setup.", "Según la tasa de impuestos de esta configuración.")}
              </p>
            </article>

            <article className="workspace-soft-card rounded-xl p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                {t("Net Profit", "Beneficio neto")}
              </p>
              <p className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-[var(--workspace-text)]">
                {formatCurrency(previewNetProfit, false, previewCurrencyCode)}
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--workspace-muted)]">
                {t("Before estimated taxes are set aside.", "Antes de reservar los impuestos estimados.")}
              </p>
            </article>
          </div>
        </div>
      </div>
    );
  }

  function handleWorkspaceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorkspaceError(null);

    const normalizedBusinessName = businessName.trim();

    if (!normalizedBusinessName) {
      setWorkspaceError(t("Add a workspace name before continuing.", "Añade un nombre de espacio antes de continuar."));
      return;
    }

    startWorkspaceTransition(() => {
      void (async () => {
        try {
          const settingsFormData = new FormData();
          settingsFormData.set("businessName", normalizedBusinessName);
          settingsFormData.set("primaryCountryCode", countryCode);

          const settingsResponse = await fetch("/api/settings", {
            method: "POST",
            body: settingsFormData,
          });
          const settingsPayload = (await settingsResponse.json()) as { error?: string };

          if (!settingsResponse.ok) {
            setWorkspaceError(settingsPayload.error ?? t("The workspace could not be saved.", "No se pudo guardar el espacio de trabajo."));
            return;
          }

          if (taxCountryCode !== countryCode && initialProperties.length === 0) {
            setTaxCountryCode(countryCode);
            setTaxRate(String(getDefaultTaxRateByCountry(countryCode)));
          }

          if (properties.length === 0) {
            setPropertyCountryCode(countryCode);
          }

          setCurrentStep(2);
        } catch {
          setWorkspaceError(t("The workspace could not be saved.", "No se pudo guardar el espacio de trabajo."));
        }
      })();
    });
  }

  function handlePropertySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPropertyError(null);

    const normalizedPropertyName = propertyName.trim();
    const normalizedUnitCount = Math.max(2, Math.trunc(Number(unitCount) || 0));

    if (!normalizedPropertyName) {
      setPropertyError(t("Add a property name before continuing.", "Añade un nombre de propiedad antes de continuar."));
      return;
    }

    if (propertyMode === "multi" && normalizedUnitCount < 2) {
      setPropertyError("Multi-listing properties need at least 2 listings.");
      return;
    }

    startPropertyTransition(() => {
      void (async () => {
        try {
          const propertyFormData = new FormData();
          propertyFormData.set("name", normalizedPropertyName);
          propertyFormData.set("countryCode", propertyCountryCode);

          const propertyResponse = await fetch("/api/properties", {
            method: "POST",
            body: propertyFormData,
          });
          const propertyPayload = (await propertyResponse.json()) as {
            error?: string;
            propertyId?: number;
          };

          if (!propertyResponse.ok) {
            setPropertyError(propertyPayload.error ?? t("The property could not be created.", "No se pudo crear la propiedad."));
            return;
          }

          const propertyId = Number(propertyPayload.propertyId);
          const nextUnits =
            propertyMode === "multi"
              ? Array.from({ length: normalizedUnitCount }, (_, index) => ({
                  name: `Listing ${index + 1}`,
                }))
              : [];

          if (propertyMode === "multi" && Number.isFinite(propertyId) && propertyId > 0) {
            for (const unit of nextUnits) {
              const unitFormData = new FormData();
              unitFormData.set("name", unit.name);

              const unitResponse = await fetch(`/api/properties/${propertyId}/units`, {
                method: "POST",
                body: unitFormData,
              });

              if (!unitResponse.ok) {
                const unitPayload = (await unitResponse.json()) as { error?: string };
                setPropertyError(
                  unitPayload.error ??
                    "The property was created, but some listings could not be added.",
                );
                return;
              }
            }
          }

          setProperties((current) => [
            ...current,
            {
              id: propertyId,
              name: normalizedPropertyName,
              countryCode: propertyCountryCode,
              units: nextUnits,
            },
          ]);
          setCurrentStep(3);
        } catch {
          setPropertyError(t("The property could not be created.", "No se pudo crear la propiedad."));
        }
      })();
    });
  }

  function handleTaxSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTaxError(null);

    startTaxTransition(() => {
      void (async () => {
        try {
          const formData = new FormData();
          formData.set("taxCountryCode", taxCountryCode);
          formData.set("taxRate", String(normalizedTaxRate));

          const response = await fetch("/api/tax-settings", {
            method: "POST",
            body: formData,
          });
          const payload = (await response.json()) as { error?: string };

          if (!response.ok) {
            setTaxError(payload.error ?? t("The tax rate could not be saved.", "No se pudo guardar la tasa de impuestos."));
            return;
          }

          setCurrentStep(5);
        } catch {
          setTaxError(t("The tax rate could not be saved.", "No se pudo guardar la tasa de impuestos."));
        }
      })();
    });
  }

  function renderStep() {
    if (currentStep === 1) {
      return (
        <section className="space-y-6">
          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--workspace-muted)]">
              {t("Workspace setup", "Espacio de trabajo")}
            </p>
            <h2 className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl text-[var(--workspace-text)]">
              {t("Name your workspace and pick your market.", "Ponle nombre a tu espacio y elige tu mercado.")}
            </h2>
            <p className="max-w-2xl text-sm leading-7 text-[var(--workspace-muted)]">
              {t("The market sets your default currency and tax context. You can change both later in Settings.", "El mercado define tu moneda y tus impuestos por defecto. Puedes cambiar ambos después en Ajustes.")}
            </p>
          </div>

          <form onSubmit={handleWorkspaceSubmit} className="space-y-5">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-[var(--workspace-text)]">{t("Workspace name", "Nombre del espacio")}</span>
              <input
                className={inputClassName()}
                value={businessName}
                onChange={(event) => setBusinessName(event.target.value)}
                placeholder={t("My rental business", "Mi negocio de alquiler")}
                required
              />
            </label>

            <div className="space-y-2">
              <p className="text-sm font-medium text-[var(--workspace-text)]">{t("Market", "Mercado")}</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {marketDefinitions.map((definition) => getMarketLabels(definition.countryCode, locale)).map((entry) => {
                  const isSelected = entry.countryCode === countryCode;

                  return (
                    <button
                      key={entry.countryCode}
                      type="button"
                      onClick={() => setCountryCode(entry.countryCode)}
                      className={`rounded-lg border p-4 text-left transition ${
                        isSelected
                          ? "border-[var(--workspace-accent)] bg-[var(--workspace-accent-soft)] shadow-[0_0_0_1px_rgba(88,196,182,0.16)]"
                          : "border-[var(--workspace-border)] bg-[var(--workspace-panel-soft)] hover:border-[var(--workspace-accent)]/40"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="workspace-icon-chip flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-semibold">
                          {entry.countryCode}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-[var(--workspace-text)]">
                            {entry.countryName}
                          </p>
                          <p className="mt-1 text-xs text-[var(--workspace-muted)]">
                            {entry.currencyCode} • {entry.currencyLabel}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {workspaceError ? (
              <p className="text-sm text-rose-400">{workspaceError}</p>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={isWorkspacePending}
                className="workspace-button-primary inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isWorkspacePending ? "Saving workspace..." : t("Continue to property", "Continuar a la propiedad")}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </form>
        </section>
      );
    }

    if (currentStep === 2) {
      return (
        <section className="space-y-6">
          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--workspace-muted)]">
              {t("Property setup", "Propiedad")}
            </p>
            <h2 className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl text-[var(--workspace-text)]">
              {t("Add your first property.", "Añade tu primera propiedad.")}
            </h2>
            <p className="max-w-2xl text-sm leading-7 text-[var(--workspace-muted)]">
              {t("Bookings, expenses and calendars are tracked per property. You can add more properties later.", "Reservas, gastos y calendarios se organizan por propiedad. Puedes añadir más después.")}
            </p>
          </div>

          <form onSubmit={handlePropertySubmit} className="space-y-5">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-[var(--workspace-text)]">{t("Property name", "Nombre de la propiedad")}</span>
              <input
                className={inputClassName()}
                value={propertyName}
                onChange={(event) => setPropertyName(event.target.value)}
                placeholder={defaultPropertyName}
                required
              />
            </label>

            <div className="space-y-2">
              <p className="text-sm font-medium text-[var(--workspace-text)]">{t("How do you rent it?", "¿Cómo la alquilas?")}</p>

              <div className="grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setPropertyMode("single")}
                  className={`rounded-lg border p-4 text-left transition ${
                    propertyMode === "single"
                      ? "border-[var(--workspace-accent)] bg-[var(--workspace-accent-soft)] shadow-[0_0_0_1px_rgba(88,196,182,0.16)]"
                      : "border-[var(--workspace-border)] bg-[var(--workspace-panel-soft)] hover:border-[var(--workspace-accent)]/40"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="workspace-icon-chip rounded-lg p-3">
                      <House className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[var(--workspace-text)]">{t("As one listing", "Como un solo listing")}</p>
                      <p className="mt-1 text-xs leading-6 text-[var(--workspace-muted)]">
                        {t("The whole home is rented as a single unit.", "La vivienda entera se alquila como una unidad.")}
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPropertyMode("multi")}
                  className={`rounded-lg border p-4 text-left transition ${
                    propertyMode === "multi"
                      ? "border-[var(--workspace-accent)] bg-[var(--workspace-accent-soft)] shadow-[0_0_0_1px_rgba(88,196,182,0.16)]"
                      : "border-[var(--workspace-border)] bg-[var(--workspace-panel-soft)] hover:border-[var(--workspace-accent)]/40"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="workspace-icon-chip rounded-lg p-3">
                      <Layers3 className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[var(--workspace-text)]">{t("As several listings", "Como varios listings")}</p>
                      <p className="mt-1 text-xs leading-6 text-[var(--workspace-muted)]">
                        {t("Rooms or units listed separately, each with its own calendar.", "Habitaciones o unidades anunciadas por separado, cada una con su calendario.")}
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {propertyMode === "multi" ? (
              <div>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-[var(--workspace-text)]">{t("How many listings?", "¿Cuántos listings?")}</span>
                  <input
                    className={inputClassName()}
                    type="number"
                    min={2}
                    step={1}
                    value={unitCount}
                    onChange={(event) => setUnitCount(event.target.value)}
                  />
                </label>
              </div>
            ) : null}

            <div className="space-y-2">
              <p className="text-sm font-medium text-[var(--workspace-text)]">{t("Where is it?", "¿Dónde está?")}</p>

              <div className="grid gap-3 sm:grid-cols-3">
                {marketDefinitions.map((definition) => getMarketLabels(definition.countryCode, locale)).map((entry) => {
                  const isSelected = entry.countryCode === propertyCountryCode;

                  return (
                    <button
                      key={`property-market-${entry.countryCode}`}
                      type="button"
                      onClick={() => setPropertyCountryCode(entry.countryCode)}
                      className={`rounded-lg border p-4 text-left transition ${
                        isSelected
                          ? "border-[var(--workspace-accent)] bg-[var(--workspace-accent-soft)] shadow-[0_0_0_1px_rgba(88,196,182,0.16)]"
                          : "border-[var(--workspace-border)] bg-[var(--workspace-panel-soft)] hover:border-[var(--workspace-accent)]/40"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="workspace-icon-chip flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-semibold">
                          {entry.countryCode}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-[var(--workspace-text)]">
                            {entry.countryName}
                          </p>
                          <p className="mt-1 text-xs text-[var(--workspace-muted)]">
                            {entry.currencyCode} • {entry.currencyLabel}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {propertyError ? <p className="text-sm text-rose-400">{propertyError}</p> : null}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="workspace-button-secondary inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition"
              >
                <ArrowLeft className="h-4 w-4" />
                {t("Back", "Atrás")}
              </button>
              <button
                type="submit"
                disabled={isPropertyPending}
                className="workspace-button-primary inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPropertyPending ? "Creating property..." : t("Continue", "Continuar")}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </form>
        </section>
      );
    }

    if (currentStep === 3) {
      return (
        <section className="space-y-6">
          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--workspace-muted)]">
              {t("Optional financial data", "Datos financieros opcionales")}
            </p>
            <h2 className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl text-[var(--workspace-text)]">
              {t("Import your numbers, or skip for now.", "Importa tus números o sáltalo por ahora.")}
            </h2>
            <p className="max-w-2xl text-sm leading-7 text-[var(--workspace-muted)]">
              {t("Upload an Airbnb or Booking.com export, an expenses sheet or a payout statement to see real numbers right away. If your bookings will come in through calendar sync, skip this.", "Sube una exportación de Airbnb o Booking.com, una hoja de gastos o un extracto de payout para ver números reales enseguida. Si tus reservas llegarán por el calendario, sáltalo.")}
            </p>
          </div>

          <UploadPanel
            properties={properties}
            hideHeader
            refreshOnSuccess={false}
            onImportComplete={({ hasRemainingIssues }) => {
              setHasUploadedData(true);
              setUploadNeedsReview(hasRemainingIssues);
              setPreviewVersion((current) => current + 1);
              if (!hasRemainingIssues) {
                setCurrentStep(4);
              }
            }}
          />

          {hasUploadedData && uploadNeedsReview ? (
            <div className="workspace-card rounded-xl border border-amber-300/18 bg-[rgba(122,97,14,0.08)] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-100/80">
                {t("Import review", "Revisión de la importación")}
              </p>
              <h3 className="mt-3 text-xl font-semibold tracking-[-0.03em] text-[var(--workspace-text)]">
                {t("Clean rows are already in GoHostlyx.", "Las filas limpias ya están en GoHostlyx.")}
              </h3>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--workspace-muted)]">
                {t("You can keep reviewing this file here, replace it, or move on. Upload is optional now, not a blocker.", "Puedes seguir revisando este archivo, reemplazarlo o continuar. Subir archivos es opcional.")}
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentStep(4)}
                  className="workspace-button-primary inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition"
                >
                  {t("Continue to tax", "Continuar a impuestos")}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="workspace-button-secondary inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("Back", "Atrás")}
            </button>
            <button
              type="button"
              onClick={() => setCurrentStep(4)}
              className="workspace-button-primary inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition"
            >
              {t("Skip for now", "Saltar por ahora")}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      );
    }

    if (currentStep === 4) {
      const estimatedTaxPreview =
        normalizedTaxRate > 0 ? `GoHostlyx will set aside ${normalizedTaxRate}% of net profit.` : "No tax will be set aside.";

      return (
        <section className="space-y-6">
          {hasUploadedData ? renderValueMoment() : null}

          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--workspace-muted)]">
              {t("Optional tax setup", "Impuestos (opcional)")}
            </p>
            <h2 className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl text-[var(--workspace-text)]">
              {t("Set your tax estimate.", "Configura tu estimación de impuestos.")}
            </h2>
            <p className="max-w-2xl text-sm leading-7 text-[var(--workspace-muted)]">
              {t("This only helps the dashboard show what to set aside and what you keep. You can skip it now and change it later in Settings.", "Solo sirve para que el dashboard muestre cuánto reservar y cuánto te quedas. Puedes saltarlo y cambiarlo después en Ajustes.")}
            </p>
          </div>

          <form onSubmit={handleTaxSubmit} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
              <div className="workspace-soft-card rounded-xl p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                  {t("Tax market", "Mercado fiscal")}
                </p>
                <div className="mt-4 grid gap-3">
                  {marketDefinitions.map((definition) => getMarketLabels(definition.countryCode, locale)).map((entry) => {
                    const isSelected = entry.countryCode === taxCountryCode;

                    return (
                      <button
                        key={entry.countryCode}
                        type="button"
                        onClick={() => {
                          setTaxCountryCode(entry.countryCode);
                          setTaxRate(String(getDefaultTaxRateByCountry(entry.countryCode)));
                          setTaxError(null);
                        }}
                        className={`rounded-lg border px-4 py-4 text-left transition ${
                          isSelected
                            ? "border-[var(--workspace-accent)] bg-[var(--workspace-accent-soft)]"
                            : "border-[var(--workspace-border)] bg-[var(--workspace-panel-soft)]"
                        }`}
                      >
                        <p className="text-sm font-semibold text-[var(--workspace-text)]">{entry.countryName}</p>
                        <p className="mt-1 text-xs text-[var(--workspace-muted)]">
                          Default {getDefaultTaxRateByCountry(entry.countryCode)}%
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4">
                <div className="workspace-soft-card rounded-xl p-5">
                  <label className="space-y-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                      {t("Tax rate", "Tasa de impuestos")}
                    </span>
                    <div className="relative">
                      <input
                        className={`${inputClassName()} pr-12`}
                        type="number"
                        min={0}
                        max={100}
                        step="0.1"
                        value={taxRate}
                        onChange={(event) => {
                          setTaxRate(event.target.value);
                          setTaxError(null);
                        }}
                      />
                      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-[var(--workspace-muted)]">
                        %
                      </span>
                    </div>
                  </label>
                </div>

                <div className="workspace-card rounded-xl p-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                    {t("Preview", "Vista previa")}
                  </p>
                  <p className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--workspace-text)]">
                    {selectedTaxMarket.countryName} • {normalizedTaxRate}%
                  </p>
                  <p className="mt-3 text-sm leading-7 text-[var(--workspace-muted)]">
                    {estimatedTaxPreview}
                  </p>
                </div>
              </div>
            </div>

            {taxError ? <p className="text-sm text-rose-400">{taxError}</p> : null}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="workspace-button-secondary inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition"
              >
                <ArrowLeft className="h-4 w-4" />
                {t("Back", "Atrás")}
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(5)}
                className="workspace-button-secondary inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition"
              >
                {t("Skip for now", "Saltar por ahora")}
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="submit"
                disabled={isTaxPending}
                className="workspace-button-primary inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isTaxPending ? "Saving tax rate..." : t("Continue to dashboard", "Continuar al dashboard")}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </form>
        </section>
      );
    }

    return (
      <section className="space-y-8">
        {hasUploadedData ? (
          renderValueMoment()
        ) : (
          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--workspace-muted)]">
              {t("All set", "Todo listo")}
            </p>
            <h2 className="text-2xl font-semibold tracking-[-0.03em] text-[var(--workspace-text)] sm:text-3xl">
              {t("Your workspace is ready.", "Tu espacio está listo.")}
            </h2>
            <p className="max-w-2xl text-sm leading-7 text-[var(--workspace-muted)]">
              {t("Next, connect your Airbnb or Booking.com calendar from the Calendar page, or upload a file from the dashboard. Your numbers appear as soon as bookings come in.", "Ahora conecta tu calendario de Airbnb o Booking.com desde la página Calendario, o sube un archivo desde el dashboard. Tus números aparecen en cuanto entren reservas.")}
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="workspace-button-primary inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition"
          >
            {t("Go to dashboard", "Ir al dashboard")}
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setCurrentStep(4)}
            className="workspace-button-secondary inline-flex items-center rounded-lg px-3.5 py-2 text-sm font-semibold transition"
          >
            {t("Review tax rate", "Revisar tasa de impuestos")}
          </button>
        </div>
      </section>
    );
  }

  const visibleSteps = steps.slice(1);
  const visibleIndex = Math.max(0, currentStep - 1);
  const firstName = userName.split(" ")[0] || (isSpanish ? "" : "there");

  return (
    <main className="min-h-screen bg-[var(--workspace-bg)] px-4 pb-16 pt-6 sm:px-6">
      <div className="mx-auto w-full max-w-3xl">
        <header className="flex items-center justify-between gap-4">
          <BrandLogo href="/" compact />
          <p className="text-sm font-medium text-[var(--workspace-muted)]">
            {t("Step", "Paso")} {visibleIndex + 1} {t("of", "de")} {visibleSteps.length}
          </p>
        </header>

        <ol className="mt-8 grid grid-cols-5 gap-2" aria-label={t("Onboarding progress", "Progreso de la configuración")}>
          {visibleSteps.map((step, index) => {
            const isActive = index === visibleIndex;
            const isDone = index < visibleIndex;

            return (
              <li key={step.id} className="space-y-2" aria-current={isActive ? "step" : undefined}>
                <div
                  className={`h-1.5 rounded-full transition-colors ${
                    isActive || isDone ? "bg-[var(--workspace-accent)]" : "bg-white/10"
                  }`}
                />
                <p
                  className={`hidden text-xs font-medium sm:block ${
                    isActive
                      ? "text-[var(--workspace-text)]"
                      : isDone
                        ? "text-[var(--workspace-accent)]"
                        : "text-[var(--workspace-muted)]"
                  }`}
                >
                  {step.label[locale]}
                </p>
              </li>
            );
          })}
        </ol>

        {currentStep === 1 ? (
          <p className="mt-10 text-sm leading-7 text-[var(--workspace-muted)]">
            {isSpanish
              ? `Hola ${firstName}. La configuración lleva unos dos minutos y puedes cambiarlo todo después.`
              : `Hi ${firstName}. Setup takes about two minutes, and you can change everything later.`}
          </p>
        ) : null}

        <section className={`workspace-card rounded-xl p-6 sm:p-8 ${currentStep === 1 ? "mt-4" : "mt-10"}`}>
          {renderStep()}
        </section>
      </div>
    </main>
  );
}

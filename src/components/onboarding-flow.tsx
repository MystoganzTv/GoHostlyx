"use client";

import { type FormEvent, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  FileSpreadsheet,
  Globe2,
  House,
  LayoutDashboard,
  Layers3,
  ReceiptText,
  Sparkles,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { UploadPanel } from "@/components/upload-panel";
import { formatCurrency } from "@/lib/format";
import { getMarketDefinition, marketDefinitions } from "@/lib/markets";
import { getDefaultTaxRateByCountry, normalizeTaxRate } from "@/lib/tax";
import type { CountryCode, CurrencyCode, PropertyDefinition, UserSettings } from "@/lib/types";

const onboardingPropertyName = "Main Property";

const steps = [
  {
    id: "welcome",
    label: "Welcome",
    title: "Get Hostlyx ready in a few quick steps.",
    icon: Sparkles,
  },
  {
    id: "workspace",
    label: "Workspace",
    title: "Set the workspace basics.",
    icon: Building2,
  },
  {
    id: "property",
    label: "Property",
    title: "Create the home that calendars and finances belong to.",
    icon: House,
  },
  {
    id: "finance",
    label: "Finance",
    title: "Bring in statements or spreadsheets only if you want them now.",
    icon: FileSpreadsheet,
  },
  {
    id: "tax",
    label: "Tax",
    title: "Choose the estimate Hostlyx should use.",
    icon: ReceiptText,
  },
  {
    id: "dashboard",
    label: "Dashboard",
    title: "You are ready to see the numbers.",
    icon: LayoutDashboard,
  },
] as const;

function inputClassName() {
  return "input-surface w-full rounded-2xl px-4 py-3 text-sm";
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
  const [currentStep, setCurrentStep] = useState(0);
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

  const market = getMarketDefinition(countryCode);
  const selectedTaxMarket = getMarketDefinition(taxCountryCode);
  const normalizedTaxRate = normalizeTaxRate(taxRate);
  const previewCurrencyCode = preview?.currencyCode ?? initialSettings.currencyCode;
  const previewNetProfit = preview?.netProfit ?? 0;
  const previewSetAside =
    previewNetProfit > 0 ? previewNetProfit * (normalizedTaxRate / 100) : 0;
  const previewYouKeep = previewNetProfit - previewSetAside;
  const stepsCompleted = currentStep;

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
        <div className="workspace-card rounded-[30px] p-6 sm:p-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--workspace-muted)]">
            Financial snapshot
          </p>
          <h3 className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-[var(--workspace-text)]">
            Calendar first is completely fine.
          </h3>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--workspace-muted)]">
            Skip spreadsheets for now if iCal will bring your bookings. You can add statements,
            expenses, or Excel data later whenever you want richer financial reporting.
          </p>
        </div>
      );
    }

    if (previewState === "loading" || previewState === "idle") {
      return (
        <div className="workspace-card rounded-[30px] p-6 sm:p-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--workspace-muted)]">
            First look
          </p>
          <h3 className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-[var(--workspace-text)]">
            Here’s what your business looks like right now.
          </h3>
          <p className="mt-4 text-sm leading-7 text-[var(--workspace-muted)]">
            Reading the imported numbers and preparing your first summary.
          </p>
        </div>
      );
    }

    if (previewState === "error" || !preview?.hasData) {
      return (
        <div className="workspace-card rounded-[30px] p-6 sm:p-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--workspace-muted)]">
            First look
          </p>
          <h3 className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-[var(--workspace-text)]">
            Here’s what your business looks like right now.
          </h3>
          <p className="mt-4 text-sm leading-7 text-[var(--workspace-muted)]">
            Hostlyx imported your file, but there is not enough clean financial data yet to show this summary.
          </p>
        </div>
      );
    }

    const youKeepPositive = previewYouKeep >= 0;

    return (
      <div className="space-y-5">
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--workspace-muted)]">
            First look
          </p>
          <h3 className="text-3xl font-semibold tracking-[-0.05em] text-[var(--workspace-text)] sm:text-4xl">
            Here’s what your business looks like right now.
          </h3>
          <p className="max-w-2xl text-sm leading-7 text-[var(--workspace-muted)]">
            The estimate below updates as you adjust the tax rate, so the first number you see is what you keep.
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.7fr)]">
          <article
            className={`workspace-card rounded-[32px] p-6 sm:p-7 ring-1 ${
              youKeepPositive
                ? "bg-[linear-gradient(180deg,rgba(29,78,60,0.2)_0%,rgba(11,22,38,0.98)_100%)] ring-emerald-300/14"
                : "bg-[linear-gradient(180deg,rgba(120,28,50,0.16)_0%,rgba(11,22,38,0.98)_100%)] ring-rose-300/12"
            }`}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--workspace-muted)]">
              You Keep
            </p>
            <p
              className={`mt-5 text-5xl font-semibold tracking-[-0.06em] sm:text-6xl ${
                youKeepPositive ? "text-white" : "text-rose-200"
              }`}
            >
              {formatCurrency(previewYouKeep, false, previewCurrencyCode)}
            </p>
            <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300">
              This is roughly what you keep after setting aside estimated taxes.
            </p>
          </article>

          <div className="grid gap-4">
            <article className="workspace-soft-card rounded-[26px] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                Set Aside
              </p>
              <p className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-[var(--workspace-text)]">
                {formatCurrency(previewSetAside, false, previewCurrencyCode)}
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--workspace-muted)]">
                Based on the tax rate in this setup.
              </p>
            </article>

            <article className="workspace-soft-card rounded-[26px] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                Net Profit
              </p>
              <p className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-[var(--workspace-text)]">
                {formatCurrency(previewNetProfit, false, previewCurrencyCode)}
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--workspace-muted)]">
                Before estimated taxes are set aside.
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
      setWorkspaceError("Add a workspace name before continuing.");
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
            setWorkspaceError(settingsPayload.error ?? "The workspace could not be saved.");
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
          setWorkspaceError("The workspace could not be saved.");
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
      setPropertyError("Add a property name before continuing.");
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
            setPropertyError(propertyPayload.error ?? "The property could not be created.");
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
          setPropertyError("The property could not be created.");
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
            setTaxError(payload.error ?? "The tax rate could not be saved.");
            return;
          }

          setCurrentStep(5);
        } catch {
          setTaxError("The tax rate could not be saved.");
        }
      })();
    });
  }

  function renderStep() {
    if (currentStep === 0) {
      return (
        <section className="space-y-8">
          <div className="space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--workspace-muted)]">
              Welcome
            </p>
            <h1 className="text-4xl font-semibold tracking-[-0.06em] text-[var(--workspace-text)] sm:text-5xl">
              Set up the structure first, then decide how much data to add.
            </h1>
            <p className="max-w-2xl text-base leading-8 text-[var(--workspace-muted)]">
              We will name the workspace, create the first property, leave room for calendar sync at
              the property or unit level, and keep spreadsheets optional.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="workspace-soft-card rounded-[26px] p-5">
              <p className="text-sm font-semibold text-[var(--workspace-text)]">1. Set the workspace</p>
              <p className="mt-2 text-sm leading-7 text-[var(--workspace-muted)]">
                Save the business name and reporting market that should guide the rest of the app.
              </p>
            </div>
            <div className="workspace-soft-card rounded-[26px] p-5">
              <p className="text-sm font-semibold text-[var(--workspace-text)]">2. Create the property</p>
              <p className="mt-2 text-sm leading-7 text-[var(--workspace-muted)]">
                Calendars and financial data should attach to a property, and to listings when the property has more than one rentable listing.
              </p>
            </div>
            <div className="workspace-soft-card rounded-[26px] p-5">
              <p className="text-sm font-semibold text-[var(--workspace-text)]">3. Add data only if useful</p>
              <p className="mt-2 text-sm leading-7 text-[var(--workspace-muted)]">
                Upload statements, spreadsheets, or expenses later. The calendar path does not need a booking file first.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="workspace-button-primary inline-flex items-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-semibold transition"
            >
              Start onboarding
              <ArrowRight className="h-4 w-4" />
            </button>
            <Link
              href="/"
              className="workspace-button-secondary inline-flex items-center rounded-2xl px-5 py-3.5 text-sm font-semibold transition"
            >
              Back home
            </Link>
          </div>
        </section>
      );
    }

    if (currentStep === 1) {
      return (
        <section className="space-y-6">
          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--workspace-muted)]">
              Workspace setup
            </p>
            <h2 className="text-3xl font-semibold tracking-[-0.05em] text-[var(--workspace-text)]">
              Give Hostlyx the right home base.
            </h2>
            <p className="max-w-2xl text-sm leading-7 text-[var(--workspace-muted)]">
              Keep this simple. The selected market becomes the default reporting context for the workspace,
              while properties and listings come next.
            </p>
          </div>

          <form onSubmit={handleWorkspaceSubmit} className="space-y-5">
            <div className="workspace-soft-card rounded-[26px] p-5">
              <label className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                  Workspace name
                </span>
                <input
                  className={inputClassName()}
                  value={businessName}
                  onChange={(event) => setBusinessName(event.target.value)}
                  placeholder="Hostlyx Capital, My Rental Portfolio..."
                  required
                />
              </label>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                    Market
                  </p>
                  <p className="mt-2 text-sm text-[var(--workspace-muted)]">
                    Country and currency stay linked so reporting stays consistent.
                  </p>
                </div>
                <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-xs font-semibold text-[var(--workspace-text)]">
                  {market.currencyCode}
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {marketDefinitions.map((entry) => {
                  const isSelected = entry.countryCode === countryCode;

                  return (
                    <button
                      key={entry.countryCode}
                      type="button"
                      onClick={() => setCountryCode(entry.countryCode)}
                      className={`rounded-[26px] border p-5 text-left transition ${
                        isSelected
                          ? "border-[var(--workspace-accent)] bg-[var(--workspace-accent-soft)] shadow-[0_0_0_1px_rgba(88,196,182,0.16)]"
                          : "border-[var(--workspace-border)] bg-[var(--workspace-panel-soft)] hover:border-[var(--workspace-accent)]/40"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="workspace-icon-chip rounded-[18px] p-3">
                          <Globe2 className="h-4 w-4" />
                        </div>
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

            <div className="workspace-soft-card rounded-[26px] p-5">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                    Workspace
                  </p>
                  <p className="mt-3 text-base font-semibold text-[var(--workspace-text)]">
                    {businessName.trim() || "Your workspace"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                    Default market
                  </p>
                  <p className="mt-3 text-base font-semibold text-[var(--workspace-text)]">
                    {market.countryName}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                    Next up
                  </p>
                  <p className="mt-3 text-base font-semibold text-[var(--workspace-text)]">
                    Create your first property
                  </p>
                </div>
              </div>
            </div>

            {workspaceError ? (
              <p className="text-sm text-rose-400">{workspaceError}</p>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setCurrentStep(0)}
                className="workspace-button-secondary inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <button
                type="submit"
                disabled={isWorkspacePending}
                className="workspace-button-primary inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isWorkspacePending ? "Saving workspace..." : "Continue to property"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </form>
        </section>
      );
    }

    if (currentStep === 2) {
      const propertyMarket = getMarketDefinition(propertyCountryCode);
      const calendarTargetLabel =
        propertyMode === "multi"
          ? `${Math.max(2, Math.trunc(Number(unitCount) || 0))} future iCal targets`
          : "1 future iCal target";

      return (
        <section className="space-y-6">
          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--workspace-muted)]">
              Property setup
            </p>
            <h2 className="text-3xl font-semibold tracking-[-0.05em] text-[var(--workspace-text)]">
              Create the home that calendars should attach to.
            </h2>
            <p className="max-w-2xl text-sm leading-7 text-[var(--workspace-muted)]">
              The business name stays at workspace level. Each future iCal feed should belong to a
              property, or to one of its listings if you rent multiple rentable listings.
            </p>
          </div>

          <div className="workspace-card rounded-[28px] p-5">
            <div className="flex items-start gap-4">
              <div className="workspace-icon-chip rounded-[18px] p-3">
                <CalendarDays className="h-4 w-4" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-[var(--workspace-text)]">
                  Calendar connection rule
                </p>
                <p className="max-w-3xl text-sm leading-7 text-[var(--workspace-muted)]">
                  The workspace is just the company shell. iCal should connect here at the property
                  level, or one level deeper at each listing when the property has multiple rentable listings.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handlePropertySubmit} className="space-y-5">
            <div className="workspace-soft-card rounded-[26px] p-5">
              <label className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                  Property name
                </span>
                <input
                  className={inputClassName()}
                  value={propertyName}
                  onChange={(event) => setPropertyName(event.target.value)}
                  placeholder={defaultPropertyName}
                  required
                />
              </label>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                  Rental structure
                </p>
                <p className="mt-2 text-sm text-[var(--workspace-muted)]">
                  Choose whether one iCal feed should cover the whole property or whether each listing needs its own feed.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setPropertyMode("single")}
                  className={`rounded-[26px] border p-5 text-left transition ${
                    propertyMode === "single"
                      ? "border-[var(--workspace-accent)] bg-[var(--workspace-accent-soft)] shadow-[0_0_0_1px_rgba(88,196,182,0.16)]"
                      : "border-[var(--workspace-border)] bg-[var(--workspace-panel-soft)] hover:border-[var(--workspace-accent)]/40"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="workspace-icon-chip rounded-[18px] p-3">
                      <House className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[var(--workspace-text)]">Single home</p>
                      <p className="mt-1 text-xs leading-6 text-[var(--workspace-muted)]">
                        One listing, one calendar connection, no extra listings required.
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPropertyMode("multi")}
                  className={`rounded-[26px] border p-5 text-left transition ${
                    propertyMode === "multi"
                      ? "border-[var(--workspace-accent)] bg-[var(--workspace-accent-soft)] shadow-[0_0_0_1px_rgba(88,196,182,0.16)]"
                      : "border-[var(--workspace-border)] bg-[var(--workspace-panel-soft)] hover:border-[var(--workspace-accent)]/40"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="workspace-icon-chip rounded-[18px] p-3">
                      <Layers3 className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[var(--workspace-text)]">Multi-listing</p>
                      <p className="mt-1 text-xs leading-6 text-[var(--workspace-muted)]">
                        Rooms, suites, apartments, or any setup where each listing may need its own iCal.
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {propertyMode === "multi" ? (
              <div className="workspace-soft-card rounded-[26px] p-5">
                <label className="space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                    How many listings?
                  </span>
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

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                    Property market
                  </p>
                  <p className="mt-2 text-sm text-[var(--workspace-muted)]">
                    This can match the workspace market, or differ if the property is in another country.
                  </p>
                </div>
                <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-xs font-semibold text-[var(--workspace-text)]">
                  {propertyMarket.currencyCode}
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {marketDefinitions.map((entry) => {
                  const isSelected = entry.countryCode === propertyCountryCode;

                  return (
                    <button
                      key={`property-market-${entry.countryCode}`}
                      type="button"
                      onClick={() => setPropertyCountryCode(entry.countryCode)}
                      className={`rounded-[26px] border p-5 text-left transition ${
                        isSelected
                          ? "border-[var(--workspace-accent)] bg-[var(--workspace-accent-soft)] shadow-[0_0_0_1px_rgba(88,196,182,0.16)]"
                          : "border-[var(--workspace-border)] bg-[var(--workspace-panel-soft)] hover:border-[var(--workspace-accent)]/40"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="workspace-icon-chip rounded-[18px] p-3">
                          <Globe2 className="h-4 w-4" />
                        </div>
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

            <div className="workspace-soft-card rounded-[26px] p-5">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                    Property
                  </p>
                  <p className="mt-3 text-base font-semibold text-[var(--workspace-text)]">
                    {propertyName.trim() || defaultPropertyName}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                    Market
                  </p>
                  <p className="mt-3 text-base font-semibold text-[var(--workspace-text)]">
                    {propertyMarket.countryName}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                    Calendar-ready shape
                  </p>
                  <p className="mt-3 text-base font-semibold text-[var(--workspace-text)]">
                    {calendarTargetLabel}
                  </p>
                </div>
              </div>
            </div>

            {propertyError ? <p className="text-sm text-rose-400">{propertyError}</p> : null}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="workspace-button-secondary inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <button
                type="submit"
                disabled={isPropertyPending}
                className="workspace-button-primary inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPropertyPending ? "Creating property..." : "Continue to optional data"}
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
              Optional financial data
            </p>
            <h2 className="text-3xl font-semibold tracking-[-0.05em] text-[var(--workspace-text)]">
              Add spreadsheets only if they help right now.
            </h2>
            <p className="max-w-2xl text-sm leading-7 text-[var(--workspace-muted)]">
              Use uploads for bookings, expenses, or payout statements if you want richer numbers
              immediately. If iCal will supply the calendar later, you can skip this step.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="workspace-soft-card rounded-[26px] p-5">
              <p className="text-sm font-semibold text-[var(--workspace-text)]">Useful uploads</p>
              <p className="mt-2 text-sm leading-7 text-[var(--workspace-muted)]">
                Booking spreadsheets, expenses, and payout statements are great when you want financial reporting before calendar sync is connected.
              </p>
            </div>
            <div className="workspace-soft-card rounded-[26px] p-5">
              <p className="text-sm font-semibold text-[var(--workspace-text)]">Safe to skip</p>
              <p className="mt-2 text-sm leading-7 text-[var(--workspace-muted)]">
                If the same bookings will arrive through iCal, do not force an upload now just to get through onboarding.
              </p>
            </div>
          </div>

          <UploadPanel
            properties={properties}
            title="Optional financial data"
            subtitle="Upload Airbnb, Booking.com, or Excel files only if you want Hostlyx to start with real financial numbers now."
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
            <div className="workspace-card rounded-[28px] border border-amber-300/18 bg-[rgba(122,97,14,0.08)] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-100/80">
                Import review
              </p>
              <h3 className="mt-3 text-xl font-semibold tracking-[-0.03em] text-[var(--workspace-text)]">
                Clean rows are already in Hostlyx.
              </h3>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--workspace-muted)]">
                You can keep reviewing this file here, replace it, or move on. Upload is optional now,
                not a blocker.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentStep(4)}
                  className="workspace-button-primary inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition"
                >
                  Continue to tax
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="workspace-button-secondary inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <button
              type="button"
              onClick={() => setCurrentStep(4)}
              className="workspace-button-primary inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition"
            >
              Skip for now
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      );
    }

    if (currentStep === 4) {
      const estimatedTaxPreview =
        normalizedTaxRate > 0 ? `Hostlyx will set aside ${normalizedTaxRate}% of net profit.` : "No tax will be set aside.";

      return (
        <section className="space-y-6">
          {renderValueMoment()}

          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--workspace-muted)]">
              Optional tax setup
            </p>
            <h2 className="text-3xl font-semibold tracking-[-0.05em] text-[var(--workspace-text)]">
              Keep the estimate lightweight.
            </h2>
            <p className="max-w-2xl text-sm leading-7 text-[var(--workspace-muted)]">
              This only helps the dashboard show what to set aside and what you keep. You can skip it
              now and change it later in Settings.
            </p>
          </div>

          <form onSubmit={handleTaxSubmit} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
              <div className="workspace-soft-card rounded-[26px] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                  Tax market
                </p>
                <div className="mt-4 grid gap-3">
                  {marketDefinitions.map((entry) => {
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
                        className={`rounded-[20px] border px-4 py-4 text-left transition ${
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
                <div className="workspace-soft-card rounded-[26px] p-5">
                  <label className="space-y-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                      Tax rate
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

                <div className="workspace-card rounded-[28px] p-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                    Preview
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
                className="workspace-button-secondary inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(5)}
                className="workspace-button-secondary inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition"
              >
                Skip for now
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="submit"
                disabled={isTaxPending}
                className="workspace-button-primary inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isTaxPending ? "Saving tax rate..." : "Continue to dashboard"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </form>
        </section>
      );
    }

    return (
      <section className="space-y-8">
        <div className="inline-flex rounded-full border border-emerald-400/18 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-100">
          Hostlyx is ready
        </div>

        {renderValueMoment()}

        <div className="workspace-soft-card rounded-[26px] p-5">
          <p className="text-sm font-semibold text-[var(--workspace-text)]">What is ready now</p>
          <p className="mt-2 text-sm leading-7 text-[var(--workspace-muted)]">
            Your workspace and first property are saved. Financial files and tax defaults can be added anytime,
            and future iCal feeds should connect to the property or its listings, not to the company record itself.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="workspace-button-primary inline-flex items-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-semibold transition"
          >
            Go to dashboard
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setCurrentStep(4)}
            className="workspace-button-secondary inline-flex items-center rounded-2xl px-5 py-3.5 text-sm font-semibold transition"
          >
            Review tax rate
          </button>
        </div>
      </section>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--workspace-bg)] px-4 py-6 sm:px-6 xl:px-8">
      <div className="mx-auto grid w-full max-w-[1480px] gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="workspace-card rounded-[34px] p-6 sm:p-7 xl:sticky xl:top-6 xl:h-fit">
          <div className="flex items-center gap-3">
            <BrandLogo href="/" compact />
          </div>

          <div className="mt-8 space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--workspace-muted)]">
              Onboarding
            </p>
            <h2 className="text-3xl font-semibold tracking-[-0.05em] text-[var(--workspace-text)]">
              Hi {userName.split(" ")[0] || "there"}.
            </h2>
            <p className="text-sm leading-7 text-[var(--workspace-muted)]">
              Keep this fast. The goal is one clean setup pass, then straight into your financial dashboard.
            </p>
          </div>

          <div className="mt-8 space-y-3">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = index === currentStep;
              const isDone = index < stepsCompleted;

              return (
                <div
                  key={step.id}
                  className={`rounded-[24px] border p-4 transition ${
                    isActive
                      ? "border-[var(--workspace-accent)] bg-[var(--workspace-accent-soft)]"
                      : isDone
                        ? "border-emerald-400/18 bg-emerald-400/10"
                        : "border-[var(--workspace-border)] bg-[var(--workspace-panel-soft)]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`rounded-[18px] p-3 ${isDone ? "bg-emerald-400/14 text-emerald-200" : "workspace-icon-chip"}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                        Step {index + 1}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[var(--workspace-text)]">
                        {step.label}
                      </p>
                      <p className="mt-1 text-xs leading-6 text-[var(--workspace-muted)]">
                        {step.title}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        <section className="workspace-card rounded-[36px] p-6 sm:p-7 xl:p-9">
          <div className="mb-8 flex flex-col gap-4 border-b border-white/6 pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--workspace-muted)]">
                Step {currentStep + 1} of {steps.length}
              </p>
              <h1 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--workspace-text)] sm:text-3xl">
                {steps[currentStep]?.title}
              </h1>
            </div>

            <div className="grid grid-cols-5 gap-2 sm:w-[280px]">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className={`h-2 rounded-full ${
                    index <= currentStep
                      ? "bg-[var(--workspace-accent)]"
                      : "bg-white/8"
                  }`}
                />
              ))}
            </div>
          </div>

          {renderStep()}
        </section>
      </div>
    </main>
  );
}

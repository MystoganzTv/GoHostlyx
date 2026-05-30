"use client";

import { type FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Edit3, Globe2, House, Layers3, Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/modal";
import { formatCurrency, formatNumber } from "@/lib/format";
import { getCurrencyForCountry, getMarketDefinition, marketDefinitions } from "@/lib/markets";
import type { CountryCode, PropertyDefinition } from "@/lib/types";

type PropertySummary = {
  id?: number;
  name: string;
  countryCode: CountryCode;
  units: string[];
  importsCount: number;
  lastImportFileName: string;
  bookings: number;
  expenses: number;
  payout: number;
  profit: number;
};

function inputClassName() {
  return "input-surface w-full rounded-2xl px-4 py-3 text-sm";
}

export function PropertiesManager({
  properties,
  summaries,
  forceCreateOnEmpty = false,
  defaultCountryCode = "US",
}: {
  properties: PropertyDefinition[];
  summaries: PropertySummary[];
  forceCreateOnEmpty?: boolean;
  defaultCountryCode?: CountryCode;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isCreateOpen, setIsCreateOpen] = useState(forceCreateOnEmpty);
  const [propertyName, setPropertyName] = useState("");
  const [propertyCountryCode, setPropertyCountryCode] = useState<CountryCode>(defaultCountryCode);
  const [propertyMode, setPropertyMode] = useState<"single" | "multi">("single");
  const [unitCount, setUnitCount] = useState("2");
  const [unitDrafts, setUnitDrafts] = useState<Record<number, string>>({});
  const [editingProperty, setEditingProperty] = useState<PropertySummary | null>(null);
  const [propertyToDelete, setPropertyToDelete] = useState<PropertySummary | null>(null);
  const [editingPropertyName, setEditingPropertyName] = useState("");
  const [editingPropertyCountryCode, setEditingPropertyCountryCode] = useState<CountryCode>("US");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function resetCreateState() {
    setPropertyName("");
    setPropertyCountryCode(defaultCountryCode);
    setPropertyMode("single");
    setUnitCount("2");
  }

  function createProperty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    startTransition(() => {
      void (async () => {
        try {
          const normalizedName = propertyName.trim();
          const normalizedUnitCount = Math.max(2, Math.trunc(Number(unitCount) || 0));

          if (!normalizedName) {
            setError("Enter a property name first.");
            return;
          }

          if (propertyMode === "multi" && normalizedUnitCount < 2) {
            setError("Multi-listing properties need at least 2 listings.");
            return;
          }

          const formData = new FormData();
          formData.set("name", normalizedName);
          formData.set("countryCode", propertyCountryCode);

          const response = await fetch("/api/properties", {
            method: "POST",
            body: formData,
          });
          const payload = (await response.json()) as { error?: string; message?: string; propertyId?: number };

          if (!response.ok) {
            setError(payload.error ?? "The property could not be created.");
            return;
          }

          const propertyId = Number(payload.propertyId);

          if (propertyMode === "multi" && Number.isFinite(propertyId) && propertyId > 0) {
            for (let index = 1; index <= normalizedUnitCount; index += 1) {
              const unitFormData = new FormData();
              unitFormData.set("name", `Listing ${index}`);

              const unitResponse = await fetch(`/api/properties/${propertyId}/units`, {
                method: "POST",
                body: unitFormData,
              });

              if (!unitResponse.ok) {
                const unitPayload = (await unitResponse.json()) as { error?: string };
                setError(unitPayload.error ?? "The property was created, but some listings could not be added.");
                router.refresh();
                return;
              }
            }
          }

          resetCreateState();
          setIsCreateOpen(false);
          setMessage(
            propertyMode === "multi"
              ? `${normalizedName} created with ${normalizedUnitCount} listings.`
              : payload.message ?? "Property created.",
          );
          router.refresh();
        } catch {
          setError("The property could not be created.");
        }
      })();
    });
  }

  function createUnit(propertyId: number) {
    const unitName = unitDrafts[propertyId] ?? "";
    setMessage(null);
    setError(null);

    startTransition(() => {
      void (async () => {
        try {
          const formData = new FormData();
          formData.set("name", unitName);

          const response = await fetch(`/api/properties/${propertyId}/units`, {
            method: "POST",
            body: formData,
          });
          const payload = (await response.json()) as { error?: string; message?: string };

          if (!response.ok) {
            setError(payload.error ?? "The unit could not be created.");
            return;
          }

          setUnitDrafts((current) => ({ ...current, [propertyId]: "" }));
          setMessage(payload.message ?? "Listing created.");
          router.refresh();
        } catch {
          setError("The unit could not be created.");
        }
      })();
    });
  }

  function openEditProperty(summary: PropertySummary) {
    setEditingProperty(summary);
    setEditingPropertyName(summary.name);
    setEditingPropertyCountryCode(summary.countryCode);
    setMessage(null);
    setError(null);
  }

  function submitPropertyUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingProperty?.id) {
      return;
    }

    setMessage(null);
    setError(null);

    startTransition(() => {
      void (async () => {
        try {
          const formData = new FormData();
          formData.set("name", editingPropertyName);
          formData.set("countryCode", editingPropertyCountryCode);

          const response = await fetch(`/api/properties/${editingProperty.id}`, {
            method: "PATCH",
            body: formData,
          });
          const payload = (await response.json()) as { error?: string; message?: string };

          if (!response.ok) {
            setError(payload.error ?? "The property could not be updated.");
            return;
          }

          setMessage(payload.message ?? "Property updated.");
          setEditingProperty(null);
          setEditingPropertyName("");
          setEditingPropertyCountryCode("US");
          router.refresh();
        } catch {
          setError("The property could not be updated.");
        }
      })();
    });
  }

  function confirmDeleteProperty() {
    if (!propertyToDelete?.id) {
      return;
    }

    setMessage(null);
    setError(null);

    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch(
            `/api/properties/${propertyToDelete.id}?deleteLinkedData=true`,
            {
            method: "DELETE",
            },
          );
          const payload = (await response.json()) as { error?: string; message?: string };

          if (!response.ok) {
            setError(payload.error ?? "The property could not be deleted.");
            return;
          }

          setMessage(payload.message ?? "Property deleted.");
          setPropertyToDelete(null);
          router.refresh();
        } catch {
          setError("The property could not be deleted.");
        }
      })();
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[0.62fr_1.38fr]">
        <div className="workspace-card rounded-[26px] p-5">
          <div className="flex items-center gap-3">
            <div className="workspace-icon-chip rounded-2xl p-3">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-base font-semibold text-[var(--workspace-text)]">
                {properties.length === 0 ? "Create your first property" : "Add another property"}
              </p>
              <p className="mt-1 text-sm text-[var(--workspace-muted)]">
                Keep the setup cleaner here, then choose region, property type, and listings inside a focused modal.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <div className="workspace-soft-card rounded-[22px] p-4 text-sm leading-6 text-[var(--workspace-muted)]">
              Create properties from a modal so region, rental structure, and listings are handled in one compact flow instead of sitting permanently on the page.
            </div>

            <button
              type="button"
              onClick={() => {
                setMessage(null);
                setError(null);
                setIsCreateOpen(true);
              }}
              className="workspace-button-primary inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              {properties.length === 0 ? "Create first property" : "Open listings setup"}
            </button>
          </div>
        </div>

        <div className="workspace-card rounded-[26px] p-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Saved properties</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--workspace-text)]">
                {formatNumber(properties.length)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Saved listings</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--workspace-text)]">
                {formatNumber(properties.reduce((sum, property) => sum + property.units.length, 0))}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Structure</p>
              <p className="mt-2 text-sm leading-6 text-[var(--workspace-muted)]">
                Single-home rentals can skip extra listings. Multi-listing properties can auto-create listing slots during setup.
              </p>
            </div>
          </div>

          <div className="mt-4 min-h-6">
            {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
            {error ? <p className="text-sm text-rose-500">{error}</p> : null}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {summaries.map((summary) => {
          const property = properties.find((entry) => entry.name === summary.name);
          const propertyId = property?.id ?? 0;
          const propertySummary: PropertySummary = {
            ...summary,
            id: propertyId,
          };
          const market = getMarketDefinition(summary.countryCode);
          const propertyCurrencyCode = getCurrencyForCountry(summary.countryCode);

          return (
            <article
              key={summary.name}
              className="workspace-card rounded-[26px] p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-[var(--workspace-text)]">{summary.name}</p>
                  <p className="mt-1 text-sm text-[var(--workspace-muted)]">
                    {market.countryName}
                    {summary.units.length > 0
                      ? ` • ${formatNumber(summary.units.length)} saved listings`
                      : " • No extra listings yet"}
                  </p>
                  {summary.lastImportFileName ? (
                    <p className="mt-1 text-xs text-[var(--workspace-muted)]">
                      Latest workbook: {summary.lastImportFileName}
                    </p>
                  ) : null}
                </div>
                <div className="workspace-icon-chip rounded-2xl p-3">
                  <Layers3 className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openEditProperty(propertySummary)}
                  disabled={!propertyId || isPending}
                  className="workspace-button-secondary inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Edit3 className="h-4 w-4" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setPropertyToDelete(propertySummary)}
                  disabled={!propertyId || isPending}
                  className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="workspace-soft-card rounded-2xl px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Imports</p>
                  <p className="mt-1 text-sm font-medium text-[var(--workspace-text)]">
                    {formatNumber(summary.importsCount)}
                  </p>
                </div>
                <div className="workspace-soft-card rounded-2xl px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Bookings</p>
                  <p className="mt-1 text-sm font-medium text-[var(--workspace-text)]">
                    {formatNumber(summary.bookings)}
                  </p>
                </div>
                <div className="workspace-soft-card rounded-2xl px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Expenses</p>
                  <p className="mt-1 text-sm font-medium text-[var(--workspace-text)]">
                    {formatCurrency(summary.expenses, false, propertyCurrencyCode)}
                  </p>
                </div>
                <div className="workspace-soft-card rounded-2xl px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Payout</p>
                  <p className="mt-1 text-sm font-medium text-[var(--workspace-text)]">
                    {formatCurrency(summary.payout, false, propertyCurrencyCode)}
                  </p>
                </div>
                <div className="workspace-soft-card rounded-2xl px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Profit</p>
                  <p className="mt-1 text-sm font-medium text-[var(--workspace-text)]">
                    {formatCurrency(summary.profit, false, propertyCurrencyCode)}
                  </p>
                </div>
              </div>

              {summary.units.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {summary.units.map((unit) => (
                    <span
                      key={`${summary.name}-${unit}`}
                      className="rounded-full border border-[var(--workspace-border)] bg-[var(--workspace-panel-soft)] px-3 py-1 text-xs text-[var(--workspace-muted)]"
                    >
                      {unit}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-[var(--workspace-muted)]">
                  This property works as a single listing for now. Add more listings only if you need them.
                </p>
              )}

              {propertyId ? (
                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <input
                    className={inputClassName()}
                    value={unitDrafts[propertyId] ?? ""}
                    onChange={(event) =>
                      setUnitDrafts((current) => ({
                        ...current,
                        [propertyId]: event.target.value,
                      }))
                    }
                    placeholder="Add a listing: Apt 2B, Garden Suite..."
                  />
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => createUnit(propertyId)}
                    className="workspace-button-secondary inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Plus className="h-4 w-4" />
                    Add listing
                  </button>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      <Modal
        open={isCreateOpen}
        title={properties.length === 0 ? "Create your first property" : "Add property or listings"}
        dismissible={!forceCreateOnEmpty}
        onClose={() => {
          if (forceCreateOnEmpty) {
            return;
          }
          setIsCreateOpen(false);
          resetCreateState();
        }}
      >
        <form onSubmit={createProperty} className="space-y-5">
          <label className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              Property name
            </span>
            <input
              className={inputClassName()}
              value={propertyName}
              onChange={(event) => setPropertyName(event.target.value)}
              placeholder="Villa Sol, PinarSabroso, Downtown Lofts..."
              required
            />
          </label>

          <div className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              Market
            </span>
            <div className="grid gap-3 sm:grid-cols-3">
              {marketDefinitions.map((market) => {
                const isSelected = propertyCountryCode === market.countryCode;

                return (
                  <button
                    key={market.countryCode}
                    type="button"
                    onClick={() => setPropertyCountryCode(market.countryCode)}
                    className={`rounded-[22px] border px-4 py-4 text-left transition ${
                      isSelected
                        ? "border-[var(--workspace-accent)] bg-[var(--workspace-accent-soft)] text-[var(--workspace-text)]"
                        : "border-[var(--workspace-border)] bg-[var(--workspace-panel-soft)] text-[var(--workspace-muted)]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Globe2 className="h-4 w-4" />
                      <span className="text-sm font-semibold">{market.shortLabel}</span>
                    </div>
                    <p className="mt-2 text-xs leading-5">
                      {market.countryName} • {market.currencyCode}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setPropertyMode("single")}
              className={`rounded-[22px] border px-4 py-4 text-left transition ${
                propertyMode === "single"
                  ? "border-[var(--workspace-accent)] bg-[var(--workspace-accent-soft)] text-[var(--workspace-text)]"
                  : "border-[var(--workspace-border)] bg-[var(--workspace-panel-soft)] text-[var(--workspace-muted)]"
              }`}
            >
              <div className="flex items-center gap-3">
                <House className="h-4 w-4" />
                <span className="text-sm font-semibold">Single house</span>
              </div>
              <p className="mt-2 text-xs leading-5">
                Rent the entire home as one listing. No extra listings are necessary.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setPropertyMode("multi")}
              className={`rounded-[22px] border px-4 py-4 text-left transition ${
                propertyMode === "multi"
                  ? "border-[var(--workspace-accent)] bg-[var(--workspace-accent-soft)] text-[var(--workspace-text)]"
                  : "border-[var(--workspace-border)] bg-[var(--workspace-panel-soft)] text-[var(--workspace-muted)]"
              }`}
            >
              <div className="flex items-center gap-3">
                <Layers3 className="h-4 w-4" />
                <span className="text-sm font-semibold">Multi-listing</span>
              </div>
              <p className="mt-2 text-xs leading-5">
                Apartments, rooms, suites, or several rentable listings inside one property.
              </p>
            </button>
          </div>

          {propertyMode === "multi" ? (
            <label className="space-y-2">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                How many listings does it have?
              </span>
              <input
                className={inputClassName()}
                type="number"
                min="2"
                max="50"
                value={unitCount}
                onChange={(event) => setUnitCount(event.target.value)}
              />
            </label>
          ) : (
            <div className="workspace-soft-card rounded-[22px] px-4 py-3 text-sm text-[var(--workspace-muted)]">
              This property will be treated as one full-home listing. You can still add more listings later if needed.
            </div>
          )}

          {forceCreateOnEmpty ? (
            <div className="workspace-soft-card rounded-[22px] p-4 text-sm leading-6 text-[var(--workspace-muted)]">
              Finish this first property and listing setup to unlock imports, dashboard reporting, bookings, and expenses.
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isPending}
            className="workspace-button-primary inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            {isPending ? "Creating property..." : "Save property"}
          </button>
        </form>
      </Modal>

      <Modal
        open={Boolean(editingProperty)}
        title={editingProperty ? `Edit ${editingProperty.name}` : "Edit property"}
        onClose={() => {
          setEditingProperty(null);
          setEditingPropertyName("");
          setEditingPropertyCountryCode("US");
        }}
      >
        {editingProperty ? (
          <form onSubmit={submitPropertyUpdate} className="space-y-5">
            <label className="space-y-2">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                Property name
              </span>
              <input
                className={inputClassName()}
                value={editingPropertyName}
                onChange={(event) => setEditingPropertyName(event.target.value)}
                placeholder="Enter property name"
                required
              />
            </label>

            <div className="space-y-2">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                Market
              </span>
              <div className="grid gap-3 sm:grid-cols-3">
                {marketDefinitions.map((market) => {
                  const isSelected = editingPropertyCountryCode === market.countryCode;

                  return (
                    <button
                      key={market.countryCode}
                      type="button"
                      onClick={() => setEditingPropertyCountryCode(market.countryCode)}
                      className={`rounded-[22px] border px-4 py-4 text-left transition ${
                        isSelected
                          ? "border-[var(--workspace-accent)] bg-[var(--workspace-accent-soft)] text-[var(--workspace-text)]"
                          : "border-[var(--workspace-border)] bg-[var(--workspace-panel-soft)] text-[var(--workspace-muted)]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Globe2 className="h-4 w-4" />
                        <span className="text-sm font-semibold">{market.shortLabel}</span>
                      </div>
                      <p className="mt-2 text-xs leading-5">
                        {market.countryName} • {market.currencyCode}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="workspace-soft-card rounded-[22px] p-4 text-sm leading-6 text-[var(--workspace-muted)]">
              Renaming a property updates the property name across existing bookings and expenses in this workspace. Changing the market also moves all linked reporting and listings for this property to the new country and currency.
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="workspace-button-primary inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Saving property..." : "Save property"}
            </button>
          </form>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(propertyToDelete)}
        title={propertyToDelete ? `Delete ${propertyToDelete.name}?` : "Delete property"}
        onClose={() => setPropertyToDelete(null)}
      >
        {propertyToDelete ? (
          <div className="space-y-5">
            <div className="rounded-[22px] border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-700">
              {properties.length === 1
                ? "This is your last property. Deleting it will also erase every linked import, booking, and expense, and the rest of Hostlyx will stay locked until you create a new property."
                : propertyToDelete.bookings > 0 ||
                    propertyToDelete.expenses > 0 ||
                    propertyToDelete.importsCount > 0
                  ? "This property has linked workbook imports and accounting data. If you continue, Hostlyx will permanently delete everything tied to this property."
                  : "This will delete the property and any saved listings under it."}
            </div>

            {propertyToDelete.importsCount > 0 ? (
              <div className="rounded-[22px] border border-amber-400/18 bg-amber-300/[0.08] p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-amber-100">Imported something by mistake?</p>
                    <p className="mt-2 text-sm leading-6 text-[var(--workspace-muted)]">
                      If the problem is the latest CSV or Excel file, undo that import first instead of deleting the whole property.
                    </p>
                    {propertyToDelete.lastImportFileName ? (
                      <p className="mt-2 text-xs leading-5 text-[var(--workspace-muted)]">
                        Latest linked file:{" "}
                        <span className="font-medium text-[var(--workspace-text)]">{propertyToDelete.lastImportFileName}</span>
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPropertyToDelete(null);
                      router.push("/dashboard/imports");
                    }}
                    className="workspace-button-secondary inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition"
                  >
                    Go to Import Center
                  </button>
                </div>
              </div>
            ) : null}

            <div className="workspace-soft-card grid gap-3 rounded-[22px] p-4 sm:grid-cols-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Imports</p>
                <p className="mt-1 text-sm text-[var(--workspace-text)]">
                  {formatNumber(propertyToDelete.importsCount)} file{propertyToDelete.importsCount === 1 ? "" : "s"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Bookings</p>
                <p className="mt-1 text-sm text-[var(--workspace-text)]">
                  {formatNumber(propertyToDelete.bookings)} row{propertyToDelete.bookings === 1 ? "" : "s"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Linked spend</p>
                <p className="mt-1 text-sm text-[var(--workspace-text)]">
                  {formatCurrency(
                    propertyToDelete.expenses,
                    false,
                    getCurrencyForCountry(propertyToDelete.countryCode),
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Listings</p>
                <p className="mt-1 text-sm text-[var(--workspace-text)]">
                  {formatNumber(propertyToDelete.units.length)} saved
                </p>
              </div>
            </div>

            <div className="workspace-soft-card rounded-[22px] p-4 text-sm leading-6 text-[var(--workspace-muted)]">
              Delete the property only when you really want to remove the whole reporting container with all linked data under it.
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setPropertyToDelete(null)}
                className="workspace-button-secondary rounded-2xl px-4 py-3 text-sm font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteProperty}
                className="inline-flex items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending
                  ? "Deleting property..."
                  : propertyToDelete.importsCount > 0 ||
                      propertyToDelete.bookings > 0 ||
                      propertyToDelete.expenses > 0
                    ? "Delete property and linked data"
                    : "Delete property"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

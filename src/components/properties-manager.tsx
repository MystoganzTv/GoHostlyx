"use client";

import { type FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Edit3, Globe2, House, Layers3, Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/modal";
import { useLocale } from "@/components/locale-provider";
import { formatCurrency, formatNumber } from "@/lib/format";
import { getCurrencyForCountry, getMarketLabels, marketDefinitions } from "@/lib/markets";
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
  return "input-surface w-full rounded-lg px-4 py-3 text-sm";
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
  const { locale } = useLocale();
  const isSpanish = locale === "es";
  const t = (en: string, es: string) => (isSpanish ? es : en);
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
            setError(t("Enter a property name first.", "Escribe primero un nombre de propiedad."));
            return;
          }

          if (propertyMode === "multi" && normalizedUnitCount < 2) {
            setError(t("Multi-listing properties need at least 2 listings.", "Las propiedades con varios listings necesitan al menos 2."));
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
            setError(payload.error ?? t("The property could not be created.", "No se pudo crear la propiedad."));
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
                setError(unitPayload.error ?? t("The property was created, but some listings could not be added.", "La propiedad se creó, pero algunos listings no se pudieron añadir."));
                router.refresh();
                return;
              }
            }
          }

          resetCreateState();
          setIsCreateOpen(false);
          setMessage(
            propertyMode === "multi"
              ? t(`${normalizedName} created with ${normalizedUnitCount} listings.`, `${normalizedName} creada con ${normalizedUnitCount} listings.`)
              : payload.message ?? t("Property created.", "Propiedad creada."),
          );
          router.refresh();
        } catch {
          setError(t("The property could not be created.", "No se pudo crear la propiedad."));
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
            setError(payload.error ?? t("The unit could not be created.", "No se pudo crear el listing."));
            return;
          }

          setUnitDrafts((current) => ({ ...current, [propertyId]: "" }));
          setMessage(payload.message ?? t("Listing created.", "Listing creado."));
          router.refresh();
        } catch {
          setError(t("The unit could not be created.", "No se pudo crear el listing."));
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
            setError(payload.error ?? t("The property could not be updated.", "No se pudo actualizar la propiedad."));
            return;
          }

          setMessage(payload.message ?? t("Property updated.", "Propiedad actualizada."));
          setEditingProperty(null);
          setEditingPropertyName("");
          setEditingPropertyCountryCode("US");
          router.refresh();
        } catch {
          setError(t("The property could not be updated.", "No se pudo actualizar la propiedad."));
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
            setError(payload.error ?? t("The property could not be deleted.", "No se pudo eliminar la propiedad."));
            return;
          }

          setMessage((payload.message ?? t("Property deleted.", "Propiedad eliminada.")) + " " + t("You can restore it from Settings → Recently deleted for 7 days.", "Puedes recuperarlo desde Ajustes → Eliminado recientemente durante 7 días."));
          setPropertyToDelete(null);
          router.refresh();
        } catch {
          setError(t("The property could not be deleted.", "No se pudo eliminar la propiedad."));
        }
      })();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-h-5 text-sm">
          {message ? <p className="text-pos">{message}</p> : null}
          {error ? <p className="text-neg">{error}</p> : null}
        </div>
        <button
          type="button"
          onClick={() => {
            setMessage(null);
            setError(null);
            setIsCreateOpen(true);
          }}
          className="workspace-button-primary inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          {properties.length === 0 ? t("Create first property", "Crear primera propiedad") : t("Add property", "Añadir propiedad")}
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {summaries.map((summary) => {
          const property = properties.find((entry) => entry.name === summary.name);
          const propertyId = property?.id ?? 0;
          const propertySummary: PropertySummary = {
            ...summary,
            id: propertyId,
          };
          const market = getMarketLabels(summary.countryCode, locale);
          const propertyCurrencyCode = getCurrencyForCountry(summary.countryCode);

          return (
            <article
              key={summary.name}
              className="workspace-card rounded-xl p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-[var(--workspace-text)]">{summary.name}</p>
                  <p className="mt-1 text-sm text-[var(--workspace-muted)]">
                    {market.countryName}
                    {summary.units.length > 0
                      ? ` • ${formatNumber(summary.units.length, locale)} ${t("saved listings", "listings guardados")}`
                      : ` • ${t("No extra listings yet", "Sin listings extra todavía")}`}
                  </p>
                  {summary.lastImportFileName ? (
                    <p className="mt-1 text-xs text-[var(--workspace-muted)]">
                      {t("Latest workbook:", "Último archivo:")} {summary.lastImportFileName}
                    </p>
                  ) : null}
                </div>
                <div className="workspace-icon-chip rounded-lg p-3">
                  <Layers3 className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openEditProperty(propertySummary)}
                  disabled={!propertyId || isPending}
                  className="workspace-button-secondary inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Edit3 className="h-4 w-4" />
                  {t("Edit", "Editar")}
                </button>
                <button
                  type="button"
                  onClick={() => setPropertyToDelete(propertySummary)}
                  disabled={!propertyId || isPending}
                  className="inline-flex items-center gap-2 rounded-lg border border-rose-400/25 bg-transparent px-4 py-3 text-sm font-semibold text-rose-300 transition hover:border-rose-400/45 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" />
                  {t("Delete", "Eliminar")}
                </button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="workspace-soft-card rounded-lg px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{t("Imports", "Importaciones")}</p>
                  <p className="mt-1 text-sm font-medium text-[var(--workspace-text)]">
                    {formatNumber(summary.importsCount, locale)}
                  </p>
                </div>
                <div className="workspace-soft-card rounded-lg px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{t("Bookings", "Reservas")}</p>
                  <p className="mt-1 text-sm font-medium text-[var(--workspace-text)]">
                    {formatNumber(summary.bookings, locale)}
                  </p>
                </div>
                <div className="workspace-soft-card rounded-lg px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{t("Expenses", "Gastos")}</p>
                  <p className="mt-1 text-sm font-medium text-[var(--workspace-text)]">
                    {formatCurrency(summary.expenses, false, propertyCurrencyCode, locale)}
                  </p>
                </div>
                <div className="workspace-soft-card rounded-lg px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Payout</p>
                  <p className="mt-1 text-sm font-medium text-[var(--workspace-text)]">
                    {formatCurrency(summary.payout, false, propertyCurrencyCode, locale)}
                  </p>
                </div>
                <div className="workspace-soft-card rounded-lg px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{t("Profit", "Beneficio")}</p>
                  <p className="mt-1 text-sm font-medium text-[var(--workspace-text)]">
                    {formatCurrency(summary.profit, false, propertyCurrencyCode, locale)}
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
                  {t("This property works as a single listing for now. Add more listings only if you need them.", "Esta propiedad funciona por ahora como un solo listing. Añade más solo si los necesitas.")}
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
                    placeholder={t("Add a listing: Apt 2B, Garden Suite...", "Añade un listing: Apto 2B, Suite Jardín...")}
                  />
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => createUnit(propertyId)}
                    className="workspace-button-secondary inline-flex shrink-0 items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Plus className="h-4 w-4" />
                    {t("Add listing", "Añadir listing")}
                  </button>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      <Modal
        open={isCreateOpen}
        title={properties.length === 0 ? t("Create your first property", "Crea tu primera propiedad") : t("Add property or listings", "Añadir propiedad o listings")}
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
              {t("Property name", "Nombre de la propiedad")}
            </span>
            <input
              className={inputClassName()}
              value={propertyName}
              onChange={(event) => setPropertyName(event.target.value)}
              placeholder={t("Villa Sol, PinarSabroso, Downtown Lofts...", "Villa Sol, Casa Pinar, Lofts Centro...")}
              required
            />
          </label>

          <div className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              {t("Market", "Mercado")}
            </span>
            <div className="grid gap-3 sm:grid-cols-3">
              {marketDefinitions.map((definition) => getMarketLabels(definition.countryCode, locale)).map((market) => {
                const isSelected = propertyCountryCode === market.countryCode;

                return (
                  <button
                    key={market.countryCode}
                    type="button"
                    onClick={() => setPropertyCountryCode(market.countryCode)}
                    className={`rounded-lg border px-4 py-4 text-left transition ${
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
              className={`rounded-lg border px-4 py-4 text-left transition ${
                propertyMode === "single"
                  ? "border-[var(--workspace-accent)] bg-[var(--workspace-accent-soft)] text-[var(--workspace-text)]"
                  : "border-[var(--workspace-border)] bg-[var(--workspace-panel-soft)] text-[var(--workspace-muted)]"
              }`}
            >
              <div className="flex items-center gap-3">
                <House className="h-4 w-4" />
                <span className="text-sm font-semibold">{t("Single house", "Vivienda completa")}</span>
              </div>
              <p className="mt-2 text-xs leading-5">
                {t("Rent the entire home as one listing. No extra listings are necessary.", "Alquilas la vivienda entera como un solo listing. No hacen falta listings extra.")}
              </p>
            </button>
            <button
              type="button"
              onClick={() => setPropertyMode("multi")}
              className={`rounded-lg border px-4 py-4 text-left transition ${
                propertyMode === "multi"
                  ? "border-[var(--workspace-accent)] bg-[var(--workspace-accent-soft)] text-[var(--workspace-text)]"
                  : "border-[var(--workspace-border)] bg-[var(--workspace-panel-soft)] text-[var(--workspace-muted)]"
              }`}
            >
              <div className="flex items-center gap-3">
                <Layers3 className="h-4 w-4" />
                <span className="text-sm font-semibold">{t("Multi-listing", "Varios listings")}</span>
              </div>
              <p className="mt-2 text-xs leading-5">
                {t("Apartments, rooms, suites, or several rentable listings inside one property.", "Apartamentos, habitaciones, suites o varios listings alquilables dentro de una propiedad.")}
              </p>
            </button>
          </div>

          {propertyMode === "multi" ? (
            <label className="space-y-2">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                {t("How many listings does it have?", "¿Cuántos listings tiene?")}
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
            <div className="workspace-soft-card rounded-lg px-4 py-3 text-sm text-[var(--workspace-muted)]">
              {t("This property will be treated as one full-home listing. You can still add more listings later if needed.", "Esta propiedad se tratará como un solo listing de vivienda completa. Puedes añadir más listings después si los necesitas.")}
            </div>
          )}

          {forceCreateOnEmpty ? (
            <div className="workspace-soft-card rounded-lg p-4 text-sm leading-6 text-[var(--workspace-muted)]">
              {t("Finish this first property and listing setup to unlock imports, dashboard reporting, bookings, and expenses.", "Termina de configurar esta primera propiedad para desbloquear importaciones, dashboard, reservas y gastos.")}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isPending}
            className="workspace-button-primary inline-flex w-full items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            {isPending ? t("Creating property...", "Creando propiedad...") : t("Save property", "Guardar propiedad")}
          </button>
        </form>
      </Modal>

      <Modal
        open={Boolean(editingProperty)}
        title={editingProperty ? `Edit ${editingProperty.name}` : t("Edit property", "Editar propiedad")}
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
                {t("Property name", "Nombre de la propiedad")}
              </span>
              <input
                className={inputClassName()}
                value={editingPropertyName}
                onChange={(event) => setEditingPropertyName(event.target.value)}
                placeholder={t("Enter property name", "Escribe el nombre de la propiedad")}
                required
              />
            </label>

            <div className="space-y-2">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                {t("Market", "Mercado")}
              </span>
              <div className="grid gap-3 sm:grid-cols-3">
                {marketDefinitions.map((definition) => getMarketLabels(definition.countryCode, locale)).map((market) => {
                  const isSelected = editingPropertyCountryCode === market.countryCode;

                  return (
                    <button
                      key={market.countryCode}
                      type="button"
                      onClick={() => setEditingPropertyCountryCode(market.countryCode)}
                      className={`rounded-lg border px-4 py-4 text-left transition ${
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

            <div className="workspace-soft-card rounded-lg p-4 text-sm leading-6 text-[var(--workspace-muted)]">
              {t("Renaming a property updates the property name across existing bookings and expenses in this workspace. Changing the market also moves all linked reporting and listings for this property to the new country and currency.", "Al renombrar una propiedad, el nombre cambia en todas sus reservas, gastos e importaciones. Si cambias el mercado, sus informes y listings pasan al nuevo país y moneda.")}
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="workspace-button-primary inline-flex w-full items-center justify-center rounded-lg px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? t("Saving property...", "Guardando propiedad...") : t("Save property", "Guardar propiedad")}
            </button>
          </form>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(propertyToDelete)}
        title={propertyToDelete ? t(`Delete ${propertyToDelete.name}?`, `¿Eliminar ${propertyToDelete.name}?`) : t("Delete property", "Eliminar propiedad")}
        onClose={() => setPropertyToDelete(null)}
      >
        {propertyToDelete ? (
          <div className="space-y-5">
            <div className="rounded-lg border border-rose-400/25 bg-rose-500/10 p-4 text-sm leading-6 text-rose-100">
              {properties.length === 1
                ? t("This is your last property. Deleting it will also erase every linked import, booking, and expense, and the rest of GoHostlyx will stay locked until you create a new property.", "Es tu última propiedad. Al borrarla se eliminan también todas sus importaciones, reservas y gastos, y GoHostlyx quedará bloqueado hasta que crees otra.")
                : propertyToDelete.bookings > 0 ||
                    propertyToDelete.expenses > 0 ||
                    propertyToDelete.importsCount > 0
                  ? isSpanish
                    ? `Se eliminarán para siempre ${propertyToDelete.importsCount} importaci${propertyToDelete.importsCount === 1 ? "ón" : "ones"}${
                        propertyToDelete.lastImportFileName ? ` (último: ${propertyToDelete.lastImportFileName})` : ""
                      }, ${propertyToDelete.bookings} reserva${propertyToDelete.bookings === 1 ? "" : "s"} y ${formatCurrency(propertyToDelete.expenses, false, getCurrencyForCountry(propertyToDelete.countryCode), locale)} en gastos de esta propiedad. No se puede deshacer.`
                    : `This will permanently delete ${propertyToDelete.importsCount} import${propertyToDelete.importsCount === 1 ? "" : "s"}${
                      propertyToDelete.lastImportFileName ? ` (latest: ${propertyToDelete.lastImportFileName})` : ""
                    }, ${propertyToDelete.bookings} booking${propertyToDelete.bookings === 1 ? "" : "s"} and ${formatCurrency(propertyToDelete.expenses, false, getCurrencyForCountry(propertyToDelete.countryCode), locale)} of expenses tied to this property. This cannot be undone.`
                  : t("This will delete the property and any saved listings under it.", "Se eliminará la propiedad y sus listings guardados.")}
            </div>

            {propertyToDelete.importsCount > 0 ? (
              <div className="rounded-lg border border-amber-400/18 bg-amber-300/[0.08] p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-amber-100">{t("Imported something by mistake?", "¿Importaste algo por error?")}</p>
                    <p className="mt-2 text-sm leading-6 text-[var(--workspace-muted)]">
                      {t("If the problem is the latest CSV or Excel file, undo that import first instead of deleting the whole property.", "Si el problema es el último CSV o Excel, deshaz esa importación en vez de borrar toda la propiedad.")}
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
                    className="workspace-button-secondary inline-flex items-center justify-center rounded-lg px-3.5 py-2 text-sm font-semibold transition"
                  >
                    {t("Go to Import Center", "Ir al Centro de importación")}
                  </button>
                </div>
              </div>
            ) : null}

            <div className="workspace-soft-card grid gap-3 rounded-lg p-4 sm:grid-cols-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t("Imports", "Importaciones")}</p>
                <p className="mt-1 text-sm text-[var(--workspace-text)]">
                  {formatNumber(propertyToDelete.importsCount, locale)} {propertyToDelete.importsCount === 1 ? t("file", "archivo") : t("files", "archivos")}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t("Bookings", "Reservas")}</p>
                <p className="mt-1 text-sm text-[var(--workspace-text)]">
                  {formatNumber(propertyToDelete.bookings, locale)} {propertyToDelete.bookings === 1 ? t("row", "fila") : t("rows", "filas")}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t("Linked spend", "Gasto vinculado")}</p>
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
                  {formatNumber(propertyToDelete.units.length, locale)} {t("saved", "guardados")}
                </p>
              </div>
            </div>

            <div className="workspace-soft-card rounded-lg p-4 text-sm leading-6 text-[var(--workspace-muted)]">
              {t("Delete the property only when you really want to remove the whole reporting container with all linked data under it.", "Borra la propiedad solo si de verdad quieres eliminarla con todos sus datos vinculados.")}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setPropertyToDelete(null)}
                className="workspace-button-secondary rounded-lg px-3.5 py-2 text-sm font-semibold transition"
              >
                {t("Cancel", "Cancelar")}
              </button>
              <button
                type="button"
                onClick={confirmDeleteProperty}
                className="inline-flex items-center justify-center rounded-lg border border-rose-400/25 bg-transparent px-4 py-3 text-sm font-semibold text-rose-300 transition hover:border-rose-400/45 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending
                  ? t("Deleting property...", "Eliminando propiedad...")
                  : propertyToDelete.importsCount > 0 ||
                      propertyToDelete.bookings > 0 ||
                      propertyToDelete.expenses > 0
                    ? t("Delete property and linked data", "Eliminar propiedad y sus datos")
                    : t("Delete property", "Eliminar propiedad")}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

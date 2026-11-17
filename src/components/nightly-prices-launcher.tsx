"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Tag } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import { Modal } from "@/components/modal";
import { WorkspaceSelect } from "@/components/workspace-select";
import { formatNumber } from "@/lib/format";
import type { PropertyDefinition } from "@/lib/types";

const channelOptions = ["Airbnb", "Booking.com", "Direct", "Vrbo"];

export function NightlyPricesLauncher({
  properties,
  savedNights,
  shownPropertyName,
  shownChannel,
}: {
  properties: PropertyDefinition[];
  savedNights: number;
  shownPropertyName: string | null;
  shownChannel: string | null;
}) {
  const { locale } = useLocale();
  const isSpanish = locale === "es";
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [propertyName, setPropertyName] = useState(
    shownPropertyName ?? (properties.length === 1 ? properties[0].name : ""),
  );
  const [channel, setChannel] = useState(shownChannel ?? "Airbnb");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const failedText = isSpanish ? "No se pudieron guardar los precios." : "The prices could not be saved.";

  function handleSubmit(formData: FormData) {
    setMessage(null);
    setError(null);

    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch("/api/nightly-prices", { method: "POST", body: formData });
          const payload = (await response.json()) as { error?: string; message?: string };

          if (!response.ok) {
            setError(payload.error ?? failedText);
            return;
          }

          setMessage(payload.message ?? (isSpanish ? "Precios guardados." : "Prices saved."));
          formRef.current?.reset();
          router.refresh();
        } catch {
          setError(failedText);
        }
      })();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="workspace-button-secondary inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition"
      >
        <Tag className="h-4 w-4" />
        {isSpanish ? "Precios" : "Prices"}
      </button>

      <Modal
        open={isOpen}
        title={isSpanish ? "Precios por noche" : "Nightly prices"}
        onClose={() => setIsOpen(false)}
        alignTop
      >
        <div className="space-y-6">
          <div className="workspace-soft-card rounded-xl p-5">
            <p className="text-sm font-semibold text-[var(--workspace-text)]">
              {savedNights > 0
                ? isSpanish
                  ? `${formatNumber(savedNights, locale)} noches con precio guardado`
                  : `${formatNumber(savedNights, locale)} nights with a saved price`
                : isSpanish
                  ? "Aún no hay precios guardados"
                  : "No prices saved yet"}
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--workspace-muted)]">
              {isSpanish
                ? "Sube un Excel o CSV con una columna de fecha y otra de precio, por ejemplo el precio que mostraba tu calendario de Airbnb cada noche. El calendario enseñará el precio de cada noche junto al del año pasado y lo que se cobró. Si una noche ya tenía precio, se sustituye."
                : "Upload an Excel or CSV file with a date column and a price column, for example the price your Airbnb calendar showed each night. The calendar will show each night's price next to last year's and what was paid. A night that already had a price is replaced."}
            </p>
            {shownPropertyName ? (
              <p className="mt-2 text-xs text-[var(--workspace-muted)]">
                {isSpanish
                  ? `En el calendario: ${shownPropertyName} · ${shownChannel}`
                  : `Shown on the calendar: ${shownPropertyName} · ${shownChannel}`}
              </p>
            ) : savedNights > 0 ? (
              <p className="mt-2 text-xs text-[var(--workspace-muted)]">
                {isSpanish
                  ? "Hay precios de varias propiedades: filtra por país para ver solo una en el calendario."
                  : "Prices exist for several properties: filter by country so the calendar shows just one."}
              </p>
            ) : null}
          </div>

          <form ref={formRef} action={handleSubmit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <WorkspaceSelect
                label={isSpanish ? "Propiedad" : "Property"}
                name="propertyName"
                value={propertyName}
                onChange={setPropertyName}
                required
                placeholder={isSpanish ? "Elige una propiedad" : "Choose a property"}
                options={properties.map((property) => ({ value: property.name, label: property.name }))}
              />
              <WorkspaceSelect
                label={isSpanish ? "Canal" : "Channel"}
                name="channel"
                value={channel}
                onChange={setChannel}
                options={channelOptions.map((option) => ({ value: option, label: option }))}
              />
              <label className="space-y-2 sm:col-span-2">
                <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                  {isSpanish ? "Archivo de precios" : "Price file"}
                </span>
                <input
                  className="input-surface w-full rounded-lg px-4 py-3 text-sm"
                  type="file"
                  name="file"
                  accept=".xlsx,.xls,.csv"
                  required
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={isPending || !propertyName}
              className="workspace-button-primary inline-flex w-full items-center justify-center rounded-lg px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending
                ? isSpanish
                  ? "Guardando..."
                  : "Saving..."
                : isSpanish
                  ? "Guardar precios"
                  : "Save prices"}
            </button>

            <div className="min-h-6">
              {message ? <p className="text-sm text-pos">{message}</p> : null}
              {error ? <p className="text-sm text-neg">{error}</p> : null}
            </div>
          </form>
        </div>
      </Modal>
    </>
  );
}

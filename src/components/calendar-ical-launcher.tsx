"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Link2 } from "lucide-react";
import { CalendarFeedsManager } from "@/components/calendar-feeds-panel";
import { useLocale } from "@/components/locale-provider";
import { Modal } from "@/components/modal";
import { PropertyUnitFieldGroup } from "@/components/property-unit-field-group";
import type { IcalFeedRecord, PropertyDefinition } from "@/lib/types";

function inputClassName() {
  return "input-surface w-full rounded-2xl px-4 py-3 text-sm";
}

export function CalendarIcalLauncher({
  properties,
  feeds,
}: {
  properties: PropertyDefinition[];
  feeds: IcalFeedRecord[];
}) {
  const { locale } = useLocale();
  const isSpanish = locale === "es";
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasFeeds = feeds.length > 0;

  async function handleSubmit(formData: FormData) {
    setMessage(null);
    setError(null);

    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch("/api/calendar/ical", {
            method: "POST",
            body: formData,
          });

          const payload = (await response.json()) as {
            error?: string;
            message?: string;
          };

          if (!response.ok) {
            setError(
              payload.error ??
                (isSpanish
                  ? "No se pudo importar el feed iCal."
                  : "The iCal feed could not be imported."),
            );
            return;
          }

          setMessage(payload.message ?? (isSpanish ? "iCal importado." : "iCal imported."));
          formRef.current?.reset();
          router.refresh();
        } catch {
          setError(
            isSpanish
              ? "No se pudo importar el feed iCal."
              : "The iCal feed could not be imported.",
          );
        }
      })();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="workspace-button-primary inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition"
      >
        <Link2 className="h-4 w-4" />
        {hasFeeds
          ? isSpanish
            ? "Gestionar iCal"
            : "Manage iCal"
          : isSpanish
            ? "Conectar iCal"
            : "Connect iCal"}
      </button>

      <Modal
        open={isOpen}
        title={isSpanish ? "iCal del calendario" : "Calendar iCal"}
        onClose={() => setIsOpen(false)}
        alignTop
      >
        <div className="space-y-8">
          {hasFeeds ? (
            <section className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-[var(--workspace-text)]">
                  {isSpanish ? "Feeds conectados" : "Connected feeds"}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--workspace-muted)]">
                  {isSpanish
                    ? "Gestiona tus conexiones guardadas y refresca el calendario desde este mismo lugar."
                    : "Manage your saved connections and refresh the calendar from the same place."}
                </p>
              </div>
              <CalendarFeedsManager feeds={feeds} />
            </section>
          ) : null}

          <section className={hasFeeds ? "space-y-5 border-t border-white/8 pt-6" : "space-y-5"}>
            <div className="workspace-soft-card rounded-[24px] p-5">
              <p className="text-sm font-semibold text-[var(--workspace-text)]">
                {hasFeeds
                  ? isSpanish
                    ? "Conectar otro feed iCal"
                    : "Connect another iCal feed"
                  : isSpanish
                    ? "Guarda una conexión de calendario real"
                    : "Save a real calendar connection"}
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--workspace-muted)]">
                {isSpanish
                  ? "Pega la URL pública `.ics` de Airbnb, Booking.com, Vrbo u otro canal. Hostlyx guardará ese feed en el listing seleccionado y lo sincronizará en eventos del calendario."
                  : "Paste the public `.ics` URL from Airbnb, Booking.com, Vrbo, or another channel. Hostlyx will save that feed on the selected listing and sync it into calendar events."}
              </p>
            </div>

            <form ref={formRef} action={handleSubmit} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <PropertyUnitFieldGroup properties={properties} />

                <label className="space-y-2 sm:col-span-2">
                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                    {isSpanish ? "Canal de origen" : "Channel source"}
                  </span>
                  <select className={inputClassName()} name="source" defaultValue="airbnb">
                    <option value="airbnb">Airbnb</option>
                    <option value="booking">Booking.com</option>
                    <option value="vrbo">Vrbo</option>
                    <option value="other">{isSpanish ? "Otro" : "Other"}</option>
                  </select>
                </label>

                <label className="space-y-2 sm:col-span-2">
                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                    {isSpanish ? "URL pública de iCal" : "Public iCal URL"}
                  </span>
                  <input
                    className={inputClassName()}
                    type="url"
                    name="icalUrl"
                    placeholder="https://..."
                    required
                  />
                </label>
              </div>

              <div className="rounded-[22px] border border-[var(--workspace-border)] bg-white/[0.02] px-4 py-4 text-sm leading-6 text-[var(--workspace-muted)]">
                {isSpanish
                  ? "iCal es ideal para la visibilidad del calendario. Normalmente trae check-ins, check-outs, reservas y días bloqueados, pero no datos financieros completos como payout, comisiones o impuestos."
                  : "iCal is great for calendar visibility. It usually brings check-ins, check-outs, reservations, and blocked days, but not full payout statement data like payout, fees, or taxes."}
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="workspace-button-primary inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending
                  ? isSpanish
                    ? "Guardando y sincronizando..."
                    : "Saving and syncing..."
                  : isSpanish
                    ? "Guardar y sincronizar"
                    : "Save and sync"}
              </button>

              <div className="min-h-6">
                {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
                {error ? <p className="text-sm text-rose-500">{error}</p> : null}
              </div>
            </form>
          </section>
        </div>
      </Modal>
    </>
  );
}

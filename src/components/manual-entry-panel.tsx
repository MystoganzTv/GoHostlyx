"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PencilLine, ReceiptText, ScrollText } from "lucide-react";
import { PropertyUnitFieldGroup } from "@/components/property-unit-field-group";
import { WorkspaceDateField } from "@/components/workspace-date-field";
import type { PropertyDefinition } from "@/lib/types";
import { useTranslate } from "@/components/use-translate";

function inputClassName() {
  return "input-surface w-full rounded-lg px-4 py-3 text-sm";
}

export function ManualEntryPanel({
  properties,
}: {
  properties: PropertyDefinition[];
}) {
  const t = useTranslate();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [bookingMessage, setBookingMessage] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [expenseMessage, setExpenseMessage] = useState<string | null>(null);
  const [expenseError, setExpenseError] = useState<string | null>(null);
  const [activeEntryType, setActiveEntryType] = useState<"booking" | "expense">("booking");

  function submitForm(
    endpoint: "/api/bookings" | "/api/expenses",
    formData: FormData,
    onSuccess: (message: string) => void,
    onError: (message: string) => void,
  ) {
    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch(endpoint, {
            method: "POST",
            body: formData,
          });

          const payload = (await response.json()) as {
            error?: string;
            message?: string;
          };

          if (!response.ok) {
            onError(payload.error ?? t("The record could not be saved.", "No se pudo guardar el registro."));
            return;
          }

          onSuccess(payload.message ?? t("Saved.", "Guardado."));
          router.refresh();
        } catch {
          onError(t("The record could not be saved.", "No se pudo guardar el registro."));
        }
      })();
    });
  }

  async function handleBookingSubmit(formData: FormData) {
    setBookingMessage(null);
    setBookingError(null);

    submitForm(
      "/api/bookings",
      formData,
      (message) => setBookingMessage(message),
      (message) => setBookingError(message),
    );
  }

  async function handleExpenseSubmit(formData: FormData) {
    setExpenseMessage(null);
    setExpenseError(null);

    submitForm(
      "/api/expenses",
      formData,
      (message) => setExpenseMessage(message),
      (message) => setExpenseError(message),
    );
  }

  return (
    <div className="workspace-card rounded-xl p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--workspace-muted)]">
            {t("Manual Entry", "Entrada manual")}
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--workspace-muted)]">
            {t("Add bookings and expenses directly in the app.", "Añade reservas y gastos directamente en la app.")}
          </p>
        </div>
        <div className="workspace-icon-chip rounded-xl p-3">
          <PencilLine className="h-6 w-6" />
        </div>
      </div>

      <div className="mt-6 space-y-5">
        <div className="grid gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() => setActiveEntryType("booking")}
            className={`rounded-xl border p-4 text-left transition ${
              activeEntryType === "booking"
                ? "border-[var(--workspace-accent)] bg-[var(--workspace-accent-soft)] shadow-[0_0_0_1px_rgba(88,196,182,0.16)]"
                : "border-[var(--workspace-border)] bg-[var(--workspace-panel-soft)] hover:border-[var(--workspace-accent)]/30"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="workspace-icon-chip rounded-lg p-3">
                <ScrollText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--workspace-text)]">{t("Add Booking", "Añadir reserva")}</p>
                <p className="mt-1 text-xs text-[var(--workspace-muted)]">
                  {t("Capture stays, guests, pricing, and payout.", "Estancias, huéspedes, precios y payout.")}
                </p>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveEntryType("expense")}
            className={`rounded-xl border p-4 text-left transition ${
              activeEntryType === "expense"
                ? "border-rose-300/30 bg-rose-400/10 shadow-[0_0_0_1px_rgba(236,143,150,0.12)]"
                : "border-[var(--workspace-border)] bg-[var(--workspace-panel-soft)] hover:border-rose-300/20"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-rose-400/12 p-3 text-rose-200">
                <ReceiptText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--workspace-text)]">{t("Add Expense", "Añadir gasto")}</p>
                <p className="mt-1 text-xs text-[var(--workspace-muted)]">
                  {t("Log costs, categories, and notes cleanly.", "Costes, categorías y notas.")}
                </p>
              </div>
            </div>
          </button>
        </div>

        {activeEntryType === "booking" ? (
        <form action={handleBookingSubmit} className="workspace-soft-card rounded-xl p-4 sm:p-5 space-y-4">
          <div>
            <p className="text-sm font-semibold text-[var(--workspace-text)]">{t("Booking details", "Datos de la reserva")}</p>
            <p className="mt-1 text-sm text-[var(--workspace-muted)]">{t("Use this when you want to add a stay manually.", "Úsalo para añadir una estancia a mano.")}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <WorkspaceDateField name="checkIn" label="Check-in" placeholder={t("Select check-in", "Elige el check-in")} required />
            <WorkspaceDateField name="checkout" label={t("Checkout", "Check-out")} placeholder={t("Select checkout", "Elige el check-out")} required />
            <PropertyUnitFieldGroup properties={properties} />
            <label className="space-y-2 sm:col-span-2">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                {t("Guest name", "Nombre del huésped")}
              </span>
              <input className={inputClassName()} type="text" name="guestName" placeholder={t("Guest name", "Nombre del huésped")} required />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                {t("Guests", "Huéspedes")}
              </span>
              <input className={inputClassName()} type="number" min="1" name="guestCount" defaultValue="1" required />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                {t("Channel", "Canal")}
              </span>
              <input className={inputClassName()} type="text" name="channel" placeholder={t("Airbnb, Booking.com, Direct...", "Airbnb, Booking.com, Directo...")} required />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                {t("Price per night", "Precio por noche")}
              </span>
              <input className={inputClassName()} type="number" min="0" step="0.01" name="pricePerNight" defaultValue="0" required />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                {t("Extra fee", "Cargo extra")}
              </span>
              <input className={inputClassName()} type="number" min="0" step="0.01" name="extraFee" defaultValue="0" />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                {t("Discount", "Descuento")}
              </span>
              <input className={inputClassName()} type="number" min="0" step="0.01" name="discount" defaultValue="0" />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                {t("Cleaning fee", "Tarifa de limpieza")}
              </span>
              <input className={inputClassName()} type="number" min="0" step="0.01" name="cleaningFee" defaultValue="0" />
            </label>
            <label className="space-y-2 sm:col-span-2">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                {t("Host fee", "Comisión del anfitrión")}
              </span>
              <input className={inputClassName()} type="number" min="0" step="0.01" name="hostFee" defaultValue="0" />
            </label>
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="workspace-button-primary inline-flex w-full items-center justify-center rounded-lg px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? t("Saving booking...", "Guardando reserva...") : t("Add booking", "Añadir reserva")}
          </button>
          <div className="min-h-6">
            {bookingMessage ? <p className="text-sm text-pos">{bookingMessage}</p> : null}
            {bookingError ? <p className="text-sm text-neg">{bookingError}</p> : null}
          </div>
        </form>
        ) : (
        <form action={handleExpenseSubmit} className="workspace-soft-card rounded-xl p-4 sm:p-5 space-y-4">
          <div>
            <p className="text-sm font-semibold text-[var(--workspace-text)]">{t("Expense details", "Datos del gasto")}</p>
            <p className="mt-1 text-sm text-[var(--workspace-muted)]">{t("Use this for bills, cleaning, supplies, repairs, and operating costs.", "Facturas, limpieza, suministros, reparaciones y costes operativos.")}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <WorkspaceDateField name="date" label={t("Date", "Fecha")} placeholder={t("Select expense date", "Elige la fecha del gasto")} required />
            <label className="space-y-2">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                {t("Amount", "Importe")}
              </span>
              <input className={inputClassName()} type="number" min="0.01" step="0.01" name="amount" required />
            </label>
            <PropertyUnitFieldGroup properties={properties} />
            <label className="space-y-2 sm:col-span-2">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                {t("Category", "Categoría")}
              </span>
              <input className={inputClassName()} type="text" name="category" placeholder={t("Cleaning, Repairs, Utilities...", "Limpieza, Reparaciones, Suministros...")} required />
            </label>
            <label className="space-y-2 sm:col-span-2">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                {t("Description", "Descripción")}
              </span>
              <input className={inputClassName()} type="text" name="description" placeholder={t("What was paid for?", "¿Qué se pagó?")} required />
            </label>
            <label className="space-y-2 sm:col-span-2">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                {t("Note", "Nota")}
              </span>
              <textarea className={`${inputClassName()} min-h-[108px] resize-y`} name="note" placeholder={t("Optional note", "Nota opcional")} />
            </label>
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="workspace-button-secondary inline-flex w-full items-center justify-center rounded-lg px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? t("Saving expense...", "Guardando gasto...") : t("Add expense", "Añadir gasto")}
          </button>
          <div className="min-h-6">
            {expenseMessage ? <p className="text-sm text-pos">{expenseMessage}</p> : null}
            {expenseError ? <p className="text-sm text-neg">{expenseError}</p> : null}
          </div>
        </form>
        )}
      </div>
    </div>
  );
}

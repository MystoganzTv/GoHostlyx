"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PencilLine, ReceiptText, ScrollText } from "lucide-react";
import { PropertyUnitFieldGroup } from "@/components/property-unit-field-group";
import { WorkspaceDateField } from "@/components/workspace-date-field";
import type { PropertyDefinition } from "@/lib/types";

function inputClassName() {
  return "input-surface w-full rounded-2xl px-4 py-3 text-sm";
}

export function ManualEntryPanel({
  properties,
}: {
  properties: PropertyDefinition[];
}) {
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
            onError(payload.error ?? "The record could not be saved.");
            return;
          }

          onSuccess(payload.message ?? "Saved.");
          router.refresh();
        } catch {
          onError("The record could not be saved.");
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
    <div className="workspace-card rounded-[30px] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--workspace-muted)]">
            Manual Entry
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--workspace-muted)]">
            Add bookings and expenses directly in the app.
          </p>
        </div>
        <div className="workspace-icon-chip rounded-3xl p-3">
          <PencilLine className="h-6 w-6" />
        </div>
      </div>

      <div className="mt-6 space-y-5">
        <div className="grid gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() => setActiveEntryType("booking")}
            className={`rounded-[24px] border p-4 text-left transition ${
              activeEntryType === "booking"
                ? "border-[var(--workspace-accent)] bg-[var(--workspace-accent-soft)] shadow-[0_0_0_1px_rgba(88,196,182,0.16)]"
                : "border-[var(--workspace-border)] bg-[var(--workspace-panel-soft)] hover:border-[var(--workspace-accent)]/30"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="workspace-icon-chip rounded-2xl p-3">
                <ScrollText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--workspace-text)]">Add Booking</p>
                <p className="mt-1 text-xs text-[var(--workspace-muted)]">
                  Capture stays, guests, pricing, and payout.
                </p>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveEntryType("expense")}
            className={`rounded-[24px] border p-4 text-left transition ${
              activeEntryType === "expense"
                ? "border-rose-300/30 bg-rose-400/10 shadow-[0_0_0_1px_rgba(236,143,150,0.12)]"
                : "border-[var(--workspace-border)] bg-[var(--workspace-panel-soft)] hover:border-rose-300/20"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-rose-400/12 p-3 text-rose-200">
                <ReceiptText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--workspace-text)]">Add Expense</p>
                <p className="mt-1 text-xs text-[var(--workspace-muted)]">
                  Log costs, categories, and notes cleanly.
                </p>
              </div>
            </div>
          </button>
        </div>

        {activeEntryType === "booking" ? (
        <form action={handleBookingSubmit} className="workspace-soft-card rounded-[26px] p-4 sm:p-5 space-y-4">
          <div>
            <p className="text-sm font-semibold text-[var(--workspace-text)]">Booking details</p>
            <p className="mt-1 text-sm text-[var(--workspace-muted)]">Use this when you want to add a stay manually.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <WorkspaceDateField name="checkIn" label="Check-in" placeholder="Select check-in" required />
            <WorkspaceDateField name="checkout" label="Checkout" placeholder="Select checkout" required />
            <PropertyUnitFieldGroup properties={properties} />
            <label className="space-y-2 sm:col-span-2">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                Guest name
              </span>
              <input className={inputClassName()} type="text" name="guestName" placeholder="Guest name" required />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                Guests
              </span>
              <input className={inputClassName()} type="number" min="1" name="guestCount" defaultValue="1" required />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                Channel
              </span>
              <input className={inputClassName()} type="text" name="channel" placeholder="Airbnb, Booking.com, Direct..." required />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                Price per night
              </span>
              <input className={inputClassName()} type="number" min="0" step="0.01" name="pricePerNight" defaultValue="0" required />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                Extra fee
              </span>
              <input className={inputClassName()} type="number" min="0" step="0.01" name="extraFee" defaultValue="0" />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                Discount
              </span>
              <input className={inputClassName()} type="number" min="0" step="0.01" name="discount" defaultValue="0" />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                Cleaning fee
              </span>
              <input className={inputClassName()} type="number" min="0" step="0.01" name="cleaningFee" defaultValue="0" />
            </label>
            <label className="space-y-2 sm:col-span-2">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                Host fee
              </span>
              <input className={inputClassName()} type="number" min="0" step="0.01" name="hostFee" defaultValue="0" />
            </label>
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="workspace-button-primary inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Saving booking..." : "Add booking"}
          </button>
          <div className="min-h-6">
            {bookingMessage ? <p className="text-sm text-emerald-600">{bookingMessage}</p> : null}
            {bookingError ? <p className="text-sm text-rose-500">{bookingError}</p> : null}
          </div>
        </form>
        ) : (
        <form action={handleExpenseSubmit} className="workspace-soft-card rounded-[26px] p-4 sm:p-5 space-y-4">
          <div>
            <p className="text-sm font-semibold text-[var(--workspace-text)]">Expense details</p>
            <p className="mt-1 text-sm text-[var(--workspace-muted)]">Use this for bills, cleaning, supplies, repairs, and operating costs.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <WorkspaceDateField name="date" label="Date" placeholder="Select expense date" required />
            <label className="space-y-2">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                Amount
              </span>
              <input className={inputClassName()} type="number" min="0.01" step="0.01" name="amount" required />
            </label>
            <PropertyUnitFieldGroup properties={properties} />
            <label className="space-y-2 sm:col-span-2">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                Category
              </span>
              <input className={inputClassName()} type="text" name="category" placeholder="Cleaning, Repairs, Utilities..." required />
            </label>
            <label className="space-y-2 sm:col-span-2">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                Description
              </span>
              <input className={inputClassName()} type="text" name="description" placeholder="What was paid for?" required />
            </label>
            <label className="space-y-2 sm:col-span-2">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                Note
              </span>
              <textarea className={`${inputClassName()} min-h-[108px] resize-y`} name="note" placeholder="Optional note" />
            </label>
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="workspace-button-secondary inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Saving expense..." : "Add expense"}
          </button>
          <div className="min-h-6">
            {expenseMessage ? <p className="text-sm text-emerald-600">{expenseMessage}</p> : null}
            {expenseError ? <p className="text-sm text-rose-500">{expenseError}</p> : null}
          </div>
        </form>
        )}
      </div>
    </div>
  );
}

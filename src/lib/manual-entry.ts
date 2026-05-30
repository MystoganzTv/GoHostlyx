import { differenceInCalendarDays, isValid, parseISO } from "date-fns";
import type { BookingRecord, ExpenseRecord } from "./types";

function parseMoney(value: FormDataEntryValue | null) {
  const amount = Number(String(value ?? "0").trim());
  return Number.isFinite(amount) ? amount : 0;
}

function parseInteger(value: FormDataEntryValue | null) {
  const amount = Number(String(value ?? "0").trim());
  return Number.isFinite(amount) ? Math.max(0, Math.trunc(amount)) : 0;
}

function parseText(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function ensureDate(value: string, fieldLabel: string) {
  const parsed = parseISO(value);
  if (!value || !isValid(parsed)) {
    throw new Error(`Enter a valid ${fieldLabel}.`);
  }

  return value;
}

export function normalizeManualBooking(formData: FormData): BookingRecord {
  const checkIn = ensureDate(parseText(formData.get("checkIn")), "check-in date");
  const checkout = ensureDate(parseText(formData.get("checkout")), "checkout date");
  const propertyName = parseText(formData.get("propertyName"));
  const nights = differenceInCalendarDays(parseISO(checkout), parseISO(checkIn));

  if (nights <= 0) {
    throw new Error("Checkout must be after check-in.");
  }

  if (!propertyName) {
    throw new Error("Choose a property before saving the booking.");
  }

  const pricePerNight = parseMoney(formData.get("pricePerNight"));
  const extraFee = parseMoney(formData.get("extraFee"));
  const discount = parseMoney(formData.get("discount"));
  const cleaningFee = parseMoney(formData.get("cleaningFee"));
  const taxAmount = parseMoney(formData.get("taxAmount"));
  const hostFee = parseMoney(formData.get("hostFee"));
  const rentalRevenue = Number((nights * pricePerNight).toFixed(2));
  const totalRevenue = Number(
    (rentalRevenue + extraFee + cleaningFee - discount).toFixed(2),
  );
  const payout = Number((totalRevenue - hostFee).toFixed(2));

  return {
    source: "manual",
    propertyName,
    unitName: parseText(formData.get("unitName")),
    checkIn,
    checkout,
    guestName: parseText(formData.get("guestName")) || "Guest",
    guestCount: Math.max(1, parseInteger(formData.get("guestCount"))),
    channel: parseText(formData.get("channel")) || "Direct",
    rentalPeriod: `${nights} nights`,
    pricePerNight,
    extraFee,
    discount,
    rentalRevenue,
    cleaningFee,
    taxAmount,
    totalRevenue,
    hostFee,
    payout,
    nights,
    bookingNumber: parseText(formData.get("bookingNumber")),
    overbookingStatus: parseText(formData.get("overbookingStatus")),
  };
}

export function normalizeManualExpense(formData: FormData): ExpenseRecord {
  const date = ensureDate(parseText(formData.get("date")), "expense date");
  const amount = parseMoney(formData.get("amount"));
  const propertyName = parseText(formData.get("propertyName"));

  if (amount <= 0) {
    throw new Error("Enter an expense amount greater than zero.");
  }

  if (!propertyName) {
    throw new Error("Choose a property before saving the expense.");
  }

  return {
    source: "manual",
    propertyName,
    unitName: parseText(formData.get("unitName")),
    date,
    category: parseText(formData.get("category")) || "Other",
    amount,
    description: parseText(formData.get("description")) || "Manual expense",
    note: parseText(formData.get("note")),
  };
}

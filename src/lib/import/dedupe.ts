import type { BookingRecord } from "@/lib/types";
import type {
  ImportBookingCandidate,
  ImportDetectedSource,
  ImportDuplicateFlag,
} from "./types";

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function normalizeAmount(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

function inferProviderKeyFromChannel(channel: string | undefined) {
  const normalized = normalizeText(channel ?? "");

  if (normalized.includes("airbnb")) {
    return "airbnb";
  }

  if (normalized.includes("booking")) {
    return "booking";
  }

  if (!normalized) {
    return "unknown";
  }

  return "other";
}

function mapStoredSource(source: BookingRecord["importedSource"]): ImportDetectedSource | "other" {
  switch (source) {
    case "airbnb":
      return "airbnb";
    case "booking_com":
      return "booking";
    case "generic_excel":
    case "hostlyx_excel":
      return "generic";
    default:
      return "unknown";
  }
}

function getStoredProviderKey(booking: BookingRecord) {
  const channelProvider = inferProviderKeyFromChannel(booking.channel);
  if (channelProvider !== "unknown") {
    return channelProvider;
  }

  return mapStoredSource(booking.importedSource);
}

function getImportedProviderKey(row: ImportBookingCandidate) {
  const channelProvider = inferProviderKeyFromChannel(row.booking.channel);
  if (channelProvider !== "unknown") {
    return channelProvider;
  }

  return row.booking.source;
}

function buildPreferredKey(
  provider: ImportDetectedSource | "other",
  bookingReference: string,
  checkIn: string,
) {
  if (!provider || !bookingReference || !checkIn) {
    return "";
  }

  return `${provider}|${normalizeText(bookingReference)}|${checkIn}`;
}

function buildFallbackKey(
  provider: ImportDetectedSource | "other",
  guestName: string,
  checkIn: string,
  checkOut: string,
  payout: number,
) {
  if (!provider || !guestName || !checkIn || !checkOut || !Number.isFinite(payout)) {
    return "";
  }

  return [
    provider,
    normalizeText(guestName),
    checkIn,
    checkOut,
    normalizeAmount(payout),
  ].join("|");
}

export function detectDuplicateBookings(
  rows: ImportBookingCandidate[],
  existingBookings: BookingRecord[],
): ImportDuplicateFlag[] {
  const duplicates: ImportDuplicateFlag[] = [];
  const filePreferred = new Map<string, number>();
  const fileFallback = new Map<string, number>();
  const existingPreferred = new Set<string>();
  const existingFallback = new Set<string>();

  for (const existingBooking of existingBookings) {
    const provider = getStoredProviderKey(existingBooking);
    const preferredKey = buildPreferredKey(
      provider,
      existingBooking.bookingNumber,
      existingBooking.checkIn,
    );
    const fallbackKey = buildFallbackKey(
      provider,
      existingBooking.guestName,
      existingBooking.checkIn,
      existingBooking.checkout,
      existingBooking.payout,
    );

    if (preferredKey) {
      existingPreferred.add(preferredKey);
    }

    if (fallbackKey) {
      existingFallback.add(fallbackKey);
    }
  }

  for (const row of rows) {
    const provider = getImportedProviderKey(row);
    const preferredKey = buildPreferredKey(
      provider,
      row.booking.bookingReference,
      row.booking.checkIn,
    );
    const fallbackKey = buildFallbackKey(
      provider,
      row.booking.guestName,
      row.booking.checkIn,
      row.booking.checkOut,
      row.booking.payout,
    );

    if (preferredKey && existingPreferred.has(preferredKey)) {
      duplicates.push({
        rowType: "booking",
        rowIndex: row.rowIndex,
        code: "duplicate_existing_reference",
        message: "This booking already exists in your workspace.",
        severity: "warning",
        matchType: "reference",
        matchScope: "existing",
      });
      continue;
    }

    if (preferredKey && filePreferred.has(preferredKey)) {
      duplicates.push({
        rowType: "booking",
        rowIndex: row.rowIndex,
        code: "duplicate_file_reference",
        message: "This booking appears more than once in the uploaded file.",
        severity: "warning",
        matchType: "reference",
        matchScope: "file",
      });
      continue;
    }

    if (fallbackKey && existingFallback.has(fallbackKey)) {
      duplicates.push({
        rowType: "booking",
        rowIndex: row.rowIndex,
        code: "duplicate_existing_fallback",
        message: "This booking looks like an existing reservation with the same guest, stay, and payout.",
        severity: "warning",
        matchType: "fallback",
        matchScope: "existing",
      });
      continue;
    }

    if (fallbackKey && fileFallback.has(fallbackKey)) {
      duplicates.push({
        rowType: "booking",
        rowIndex: row.rowIndex,
        code: "duplicate_file_fallback",
        message: "This booking looks duplicated inside the uploaded file.",
        severity: "warning",
        matchType: "fallback",
        matchScope: "file",
      });
      continue;
    }

    if (preferredKey) {
      filePreferred.set(preferredKey, row.rowIndex);
    }

    if (fallbackKey) {
      fileFallback.set(fallbackKey, row.rowIndex);
    }
  }

  return duplicates;
}

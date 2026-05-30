import type {
  ImportValidationWarning,
  NormalizedImportBooking,
  NormalizedImportExpense,
} from "./types";

export function normalizeChannelLabel(value: string) {
  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return "";
  }

  if (normalized.includes("airbnb")) {
    return "Airbnb";
  }

  if (normalized.includes("booking")) {
    return "Booking.com";
  }

  if (normalized.includes("vrbo")) {
    return "VRBO";
  }

  if (normalized.includes("direct")) {
    return "Direct";
  }

  return value.trim();
}

export function shouldNoteDateStandardization(
  rawValue: unknown,
  parsedValue: string,
  options?: {
    ambiguous?: boolean;
    malformed?: boolean;
  },
) {
  const raw = String(rawValue ?? "").trim();
  if (!raw || !parsedValue || options?.ambiguous || options?.malformed) {
    return false;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return false;
  }

  return true;
}

export function applyReviewMetadata<
  T extends NormalizedImportBooking | NormalizedImportExpense,
>(row: T, warnings: ImportValidationWarning[]) {
  row.needsReview = warnings.length > 0;
  row.reviewReasons = warnings.map((warning) => warning.message);
  return row;
}

export function summarizeAutoFixes(
  bookings: Array<NormalizedImportBooking>,
  expenses: Array<NormalizedImportExpense>,
) {
  const counts = new Map<string, number>();

  [...bookings, ...expenses].forEach((row) => {
    row.autoFixesApplied.forEach((fix) => {
      counts.set(fix, (counts.get(fix) ?? 0) + 1);
    });
  });

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .map(([label, count]) => `${label} on ${count} row${count === 1 ? "" : "s"}`);
}

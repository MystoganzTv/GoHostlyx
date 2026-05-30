import {
  applyReviewMetadata,
  normalizeChannelLabel,
  shouldNoteDateStandardization,
} from "./autoFix";
import {
  airbnbBookingColumns,
  getCell,
  mapOptionalColumns,
  rowIsEmpty,
  toRawRow,
} from "./columnMatchers";
import {
  calculateNights,
  deriveCheckOut,
  inferDatePreferenceFromSheet,
  parseImportDateDetailed,
  parseNights,
} from "./dates";
import { inferCurrency, parseMoney } from "./money";
import { rowLooksLikeSeparator, rowLooksLikeSummary, validateBookingRow } from "./validators";
import type {
  ImportBookingCandidate,
  ImportNormalizationResult,
  ImportValidationWarning,
  NormalizedImportBooking,
  ParsedImportWorkbook,
} from "./types";

type AirbnbColumnKey = keyof typeof airbnbBookingColumns;

function parseGuestCount(value: unknown) {
  const numeric = Number(String(value ?? "").replace(/[^\d]/g, ""));
  return Number.isFinite(numeric) ? Math.max(0, Math.trunc(numeric)) : 0;
}

export function normalizeAirbnb(workbook: ParsedImportWorkbook): ImportNormalizationResult {
  let selectedSheet = workbook.sheets[0];
  let selectedHeaderRowIndex = -1;
  let selectedIndexes: Partial<Record<AirbnbColumnKey, number>> | null = null;

  for (const sheet of workbook.sheets) {
    for (let rowIndex = 0; rowIndex < Math.min(sheet.rows.length, 10); rowIndex += 1) {
      const row = sheet.rows[rowIndex];
      const indexes = mapOptionalColumns(row, airbnbBookingColumns);

      if (
        typeof indexes.checkIn === "number" &&
        (typeof indexes.checkOut === "number" || typeof indexes.nights === "number") &&
        (typeof indexes.bookingReference === "number" ||
          typeof indexes.guestName === "number" ||
          typeof indexes.payout === "number")
      ) {
        selectedSheet = sheet;
        selectedHeaderRowIndex = rowIndex;
        selectedIndexes = indexes;
        break;
      }
    }

    if (selectedHeaderRowIndex >= 0) {
      break;
    }
  }

  if (selectedHeaderRowIndex < 0 || !selectedIndexes) {
    throw new Error("Hostlyx could not find recognizable Airbnb columns in this file.");
  }

  const headers = selectedSheet.rows[selectedHeaderRowIndex];
  const datePreference = inferDatePreferenceFromSheet(
    headers,
    selectedSheet.rows.slice(selectedHeaderRowIndex + 1).filter((row) => !rowIsEmpty(row)),
    [selectedIndexes.checkIn, selectedIndexes.checkOut],
  );
  const warnings: ImportValidationWarning[] = [];
  const bookings: ImportBookingCandidate[] = [];
  let skippedRows = 0;

  selectedSheet.rows
    .slice(selectedHeaderRowIndex + 1)
    .filter((row) => !rowIsEmpty(row))
    .forEach((row, index) => {
      const rowIndex = selectedHeaderRowIndex + index + 2;
      const rawRow = toRawRow(headers, row);

      if (rowLooksLikeSummary(rawRow) || rowLooksLikeSeparator(rawRow)) {
        skippedRows += 1;
        return;
      }

      const grossMoney = parseMoney(getCell(row, selectedIndexes.grossRevenue));
      const payoutMoney = parseMoney(getCell(row, selectedIndexes.payout));
      const feeMoney = parseMoney(getCell(row, selectedIndexes.platformFee));
      const cleaningMoney = parseMoney(getCell(row, selectedIndexes.cleaningFee));
      const taxMoney = parseMoney(getCell(row, selectedIndexes.taxAmount));
      const explicitNights = parseNights(getCell(row, selectedIndexes.nights));
      const adultsCount = parseGuestCount(getCell(row, selectedIndexes.adultsCount));
      const childrenCount = parseGuestCount(getCell(row, selectedIndexes.childrenCount));
      const infantsCount = parseGuestCount(getCell(row, selectedIndexes.infantsCount));
      const explicitGuests = parseGuestCount(getCell(row, selectedIndexes.guests));
      const checkInMeta = parseImportDateDetailed(getCell(row, selectedIndexes.checkIn), {
        datePreference,
      });
      let checkOutMeta = parseImportDateDetailed(getCell(row, selectedIndexes.checkOut), {
        datePreference,
      });
      const bookedAtMeta = parseImportDateDetailed(getCell(row, selectedIndexes.bookedAt), {
        datePreference,
      });

      if (!checkOutMeta.value && checkInMeta.value && explicitNights > 0) {
        checkOutMeta = {
          value: deriveCheckOut(checkInMeta.value, explicitNights),
          ambiguous: false,
          malformed: false,
        };
      }

      const autoFixesApplied: string[] = [];
      autoFixesApplied.push("Inferred channel from source");
      const nights = explicitNights || calculateNights(checkInMeta.value, checkOutMeta.value);
      if (!explicitNights && nights > 0 && checkInMeta.value && checkOutMeta.value) {
        autoFixesApplied.push("Calculated nights from dates");
      }

      const inferredGrossRevenue =
        grossMoney.value > 0
          ? grossMoney.value
          : Math.max(0, payoutMoney.value + Math.abs(feeMoney.value));
      if (grossMoney.value <= 0 && inferredGrossRevenue > 0 && payoutMoney.value > 0) {
        autoFixesApplied.push("Computed gross revenue from payout and platform fee");
      }

      const inferredPayout =
        payoutMoney.value > 0
          ? payoutMoney.value
          : Math.max(0, inferredGrossRevenue - Math.abs(feeMoney.value));
      if (payoutMoney.value <= 0 && inferredGrossRevenue > 0) {
        autoFixesApplied.push("Computed payout from revenue and platform fee");
      }

      if (shouldNoteDateStandardization(getCell(row, selectedIndexes.checkIn), checkInMeta.value, checkInMeta)) {
        autoFixesApplied.push("Standardized check-in date");
      }

      if (shouldNoteDateStandardization(getCell(row, selectedIndexes.checkOut), checkOutMeta.value, checkOutMeta)) {
        autoFixesApplied.push("Standardized check-out date");
      }

      if (shouldNoteDateStandardization(getCell(row, selectedIndexes.bookedAt), bookedAtMeta.value, bookedAtMeta)) {
        autoFixesApplied.push("Standardized booking date");
      }

      const guestCount =
        explicitGuests > 0
          ? explicitGuests
          : adultsCount + childrenCount + infantsCount;
      if (!explicitGuests && guestCount > 0) {
        autoFixesApplied.push("Calculated guest count from adults, children, and infants");
      }

      const booking: NormalizedImportBooking = {
        source: "airbnb",
        propertyName: String(getCell(row, selectedIndexes.propertyName) ?? "").trim(),
        bookingReference: String(getCell(row, selectedIndexes.bookingReference) ?? "").trim(),
        guestName: String(getCell(row, selectedIndexes.guestName) ?? "").trim(),
        guestContact: String(getCell(row, selectedIndexes.guestContact) ?? "").trim(),
        bookedAt: bookedAtMeta.value,
        adultsCount,
        childrenCount,
        infantsCount,
        channel: normalizeChannelLabel("Airbnb"),
        checkIn: checkInMeta.value,
        checkOut: checkOutMeta.value,
        nights,
        guests: guestCount,
        grossRevenue: inferredGrossRevenue,
        platformFee: Math.max(0, Math.abs(feeMoney.value)),
        cleaningFee: Math.max(0, cleaningMoney.value),
        taxAmount: Math.max(0, Math.abs(taxMoney.value)),
        payout: inferredPayout,
        currency: inferCurrency(
          String(getCell(row, selectedIndexes.currency) ?? "").trim(),
          grossMoney.currency,
          payoutMoney.currency,
          feeMoney.currency,
          cleaningMoney.currency,
          taxMoney.currency,
        ),
        status: String(getCell(row, selectedIndexes.status) ?? "").trim() || "Booked",
        rawRow,
        autoFixesApplied,
        needsReview: false,
        reviewReasons: [],
      };

      const rowWarnings = validateBookingRow({
        booking,
        rowIndex,
        malformedRequiredMoneyFields: [
          grossMoney.malformed ? "gross revenue" : "",
          payoutMoney.malformed ? "payout" : "",
        ].filter(Boolean),
        malformedOptionalMoneyFields: [
          feeMoney.malformed ? "platform fee" : "",
          cleaningMoney.malformed ? "cleaning fee" : "",
          taxMoney.malformed ? "taxes" : "",
        ].filter(Boolean),
        ambiguousDateFields: [
          checkInMeta.ambiguous ? "check-in" : "",
          checkOutMeta.ambiguous ? "check-out" : "",
        ].filter(Boolean),
        malformedDateFields: [
          checkInMeta.malformed ? "check-in" : "",
          checkOutMeta.malformed ? "check-out" : "",
        ].filter(Boolean),
      });

      warnings.push(...rowWarnings);
      bookings.push({
        rowIndex,
        booking: applyReviewMetadata(booking, rowWarnings),
        warnings: rowWarnings,
      });
    });

  return {
    source: "airbnb",
    bookings,
    expenses: [],
    warnings,
    duplicates: [],
    skippedRows,
    totalRowsRead: selectedSheet.rows
      .slice(selectedHeaderRowIndex + 1)
      .filter((row) => !rowIsEmpty(row)).length,
  };
}

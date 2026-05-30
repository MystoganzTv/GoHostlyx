import { getCell, rowIsEmpty, toRawRow } from "./columnMatchers";
import {
  applyReviewMetadata,
  normalizeChannelLabel,
  shouldNoteDateStandardization,
} from "./autoFix";
import {
  calculateNights,
  inferDatePreferenceFromSheet,
  parseImportDateDetailed,
} from "./dates";
import { inferCurrency, parseMoney } from "./money";
import { rowLooksLikeSeparator, rowLooksLikeSummary, validateBookingRow } from "./validators";
import type {
  ImportBookingCandidate,
  ImportManualMapping,
  ImportNormalizationResult,
  ImportValidationWarning,
  NormalizedImportBooking,
  ParsedImportWorkbook,
} from "./types";

export function normalizeManual(
  workbook: ParsedImportWorkbook,
  mapping: ImportManualMapping,
  options?: {
    source?: "airbnb" | "booking" | "generic" | "unknown";
    channel?: string;
  },
): ImportNormalizationResult {
  const sheet = workbook.sheets.find((entry) => entry.name === mapping.sheetName);

  if (!sheet) {
    throw new Error("Hostlyx could not find the selected sheet for manual mapping.");
  }

  const headers = sheet.rows[mapping.headerRowIndex];
  if (!headers) {
    throw new Error("Hostlyx could not find the selected header row for manual mapping.");
  }

  const warnings: ImportValidationWarning[] = [];
  const bookings: ImportBookingCandidate[] = [];
  const dataRows = sheet.rows.slice(mapping.headerRowIndex + 1).filter((row) => !rowIsEmpty(row));
  let skippedRows = 0;
  const datePreference = inferDatePreferenceFromSheet(headers, dataRows, [
    mapping.checkIn ?? undefined,
    mapping.checkOut ?? undefined,
  ]);

  dataRows.forEach((row, index) => {
      const rowIndex = mapping.headerRowIndex + index + 2;
      const rawRow = toRawRow(headers, row);
      if (rowLooksLikeSummary(rawRow) || rowLooksLikeSeparator(rawRow)) {
        skippedRows += 1;
        return;
      }
      const checkInMeta = parseImportDateDetailed(getCell(row, mapping.checkIn ?? undefined), {
        datePreference,
      });
      const checkOutMeta = parseImportDateDetailed(getCell(row, mapping.checkOut ?? undefined), {
        datePreference,
      });
      const grossMoney = parseMoney(getCell(row, mapping.grossRevenue ?? undefined));
      const payoutMoney =
        mapping.payout != null
          ? parseMoney(getCell(row, mapping.payout))
          : { value: grossMoney.value, malformed: false, currency: grossMoney.currency };
      const platformFee =
        grossMoney.value > 0 && payoutMoney.value > 0 && grossMoney.value >= payoutMoney.value
          ? grossMoney.value - payoutMoney.value
          : 0;
      const autoFixesApplied: string[] = [];

      if (grossMoney.value > 0 && payoutMoney.value > 0 && platformFee > 0 && mapping.payout == null) {
        autoFixesApplied.push("Computed payout from revenue and platform fee");
      }

      const nights = calculateNights(checkInMeta.value, checkOutMeta.value);
      if (nights > 0 && checkInMeta.value && checkOutMeta.value) {
        autoFixesApplied.push("Calculated nights from dates");
      }

      if (shouldNoteDateStandardization(getCell(row, mapping.checkIn ?? undefined), checkInMeta.value, checkInMeta)) {
        autoFixesApplied.push("Standardized check-in date");
      }

      if (shouldNoteDateStandardization(getCell(row, mapping.checkOut ?? undefined), checkOutMeta.value, checkOutMeta)) {
        autoFixesApplied.push("Standardized check-out date");
      }

      const normalizedChannel = normalizeChannelLabel(options?.channel ?? "");
      if (normalizedChannel) {
        autoFixesApplied.push("Inferred channel from source");
      }

      const booking: NormalizedImportBooking = {
        source: options?.source ?? "unknown",
        propertyName: String(getCell(row, mapping.propertyName ?? undefined) ?? "").trim(),
        bookingReference: "",
        guestName: String(getCell(row, mapping.guestName ?? undefined) ?? "").trim(),
        channel: normalizedChannel || "Imported file",
        checkIn: checkInMeta.value,
        checkOut: checkOutMeta.value,
        nights,
        guests: 0,
        grossRevenue: grossMoney.value,
        platformFee,
        cleaningFee: 0,
        taxAmount: 0,
        payout: payoutMoney.value,
        currency: inferCurrency(grossMoney.currency, payoutMoney.currency),
        status: "Booked",
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
          mapping.payout != null && payoutMoney.malformed ? "payout" : "",
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
    source: options?.source ?? "unknown",
    bookings,
    expenses: [],
    warnings,
    duplicates: [],
    skippedRows,
    totalRowsRead: dataRows.length,
  };
}

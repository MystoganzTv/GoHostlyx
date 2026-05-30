import { normalizeExpenseFields } from "@/lib/expense-normalization";
import {
  applyReviewMetadata,
  normalizeChannelLabel,
  shouldNoteDateStandardization,
} from "./autoFix";
import {
  findHeaderRowIndex,
  genericBookingColumns,
  genericBookingRequiredColumns,
  genericExpenseColumns,
  genericExpenseRequiredColumns,
  getCell,
  mapOptionalColumns,
  mapRequiredColumns,
  rowIsEmpty,
  toRawRow,
} from "./columnMatchers";
import {
  calculateNights,
  inferDatePreferenceFromSheet,
  parseImportDateDetailed,
  parseNights,
} from "./dates";
import { inferCurrency, parseMoney } from "./money";
import {
  rowLooksLikeSeparator,
  rowLooksLikeSummary,
  validateBookingRow,
  validateExpenseRow,
} from "./validators";
import type {
  ImportBookingCandidate,
  ImportExpenseCandidate,
  ImportNormalizationResult,
  ImportValidationWarning,
  NormalizedImportBooking,
  NormalizedImportExpense,
  ParsedImportWorkbook,
} from "./types";

function hasValue(value: unknown) {
  return String(value ?? "").trim() !== "";
}

function rowLooksLikeGenericBookingTemplate(
  row: ParsedImportWorkbook["sheets"][number]["rows"][number],
  indexes: {
    checkIn: number;
    checkOut: number;
    guestName: number;
  },
  optional: Partial<Record<keyof typeof genericBookingColumns, number>>,
) {
  const signalValues = [
    getCell(row, indexes.checkIn),
    getCell(row, indexes.checkOut),
    getCell(row, indexes.guestName),
    getCell(row, optional.bookingReference),
    getCell(row, optional.propertyName),
  ];

  return signalValues.every((value) => !hasValue(value));
}

function rowLooksLikeGenericExpenseTemplate(
  row: ParsedImportWorkbook["sheets"][number]["rows"][number],
  indexes: {
    date: number;
    category: number;
    amount: number;
  },
  optional: Partial<Record<keyof typeof genericExpenseColumns, number>>,
) {
  const signalValues = [
    getCell(row, indexes.date),
    getCell(row, indexes.category),
    getCell(row, indexes.amount),
    getCell(row, optional.description),
    getCell(row, optional.propertyName),
    getCell(row, optional.note),
  ];

  return signalValues.every((value) => !hasValue(value));
}

export function normalizeGeneric(workbook: ParsedImportWorkbook): ImportNormalizationResult {
  const bookingsSheet =
    workbook.sheets.find((sheet) => ["bookings", "reservas"].includes(sheet.normalizedName)) ??
    workbook.sheets.find((sheet) => findHeaderRowIndex(sheet.rows, genericBookingRequiredColumns) >= 0);
  const expensesSheet =
    workbook.sheets.find((sheet) => ["expenses", "gastos"].includes(sheet.normalizedName)) ??
    workbook.sheets.find((sheet) => findHeaderRowIndex(sheet.rows, genericExpenseRequiredColumns) >= 0);

  if (!bookingsSheet || !expensesSheet) {
    throw new Error("Generic imports require both Bookings and Expenses sheets.");
  }

  const bookingHeaderRowIndex = findHeaderRowIndex(bookingsSheet.rows, genericBookingRequiredColumns);
  const expenseHeaderRowIndex = findHeaderRowIndex(expensesSheet.rows, genericExpenseRequiredColumns);

  if (bookingHeaderRowIndex < 0) {
    throw new Error("Hostlyx could not find the Bookings header row.");
  }

  if (expenseHeaderRowIndex < 0) {
    throw new Error("Hostlyx could not find the Expenses header row.");
  }

  const bookingHeaders = bookingsSheet.rows[bookingHeaderRowIndex];
  const expenseHeaders = expensesSheet.rows[expenseHeaderRowIndex];
  const bookingIndexes = mapRequiredColumns(bookingHeaders, genericBookingRequiredColumns);
  const bookingOptional = mapOptionalColumns(bookingHeaders, genericBookingColumns);
  const expenseIndexes = mapRequiredColumns(expenseHeaders, genericExpenseRequiredColumns);
  const expenseOptional = mapOptionalColumns(expenseHeaders, genericExpenseColumns);
  const bookingDatePreference = inferDatePreferenceFromSheet(
    bookingHeaders,
    bookingsSheet.rows.slice(bookingHeaderRowIndex + 1).filter((row) => !rowIsEmpty(row)),
    [bookingIndexes.checkIn, bookingIndexes.checkOut],
  );
  const expenseDatePreference = inferDatePreferenceFromSheet(
    expenseHeaders,
    expensesSheet.rows.slice(expenseHeaderRowIndex + 1).filter((row) => !rowIsEmpty(row)),
    [expenseIndexes.date],
  );

  const warnings: ImportValidationWarning[] = [];
  const bookings: ImportBookingCandidate[] = [];
  const expenses: ImportExpenseCandidate[] = [];
  let skippedRows = 0;

  bookingsSheet.rows
    .slice(bookingHeaderRowIndex + 1)
    .filter((row) => !rowIsEmpty(row))
    .forEach((row, index) => {
      if (rowLooksLikeGenericBookingTemplate(row, bookingIndexes, bookingOptional)) {
        return;
      }

      const rowIndex = bookingHeaderRowIndex + index + 2;
      const rawRow = toRawRow(bookingHeaders, row);
      if (rowLooksLikeSummary(rawRow) || rowLooksLikeSeparator(rawRow)) {
        skippedRows += 1;
        return;
      }
      const grossMoney = parseMoney(getCell(row, bookingOptional.totalRevenue));
      const payoutMoney = parseMoney(getCell(row, bookingOptional.payout));
      const feeMoney = parseMoney(getCell(row, bookingOptional.hostFee));
      const cleaningMoney = parseMoney(getCell(row, bookingOptional.cleaningFee));
      const taxMoney = parseMoney(getCell(row, bookingOptional.taxAmount));
      const checkInMeta = parseImportDateDetailed(getCell(row, bookingIndexes.checkIn), {
        datePreference: bookingDatePreference,
      });
      const checkOutMeta = parseImportDateDetailed(getCell(row, bookingIndexes.checkOut), {
        datePreference: bookingDatePreference,
      });
      const derivedNights =
        parseNights(getCell(row, bookingOptional.rentalPeriod)) ||
        calculateNights(checkInMeta.value, checkOutMeta.value);
      const autoFixesApplied: string[] = [];
      const normalizedChannel = normalizeChannelLabel(String(getCell(row, bookingOptional.channel) ?? "").trim());
      const channel =
        normalizedChannel || "Direct";

      if (!normalizedChannel) {
        autoFixesApplied.push("Inferred channel from source");
      } else if (normalizedChannel !== String(getCell(row, bookingOptional.channel) ?? "").trim()) {
        autoFixesApplied.push("Normalized channel label");
      }

      if (!parseNights(getCell(row, bookingOptional.rentalPeriod)) && derivedNights > 0 && checkInMeta.value && checkOutMeta.value) {
        autoFixesApplied.push("Calculated nights from dates");
      }

      if (payoutMoney.value <= 0 && grossMoney.value > 0 && Math.abs(feeMoney.value) >= 0) {
        autoFixesApplied.push("Computed payout from revenue and platform fee");
      }

      if (grossMoney.value <= 0 && payoutMoney.value > 0 && Math.abs(feeMoney.value) > 0) {
        autoFixesApplied.push("Computed gross revenue from payout and platform fee");
      }

      if (shouldNoteDateStandardization(getCell(row, bookingIndexes.checkIn), checkInMeta.value, checkInMeta)) {
        autoFixesApplied.push("Standardized check-in date");
      }

      if (shouldNoteDateStandardization(getCell(row, bookingIndexes.checkOut), checkOutMeta.value, checkOutMeta)) {
        autoFixesApplied.push("Standardized check-out date");
      }

      const payout =
        payoutMoney.value > 0
          ? payoutMoney.value
          : Math.max(0, grossMoney.value - Math.max(0, Math.abs(feeMoney.value)));

      const grossRevenue =
        grossMoney.value > 0
          ? grossMoney.value
          : Math.max(0, payout + Math.max(0, Math.abs(feeMoney.value)));

      const booking: NormalizedImportBooking = {
        source: "generic",
        propertyName: String(getCell(row, bookingOptional.propertyName) ?? "").trim(),
        bookingReference: String(getCell(row, bookingOptional.bookingReference) ?? "").trim(),
        guestName: String(getCell(row, bookingIndexes.guestName) ?? "").trim(),
        channel,
        checkIn: checkInMeta.value,
        checkOut: checkOutMeta.value,
        nights: derivedNights,
        guests: Number(String(getCell(row, bookingOptional.guests) ?? "").replace(/[^\d]/g, "")) || 0,
        grossRevenue,
        platformFee: Math.max(0, Math.abs(feeMoney.value)),
        cleaningFee: Math.max(0, cleaningMoney.value),
        taxAmount: Math.max(0, Math.abs(taxMoney.value)),
        payout,
        currency: inferCurrency(
          grossMoney.currency,
          payoutMoney.currency,
          feeMoney.currency,
          cleaningMoney.currency,
          taxMoney.currency,
        ),
        status: String(getCell(row, bookingOptional.status) ?? "").trim() || "Booked",
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

  expensesSheet.rows
    .slice(expenseHeaderRowIndex + 1)
    .filter((row) => !rowIsEmpty(row))
    .forEach((row, index) => {
      if (rowLooksLikeGenericExpenseTemplate(row, expenseIndexes, expenseOptional)) {
        return;
      }

      const rowIndex = expenseHeaderRowIndex + index + 2;
      const rawRow = toRawRow(expenseHeaders, row);
      if (rowLooksLikeSummary(rawRow) || rowLooksLikeSeparator(rawRow)) {
        skippedRows += 1;
        return;
      }
      const normalizedExpenseFields = normalizeExpenseFields({
        amountValue: getCell(row, expenseIndexes.amount),
        descriptionValue: getCell(row, expenseOptional.description),
        noteValue: getCell(row, expenseOptional.note),
      });
      const expenseDateMeta = parseImportDateDetailed(getCell(row, expenseIndexes.date), {
        datePreference: expenseDatePreference,
      });
      const amountMeta = parseMoney(getCell(row, expenseIndexes.amount));
      const autoFixesApplied: string[] = [];
      if (shouldNoteDateStandardization(getCell(row, expenseIndexes.date), expenseDateMeta.value, expenseDateMeta)) {
        autoFixesApplied.push("Standardized expense date");
      }
      const expense: NormalizedImportExpense = {
        source: "generic",
        propertyName: String(getCell(row, expenseOptional.propertyName) ?? "").trim(),
        date: expenseDateMeta.value,
        category: String(getCell(row, expenseIndexes.category) ?? "").trim() || "Other",
        description: normalizedExpenseFields.description,
        note: normalizedExpenseFields.note,
        amount: amountMeta.malformed ? normalizedExpenseFields.amount : amountMeta.value,
        rawRow,
        autoFixesApplied,
        needsReview: false,
        reviewReasons: [],
      };

      const rowWarnings = validateExpenseRow({
        expense,
        rowIndex,
        malformedAmount: amountMeta.malformed,
        malformedDate: expenseDateMeta.malformed,
      });
      warnings.push(...rowWarnings);
      expenses.push({
        rowIndex,
        expense: applyReviewMetadata(expense, rowWarnings),
        warnings: rowWarnings,
      });
    });

  return {
    source: "generic",
    bookings,
    expenses,
    warnings,
    duplicates: [],
    skippedRows,
    totalRowsRead: bookings.length + expenses.length,
  };
}

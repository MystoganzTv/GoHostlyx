import {
  airbnbBookingColumns,
  bookingComBookingColumns,
  findHeaderRowIndex,
  genericBookingColumns,
  genericBookingRequiredColumns,
  genericExpenseColumns,
  genericExpenseRequiredColumns,
  mapOptionalColumns,
  normalizeHeader,
} from "./columnMatchers";
import { detectFinancialStatementSource } from "./financialStatement";
import type { ImportDetectedSource, ParsedImportWorkbook } from "./types";

export function detectSource(workbook: ParsedImportWorkbook): ImportDetectedSource {
  if (detectFinancialStatementSource(workbook)) {
    return "financial_statement";
  }

  const hasNamedBookingsSheet = workbook.sheets.some((sheet) =>
    ["bookings", "reservas"].includes(sheet.normalizedName),
  );
  const hasNamedExpensesSheet = workbook.sheets.some((sheet) =>
    ["expenses", "gastos"].includes(sheet.normalizedName),
  );
  const hasGenericBookingHeaders = workbook.sheets.some(
    (sheet) => findHeaderRowIndex(sheet.rows, genericBookingRequiredColumns) >= 0,
  );
  const hasGenericExpenseHeaders = workbook.sheets.some(
    (sheet) => findHeaderRowIndex(sheet.rows, genericExpenseRequiredColumns) >= 0,
  );

  if (hasNamedBookingsSheet && hasNamedExpensesSheet) {
    return "generic";
  }

  if (hasGenericBookingHeaders && hasGenericExpenseHeaders) {
    return "generic";
  }

  for (const sheet of workbook.sheets) {
    for (let rowIndex = 0; rowIndex < Math.min(sheet.rows.length, 8); rowIndex += 1) {
      const row = sheet.rows[rowIndex];
      const indexes = mapOptionalColumns(row, airbnbBookingColumns);
      const matches = Object.keys(indexes).length;
      const normalizedHeaders = row.map((cell) => normalizeHeader(cell));

      const hasAirbnbSpecificHeader = normalizedHeaders.some((header) =>
        [
          "confirmationcode",
          "yourearnings",
          "hostservicefee",
          "listing",
          "codigodeconfirmacion",
          "ganancias",
          "anuncio",
        ].includes(header),
      );

      if (
        matches >= 4 &&
        typeof indexes.checkIn === "number" &&
        (typeof indexes.checkOut === "number" || typeof indexes.nights === "number") &&
        (hasAirbnbSpecificHeader ||
          typeof indexes.bookingReference === "number" ||
          typeof indexes.payout === "number")
      ) {
        return "airbnb";
      }

      const bookingIndexes = mapOptionalColumns(row, bookingComBookingColumns);
      const bookingMatches = Object.keys(bookingIndexes).length;
      const hasBookingSpecificHeader = normalizedHeaders.some((header) =>
        [
          "reservationnumber",
          "commission",
          "accommodation",
          "arrival",
          "departure",
          "numerodereserva",
          "comision",
          "alojamiento",
        ].includes(header),
      );

      if (
        bookingMatches >= 4 &&
        typeof bookingIndexes.checkIn === "number" &&
        typeof bookingIndexes.checkOut === "number" &&
        (typeof bookingIndexes.bookingReference === "number" ||
          typeof bookingIndexes.guestName === "number") &&
        (typeof bookingIndexes.payout === "number" ||
          typeof bookingIndexes.grossRevenue === "number" ||
          typeof bookingIndexes.platformFee === "number") &&
        hasBookingSpecificHeader
      ) {
        return "booking";
      }
    }
  }

  return "unknown";
}

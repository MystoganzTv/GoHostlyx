import * as XLSX from "xlsx";
import type { BookingRecord, ExpenseRecord, ImportSummary, PropertyDefinition } from "@/lib/types";

/**
 * A full copy of a workspace as an Excel file. The Bookings and Expenses
 * sheets use the column names the generic GoHostlyx import understands, so the
 * file can be imported back as a backup. Column order matters for that: the
 * importer matches headers loosely ("Property name" also contains "name"), so
 * Guest name comes before Property name.
 */
export function buildWorkspaceExport({
  bookings,
  expenses,
  properties,
  imports,
}: {
  bookings: BookingRecord[];
  expenses: ExpenseRecord[];
  properties: PropertyDefinition[];
  imports: ImportSummary[];
}) {
  const workbook = XLSX.utils.book_new();

  const bookingRows = bookings.map((booking) => ({
    "Guest name": booking.guestName,
    "Check-in": booking.checkIn,
    Checkout: booking.checkout,
    Nights: booking.nights,
    Guests: booking.guestCount,
    Channel: booking.channel,
    "Booking number": booking.bookingNumber,
    "Price per night": booking.pricePerNight,
    "Cleaning fee": booking.cleaningFee,
    Taxes: booking.taxAmount,
    "Total revenue": booking.totalRevenue,
    "Host fee": booking.hostFee,
    Payout: booking.payout,
    Status: booking.overbookingStatus,
    "Property name": booking.propertyName,
    Unit: booking.unitName,
  }));

  const expenseRows = expenses.map((expense) => ({
    Date: expense.date,
    Category: expense.category,
    Amount: expense.amount,
    Description: expense.description,
    Note: expense.note,
    "Property name": expense.propertyName,
    Unit: expense.unitName,
  }));

  const propertyRows = properties.map((property) => ({
    Name: property.name,
    Country: property.countryCode,
    Listings: property.units.map((unit) => unit.name).join(", "),
  }));

  const importRows = imports.map((item) => ({
    File: item.fileName,
    Property: item.propertyName,
    Source: item.importedSource,
    "Imported at": item.importedAt,
    Bookings: item.bookingsCount,
    Expenses: item.expensesCount,
  }));

  appendSheet(workbook, "Bookings", bookingRows, ["Guest name", "Check-in", "Checkout", "Total revenue", "Payout"]);
  appendSheet(workbook, "Expenses", expenseRows, ["Date", "Category", "Amount", "Description"]);
  appendSheet(workbook, "Properties", propertyRows, ["Name", "Country", "Listings"]);
  appendSheet(workbook, "Imports", importRows, ["File", "Property", "Imported at"]);

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

function appendSheet(
  workbook: XLSX.WorkBook,
  name: string,
  rows: Array<Record<string, unknown>>,
  emptyHeaders: string[],
) {
  const sheet = rows.length > 0 ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet([emptyHeaders]);
  const headers = rows.length > 0 ? Object.keys(rows[0]) : emptyHeaders;
  sheet["!cols"] = headers.map((header) => ({ wch: Math.max(12, header.length + 2) }));
  XLSX.utils.book_append_sheet(workbook, sheet, name);
}

import { describe, expect, it } from "vitest";
import { buildWorkspaceExport } from "@/lib/data-export";
import { detectSource } from "@/lib/import/detectSource";
import { normalizeGeneric } from "@/lib/import/normalizeGeneric";
import { parseWorkbook } from "@/lib/import/parseWorkbook";
import type { BookingRecord, ExpenseRecord } from "@/lib/types";

const booking: BookingRecord = {
  propertyName: "Ocean Villa",
  unitName: "",
  checkIn: "2026-03-02",
  checkout: "2026-03-05",
  guestName: "Ana Gomez",
  guestCount: 2,
  channel: "Airbnb",
  rentalPeriod: "3 nights",
  pricePerNight: 150,
  extraFee: 0,
  discount: 0,
  rentalRevenue: 450,
  cleaningFee: 60,
  taxAmount: 0,
  totalRevenue: 510,
  hostFee: 45,
  payout: 465,
  nights: 3,
  bookingNumber: "HM123",
  overbookingStatus: "Booked",
};

const expense: ExpenseRecord = {
  propertyName: "Ocean Villa",
  unitName: "",
  date: "2026-03-06",
  category: "Cleaning",
  amount: 80,
  description: "Turnover clean",
  note: "",
};

describe("workspace export", () => {
  it("can be imported back by the generic importer", () => {
    const file = buildWorkspaceExport({ bookings: [booking], expenses: [expense], properties: [], imports: [] });
    const arrayBuffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;
    const workbook = parseWorkbook(arrayBuffer, "export.xlsx");

    expect(detectSource(workbook)).toBe("generic");

    const result = normalizeGeneric(workbook);
    expect(result.bookings).toHaveLength(1);
    expect(result.bookings[0].booking).toMatchObject({
      guestName: "Ana Gomez",
      propertyName: "Ocean Villa",
      checkIn: "2026-03-02",
      checkOut: "2026-03-05",
      grossRevenue: 510,
      payout: 465,
      platformFee: 45,
      bookingReference: "HM123",
    });
    expect(result.expenses).toHaveLength(1);
    expect(result.expenses[0].expense).toMatchObject({ category: "Cleaning", amount: 80, propertyName: "Ocean Villa" });
  });
});

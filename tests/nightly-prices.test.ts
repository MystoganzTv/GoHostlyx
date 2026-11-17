import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  buildNightPriceComparisons,
  pickCalendarPrices,
  shiftDateKey,
} from "@/lib/nightly-price-compare";
import { parseNightlyPriceFile, parseNightlyPriceRows } from "@/lib/nightly-prices";
import type { BookingRecord, CalendarClosureRecord } from "@/lib/types";

function booking(overrides: Partial<BookingRecord>): BookingRecord {
  return {
    propertyName: "HomeXperience",
    unitName: "",
    checkIn: "2025-12-05",
    checkout: "2025-12-08",
    guestName: "Guest",
    guestCount: 2,
    channel: "Booking.com",
    rentalPeriod: "",
    pricePerNight: 0,
    extraFee: 0,
    discount: 0,
    rentalRevenue: 216,
    cleaningFee: 0,
    taxAmount: 0,
    totalRevenue: 216,
    hostFee: 0,
    payout: 216,
    nights: 3,
    bookingNumber: "",
    overbookingStatus: "",
    ...overrides,
  };
}

describe("parseNightlyPriceRows", () => {
  it("reads a date and price column below a title block", () => {
    const rows = [
      ["", "Airbnb Prices"],
      ["", "Airbnb calendar price per night, booked or not."],
      [],
      ["", "Date", "Day", "Airbnb price"],
      ["", new Date(Date.UTC(2024, 10, 10)), "Sun", 73],
      ["", "2024-11-11", "Mon", "€73"],
      ["", "", "", ""],
      ["", "2024-11-12", "Tue", ""],
    ];

    expect(parseNightlyPriceRows([{ rows }])).toEqual([
      { date: "2024-11-10", price: 73 },
      { date: "2024-11-11", price: 73 },
    ]);
  });

  it("moves 'last year' and '2 years ago' columns back to their own dates", () => {
    const rows = [
      ["Date", "Day", "Price now", "Last year", "Change", "2 years ago"],
      ["2026-11-10", "Tue", 80, 80, 0, 73],
      ["2026-12-05", "Sat", 77, 80, -3, 65],
    ];

    expect(parseNightlyPriceRows([{ rows }])).toEqual([
      { date: "2024-11-10", price: 73 },
      { date: "2024-12-05", price: 65 },
      { date: "2025-11-10", price: 80 },
      { date: "2025-12-05", price: 80 },
      { date: "2026-11-10", price: 80 },
      { date: "2026-12-05", price: 77 },
    ]);
  });

  it("lets a price for the row's own date win over a shifted one", () => {
    const rows = [
      ["Date", "Price", "Last year"],
      ["2025-11-10", 99, ""],
      ["2026-11-10", 80, 70],
    ];

    expect(parseNightlyPriceRows([{ rows }])).toContainEqual({ date: "2025-11-10", price: 99 });
  });

  it("skips sheets without a date column", () => {
    const rows = [
      ["Month", "Price now", "Last year"],
      ["Jan", 72, 65],
    ];

    expect(parseNightlyPriceRows([{ rows }])).toEqual([]);
  });

  it("reads an Excel file", () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Date", "Price"],
      ["2027-01-01", 72],
    ]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "By day");
    const buffer = XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

    expect(parseNightlyPriceFile(buffer, "prices.xlsx")).toEqual([{ date: "2027-01-01", price: 72 }]);
  });
});

describe("shiftDateKey", () => {
  it("keeps the calendar date and turns 29 February into the 28th", () => {
    expect(shiftDateKey("2026-12-05", -1)).toBe("2025-12-05");
    expect(shiftDateKey("2028-02-29", -1)).toBe("2027-02-28");
  });
});

describe("buildNightPriceComparisons", () => {
  const prices = new Map([
    ["2026-12-05", 77],
    ["2025-12-05", 80],
    ["2025-12-08", 80],
  ]);
  const closures: CalendarClosureRecord[] = [
    {
      propertyName: "HomeXperience",
      unitName: "",
      date: "2025-11-20",
      reason: "Repairs",
      note: "",
      statusLabel: "",
      guestCount: 0,
      nights: 0,
    },
  ];

  it("shows last year's asking price and what the stay paid per night", () => {
    const result = buildNightPriceComparisons({
      dateKeys: ["2026-12-05", "2026-12-08", "2026-11-20"],
      prices,
      bookings: [booking({})],
      closures,
    });

    expect(result.get("2026-12-05")).toEqual({
      price: 77,
      lastYear: { price: 80, paid: 72, channel: "Booking.com", closed: false },
    });
    // Checkout day is free again.
    expect(result.get("2026-12-08")?.lastYear).toEqual({ price: 80, paid: null, channel: null, closed: false });
    expect(result.get("2026-11-20")?.lastYear.closed).toBe(true);
  });

  it("ignores canceled stays", () => {
    const result = buildNightPriceComparisons({
      dateKeys: ["2026-12-05"],
      prices,
      bookings: [booking({ overbookingStatus: "Canceled by guest" })],
      closures: [],
    });

    expect(result.get("2026-12-05")?.lastYear.paid).toBeNull();
  });
});

describe("pickCalendarPrices", () => {
  const prices = [
    { propertyName: "HomeXperience", channel: "Airbnb", date: "2026-12-05", price: 77 },
    { propertyName: "HomeXperience", channel: "Booking.com", date: "2026-12-05", price: 86 },
  ];

  it("prefers the filtered channel, then Airbnb", () => {
    expect(
      pickCalendarPrices({ prices, propertyNames: ["HomeXperience"], channel: "Booking.com" }).byDate,
    ).toEqual({ "2026-12-05": 86 });
    expect(pickCalendarPrices({ prices, propertyNames: ["HomeXperience"], channel: "all" }).byDate).toEqual({
      "2026-12-05": 77,
    });
  });

  it("shows nothing when several properties in view have prices", () => {
    const result = pickCalendarPrices({
      prices: [...prices, { propertyName: "Beach Flat", channel: "Airbnb", date: "2026-12-05", price: 120 }],
      propertyNames: ["HomeXperience", "Beach Flat"],
      channel: "all",
    });

    expect(result.propertyName).toBeNull();
    expect(result.byDate).toEqual({});
  });
});

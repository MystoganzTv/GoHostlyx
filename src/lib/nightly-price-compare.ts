// Compares each night's asked price with the same date a year earlier.
// Pure functions only, so the calendar can use them in the browser.

import { addYears, format, parseISO } from "date-fns";
import type { BookingRecord, CalendarClosureRecord } from "@/lib/types";

/** The same calendar date `years` later (negative: earlier). 29 Feb becomes 28 Feb. */
export function shiftDateKey(dateKey: string, years: number) {
  return format(addYears(parseISO(dateKey), years), "yyyy-MM-dd");
}

export type NightPriceComparison = {
  /** Price asked for this night, if one is saved. */
  price: number | null;
  lastYear: {
    /** Price asked for the same date last year, if one is saved. */
    price: number | null;
    /** Average paid per night by the stay that covered that date. */
    paid: number | null;
    channel: string | null;
    closed: boolean;
  };
};

function paidPerNight(booking: BookingRecord) {
  if (booking.nights > 0 && booking.rentalRevenue > 0) {
    return booking.rentalRevenue / booking.nights;
  }

  return booking.pricePerNight > 0 ? booking.pricePerNight : null;
}

/**
 * Builds, for each night in `dateKeys`, its saved price and what happened on
 * the same date a year earlier: the price asked, what the stay paid per night,
 * or that the place was closed.
 */
export function buildNightPriceComparisons({
  dateKeys,
  prices,
  bookings,
  closures,
}: {
  dateKeys: string[];
  prices: Map<string, number>;
  bookings: BookingRecord[];
  closures: CalendarClosureRecord[];
}) {
  const closedDates = new Set(closures.map((closure) => closure.date));
  const result = new Map<string, NightPriceComparison>();

  for (const dateKey of dateKeys) {
    const lastYearKey = shiftDateKey(dateKey, -1);
    const stay = bookings.find(
      (booking) =>
        booking.checkIn <= lastYearKey &&
        booking.checkout > lastYearKey &&
        !booking.overbookingStatus.toLowerCase().includes("cancel"),
    );

    result.set(dateKey, {
      price: prices.get(dateKey) ?? null,
      lastYear: {
        price: prices.get(lastYearKey) ?? null,
        paid: stay ? paidPerNight(stay) : null,
        channel: stay?.channel ?? null,
        closed: !stay && closedDates.has(lastYearKey),
      },
    });
  }

  return result;
}

/**
 * The calendar draws every listing on one grid, so it can only show one price
 * per night. Prices are shown when a single property in view has them; the
 * channel picked in the filter wins, then Airbnb, then whatever was uploaded.
 */
export function pickCalendarPrices({
  prices,
  propertyNames,
  channel,
}: {
  prices: Array<{ propertyName: string; channel: string; date: string; price: number }>;
  propertyNames: string[];
  channel: string | "all";
}) {
  const inView = new Set(propertyNames.map((name) => name.trim().toLowerCase()));
  const visible = prices.filter((item) => inView.has(item.propertyName.trim().toLowerCase()));
  const pricedProperties = Array.from(new Set(visible.map((item) => item.propertyName)));

  if (pricedProperties.length !== 1) {
    return { propertyName: null, channel: null, byDate: {} as Record<string, number> };
  }

  const channels = Array.from(new Set(visible.map((item) => item.channel)));
  const pickedChannel =
    (channel !== "all" && channels.includes(channel) ? channel : null) ??
    (channels.includes("Airbnb") ? "Airbnb" : channels.sort()[0]);
  const byDate: Record<string, number> = {};

  for (const item of visible) {
    if (item.channel === pickedChannel) {
      byDate[item.date] = item.price;
    }
  }

  return { propertyName: pricedProperties[0], channel: pickedChannel, byDate };
}

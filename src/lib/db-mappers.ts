// Pure row-mapping layer for the data access module.
// Translates raw DB rows (SQLite/Postgres/memory) into domain records.
// Extracted from db.ts; these functions have no module state or side effects.

import { differenceInCalendarDays, formatISO, isValid, parseISO, setYear } from "date-fns";
import { normalizeExpenseFields } from "./expense-normalization";
import type {
  BookingMatchStatus,
  BookingRecord,
  BookingReviewStatus,
  CalendarClosureRecord,
  CalendarEventRecord,
  CalendarEventSource,
  CalendarEventType,
  ExpenseRecord,
  FinancialDocumentRecord,
  FinancialDocumentSource,
  IcalFeedRecord,
  IcalFeedSyncStatus,
  ImportedFileSource,
  ImportSource,
  ImportSummary,
} from "./types";

export function getRowValue(row: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    if (key in row) {
      return row[key];
    }
  }

  return undefined;
}

export function normalizeTimestampValue(value: unknown, fallback: string) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
  }

  return fallback;
}

function repairLegacyBookingDate(value: string, relatedDate?: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  const parsed = parseISO(trimmed);
  if (!isValid(parsed)) {
    return trimmed;
  }

  const year = parsed.getUTCFullYear();
  if (year >= 2000) {
    return trimmed;
  }

  const related = relatedDate ? parseISO(relatedDate) : null;
  let targetYear = 2000 + year;

  if (related && isValid(related) && related.getUTCFullYear() >= 2000) {
    targetYear = related.getUTCFullYear();
    const sameYearDate = setYear(parsed, targetYear);

    if (isValid(sameYearDate) && sameYearDate > related) {
      targetYear -= 1;
    }
  }

  return formatISO(setYear(parsed, targetYear), { representation: "date" });
}

function calculateBookingNights(checkIn: string, checkOut: string) {
  if (!checkIn || !checkOut) {
    return 0;
  }

  const checkInDate = parseISO(checkIn);
  const checkOutDate = parseISO(checkOut);

  if (!isValid(checkInDate) || !isValid(checkOutDate)) {
    return 0;
  }

  return differenceInCalendarDays(checkOutDate, checkInDate);
}

export function mapImportSummary(row: Record<string, unknown>): ImportSummary {
  const importedAt = getRowValue(row, "importedAt", "importedat");
  const importedAtFallback = new Date().toISOString();

  return {
    id: Number(getRowValue(row, "id")),
    fileName: String(getRowValue(row, "fileName", "filename")),
    propertyName:
      String(getRowValue(row, "propertyName", "propertyname")) || "Default Property",
    source: String(getRowValue(row, "source")) as ImportSource,
    importedSource: String(
      getRowValue(row, "importedSource", "importedsource") ?? "generic_excel",
    ) as ImportedFileSource,
    importedAt: normalizeTimestampValue(importedAt, importedAtFallback),
    bookingsCount: Number(getRowValue(row, "bookingsCount", "bookingscount")),
    expensesCount: Number(getRowValue(row, "expensesCount", "expensescount")),
  };
}

export function mapBookingRecord(row: Record<string, unknown>): BookingRecord {
  const rawCheckIn = String(getRowValue(row, "checkIn", "checkin"));
  const rawCheckOut = String(getRowValue(row, "checkout"));
  const normalizedCheckOut = repairLegacyBookingDate(rawCheckOut);
  const normalizedCheckIn = repairLegacyBookingDate(
    rawCheckIn,
    normalizedCheckOut || rawCheckOut,
  );
  const derivedNights = calculateBookingNights(normalizedCheckIn, normalizedCheckOut);
  const storedNights = Number(getRowValue(row, "nights"));
  const rentalRevenue = Number(getRowValue(row, "rentalRevenue", "rentalrevenue"));
  const normalizedNights =
    derivedNights > 0 && (storedNights <= 0 || storedNights > 365 || Math.abs(storedNights - derivedNights) > 3)
      ? derivedNights
      : storedNights;
  const storedPricePerNight = Number(getRowValue(row, "pricePerNight", "pricepernight"));
  const normalizedPricePerNight =
    normalizedNights > 0 &&
    (!Number.isFinite(storedPricePerNight) ||
      storedPricePerNight <= 0 ||
      storedPricePerNight < 1 / 1000 ||
      (rentalRevenue > 0 && Math.abs(storedPricePerNight * normalizedNights - rentalRevenue) > Math.max(1, rentalRevenue * 0.05)))
      ? rentalRevenue / normalizedNights
      : storedPricePerNight;

  return {
    id: Number(getRowValue(row, "id")),
    importId: Number(getRowValue(row, "importId", "importid")),
    source: String(getRowValue(row, "source")) as ImportSource,
    importedSource: String(
      getRowValue(row, "importedSource", "importedsource") ?? "generic_excel",
    ) as ImportedFileSource,
    propertyId: Number(getRowValue(row, "propertyId", "propertyid")) || null,
    propertyName: String(getRowValue(row, "propertyName", "propertyname")) || "Default Property",
    unitName: String(getRowValue(row, "unitName", "unitname")),
    checkIn: normalizedCheckIn,
    checkout: normalizedCheckOut,
    guestName: String(getRowValue(row, "guestName", "guestname")),
    guestCount: Number(getRowValue(row, "guestCount", "guestcount")),
    guestContact: String(getRowValue(row, "guestContact", "guestcontact") ?? ""),
    bookedAt: String(getRowValue(row, "bookedAt", "bookedat") ?? ""),
    adultsCount: Number(getRowValue(row, "adultsCount", "adultscount") ?? 0),
    childrenCount: Number(getRowValue(row, "childrenCount", "childrencount") ?? 0),
    infantsCount: Number(getRowValue(row, "infantsCount", "infantscount") ?? 0),
    channel: String(getRowValue(row, "channel")),
    rentalPeriod: normalizedNights > 0 ? `${normalizedNights} nights` : String(getRowValue(row, "rentalPeriod", "rentalperiod")),
    pricePerNight: normalizedPricePerNight,
    extraFee: Number(getRowValue(row, "extraFee", "extrafee")),
    discount: Number(getRowValue(row, "discount")),
    rentalRevenue,
    cleaningFee: Number(getRowValue(row, "cleaningFee", "cleaningfee")),
    taxAmount: Number(getRowValue(row, "taxAmount", "taxamount")),
    totalRevenue: Number(getRowValue(row, "totalRevenue", "totalrevenue")),
    hostFee: Number(getRowValue(row, "hostFee", "hostfee")),
    payout: Number(getRowValue(row, "payout")),
    nights: normalizedNights,
    bookingNumber: String(getRowValue(row, "bookingNumber", "bookingnumber") ?? ""),
    overbookingStatus: String(
      getRowValue(row, "overbookingStatus", "overbookingstatus") ?? "",
    ),
    matchStatus: String(
      getRowValue(row, "matchStatus", "matchstatus") ?? "unmatched",
    ) as BookingMatchStatus,
    matchedCalendarEventId:
      Number(getRowValue(row, "matchedCalendarEventId", "matchedcalendareventid")) || null,
    reviewStatus: String(
      getRowValue(row, "reviewStatus", "reviewstatus") ?? "ready",
    ) as BookingReviewStatus,
    reviewReason: String(getRowValue(row, "reviewReason", "reviewreason") ?? ""),
  };
}

export function mapExpenseRecord(row: Record<string, unknown>): ExpenseRecord {
  const normalizedExpenseFields = normalizeExpenseFields({
    amountValue: getRowValue(row, "amount"),
    descriptionValue: getRowValue(row, "description"),
    noteValue: getRowValue(row, "note"),
  });

  return {
    id: Number(getRowValue(row, "id")),
    importId: Number(getRowValue(row, "importId", "importid")),
    source: String(getRowValue(row, "source")) as ImportSource,
    propertyName: String(getRowValue(row, "propertyName", "propertyname")) || "Default Property",
    unitName: String(getRowValue(row, "unitName", "unitname")),
    date: String(getRowValue(row, "date")),
    category: String(getRowValue(row, "category")),
    amount: normalizedExpenseFields.amount,
    description: normalizedExpenseFields.description,
    note: normalizedExpenseFields.note,
  };
}

export function mapCalendarClosureRecord(row: Record<string, unknown>): CalendarClosureRecord {
  return {
    id: Number(getRowValue(row, "id")),
    importId: Number(getRowValue(row, "importId", "importid")),
    source: String(getRowValue(row, "source")) as ImportSource,
    propertyName: String(getRowValue(row, "propertyName", "propertyname")) || "Default Property",
    unitName: String(getRowValue(row, "unitName", "unitname")),
    date: String(getRowValue(row, "date")),
    reason: String(getRowValue(row, "reason")),
    note: String(getRowValue(row, "note")),
    statusLabel:
      String(getRowValue(row, "statusLabel", "statuslabel")) || "Closed",
    guestCount: Number(getRowValue(row, "guestCount", "guestcount") ?? 0),
    nights: Number(getRowValue(row, "nights") ?? 0),
  };
}

export function mapFinancialDocumentRecord(row: Record<string, unknown>): FinancialDocumentRecord {
  return {
    id: Number(getRowValue(row, "id")),
    importId: Number(getRowValue(row, "importId", "importid")),
    propertyName:
      String(getRowValue(row, "propertyName", "propertyname")) || "Default Property",
    source: String(getRowValue(row, "source")) as FinancialDocumentSource,
    period: {
      start: String(getRowValue(row, "periodStart", "periodstart")),
      end: String(getRowValue(row, "periodEnd", "periodend")),
      label: String(getRowValue(row, "periodLabel", "periodlabel")),
    },
    totalPayout: Number(getRowValue(row, "totalPayout", "totalpayout") ?? 0),
    totalFees: Number(getRowValue(row, "totalFees", "totalfees") ?? 0),
    totalTaxes: Number(getRowValue(row, "totalTaxes", "totaltaxes") ?? 0),
    currency: String(getRowValue(row, "currency") ?? ""),
    rawData: String(getRowValue(row, "rawData", "rawdata") ?? "{}"),
    importedAt: normalizeTimestampValue(
      getRowValue(row, "importedAt", "importedat"),
      new Date().toISOString(),
    ),
  };
}

export function mapCalendarEventRecord(row: Record<string, unknown>): CalendarEventRecord {
  return {
    id: Number(getRowValue(row, "id")),
    importId: Number(getRowValue(row, "importId", "importid")),
    icalFeedId: Number(getRowValue(row, "icalFeedId", "icalfeedid")) || null,
    propertyId: Number(getRowValue(row, "propertyId", "propertyid")) || null,
    propertyName: String(getRowValue(row, "propertyName", "propertyname")) || "Default Property",
    unitName: String(getRowValue(row, "unitName", "unitname") ?? ""),
    source: String(getRowValue(row, "source") ?? "other") as CalendarEventSource,
    externalEventId: String(getRowValue(row, "externalEventId", "externaleventid") ?? ""),
    summary: String(getRowValue(row, "summary") ?? ""),
    description: String(getRowValue(row, "description") ?? ""),
    startDate: String(getRowValue(row, "startDate", "startdate") ?? ""),
    endDate: String(getRowValue(row, "endDate", "enddate") ?? ""),
    eventType: String(getRowValue(row, "eventType", "eventtype") ?? "unknown") as CalendarEventType,
    linkedBookingId: Number(getRowValue(row, "linkedBookingId", "linkedbookingid")) || null,
    lastSyncedAt: normalizeTimestampValue(
      getRowValue(row, "lastSyncedAt", "lastsyncedat"),
      new Date().toISOString(),
    ),
  };
}

export function mapIcalFeedRecord(row: Record<string, unknown>): IcalFeedRecord {
  return {
    id: Number(getRowValue(row, "id")),
    workspaceId: String(getRowValue(row, "workspaceId", "workspaceid") ?? ""),
    propertyId: Number(getRowValue(row, "propertyId", "propertyid") ?? 0),
    listingId: Number(getRowValue(row, "listingId", "listingid")) || null,
    propertyName: String(getRowValue(row, "propertyName", "propertyname") ?? "Default Property"),
    listingName: String(getRowValue(row, "listingName", "listingname") ?? ""),
    source: String(getRowValue(row, "source") ?? "other") as CalendarEventSource,
    feedUrl: String(getRowValue(row, "feedUrl", "feedurl") ?? ""),
    isActive: Boolean(getRowValue(row, "isActive", "isactive", "is_active") ?? true),
    lastSyncedAt: normalizeTimestampValue(
      getRowValue(row, "lastSyncedAt", "lastsyncedat"),
      "",
    ) || null,
    lastSyncStatus: String(
      getRowValue(row, "lastSyncStatus", "lastsyncstatus") ?? "never",
    ) as IcalFeedSyncStatus,
    lastError: String(getRowValue(row, "lastError", "lasterror") ?? "") || null,
    eventCount: Number(getRowValue(row, "eventCount", "eventcount") ?? 0),
  };
}

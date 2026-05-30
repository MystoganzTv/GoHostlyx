import { differenceInCalendarDays, parseISO } from "date-fns";
import type { CalendarEventRecord } from "@/lib/types";
import type {
  ImportBookingCandidate,
  ImportBookingRowStatus,
  ImportCalendarMatch,
  ImportValidationWarning,
} from "./types";

type MatchType = ImportCalendarMatch["matchType"];

function normalizeText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizeChannel(value: string) {
  const normalized = normalizeText(value);

  if (normalized.includes("airbnb")) {
    return "airbnb";
  }

  if (normalized.includes("booking")) {
    return "booking";
  }

  if (normalized.includes("vrbo")) {
    return "vrbo";
  }

  if (normalized.includes("direct")) {
    return "direct";
  }

  return null;
}

function overlaps(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
) {
  return startA < endB && endA > startB;
}

function getDayDistance(left: string, right: string) {
  return Math.abs(differenceInCalendarDays(parseISO(left), parseISO(right)));
}

function getPropertyRelationship(
  booking: ImportBookingCandidate["booking"],
  event: CalendarEventRecord,
) {
  if (booking.propertyId && event.propertyId) {
    return booking.propertyId === event.propertyId ? "same" : "different";
  }

  const bookingProperty = normalizeText(booking.propertyName);
  const eventProperty = normalizeText(event.propertyName);

  if (!bookingProperty || !eventProperty) {
    return "unknown";
  }

  return bookingProperty === eventProperty ? "same" : "different";
}

function getListingRelationship(
  booking: ImportBookingCandidate["booking"],
  event: CalendarEventRecord,
) {
  const bookingListing = normalizeText(booking.unitName ?? "");
  const eventListing = normalizeText(event.unitName ?? "");

  if (!bookingListing || !eventListing) {
    return "unknown";
  }

  return bookingListing === eventListing ? "same" : "different";
}

function isPropertyCompatible(
  booking: ImportBookingCandidate["booking"],
  event: CalendarEventRecord,
) {
  if (getPropertyRelationship(booking, event) === "different") {
    return false;
  }

  return getListingRelationship(booking, event) !== "different";
}

function getEventChannel(event: CalendarEventRecord) {
  if (event.source === "other") {
    const inferred = normalizeChannel(event.summary);
    return inferred || null;
  }

  return normalizeChannel(event.source);
}

function getEventNights(event: CalendarEventRecord) {
  return Math.max(0, differenceInCalendarDays(parseISO(event.endDate), parseISO(event.startDate)));
}

function getBigrams(value: string) {
  const compact = normalizeText(value).replace(/[^a-z0-9]/g, "");
  if (compact.length < 2) {
    return compact ? new Set([compact]) : new Set<string>();
  }

  const bigrams = new Set<string>();
  for (let index = 0; index < compact.length - 1; index += 1) {
    bigrams.add(compact.slice(index, index + 2));
  }
  return bigrams;
}

function getGuestSimilarity(guestName: string, summary: string) {
  const left = normalizeText(guestName);
  const right = normalizeText(summary);

  if (!left || !right) {
    return 0;
  }

  if (left === right || right.includes(left) || left.includes(right)) {
    return 1;
  }

  const leftBigrams = getBigrams(left);
  const rightBigrams = getBigrams(right);

  if (leftBigrams.size === 0 || rightBigrams.size === 0) {
    return 0;
  }

  let overlapCount = 0;
  leftBigrams.forEach((bigram) => {
    if (rightBigrams.has(bigram)) {
      overlapCount += 1;
    }
  });

  return (2 * overlapCount) / (leftBigrams.size + rightBigrams.size);
}

function collectMatchReasons(
  booking: ImportBookingCandidate["booking"],
  calendarEvent: CalendarEventRecord,
  isConflict: boolean,
) {
  const reasons: string[] = [];

  if (isConflict) {
    reasons.push("Overlaps blocked dates");
    return reasons;
  }

  if (getReferenceScore(booking.bookingReference, calendarEvent) === 100) {
    reasons.push("Booking reference matches");
    return reasons;
  }

  const checkInDiff = getDayDistance(booking.checkIn, calendarEvent.startDate);
  if (checkInDiff === 0) {
    reasons.push("Same check-in date");
  } else if (checkInDiff <= 2) {
    reasons.push(`Check-in is within ${checkInDiff} day${checkInDiff === 1 ? "" : "s"}`);
  }

  const checkOutDiff = getDayDistance(booking.checkOut, calendarEvent.endDate);
  if (checkOutDiff === 0) {
    reasons.push("Same check-out date");
  } else if (checkOutDiff <= 2) {
    reasons.push(`Check-out is within ${checkOutDiff} day${checkOutDiff === 1 ? "" : "s"}`);
  }

  const propertyRelationship = getPropertyRelationship(booking, calendarEvent);
  if (propertyRelationship === "same") {
    reasons.push("Same property");
  } else if (propertyRelationship === "unknown") {
    reasons.push("Property was not available on one side");
  }

  const listingRelationship = getListingRelationship(booking, calendarEvent);
  if (listingRelationship === "same") {
    reasons.push("Same listing");
  } else if (listingRelationship === "unknown" && (booking.unitName || calendarEvent.unitName)) {
    reasons.push("Listing was not available on one side");
  }

  const bookingChannel = normalizeChannel(booking.channel);
  const eventChannel = getEventChannel(calendarEvent);
  if (bookingChannel && eventChannel && bookingChannel === eventChannel) {
    reasons.push("Same channel");
  } else if (!bookingChannel || !eventChannel) {
    reasons.push("Channel is unknown on one side");
  }

  const eventNights = getEventNights(calendarEvent);
  if (booking.nights === eventNights) {
    reasons.push("Same stay length");
  } else if (Math.abs(booking.nights - eventNights) === 1) {
    reasons.push("Similar stay length");
  }

  const guestSimilarity = getGuestSimilarity(booking.guestName, calendarEvent.summary);
  if (guestSimilarity > 0.8) {
    reasons.push("Guest name is highly similar");
  } else if (guestSimilarity > 0.5) {
    reasons.push("Guest name is somewhat similar");
  }

  return reasons;
}

function getReferenceScore(
  bookingReference: string,
  event: CalendarEventRecord,
) {
  const normalizedReference = normalizeText(bookingReference);
  if (!normalizedReference) {
    return 0;
  }

  const externalEventId = normalizeText(event.externalEventId);
  const summary = normalizeText(event.summary);

  if (
    normalizedReference === externalEventId ||
    normalizedReference === summary ||
    (externalEventId && externalEventId.includes(normalizedReference)) ||
    (summary && summary.includes(normalizedReference))
  ) {
    return 100;
  }

  return 0;
}

export function calculateMatchScore(
  booking: ImportBookingCandidate["booking"],
  calendarEvent: CalendarEventRecord,
): {
  score: number;
  matchType: MatchType;
  isConflict: boolean;
} {
  if (
    calendarEvent.eventType === "blocked" &&
    isPropertyCompatible(booking, calendarEvent) &&
    overlaps(booking.checkIn, booking.checkOut, calendarEvent.startDate, calendarEvent.endDate)
  ) {
    return {
      score: 0,
      matchType: "conflict",
      isConflict: true,
    };
  }

  const referenceScore = getReferenceScore(booking.bookingReference, calendarEvent);
  if (referenceScore === 100) {
    return {
      score: 100,
      matchType: "exact",
      isConflict: false,
    };
  }

  let score = 0;

  const checkInDiff = getDayDistance(booking.checkIn, calendarEvent.startDate);
  if (checkInDiff === 0) {
    score += 40;
  } else if (checkInDiff === 1) {
    score += 25;
  } else if (checkInDiff === 2) {
    score += 10;
  }

  const checkOutDiff = getDayDistance(booking.checkOut, calendarEvent.endDate);
  if (checkOutDiff === 0) {
    score += 30;
  } else if (checkOutDiff === 1) {
    score += 20;
  } else if (checkOutDiff === 2) {
    score += 10;
  }

  const propertyRelationship = getPropertyRelationship(booking, calendarEvent);
  if (propertyRelationship === "same") {
    score += 20;
  } else if (propertyRelationship === "unknown") {
    score += 5;
  }

  const listingRelationship = getListingRelationship(booking, calendarEvent);
  if (listingRelationship === "same") {
    score += 15;
  } else if (listingRelationship === "unknown" && (booking.unitName || calendarEvent.unitName)) {
    score += 3;
  }

  const bookingChannel = normalizeChannel(booking.channel);
  const eventChannel = getEventChannel(calendarEvent);
  if (bookingChannel && eventChannel && bookingChannel === eventChannel) {
    score += 10;
  } else if (!bookingChannel || !eventChannel) {
    score += 5;
  }

  const eventNights = getEventNights(calendarEvent);
  if (booking.nights === eventNights) {
    score += 10;
  } else if (Math.abs(booking.nights - eventNights) === 1) {
    score += 5;
  }

  const guestSimilarity = getGuestSimilarity(booking.guestName, calendarEvent.summary);
  if (guestSimilarity > 0.8) {
    score += 10;
  } else if (guestSimilarity > 0.5) {
    score += 5;
  }

  if (score >= 90) {
    return {
      score,
      matchType: "exact",
      isConflict: false,
    };
  }

  if (score >= 70) {
    return {
      score,
      matchType: "probable",
      isConflict: false,
    };
  }

  if (score >= 40) {
    return {
      score,
      matchType: "weak",
      isConflict: false,
    };
  }

  return {
    score,
    matchType: "none",
    isConflict: false,
  };
}

function buildMatch(
  row: ImportBookingCandidate,
  event: CalendarEventRecord,
  scoreResult: ReturnType<typeof calculateMatchScore>,
): ImportCalendarMatch {
  if (scoreResult.isConflict) {
    return {
      rowIndex: row.rowIndex,
      matchType: "conflict",
      score: scoreResult.score,
      isConflict: true,
      calendarEventId: Number(event.id ?? 0),
      source: event.source,
      summary: event.summary,
      startDate: event.startDate,
      endDate: event.endDate,
      eventType: event.eventType,
      message: "This booking overlaps a blocked calendar event.",
      reasons: collectMatchReasons(row.booking, event, true),
    };
  }

  return {
    rowIndex: row.rowIndex,
    matchType: scoreResult.matchType,
    score: scoreResult.score,
    isConflict: false,
    calendarEventId: Number(event.id ?? 0),
    source: event.source,
    summary: event.summary,
    startDate: event.startDate,
    endDate: event.endDate,
    eventType: event.eventType,
    message:
      scoreResult.matchType === "exact"
        ? `This booking matches a calendar event with a score of ${scoreResult.score}.`
        : scoreResult.matchType === "probable"
          ? `This booking likely matches a calendar event with a score of ${scoreResult.score}.`
          : `This booking may match a calendar event with a score of ${scoreResult.score}.`,
    reasons: collectMatchReasons(row.booking, event, false),
  };
}

function buildWeakMatchWarning(match: ImportCalendarMatch): ImportValidationWarning {
  return {
    rowType: "booking",
    rowIndex: match.rowIndex,
    code: "weak_calendar_match",
    message: `${match.message} Review it before relying on the calendar link.`,
    severity: "warning",
  };
}

export function matchBookingsToCalendar(
  rows: ImportBookingCandidate[],
  calendarEvents: CalendarEventRecord[],
) {
  const calendarMatches: ImportCalendarMatch[] = [];
  const matchedRows = rows.map((row) => {
    const compatibleEvents = calendarEvents.filter((event) =>
      isPropertyCompatible(row.booking, event),
    );

    const blockedConflict = compatibleEvents.find((event) => {
      const scoreResult = calculateMatchScore(row.booking, event);
      return scoreResult.isConflict;
    });

    if (blockedConflict) {
      const calendarMatch = buildMatch(row, blockedConflict, {
        score: 0,
        matchType: "conflict",
        isConflict: true,
      });
      calendarMatches.push(calendarMatch);
      return {
        ...row,
        calendarMatch,
        rowStatus: "conflict" as ImportBookingRowStatus,
      };
    }

    const bestMatch = compatibleEvents
      .filter((event) => event.eventType !== "blocked")
      .map((event) => ({
        event,
        result: calculateMatchScore(row.booking, event),
      }))
      .sort((left, right) => right.result.score - left.result.score)[0];

    if (!bestMatch || bestMatch.result.matchType === "none") {
      return {
        ...row,
        rowStatus: "new" as ImportBookingRowStatus,
      };
    }

    const calendarMatch = buildMatch(row, bestMatch.event, bestMatch.result);

    if (bestMatch.result.matchType === "weak") {
      calendarMatches.push(calendarMatch);
      return {
        ...row,
        calendarMatch,
        warnings: [...row.warnings, buildWeakMatchWarning(calendarMatch)],
        rowStatus: "new" as ImportBookingRowStatus,
      };
    }

    calendarMatches.push(calendarMatch);
    return {
      ...row,
      calendarMatch,
      rowStatus: "matched" as ImportBookingRowStatus,
    };
  });

  return {
    bookings: matchedRows,
    calendarMatches,
  };
}

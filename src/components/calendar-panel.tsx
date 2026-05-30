"use client";

import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isSameMonth,
  isWithinInterval,
  max,
  min,
  parseISO,
  startOfDay,
  startOfMonth,
} from "date-fns";
import Link from "next/link";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { BookingChannelBadge, BookingStatusBadge } from "@/components/booking-badges";
import { useLocale } from "@/components/locale-provider";
import { formatCurrency, formatDateLabel, formatNumber } from "@/lib/format";
import { getBookingStatusState } from "@/lib/booking-status";
import { getDateFnsLocale } from "@/lib/i18n";
import { Modal } from "@/components/modal";
import type {
  BookingRecord,
  CalendarEventRecord,
  CalendarClosureRecord,
  CurrencyCode,
} from "@/lib/types";

const weekdayLabels = {
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  es: ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"],
};

type CalendarTimelineItem = {
  id: string;
  startDate: string;
  endDate: string;
  label: string;
  channel: string;
  variant: "financial_booking" | "calendar_booking" | "blocked_conflict";
  sourceStatus: "manual" | "imported" | "synced" | "merged";
  booking?: BookingRecord;
  calendarEvent?: CalendarEventRecord;
};

type TimelineBuildResult = {
  items: CalendarTimelineItem[];
  linkedCalendarEventByBookingKey: Map<string, CalendarEventRecord>;
};

function buildCalendarDays(anchor: Date) {
  const monthStart = startOfMonth(anchor);
  const monthEnd = endOfMonth(anchor);
  const startOffset = getDay(monthStart);
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - startOffset);
  const endOffset = 6 - getDay(monthEnd);
  const gridEnd = new Date(monthEnd);
  gridEnd.setDate(monthEnd.getDate() + endOffset);

  return eachDayOfInterval({ start: gridStart, end: gridEnd });
}

function chunkWeeks(days: Date[]) {
  const weeks: Date[][] = [];

  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7));
  }

  return weeks;
}

function getBookingTone(channel: string, variant: CalendarTimelineItem["variant"] = "financial_booking") {
  if (variant === "blocked_conflict") {
    return "border-rose-300/22 bg-[linear-gradient(180deg,rgba(251,113,133,0.2)_0%,rgba(67,24,39,0.88)_100%)] text-white";
  }

  if (variant === "calendar_booking") {
    return "border-slate-300/18 bg-[linear-gradient(180deg,rgba(148,163,184,0.16)_0%,rgba(36,47,63,0.86)_100%)] text-slate-100";
  }

  const normalized = channel.trim().toLowerCase();

  if (normalized.includes("airbnb")) {
    return "border-emerald-300/18 bg-[linear-gradient(180deg,rgba(88,196,182,0.22)_0%,rgba(38,76,91,0.78)_100%)] text-white";
  }

  if (normalized.includes("booking")) {
    return "border-sky-300/18 bg-[linear-gradient(180deg,rgba(92,153,255,0.22)_0%,rgba(28,45,82,0.82)_100%)] text-white";
  }

  if (normalized.includes("direct")) {
    return "border-amber-200/16 bg-[linear-gradient(180deg,rgba(244,198,105,0.18)_0%,rgba(77,58,29,0.82)_100%)] text-white";
  }

  return "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.12)_0%,rgba(31,41,55,0.88)_100%)] text-white";
}

function normalizeMatchToken(value: string) {
  return value.trim().toLowerCase();
}

function normalizeChannelToken(value: string) {
  const normalized = normalizeMatchToken(value);

  if (!normalized) {
    return "";
  }

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

  return normalized;
}

function getGuestLabel(booking: BookingRecord) {
  const primary = booking.guestName.trim().split(/\s+/)[0] || "Guest";
  const extraGuests = Math.max(0, booking.guestCount - 1);

  return extraGuests > 0 ? `${primary} + ${extraGuests}` : primary;
}

function getGuestBreakdownLabel(booking: BookingRecord) {
  const adults = Math.max(0, booking.adultsCount ?? 0);
  const children = Math.max(0, booking.childrenCount ?? 0);
  const infants = Math.max(0, booking.infantsCount ?? 0);

  if (adults + children + infants <= 0) {
    return "";
  }

  return `A ${adults} · C ${children} · I ${infants}`;
}

function isSameProperty(booking: BookingRecord, event: CalendarEventRecord) {
  if (booking.propertyId && event.propertyId) {
    return booking.propertyId === event.propertyId;
  }

  return normalizeMatchToken(booking.propertyName) === normalizeMatchToken(event.propertyName);
}

function isSameListing(booking: BookingRecord, event: CalendarEventRecord) {
  const bookingListing = normalizeMatchToken(booking.unitName);
  const eventListing = normalizeMatchToken(event.unitName);

  if (bookingListing && eventListing) {
    return bookingListing === eventListing;
  }

  return true;
}

function isSameStayWindow(booking: BookingRecord, event: CalendarEventRecord) {
  return booking.checkIn === event.startDate && booking.checkout === event.endDate;
}

function extractReservationUrl(description: string) {
  const match = description.match(/Reservation URL:\s*(https?:\/\/\S+)/i);
  return match?.[1]?.trim() ?? "";
}

function extractReservationCode(description: string) {
  const reservationUrl = extractReservationUrl(description);

  if (!reservationUrl) {
    return "";
  }

  try {
    const parsed = new URL(reservationUrl);
    const match = parsed.pathname.match(/\/details\/([^/?#]+)/i);
    return match?.[1]?.trim() ?? "";
  } catch {
    const match = reservationUrl.match(/\/details\/([^/?#]+)/i);
    return match?.[1]?.trim() ?? "";
  }
}

function getCalendarEventReferenceTokens(event: CalendarEventRecord) {
  const tokens = new Set<string>();
  const reservationCode = normalizeMatchToken(extractReservationCode(event.description));
  const externalEventId = normalizeMatchToken(event.externalEventId);

  if (reservationCode) {
    tokens.add(reservationCode);
  }

  if (externalEventId) {
    tokens.add(externalEventId);
  }

  return tokens;
}

function extractPhoneLast4(description: string) {
  const match = description.match(/Phone Number \(Last 4 Digits\):\s*(\d{4})/i);
  return match?.[1]?.trim() ?? "";
}

function extractGuestName(description: string) {
  const patterns = [
    /^(?:guest|guest name|name|booker|reserved for):\s*(.+)$/im,
    /^traveler:\s*(.+)$/im,
  ];

  for (const pattern of patterns) {
    const match = description.match(pattern)?.[1]?.trim();

    if (match) {
      return match;
    }
  }

  return "";
}

function isGenericCalendarSummary(summary: string) {
  const normalized = summary.trim().toLowerCase();

  return (
    !normalized ||
    normalized === "reserved" ||
    normalized === "booked" ||
    normalized === "booking" ||
    normalized === "calendar booking" ||
    normalized === "imported ical event"
  );
}

function getSourceGuestFallback(source: string) {
  const normalized = source.trim();

  if (!normalized) {
    return "Reserved guest";
  }

  return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)} guest`;
}

function getCalendarEventDisplayName(event: CalendarEventRecord) {
  const guestName = extractGuestName(event.description);

  if (guestName) {
    return guestName;
  }

  const summary = event.summary.trim();
  if (!isGenericCalendarSummary(summary)) {
    return summary;
  }

  return getSourceGuestFallback(event.source);
}

function getCalendarEventStayTitle(event: CalendarEventRecord) {
  const guestName = extractGuestName(event.description);

  if (guestName) {
    return guestName;
  }

  const summary = event.summary.trim();
  if (!isGenericCalendarSummary(summary)) {
    return summary;
  }

  return event.eventType === "blocked" ? "Blocked dates" : "Reserved";
}

function getTimelineSourceLabel(item: CalendarTimelineItem, locale: "en" | "es") {
  const isSpanish = locale === "es";

  switch (item.sourceStatus) {
    case "manual":
      return isSpanish ? "manual" : "manual";
    case "imported":
      return isSpanish ? "importada" : "imported";
    case "merged":
      return item.booking?.source === "manual"
        ? isSpanish
          ? "sync + manual"
          : "sync + manual"
        : isSpanish
          ? "sync + import"
          : "sync + import";
    case "synced":
    default:
      return isSpanish ? "sync" : "synced";
  }
}

function getBookingSourceStatus(booking: BookingRecord, linkedCalendarEvent?: CalendarEventRecord | null) {
  if (linkedCalendarEvent) {
    return "merged" as const;
  }

  return booking.source === "manual" ? ("manual" as const) : ("imported" as const);
}

function findLinkedCalendarEventForBooking(
  booking: BookingRecord,
  calendarEvents: CalendarEventRecord[],
  usedCalendarEventIds: Set<number>,
) {
  const bookingReference = normalizeMatchToken(booking.bookingNumber);
  const bookingChannel = normalizeChannelToken(booking.channel);

  const candidates = calendarEvents
    .filter((event) => event.eventType === "booking")
    .filter((event) => {
      const eventId = Number(event.id ?? 0);

      if (eventId > 0 && usedCalendarEventIds.has(eventId)) {
        return false;
      }

      return true;
    })
    .map((event) => {
      let score = 0;

      if (booking.matchedCalendarEventId && event.id === booking.matchedCalendarEventId) {
        score += 1000;
      }

      if (booking.id && event.linkedBookingId && booking.id === event.linkedBookingId) {
        score += 950;
      }

      const referenceTokens = getCalendarEventReferenceTokens(event);
      if (bookingReference && referenceTokens.has(bookingReference)) {
        score += 800;
      }

      if (!isSameProperty(booking, event)) {
        return { event, score: -1 };
      }

      score += 120;

      if (!isSameListing(booking, event)) {
        return { event, score: -1 };
      }

      score += 90;

      if (!isSameStayWindow(booking, event)) {
        return { event, score: -1 };
      }

      score += 260;

      const eventChannel = normalizeChannelToken(event.source);
      if (bookingChannel && eventChannel && bookingChannel === eventChannel) {
        score += 70;
      } else if (bookingChannel && eventChannel && bookingChannel !== eventChannel) {
        return { event, score: -1 };
      }

      return { event, score };
    })
    .filter((candidate) => candidate.score >= 450)
    .sort((left, right) => right.score - left.score);

  return candidates[0]?.event ?? null;
}

function getCalendarEventNotes(description: string) {
  return description
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) =>
        line &&
        !line.toLowerCase().startsWith("reservation url:") &&
        !line.toLowerCase().startsWith("phone number (last 4 digits):"),
    );
}

function buildTimelineItems(
  bookings: BookingRecord[],
  calendarEvents: CalendarEventRecord[],
) : TimelineBuildResult {
  const usedCalendarEventIds = new Set<number>();
  const linkedCalendarEventByBookingKey = new Map<string, CalendarEventRecord>();

  const bookingItems: CalendarTimelineItem[] = bookings.map((booking) => {
    const linkedCalendarEvent = findLinkedCalendarEventForBooking(booking, calendarEvents, usedCalendarEventIds);

    if (linkedCalendarEvent?.id) {
      usedCalendarEventIds.add(linkedCalendarEvent.id);
      linkedCalendarEventByBookingKey.set(getBookingSelectionKey(booking), linkedCalendarEvent);
    }

    return {
      id: `booking-${booking.id ?? booking.bookingNumber}-${booking.checkIn}`,
      startDate: booking.checkIn,
      endDate: booking.checkout,
      label: getGuestLabel(booking),
      channel: booking.channel,
      variant:
        booking.matchStatus === "conflict_blocked_calendar" ? "blocked_conflict" : "financial_booking",
      sourceStatus: getBookingSourceStatus(booking, linkedCalendarEvent),
      booking,
      calendarEvent: linkedCalendarEvent ?? undefined,
    };
  });

  const calendarBookingItems: CalendarTimelineItem[] = calendarEvents
    .filter((event) => {
      if (event.eventType !== "booking") {
        return false;
      }

      const eventId = Number(event.id ?? 0);

      if (eventId > 0 && usedCalendarEventIds.has(eventId)) {
        return false;
      }

      return !event.linkedBookingId;
    })
    .map((event) => ({
      id: `calendar-${event.id ?? event.externalEventId}-${event.startDate}`,
      startDate: event.startDate,
      endDate: event.endDate,
      label: getCalendarEventDisplayName(event),
      channel: event.source,
      variant: "calendar_booking" as const,
      sourceStatus: "synced" as const,
      calendarEvent: event,
    }));

  return {
    items: [...bookingItems, ...calendarBookingItems],
    linkedCalendarEventByBookingKey,
  };
}

function getScrollContainer(node: HTMLElement | null) {
  let current = node?.parentElement ?? null;

  while (current) {
    const { overflowY } = window.getComputedStyle(current);

    if (overflowY === "auto" || overflowY === "scroll") {
      return current;
    }

    current = current.parentElement;
  }

  return null;
}

function getWorkspaceScrollRegion() {
  const region = document.querySelector('[data-workspace-scroll-region="true"]');
  return region instanceof HTMLElement ? region : null;
}

function isScrollableElement(element: HTMLElement | null) {
  if (!element) {
    return false;
  }

  const styles = window.getComputedStyle(element);
  const allowsScroll = styles.overflowY === "auto" || styles.overflowY === "scroll";

  return allowsScroll && element.scrollHeight > element.clientHeight + 4;
}

function buildBlockedDateSet(
  anchorDate: Date,
  closures: CalendarClosureRecord[],
  calendarEvents: CalendarEventRecord[],
) {
  const blockedDates = new Set(closures.map((closure) => closure.date));

  calendarEvents
    .filter((event) => event.eventType === "blocked")
    .forEach((event) => {
      const start = parseISO(event.startDate);
      const endExclusive = parseISO(event.endDate);

      if (Number.isNaN(start.getTime()) || Number.isNaN(endExclusive.getTime())) {
        return;
      }

      const effectiveEnd = addDays(endExclusive, -1);
      if (effectiveEnd < start) {
        return;
      }

      eachDayOfInterval({ start, end: effectiveEnd }).forEach((day) => {
        if (isSameMonth(day, anchorDate)) {
          blockedDates.add(format(day, "yyyy-MM-dd"));
        }
      });
    });

  return blockedDates;
}

function getBookingSelectionKey(booking: BookingRecord) {
  if (booking.id) {
    return `id-${booking.id}`;
  }

  return [
    booking.checkIn,
    booking.checkout,
    booking.guestName.trim().toLowerCase(),
    booking.bookingNumber.trim().toLowerCase(),
    booking.propertyName.trim().toLowerCase(),
  ].join("__");
}

function buildTrimmedWeekBookingSegments(
  weekDays: Date[],
  items: CalendarTimelineItem[],
  anchorDate: Date,
) {
  const monthStart = startOfMonth(anchorDate);
  const monthEndExclusive = addDays(endOfMonth(anchorDate), 1);
  const weekStart = weekDays[0];
  const weekEnd = weekDays[6];
  const weekEndExclusive = addDays(weekEnd, 1);

  const visibleItems = items
    .filter((item) => {
      const stayStart = parseISO(item.startDate);
      const stayEnd = parseISO(item.endDate);
      return stayStart < weekEndExclusive && stayEnd > weekStart;
    })
    .sort((left, right) => {
      if (left.startDate !== right.startDate) {
        return left.startDate.localeCompare(right.startDate);
      }

      return left.endDate.localeCompare(right.endDate);
    });

  const trackEnds: number[] = [];

  const segments = visibleItems.flatMap((item) => {
    const stayStart = parseISO(item.startDate);
    const stayEnd = parseISO(item.endDate);
    const segmentStart = max([stayStart, weekStart, monthStart]);
    const segmentEnd = min([stayEnd, weekEndExclusive, monthEndExclusive]);

    if (segmentEnd <= segmentStart) {
      return [];
    }

    const startIndex = differenceInCalendarDays(segmentStart, weekStart);
    const span = Math.max(1, differenceInCalendarDays(segmentEnd, segmentStart));

    let track = trackEnds.findIndex((trackEnd) => trackEnd <= startIndex);

    if (track === -1) {
      track = trackEnds.length;
      trackEnds.push(0);
    }

    trackEnds[track] = startIndex + span;

    return [
      {
        item,
        startIndex,
        span,
        track,
        startsThisWeek: stayStart >= weekStart && stayStart < weekEndExclusive,
        endsThisWeek: stayEnd > weekStart && stayEnd <= weekEndExclusive,
      },
    ];
  });

  return {
    segments,
    maxTracks: Math.max(segments.reduce((highest, segment) => Math.max(highest, segment.track + 1), 0), 1),
  };
}

function MonthCalendar({
  anchorDate,
  calendarEvents,
  closures,
  timelineItems,
  compact = false,
  abbreviatedTitle = false,
  onSelectBooking,
  onSelectCalendarEvent,
}: {
  anchorDate: Date;
  calendarEvents: CalendarEventRecord[];
  closures: CalendarClosureRecord[];
  timelineItems: CalendarTimelineItem[];
  compact?: boolean;
  abbreviatedTitle?: boolean;
  onSelectBooking: (booking: BookingRecord) => void;
  onSelectCalendarEvent: (event: CalendarEventRecord) => void;
}) {
  const { locale } = useLocale();
  const isSpanish = locale === "es";
  const dateFnsLocale = getDateFnsLocale(locale);
  const days = buildCalendarDays(anchorDate);
  const weeks = chunkWeeks(days);
  const monthLabel = format(anchorDate, abbreviatedTitle ? "MMMM" : "MMMM yyyy", { locale: dateFnsLocale });
  const monthKey = format(anchorDate, "yyyy-MM");
  const isPastMonth = endOfMonth(anchorDate) < startOfMonth(startOfDay(new Date()));
  const monthTimelineItems = timelineItems.filter((item) => {
    const stayStart = parseISO(item.startDate);
    const stayEnd = parseISO(item.endDate);
    const monthStart = startOfMonth(anchorDate);
    const monthEnd = endOfMonth(anchorDate);
    return stayStart <= monthEnd && stayEnd > monthStart;
  });
  const checkIns = monthTimelineItems.filter((item) => item.startDate.startsWith(monthKey));
  const checkOuts = monthTimelineItems.filter((item) => item.endDate.startsWith(monthKey));
  const blockedDateSet = buildBlockedDateSet(anchorDate, closures, calendarEvents);

  return (
    <section
      className={`space-y-4 border-t border-white/6 py-8 first:border-t-0 first:pt-0 ${
        isPastMonth ? "opacity-55 [filter:grayscale(0.5)]" : ""
      }`}
    >
      <div className="flex flex-col gap-3 border-b border-white/6 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-[-0.05em] text-[var(--workspace-text)]">
            {monthLabel}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--workspace-muted)]">
            {formatNumber(checkIns.length, locale)} {isSpanish ? "check-ins" : "check-ins"},{" "}
            {formatNumber(checkOuts.length, locale)} {isSpanish ? "check-outs" : "check-outs"},{" "}
            {formatNumber(blockedDateSet.size, locale)} {isSpanish ? "días cerrados" : "closed days"}
          </p>
        </div>

        {isPastMonth ? (
          <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
            {isSpanish ? "Mes pasado" : "Past month"}
          </span>
        ) : null}
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-7 gap-2">
          {weekdayLabels[locale].map((label) => (
            <div
              key={`${monthKey}-${label}`}
              className={`px-2 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)] ${compact ? "pb-1" : "pb-2"}`}
            >
              {label}
            </div>
          ))}
        </div>

        <div className="space-y-2.5">
          {weeks.map((weekDays) => {
            const { segments, maxTracks } = buildTrimmedWeekBookingSegments(weekDays, monthTimelineItems, anchorDate);
            const rowHeight = compact ? Math.max(88, 38 + maxTracks * 26) : Math.max(124, 48 + maxTracks * 32);
            const barHeight = compact ? 22 : 28;
            const overlayTop = compact ? 34 : 40;

            return (
              <div key={format(weekDays[0], "yyyy-MM-dd")} className="relative" style={{ height: rowHeight }}>
                <div className="grid h-full grid-cols-7 gap-2">
                  {weekDays.map((day) => {
                    const dayKey = format(day, "yyyy-MM-dd");
                    const dayClosure = blockedDateSet.has(dayKey);
                    const isCurrentMonth = isSameMonth(day, anchorDate);

                    if (!isCurrentMonth) {
                      return <div key={dayKey} aria-hidden="true" className="h-full" />;
                    }

                    return (
                      <article
                        key={dayKey}
                        className={`rounded-[22px] px-3 py-2.5 ${
                          dayClosure
                            ? "border-amber-300/14 bg-[linear-gradient(180deg,rgba(244,198,105,0.08)_0%,rgba(15,24,38,0.92)_100%)]"
                            : "workspace-soft-card"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p
                            className={`font-semibold ${compact ? "text-xs" : "text-sm"} text-[var(--workspace-text)]`}
                          >
                            {format(day, "d")}
                          </p>
                          {dayClosure ? (
                            <span className="h-2.5 w-2.5 rounded-full bg-amber-200/80" />
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>

                <div className="absolute inset-x-0" style={{ top: overlayTop }}>
                  <div className="grid grid-cols-7 gap-2" style={{ gridAutoRows: `${barHeight}px` }}>
                    {segments.map((segment) => (
                      <button
                        type="button"
                        key={`${segment.item.id}-${segment.startIndex}-${segment.track}`}
                        onClick={() => {
                          if (segment.item.booking) {
                            onSelectBooking(segment.item.booking);
                            return;
                          }

                          if (segment.item.calendarEvent) {
                            onSelectCalendarEvent(segment.item.calendarEvent);
                          }
                        }}
                        className={`flex min-w-0 items-center gap-2 overflow-hidden rounded-2xl border px-3 text-left shadow-[0_10px_24px_rgba(2,6,23,0.22)] transition ${
                          segment.item.booking || segment.item.calendarEvent
                            ? "hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[var(--workspace-accent)]/70"
                            : "cursor-default"
                        } ${getBookingTone(segment.item.channel, segment.item.variant)}`}
                        style={{
                          gridColumn: `${segment.startIndex + 1} / span ${segment.span}`,
                          gridRow: segment.track + 1,
                          height: `${barHeight}px`,
                        }}
                        title={`${segment.item.label} · ${formatDateLabel(segment.item.startDate, locale)} ${isSpanish ? "a" : "to"} ${formatDateLabel(segment.item.endDate, locale)}`}
                      >
                        {segment.startsThisWeek ? (
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-white/85" />
                        ) : null}
                        <span className={`truncate font-medium ${compact ? "text-[11px]" : "text-xs"}`}>
                          {segment.item.label}
                        </span>
                        {!compact && segment.span > 2 ? (
                          <span className="ml-auto shrink-0 text-[11px] text-white/70">
                            {getTimelineSourceLabel(segment.item, locale)}
                          </span>
                        ) : null}
                        {segment.endsThisWeek ? (
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/60" />
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function CalendarPanel({
  bookings,
  calendarEvents,
  closures,
  monthAnchors,
  currencyCode,
}: {
  bookings: BookingRecord[];
  calendarEvents: CalendarEventRecord[];
  closures: CalendarClosureRecord[];
  monthAnchors: Date[];
  currencyCode: CurrencyCode;
}) {
  const { locale } = useLocale();
  const isSpanish = locale === "es";
  const [selectedBooking, setSelectedBooking] = useState<BookingRecord | null>(null);
  const [selectedCalendarEvent, setSelectedCalendarEvent] = useState<CalendarEventRecord | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const monthSectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const monthAnchorKey = useMemo(
    () => monthAnchors.map((anchorDate) => format(anchorDate, "yyyy-MM")).join(","),
    [monthAnchors],
  );
  const initialMonthKey = useMemo(() => {
    const todayKey = format(startOfMonth(new Date()), "yyyy-MM");

    if (monthAnchors.some((anchorDate) => format(anchorDate, "yyyy-MM") === todayKey)) {
      return todayKey;
    }

    return monthAnchors[0] ? format(monthAnchors[0], "yyyy-MM") : "";
  }, [monthAnchors]);
  const timelineBuildResult = useMemo(() => buildTimelineItems(bookings, calendarEvents), [bookings, calendarEvents]);
  const linkedCalendarEvent =
    selectedBooking ? timelineBuildResult.linkedCalendarEventByBookingKey.get(getBookingSelectionKey(selectedBooking)) ?? null : null;

  useLayoutEffect(() => {
    const targetNode = monthSectionRefs.current[initialMonthKey] ?? panelRef.current;

    if (!targetNode) {
      return;
    }

    let timeoutId = 0;
    let firstFrameId = 0;
    let secondFrameId = 0;

    const scrollToMonth = () => {
      const workspaceRegion = getWorkspaceScrollRegion();
      const scrollContainer = isScrollableElement(workspaceRegion)
        ? workspaceRegion
        : getScrollContainer(targetNode);

      if (!scrollContainer) {
        targetNode.scrollIntoView({
          behavior: "auto",
          block: "start",
        });
        return;
      }

      const containerRect = scrollContainer.getBoundingClientRect();
      const targetRect = targetNode.getBoundingClientRect();
      const nextTop =
        scrollContainer.scrollTop + (targetRect.top - containerRect.top) - 16;

      scrollContainer.scrollTo({
        top: Math.max(nextTop, 0),
        behavior: "auto",
      });
    };

    firstFrameId = window.requestAnimationFrame(() => {
      secondFrameId = window.requestAnimationFrame(scrollToMonth);
    });
    timeoutId = window.setTimeout(scrollToMonth, 140);

    return () => {
      window.cancelAnimationFrame(firstFrameId);
      window.cancelAnimationFrame(secondFrameId);
      window.clearTimeout(timeoutId);
    };
  }, [initialMonthKey, monthAnchorKey]);

  return (
    <div ref={panelRef} className="space-y-6">
      <div className="workspace-card rounded-[30px] p-6 sm:p-7">
        {monthAnchors.map((anchorDate) => {
          const monthKey = format(anchorDate, "yyyy-MM");
          const monthCalendarEvents = calendarEvents.filter((event) => {
            const eventStart = parseISO(event.startDate);
            const eventEnd = parseISO(event.endDate);
            return eventStart <= endOfMonth(anchorDate) && eventEnd > startOfMonth(anchorDate);
          });
          const monthClosures = closures.filter((closure) =>
            isWithinInterval(parseISO(closure.date), {
              start: startOfMonth(anchorDate),
              end: endOfMonth(anchorDate),
            }),
          );

          return (
            <div
              key={monthKey}
              className="scroll-mt-6 xl:scroll-mt-6"
              ref={(node) => {
                monthSectionRefs.current[monthKey] = node;
              }}
            >
              <MonthCalendar
                anchorDate={anchorDate}
                calendarEvents={monthCalendarEvents}
                closures={monthClosures}
                timelineItems={timelineBuildResult.items.filter((item) => {
                  const stayStart = parseISO(item.startDate);
                  const stayEnd = parseISO(item.endDate);
                  return stayStart <= endOfMonth(anchorDate) && stayEnd > startOfMonth(anchorDate);
                })}
                onSelectBooking={setSelectedBooking}
                onSelectCalendarEvent={setSelectedCalendarEvent}
              />
            </div>
          );
        })}
      </div>

      <Modal
        open={Boolean(selectedBooking)}
        title={selectedBooking ? selectedBooking.guestName : isSpanish ? "Detalles de la reserva" : "Booking details"}
        onClose={() => setSelectedBooking(null)}
      >
        {selectedBooking ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              {(() => {
                const bookingStatus = getBookingStatusState(selectedBooking);

                return (
                  <BookingStatusBadge status={bookingStatus} className="px-3 py-1.5 text-[11px]" />
                );
              })()}
              <div
                className={`rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                  linkedCalendarEvent
                    ? "border border-emerald-300/18 bg-emerald-400/10 text-emerald-100"
                    : selectedBooking.source === "manual"
                      ? "border border-amber-300/18 bg-amber-400/10 text-amber-100"
                      : "border border-sky-300/18 bg-sky-400/10 text-sky-100"
                }`}
              >
                {linkedCalendarEvent
                  ? selectedBooking.source === "manual"
                    ? isSpanish
                      ? "Sincronizada + manual"
                      : "Synced + manual"
                    : isSpanish
                      ? "Sincronizada + importada"
                      : "Synced + imported"
                  : selectedBooking.source === "manual"
                    ? isSpanish
                      ? "Reserva manual"
                      : "Manual booking"
                    : isSpanish
                      ? "Reserva importada"
                      : "Imported booking"}
              </div>
            </div>

            {linkedCalendarEvent ? (
              <p className="text-sm leading-6 text-[var(--workspace-muted)]">
                {isSpanish
                  ? "Hostlyx ocultó el duplicado del iCal y usa esta reserva como ficha principal porque contiene más detalle, como nombre del huésped, contacto y datos financieros."
                  : "Hostlyx hid the duplicate iCal event and uses this booking as the primary record because it carries richer detail, like guest name, contact, and financial data."}
              </p>
            ) : null}

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
              <div className="workspace-soft-card rounded-[24px] p-5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">{isSpanish ? "Resumen de la estancia" : "Stay summary"}</p>
                <h3 className="mt-2 text-2xl font-semibold text-[var(--workspace-text)]">
                  {selectedBooking.guestName}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--workspace-muted)]">
                  {formatDateLabel(selectedBooking.checkIn, locale)} {isSpanish ? "a" : "to"} {formatDateLabel(selectedBooking.checkout, locale)}
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">{isSpanish ? "Propiedad" : "Property"}</p>
                    <p className="mt-1 text-sm font-medium text-[var(--workspace-text)]">
                      {selectedBooking.propertyName}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">Listing</p>
                    <p className="mt-1 text-sm font-medium text-[var(--workspace-text)]">
                      {selectedBooking.unitName || (isSpanish ? "Listing principal" : "Primary listing")}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">{isSpanish ? "Huéspedes" : "Guests"}</p>
                    <p className="mt-1 text-sm font-medium text-[var(--workspace-text)]">
                      {formatNumber(selectedBooking.guestCount, locale)}
                    </p>
                    {getGuestBreakdownLabel(selectedBooking) ? (
                      <p className="mt-1 text-xs text-[var(--workspace-muted)]">
                        {getGuestBreakdownLabel(selectedBooking)}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">{isSpanish ? "Noches" : "Nights"}</p>
                    <p className="mt-1 text-sm font-medium text-[var(--workspace-text)]">
                      {formatNumber(selectedBooking.nights, locale)}
                    </p>
                  </div>
                  {selectedBooking.guestContact ? (
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">{isSpanish ? "Contacto" : "Contact"}</p>
                      <p className="mt-1 text-sm font-medium text-[var(--workspace-text)]">
                        {selectedBooking.guestContact}
                      </p>
                    </div>
                  ) : null}
                  {selectedBooking.bookedAt ? (
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">{isSpanish ? "Fecha de reserva" : "Booked on"}</p>
                      <p className="mt-1 text-sm font-medium text-[var(--workspace-text)]">
                        {formatDateLabel(selectedBooking.bookedAt, locale)}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="workspace-soft-card rounded-[24px] p-5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">{isSpanish ? "Detalles de la reserva" : "Booking details"}</p>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[var(--workspace-muted)]">{isSpanish ? "Origen de datos" : "Data source"}</span>
                    <span className="font-medium text-[var(--workspace-text)]">
                      {linkedCalendarEvent
                        ? selectedBooking.source === "manual"
                          ? isSpanish
                            ? "iCal + manual"
                            : "iCal + manual"
                          : isSpanish
                            ? "iCal + importación"
                            : "iCal + import"
                        : selectedBooking.source === "manual"
                          ? isSpanish
                            ? "Manual"
                            : "Manual"
                          : isSpanish
                            ? "Importación"
                            : "Import"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[var(--workspace-muted)]">{isSpanish ? "Canal" : "Channel"}</span>
                    <BookingChannelBadge channel={selectedBooking.channel} />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[var(--workspace-muted)]">{isSpanish ? "Ref. reserva" : "Booking ref"}</span>
                    <span className="font-medium text-[var(--workspace-text)]">
                      {selectedBooking.bookingNumber || (isSpanish ? "Sin definir" : "Not set")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[var(--workspace-muted)]">{isSpanish ? "Estado" : "Status"}</span>
                    <BookingStatusBadge status={getBookingStatusState(selectedBooking)} />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[var(--workspace-muted)]">{isSpanish ? "Periodo de alquiler" : "Rental period"}</span>
                    <span className="font-medium text-[var(--workspace-text)]">{selectedBooking.rentalPeriod}</span>
                  </div>
                  {linkedCalendarEvent ? (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[var(--workspace-muted)]">{isSpanish ? "iCal sincronizado" : "Synced iCal"}</span>
                      <span className="font-medium text-[var(--workspace-text)]">
                        {linkedCalendarEvent.source}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {linkedCalendarEvent ? (
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
                <div className="workspace-soft-card rounded-[24px] p-5">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                    {isSpanish ? "Datos enriquecidos desde iCal" : "Enriched from iCal"}
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                        {isSpanish ? "Última sincronización" : "Last synced"}
                      </p>
                      <p className="mt-1 text-sm font-medium text-[var(--workspace-text)]">
                        {formatDateLabel(linkedCalendarEvent.lastSyncedAt, locale)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                        {isSpanish ? "Código de reserva" : "Reservation code"}
                      </p>
                      <p className="mt-1 text-sm font-medium text-[var(--workspace-text)]">
                        {extractReservationCode(linkedCalendarEvent.description) || (isSpanish ? "No disponible" : "Not provided")}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                        {isSpanish ? "Últimos 4 del teléfono" : "Phone last 4"}
                      </p>
                      <p className="mt-1 text-sm font-medium text-[var(--workspace-text)]">
                        {extractPhoneLast4(linkedCalendarEvent.description) || (isSpanish ? "No disponible" : "Not provided")}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                        {isSpanish ? "ID externo" : "External id"}
                      </p>
                      <p className="mt-1 truncate text-sm font-medium text-[var(--workspace-text)]">
                        {linkedCalendarEvent.externalEventId || (isSpanish ? "No disponible" : "Not provided")}
                      </p>
                    </div>
                  </div>
                </div>

                {extractReservationUrl(linkedCalendarEvent.description) ? (
                  <div className="workspace-soft-card rounded-[24px] p-5">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                      {isSpanish ? "Reserva sincronizada" : "Synced reservation"}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-[var(--workspace-muted)]">
                      {isSpanish
                        ? "El calendario sincronizado sigue conectado a esta estancia, pero la vista principal usa la reserva con más datos para evitar duplicados."
                        : "The synced calendar stay remains linked to this booking, but the main view uses the richer booking record to avoid duplicates."}
                    </p>
                    <a
                      href={extractReservationUrl(linkedCalendarEvent.description)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex text-sm font-medium text-[var(--workspace-accent)] hover:underline"
                    >
                      {isSpanish ? "Abrir reserva en Airbnb" : "Open reservation in Airbnb"}
                    </a>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <div className="workspace-soft-card rounded-[22px] p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">{isSpanish ? "Ingresos brutos" : "Gross revenue"}</p>
                <p className="mt-2 text-xl font-semibold text-[var(--workspace-text)]">
                  {formatCurrency(selectedBooking.totalRevenue, false, currencyCode)}
                </p>
              </div>
              <div className="workspace-soft-card rounded-[22px] p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">{isSpanish ? "Payout neto" : "Net payout"}</p>
                <p className="mt-2 text-xl font-semibold text-[var(--workspace-text)]">
                  {formatCurrency(selectedBooking.payout, false, currencyCode)}
                </p>
              </div>
              <div className="workspace-soft-card rounded-[22px] p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">{isSpanish ? "Fee del anfitrión" : "Host fee"}</p>
                <p className="mt-2 text-xl font-semibold text-[var(--workspace-text)]">
                  {formatCurrency(selectedBooking.hostFee, false, currencyCode)}
                </p>
              </div>
              <div className="workspace-soft-card rounded-[22px] p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">{isSpanish ? "Impuestos" : "Taxes"}</p>
                <p className="mt-2 text-xl font-semibold text-[var(--workspace-text)]">
                  {formatCurrency(selectedBooking.taxAmount, false, currencyCode)}
                </p>
              </div>
              <div className="workspace-soft-card rounded-[22px] p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">{isSpanish ? "Tarifa de limpieza" : "Cleaning fee"}</p>
                <p className="mt-2 text-xl font-semibold text-[var(--workspace-text)]">
                  {formatCurrency(selectedBooking.cleaningFee, false, currencyCode)}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Link
                href={`/dashboard/bookings?booking=${encodeURIComponent(getBookingSelectionKey(selectedBooking))}`}
                className="workspace-button-secondary inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition"
              >
                {isSpanish ? "Abrir página de reservas" : "Open bookings page"}
              </Link>
              <button
                type="button"
                onClick={() => setSelectedBooking(null)}
                className="workspace-button-primary rounded-2xl px-4 py-3 text-sm font-semibold transition"
              >
                {isSpanish ? "Cerrar detalles" : "Close details"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(selectedCalendarEvent)}
        title={selectedCalendarEvent ? getCalendarEventDisplayName(selectedCalendarEvent) : isSpanish ? "Evento sincronizado" : "Synced calendar event"}
        onClose={() => setSelectedCalendarEvent(null)}
      >
        {selectedCalendarEvent ? (
          <div className="space-y-5">
            <div className="rounded-full border border-slate-300/18 bg-slate-400/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-100">
              {isSpanish ? "Evento iCal sincronizado" : "Synced iCal event"}
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
              <div className="workspace-soft-card rounded-[24px] p-5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">{isSpanish ? "Ventana de estancia" : "Stay window"}</p>
                <h3 className="mt-2 text-2xl font-semibold text-[var(--workspace-text)]">
                  {getCalendarEventStayTitle(selectedCalendarEvent)}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--workspace-muted)]">
                  {formatDateLabel(selectedCalendarEvent.startDate, locale)} {isSpanish ? "a" : "to"} {formatDateLabel(selectedCalendarEvent.endDate, locale)}
                </p>
                {!extractGuestName(selectedCalendarEvent.description) && isGenericCalendarSummary(selectedCalendarEvent.summary) ? (
                  <p className="mt-3 text-sm leading-6 text-[var(--workspace-muted)]">
                    {isSpanish
                      ? `${getSourceGuestFallback(selectedCalendarEvent.source)} aparece aquí porque este feed iCal no expone el nombre del huésped.`
                      : `${getSourceGuestFallback(selectedCalendarEvent.source)} shown here because this iCal feed does not expose the guest name.`}
                  </p>
                ) : null}
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">{isSpanish ? "Propiedad" : "Property"}</p>
                    <p className="mt-1 text-sm font-medium text-[var(--workspace-text)]">
                      {selectedCalendarEvent.propertyName}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">Listing</p>
                    <p className="mt-1 text-sm font-medium text-[var(--workspace-text)]">
                      {selectedCalendarEvent.unitName || (isSpanish ? "Listing principal" : "Primary listing")}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">{isSpanish ? "Código de reserva" : "Reservation code"}</p>
                    <p className="mt-1 text-sm font-medium text-[var(--workspace-text)]">
                      {extractReservationCode(selectedCalendarEvent.description) || (isSpanish ? "No disponible" : "Not provided")}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">{isSpanish ? "Últimos 4 del teléfono" : "Phone last 4"}</p>
                    <p className="mt-1 text-sm font-medium text-[var(--workspace-text)]">
                      {extractPhoneLast4(selectedCalendarEvent.description) || (isSpanish ? "No disponible" : "Not provided")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="workspace-soft-card rounded-[24px] p-5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">{isSpanish ? "Detalles de sincronización" : "Sync details"}</p>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[var(--workspace-muted)]">{isSpanish ? "Origen" : "Source"}</span>
                    <span className="font-medium capitalize text-[var(--workspace-text)]">
                      {selectedCalendarEvent.source}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[var(--workspace-muted)]">{isSpanish ? "Tipo" : "Type"}</span>
                    <span className="font-medium text-[var(--workspace-text)]">
                      {selectedCalendarEvent.eventType === "blocked"
                        ? isSpanish
                          ? "Bloqueado"
                          : "Blocked"
                        : isSpanish
                          ? "Reserva"
                          : "Reservation"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[var(--workspace-muted)]">{isSpanish ? "Última sincronización" : "Last synced"}</span>
                    <span className="font-medium text-[var(--workspace-text)]">
                      {formatDateLabel(selectedCalendarEvent.lastSyncedAt, locale)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[var(--workspace-muted)]">{isSpanish ? "ID externo" : "External id"}</span>
                    <span className="max-w-[230px] truncate font-medium text-[var(--workspace-text)]">
                      {selectedCalendarEvent.externalEventId || (isSpanish ? "No disponible" : "Not provided")}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {extractReservationUrl(selectedCalendarEvent.description) ? (
              <div className="workspace-soft-card rounded-[24px] p-5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">{isSpanish ? "Enlace de reserva" : "Reservation link"}</p>
                <a
                  href={extractReservationUrl(selectedCalendarEvent.description)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex text-sm font-medium text-[var(--workspace-accent)] hover:underline"
                >
                  {isSpanish ? "Abrir reserva en Airbnb" : "Open reservation in Airbnb"}
                </a>
              </div>
            ) : null}

            {getCalendarEventNotes(selectedCalendarEvent.description).length > 0 ? (
              <div className="workspace-soft-card rounded-[24px] p-5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">{isSpanish ? "Notas importadas" : "Imported notes"}</p>
                <div className="mt-3 space-y-2 text-sm leading-6 text-[var(--workspace-text)]">
                  {getCalendarEventNotes(selectedCalendarEvent.description).map((note) => (
                    <p key={note}>{note}</p>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedCalendarEvent(null)}
                className="workspace-button-primary rounded-2xl px-4 py-3 text-sm font-semibold transition"
              >
                {isSpanish ? "Cerrar detalles" : "Close details"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

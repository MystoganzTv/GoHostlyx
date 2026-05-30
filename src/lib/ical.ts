import { addDays, format } from "date-fns";
import type { CalendarEventSource, CalendarEventType } from "./types";

type ParsedIcalEvent = {
  externalEventId: string;
  summary: string;
  description: string;
  startDate: string;
  endDate: string;
  eventType: CalendarEventType;
};

type RawIcalEvent = {
  uid: string;
  summary: string;
  description: string;
  status: string;
  startDate: string;
  endDate: string;
};

function normalizeLineBreaks(input: string) {
  return input.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function unfoldIcalLines(input: string) {
  const foldedLines = normalizeLineBreaks(input).split("\n");
  const lines: string[] = [];

  for (const rawLine of foldedLines) {
    if ((rawLine.startsWith(" ") || rawLine.startsWith("\t")) && lines.length > 0) {
      lines[lines.length - 1] += rawLine.slice(1);
      continue;
    }

    lines.push(rawLine);
  }

  return lines;
}

function unescapeIcalText(value: string) {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

function formatCalendarDate(date: Date, useUtc: boolean) {
  if (useUtc) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  return format(date, "yyyy-MM-dd");
}

function parseIcalDateValue(value: string) {
  const normalized = value.trim();

  if (/^\d{8}$/.test(normalized)) {
    return `${normalized.slice(0, 4)}-${normalized.slice(4, 6)}-${normalized.slice(6, 8)}`;
  }

  const match = normalized.match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/,
  );

  if (!match) {
    return null;
  }

  const [, year, month, day, hours, minutes, seconds = "00", utcMarker] = match;
  const useUtc = Boolean(utcMarker);
  const parsed = useUtc
    ? new Date(Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hours),
        Number(minutes),
        Number(seconds),
      ))
    : new Date(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hours),
        Number(minutes),
        Number(seconds),
      );

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return formatCalendarDate(parsed, useUtc);
}

function inferEventType(rawEvent: RawIcalEvent): CalendarEventType {
  const haystack = [rawEvent.summary, rawEvent.description, rawEvent.status]
    .join(" ")
    .trim()
    .toLowerCase();

  if (
    haystack.includes("blocked") ||
    haystack.includes("unavailable") ||
    haystack.includes("not available") ||
    haystack.includes("closed") ||
    haystack.includes("blackout") ||
    haystack.includes("owner stay") ||
    haystack.includes("hold")
  ) {
    return "blocked";
  }

  return "booking";
}

function buildExternalEventId(source: CalendarEventSource, rawEvent: RawIcalEvent, index: number) {
  const base =
    rawEvent.uid.trim() ||
    [
      rawEvent.startDate,
      rawEvent.endDate,
      rawEvent.summary.trim().toLowerCase(),
      String(index + 1),
    ].join("__");

  return `ical:${source}:${base}`;
}

export function parseIcalEvents(
  input: string,
  source: CalendarEventSource,
): ParsedIcalEvent[] {
  const lines = unfoldIcalLines(input);
  const rawEvents: RawIcalEvent[] = [];
  let currentEvent: Partial<RawIcalEvent> | null = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      currentEvent = {};
      continue;
    }

    if (line === "END:VEVENT") {
      if (
        currentEvent?.startDate &&
        currentEvent.endDate
      ) {
        rawEvents.push({
          uid: currentEvent.uid ?? "",
          summary: currentEvent.summary ?? "",
          description: currentEvent.description ?? "",
          status: currentEvent.status ?? "",
          startDate: currentEvent.startDate,
          endDate: currentEvent.endDate,
        });
      }

      currentEvent = null;
      continue;
    }

    if (!currentEvent) {
      continue;
    }

    const separatorIndex = line.indexOf(":");

    if (separatorIndex === -1) {
      continue;
    }

    const fieldName = line.slice(0, separatorIndex).split(";")[0]?.toUpperCase().trim();
    const rawValue = line.slice(separatorIndex + 1);

    if (!fieldName) {
      continue;
    }

    if (fieldName === "UID") {
      currentEvent.uid = unescapeIcalText(rawValue);
    }

    if (fieldName === "SUMMARY") {
      currentEvent.summary = unescapeIcalText(rawValue);
    }

    if (fieldName === "DESCRIPTION") {
      currentEvent.description = unescapeIcalText(rawValue);
    }

    if (fieldName === "STATUS") {
      currentEvent.status = unescapeIcalText(rawValue);
    }

    if (fieldName === "DTSTART") {
      const parsed = parseIcalDateValue(rawValue);
      if (parsed) {
        currentEvent.startDate = parsed;
      }
    }

    if (fieldName === "DTEND") {
      const parsed = parseIcalDateValue(rawValue);
      if (parsed) {
        currentEvent.endDate = parsed;
      }
    }
  }

  return rawEvents.flatMap((rawEvent, index) => {
    const startDate = rawEvent.startDate;
    const endDate = rawEvent.endDate || format(addDays(new Date(`${startDate}T00:00:00`), 1), "yyyy-MM-dd");

    if (!startDate || !endDate || endDate <= startDate) {
      return [];
    }

    return [
      {
        externalEventId: buildExternalEventId(source, rawEvent, index),
        summary: rawEvent.summary || "Imported iCal event",
        description: rawEvent.description || "",
        startDate,
        endDate,
        eventType: inferEventType(rawEvent),
      },
    ];
  });
}

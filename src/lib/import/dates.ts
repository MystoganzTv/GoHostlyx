import { addDays, differenceInCalendarDays, formatISO, isValid, parse } from "date-fns";
import * as XLSX from "xlsx";
import { normalizeHeader } from "./columnMatchers";
import type { ImportCellValue } from "./types";

export type ParsedImportDate = {
  value: string;
  ambiguous: boolean;
  malformed: boolean;
};

export type ImportDatePreference = "day-first" | "month-first" | null;

function normalizeParsedDate(value: Date) {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateUsingPatterns(raw: string, patterns: string[]) {
  for (const pattern of patterns) {
    const parsed = parse(raw, pattern, new Date());
    if (isValid(parsed)) {
      return parsed;
    }
  }

  return null;
}

function buildDatePatterns(
  raw: string,
  ambiguous: boolean,
  datePreference: ImportDatePreference = null,
) {
  const slashOrDashMatch = raw.match(/^(\d{1,2})([/-])(\d{1,2})\2(\d{2}|\d{4})$/);

  if (slashOrDashMatch) {
    const separator = slashOrDashMatch[2];
    const yearToken = slashOrDashMatch[4].length === 2 ? "yy" : "yyyy";
    const dayFirstBase = [`d${separator}M${separator}${yearToken}`, `dd${separator}MM${separator}${yearToken}`];
    const monthFirstBase = [`M${separator}d${separator}${yearToken}`, `MM${separator}dd${separator}${yearToken}`];

    if (datePreference === "day-first") {
      return [...dayFirstBase, ...monthFirstBase];
    }

    if (datePreference === "month-first") {
      return [...monthFirstBase, ...dayFirstBase];
    }

    return ambiguous ? [...dayFirstBase, ...monthFirstBase] : [...monthFirstBase, ...dayFirstBase];
  }

  return [
    "yyyy-MM-dd",
    "dd-MM-yyyy",
    "d MMM yyyy",
    "d MMM yy",
    "MMM d, yyyy",
    "MMM d, yy",
  ];
}

export function parseImportDateDetailed(
  value: ImportCellValue,
  options?: {
    datePreference?: ImportDatePreference;
  },
): ParsedImportDate {
  if (!value && value !== 0) {
    return {
      value: "",
      ambiguous: false,
      malformed: false,
    };
  }

  if (value instanceof Date && isValid(value)) {
    return {
      value: normalizeParsedDate(value),
      ambiguous: false,
      malformed: false,
    };
  }

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      const normalized = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d ?? 1));
      return {
        value: normalizeParsedDate(normalized),
        ambiguous: false,
        malformed: false,
      };
    }
  }

  const raw = String(value ?? "").trim();

  if (!raw) {
    return {
      value: "",
      ambiguous: false,
      malformed: false,
    };
  }

  if (/^\d{1,4}$/.test(raw)) {
    return {
      value: "",
      ambiguous: false,
      malformed: true,
    };
  }

  const ambiguousMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  const ambiguous =
    !!ambiguousMatch &&
    Number(ambiguousMatch[1]) <= 12 &&
    Number(ambiguousMatch[2]) <= 12 &&
    ambiguousMatch[1] !== ambiguousMatch[2];

  const datePreference = options?.datePreference ?? null;
  const prioritizedPatterns = buildDatePatterns(raw, ambiguous, datePreference);

  const parsed = parseDateUsingPatterns(raw, prioritizedPatterns);
  if (parsed) {
    return {
      value: normalizeParsedDate(parsed),
      ambiguous: ambiguous && !datePreference,
      malformed: false,
    };
  }

  const fallback = new Date(raw);
  if (isValid(fallback)) {
    return {
      value: normalizeParsedDate(fallback),
      ambiguous: false,
      malformed: false,
    };
  }

  return {
    value: "",
    ambiguous: false,
    malformed: true,
  };
}

export function parseImportDate(value: ImportCellValue) {
  return parseImportDateDetailed(value).value;
}

export function inferDatePreferenceFromSheet(
  headers: ImportCellValue[],
  rows: ImportCellValue[][],
  columnIndexes: Array<number | undefined>,
): ImportDatePreference {
  const normalizedHeaders = headers.map((header) => normalizeHeader(header));
  const spanishSignals = normalizedHeaders.filter((header) =>
    [
      "fechadeinicio",
      "fechadefinalizacion",
      "fechaentrada",
      "fechadesalida",
      "nombredelhuesped",
      "ganancias",
      "reservas",
      "gastos",
      "numerodereserva",
      "anuncio",
      "alojamiento",
    ].includes(header),
  ).length;
  const englishSignals = normalizedHeaders.filter((header) =>
    [
      "checkin",
      "checkout",
      "arrival",
      "departure",
      "guestname",
      "confirmationcode",
      "reservationnumber",
      "listing",
      "propertyname",
    ].includes(header),
  ).length;

  let dayFirstVotes = 0;
  let monthFirstVotes = 0;

  for (const row of rows.slice(0, 40)) {
    for (const index of columnIndexes) {
      if (typeof index !== "number") {
        continue;
      }

      const raw = String(row[index] ?? "").trim();
      const match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);

      if (!match) {
        continue;
      }

      const first = Number(match[1]);
      const second = Number(match[2]);

      if (first > 12 && second <= 12) {
        dayFirstVotes += 2;
      } else if (second > 12 && first <= 12) {
        monthFirstVotes += 2;
      } else if (first <= 12 && second <= 12 && first !== second) {
        if (spanishSignals > englishSignals) {
          dayFirstVotes += 1;
        } else if (englishSignals > spanishSignals) {
          monthFirstVotes += 1;
        }
      }
    }
  }

  if (dayFirstVotes > monthFirstVotes) {
    return "day-first";
  }

  if (monthFirstVotes > dayFirstVotes) {
    return "month-first";
  }

  if (spanishSignals > englishSignals) {
    return "day-first";
  }

  if (englishSignals > spanishSignals) {
    return "month-first";
  }

  return null;
}

export function parseNights(value: ImportCellValue) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }

  const raw = String(value ?? "");
  const match = raw.match(/(\d+)/);
  return match ? Math.max(0, Number(match[1])) : 0;
}

export function calculateNights(checkIn: string, checkOut: string) {
  if (!checkIn || !checkOut) {
    return 0;
  }

  return differenceInCalendarDays(new Date(checkOut), new Date(checkIn));
}

export function deriveCheckOut(checkIn: string, nights: number) {
  if (!checkIn || nights <= 0) {
    return "";
  }

  return formatISO(addDays(new Date(checkIn), nights), { representation: "date" });
}

import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  formatISO,
  isValid,
  parse,
} from "date-fns";
import * as XLSX from "xlsx";
import { normalizeExpenseFields } from "./expense-normalization";
import type {
  BookingRecord,
  CalendarClosureRecord,
  ExpenseRecord,
  ImportedFileSource,
  ParsedImportSummary,
} from "./types";

type CellValue = string | number | boolean | Date | null | undefined;
type SheetRow = CellValue[];
type OptionalIndexMap<T extends string> = Partial<Record<T, number>>;
type ProviderColumnKey =
  | "propertyName"
  | "guestName"
  | "guestCount"
  | "channel"
  | "checkIn"
  | "checkOut"
  | "nights"
  | "grossRevenue"
  | "payout"
  | "platformFee"
  | "taxes"
  | "cleaningFee"
  | "extraFee"
  | "bookingReference";

type ParsedImportFile = {
  importedSource: ImportedFileSource;
  sourceLabel: string;
  bookings: BookingRecord[];
  expenses: ExpenseRecord[];
  closures: CalendarClosureRecord[];
  summary: ParsedImportSummary;
};

type SheetDetectionCandidate = {
  source: Exclude<ImportedFileSource, "hostlyx_excel" | "financial_statement">;
  sheetName: string;
  headerRowIndex: number;
  indexes: OptionalIndexMap<ProviderColumnKey>;
  score: number;
};

const bookingColumnMap = {
  checkIn: ["checkin"],
  checkout: ["checkout"],
  guestName: ["guestname"],
  guestCount: ["ofguests", "guests", "guestcount"],
  channel: ["channel"],
  rentalPeriod: ["rentalperiod"],
  pricePerNight: ["pricepernight"],
  extraFee: ["extrafee"],
  discount: ["discount"],
  rentalRevenue: ["rentalrevenue"],
  cleaningFee: ["cleaningfee"],
  totalRevenue: ["totalrevenue"],
  hostFee: ["hostfee"],
  payout: ["payout"],
  bookingNumber: ["bookingnumber"],
  overbookingStatus: ["overbookingstatus"],
} as const;

const expenseColumnMap = {
  date: ["date"],
  category: ["category"],
  amount: ["amount"],
  description: ["description"],
  note: ["note"],
} as const;

const sharedProviderColumns: Record<ProviderColumnKey, readonly string[]> = {
  propertyName: [
    "listing",
    "listingname",
    "property",
    "propertyname",
    "accommodation",
    "accommodationname",
    "unit",
    "unitname",
    "room",
    "roomname",
    "apartment",
    "listingtitle",
  ],
  guestName: [
    "guest",
    "guestname",
    "leadguest",
    "booker",
    "bookername",
    "primaryguest",
    "name",
    "guestfullname",
  ],
  guestCount: [
    "guests",
    "guestcount",
    "numberofguests",
    "pax",
    "party",
    "partysize",
    "adultschildren",
  ],
  channel: ["channel", "source", "platform", "ota"],
  checkIn: [
    "checkin",
    "arrival",
    "arrivaldate",
    "startdate",
    "reservationstart",
    "datefrom",
  ],
  checkOut: [
    "checkout",
    "departure",
    "departuredate",
    "enddate",
    "reservationend",
    "dateto",
  ],
  nights: ["nights", "nightcount", "lengthofstay", "staynights", "numberofnights"],
  grossRevenue: [
    "grossrevenue",
    "grossbookingvalue",
    "bookingvalue",
    "bookingamount",
    "totalbookingvalue",
    "totalprice",
    "reservationvalue",
    "totalearnings",
    "subtotal",
    "amount",
    "earnings",
    "paidbyguest",
    "guestpaid",
  ],
  payout: [
    "payout",
    "netpayout",
    "expectedpayout",
    "cashreceived",
    "actualpayout",
    "earningsafterfees",
    "hostpayout",
    "paidout",
    "yourearnings",
  ],
  platformFee: [
    "hostfee",
    "platformfee",
    "servicefee",
    "hostservicefee",
    "airbnbservicefee",
    "commission",
    "commissionamount",
    "otafee",
    "channelfee",
  ],
  taxes: [
    "tax",
    "taxes",
    "touristtax",
    "occupancytax",
    "vat",
    "citytax",
    "lodgingtax",
    "withheldtax",
  ],
  cleaningFee: ["cleaningfee", "cleaning"],
  extraFee: ["extrafee", "fees", "otherfee", "otherfees", "extras"],
  bookingReference: [
    "bookingreference",
    "bookingnumber",
    "bookingid",
    "reservationnumber",
    "reservationid",
    "reservationcode",
    "confirmationcode",
    "confirmationnumber",
    "confirmation",
    "reference",
  ],
};

const providerDetectionProfiles: Record<
  Exclude<ImportedFileSource, "hostlyx_excel" | "financial_statement">,
  {
    label: string;
    filenameHints: string[];
    distinctiveHeaders: string[];
    columns: Record<ProviderColumnKey, readonly string[]>;
  }
> = {
  airbnb: {
    label: "Airbnb",
    filenameHints: ["airbnb", "air-bnb"],
    distinctiveHeaders: [
      "confirmationcode",
      "listing",
      "hostservicefee",
      "airbnbservicefee",
      "yourearnings",
    ],
    columns: {
      ...sharedProviderColumns,
      guestName: [...sharedProviderColumns.guestName, "guest"],
      bookingReference: [...sharedProviderColumns.bookingReference, "confirmationcode"],
      payout: [...sharedProviderColumns.payout, "yourearnings", "expectedpayout"],
      platformFee: [...sharedProviderColumns.platformFee, "hostservicefee", "airbnbservicefee"],
    },
  },
  booking_com: {
    label: "Booking.com",
    filenameHints: ["booking", "bookingcom"],
    distinctiveHeaders: [
      "reservationnumber",
      "commissionamount",
      "accommodationname",
      "arrivaldate",
      "departuredate",
    ],
    columns: {
      ...sharedProviderColumns,
      propertyName: [...sharedProviderColumns.propertyName, "accommodationname"],
      guestName: [...sharedProviderColumns.guestName, "guestname"],
      bookingReference: [...sharedProviderColumns.bookingReference, "reservationnumber"],
      grossRevenue: [...sharedProviderColumns.grossRevenue, "totalprice"],
      platformFee: [...sharedProviderColumns.platformFee, "commissionamount", "commission"],
      checkIn: [...sharedProviderColumns.checkIn, "arrivaldate"],
      checkOut: [...sharedProviderColumns.checkOut, "departuredate"],
    },
  },
  generic_excel: {
    label: "Generic Excel",
    filenameHints: ["export", "report", "reservation", "booking"],
    distinctiveHeaders: [],
    columns: sharedProviderColumns,
  },
};

function normalizeHeader(value: CellValue) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function getImportedSourceLabel(source: ImportedFileSource) {
  switch (source) {
    case "airbnb":
      return "Airbnb";
    case "booking_com":
      return "Booking.com";
    case "hostlyx_excel":
      return "Generic Excel";
    case "financial_statement":
      return "Payout statement";
    default:
      return "Generic Excel";
  }
}

function parseCurrency(value: CellValue) {
  if (typeof value === "number") {
    return value;
  }

  const raw = String(value ?? "").trim();

  if (!raw) {
    return 0;
  }

  const negative = raw.startsWith("(") && raw.endsWith(")");
  let cleaned = raw.replace(/[^\d,.-]/g, "");

  if (cleaned.includes(",") && cleaned.includes(".")) {
    cleaned =
      cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "");
  } else if (cleaned.includes(",")) {
    cleaned =
      cleaned.split(",").length - 1 === 1
        ? cleaned.replace(",", ".")
        : cleaned.replace(/,/g, "");
  }

  const amount = Number(cleaned);

  if (!Number.isFinite(amount)) {
    return 0;
  }

  return negative ? -amount : amount;
}

function parsePositiveCurrency(value: CellValue) {
  return Math.abs(parseCurrency(value));
}

function parseCount(value: CellValue) {
  if (typeof value === "number") {
    return Math.max(0, Math.trunc(value));
  }

  const parsed = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}

function parseExcelDate(value: CellValue) {
  if (!value && value !== 0) {
    return "";
  }

  if (value instanceof Date && isValid(value)) {
    return formatISO(value, { representation: "date" });
  }

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);

    if (parsed) {
      const normalized = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d ?? 1));
      return formatISO(normalized, { representation: "date" });
    }
  }

  const raw = String(value).trim();

  if (!raw) {
    return "";
  }

  const patterns = [
    "M/d/yyyy",
    "MM/dd/yyyy",
    "d/M/yyyy",
    "dd/MM/yyyy",
    "M/d/yy",
    "d/M/yy",
    "yyyy-MM-dd",
    "dd-MM-yyyy",
    "MMM d, yyyy",
    "d MMM yyyy",
  ];

  for (const pattern of patterns) {
    const parsed = parse(raw, pattern, new Date());
    if (isValid(parsed)) {
      return formatISO(parsed, { representation: "date" });
    }
  }

  const fallback = new Date(raw);
  if (isValid(fallback)) {
    return formatISO(fallback, { representation: "date" });
  }

  return "";
}

function parseRentalPeriodNights(value: CellValue) {
  const raw = String(value ?? "");
  const match = raw.match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

function normalizeChannel(value: CellValue) {
  const raw = String(value ?? "").trim();
  return raw || "Unassigned";
}

function getSheetRows(sheet: XLSX.WorkSheet) {
  return XLSX.utils.sheet_to_json<SheetRow>(sheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  });
}

function getWorksheet(workbook: XLSX.WorkBook, name: string) {
  const match = workbook.SheetNames.find(
    (sheetName) => normalizeHeader(sheetName) === normalizeHeader(name),
  );

  if (!match) {
    throw new Error(`Missing required sheet: ${name}`);
  }

  return workbook.Sheets[match];
}

function getOptionalWorksheet(workbook: XLSX.WorkBook, name: string) {
  const match = workbook.SheetNames.find(
    (sheetName) => normalizeHeader(sheetName) === normalizeHeader(name),
  );

  return match ? workbook.Sheets[match] : null;
}

function mapHeaderIndexes<T extends string>(
  headers: SheetRow,
  columns: Record<T, readonly string[]>,
) {
  const normalizedHeaders = headers.map((header) => normalizeHeader(header));

  return Object.fromEntries(
    (Object.entries(columns) as Array<[T, readonly string[]]>).map(([key, aliases]) => {
      const index = normalizedHeaders.findIndex((header) => aliases.includes(header));

      if (index === -1) {
        throw new Error(`Missing required column: ${key}`);
      }

      return [key, index];
    }),
  ) as Record<T, number>;
}

function mapOptionalHeaderIndexes<T extends string>(
  headers: SheetRow,
  columns: Record<T, readonly string[]>,
) {
  const normalizedHeaders = headers.map((header) => normalizeHeader(header));
  const indexes: OptionalIndexMap<T> = {};

  for (const [key, aliases] of Object.entries(columns) as Array<[T, readonly string[]]>) {
    const index = normalizedHeaders.findIndex((header) => aliases.includes(header));
    if (index >= 0) {
      indexes[key] = index;
    }
  }

  return indexes;
}

function findHeaderRowIndex<T extends string>(
  rows: SheetRow[],
  columns: Record<T, readonly string[]>,
) {
  for (let index = 0; index < Math.min(rows.length, 12); index += 1) {
    try {
      mapHeaderIndexes(rows[index], columns);
      return index;
    } catch {
      continue;
    }
  }

  throw new Error("Could not find the expected header row in the worksheet.");
}

function rowIsEmpty(row: SheetRow) {
  return row.every((cell) => String(cell ?? "").trim() === "");
}

function parseMonthName(value: CellValue) {
  const monthNames = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ];
  const raw = String(value ?? "").trim().toLowerCase();
  const index = monthNames.findIndex((month) => month === raw);
  return index >= 0 ? index + 1 : null;
}

function extractDayNumber(value: CellValue) {
  const raw = String(value ?? "").trim();

  if (!/^\d{1,2}$/.test(raw)) {
    return null;
  }

  const day = Number(raw);
  return day >= 1 && day <= 31 ? day : null;
}

function resolveCalendarDate(
  dateRow: SheetRow,
  targetColumnIndex: number,
  currentYear: number,
  currentMonth: number,
) {
  const calendarColumns = [4, 5, 6, 7, 8, 9, 10];
  const targetIndex = calendarColumns.indexOf(targetColumnIndex);

  if (targetIndex < 0) {
    return "";
  }

  const dateCells = calendarColumns.map((columnIndex) => extractDayNumber(dateRow[columnIndex]));

  if (dateCells[targetIndex] === null) {
    return "";
  }

  const firstCurrentMonthIndex = dateCells.findIndex((day) => day === 1);
  let monthOffset = 0;
  let previousDay: number | null = null;

  for (let index = 0; index <= targetIndex; index += 1) {
    const day = dateCells[index];

    if (day === null) {
      continue;
    }

    if (firstCurrentMonthIndex >= 0 && index < firstCurrentMonthIndex) {
      monthOffset = -1;
    } else if (
      previousDay !== null &&
      day < previousDay &&
      !(firstCurrentMonthIndex >= 0 && index === firstCurrentMonthIndex)
    ) {
      monthOffset += 1;
    } else if (firstCurrentMonthIndex >= 0 && index >= firstCurrentMonthIndex && monthOffset < 0) {
      monthOffset = 0;
    }

    previousDay = day;
  }

  const anchor = addMonths(new Date(currentYear, currentMonth - 1, 1), monthOffset);
  return formatISO(
    new Date(anchor.getFullYear(), anchor.getMonth(), dateCells[targetIndex] ?? 1),
    {
      representation: "date",
    },
  );
}

function parseCalendarClosures(rows: SheetRow[]) {
  const closuresByDate = new Map<string, CalendarClosureRecord>();
  let currentYear: number | null = null;
  let currentMonth: number | null = null;

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const yearValue = row
      .map((cell) => String(cell ?? "").trim())
      .find((cell) => /^\d{4}$/.test(cell));
    const monthValue = row
      .map((cell) => parseMonthName(cell))
      .find((value) => value !== null);

    if (yearValue && monthValue) {
      currentYear = Number(yearValue);
      currentMonth = monthValue;
    }

    if (!currentYear || !currentMonth) {
      continue;
    }

    for (let columnIndex = 4; columnIndex <= 10; columnIndex += 1) {
      const rawValue = String(row[columnIndex] ?? "").trim();

      if (!rawValue || !/(closed|check-in|check-out)/i.test(rawValue)) {
        continue;
      }

      let dateRowIndex = -1;

      for (
        let searchIndex = rowIndex - 1;
        searchIndex >= Math.max(0, rowIndex - 6);
        searchIndex -= 1
      ) {
        if (extractDayNumber(rows[searchIndex]?.[columnIndex]) !== null) {
          dateRowIndex = searchIndex;
          break;
        }
      }

      if (dateRowIndex < 0) {
        continue;
      }

      const date = resolveCalendarDate(
        rows[dateRowIndex],
        columnIndex,
        currentYear,
        currentMonth,
      );

      if (!date) {
        continue;
      }

      const noteLines = new Set<string>();
      for (
        let detailIndex = dateRowIndex + 1;
        detailIndex <= Math.min(rows.length - 1, rowIndex + 1);
        detailIndex += 1
      ) {
        const detailValue = String(rows[detailIndex]?.[columnIndex] ?? "").trim();
        if (detailValue) {
          noteLines.add(detailValue);
        }
      }

      const note = Array.from(noteLines).join("\n");
      const guestLine = note
        .split("\n")
        .find((line) => /guests?\s*:/i.test(line));
      const nightsLine = note
        .split("\n")
        .find((line) => /nights?\s*:/i.test(line));
      const statusLine = note
        .split("\n")
        .find((line) => /^(check-in|check-out|closed|booked)\s*:?/i.test(line));
      const parsedGuestCount = guestLine
        ? parseCount(guestLine.replace(/guests?\s*:/i, ""))
        : 0;
      const parsedNights = nightsLine
        ? parseCount(nightsLine.replace(/nights?\s*:/i, ""))
        : 0;
      const statusLabel =
        statusLine
          ?.split(":")[0]
          .trim()
          .replace(/\s+/g, " ")
          .replace(/\b\w/g, (match) => match.toUpperCase()) ?? "Closed";
      const reason =
        note
          .split("\n")
          .map((line) =>
            line
              .replace(/check-in:\s*/i, "")
              .replace(/check-out:\s*/i, "")
              .replace(/closed:\s*/i, "")
              .trim(),
          )
          .find(
            (line) =>
              line &&
              !/closed/i.test(line) &&
              !/check-in/i.test(line) &&
              !/check-out/i.test(line) &&
              !/booked/i.test(line) &&
              !/guests:/i.test(line) &&
              !/nights:/i.test(line),
          ) || statusLabel;
      const existing = closuresByDate.get(date);

      closuresByDate.set(date, {
        propertyName: "Default Property",
        unitName: "",
        date,
        reason,
        note: existing?.note ? `${existing.note}\n${note}` : note,
        statusLabel,
        guestCount: Math.max(existing?.guestCount ?? 0, parsedGuestCount),
        nights: Math.max(existing?.nights ?? 0, parsedNights),
        source: "upload",
      });
    }
  }

  return Array.from(closuresByDate.values());
}

function parseHostlyxWorkbook(workbook: XLSX.WorkBook) {
  const bookingsSheet = getWorksheet(workbook, "Bookings");
  const expensesSheet = getWorksheet(workbook, "Expenses");
  const calendarSheet = getOptionalWorksheet(workbook, "Calendar");

  const bookingRows = getSheetRows(bookingsSheet);
  const expenseRows = getSheetRows(expensesSheet);
  const calendarRows = calendarSheet ? getSheetRows(calendarSheet) : [];

  if (!bookingRows.length) {
    throw new Error("The Bookings sheet is empty.");
  }

  if (!expenseRows.length) {
    throw new Error("The Expenses sheet is empty.");
  }

  const bookingHeaderRowIndex = findHeaderRowIndex(bookingRows, bookingColumnMap);
  const expenseHeaderRowIndex = findHeaderRowIndex(expenseRows, expenseColumnMap);
  const bookingIndexes = mapHeaderIndexes(bookingRows[bookingHeaderRowIndex], bookingColumnMap);
  const expenseIndexes = mapHeaderIndexes(expenseRows[expenseHeaderRowIndex], expenseColumnMap);

  const bookings: BookingRecord[] = bookingRows
    .slice(bookingHeaderRowIndex + 1)
    .filter((row) => !rowIsEmpty(row))
    .map((row) => {
      const checkIn = parseExcelDate(row[bookingIndexes.checkIn]);
      const checkout = parseExcelDate(row[bookingIndexes.checkout]);
      const rawRentalPeriod = row[bookingIndexes.rentalPeriod];
      const rentalPeriod = String(rawRentalPeriod ?? "").trim();
      const dateDifference =
        checkIn && checkout ? differenceInCalendarDays(new Date(checkout), new Date(checkIn)) : 0;
      const nights = Math.max(1, dateDifference || parseRentalPeriodNights(rentalPeriod) || 1);

      return {
        propertyName: "Default Property",
        unitName: "",
        importedSource: "hostlyx_excel" as ImportedFileSource,
        checkIn,
        checkout,
        guestName: String(row[bookingIndexes.guestName] ?? "").trim() || "Guest",
        guestCount: parseCount(row[bookingIndexes.guestCount]),
        channel: normalizeChannel(row[bookingIndexes.channel]),
        rentalPeriod:
          rentalPeriod && Number.isNaN(Number(rentalPeriod)) ? rentalPeriod : `${nights} nights`,
        pricePerNight: parseCurrency(row[bookingIndexes.pricePerNight]),
        extraFee: parseCurrency(row[bookingIndexes.extraFee]),
        discount: parseCurrency(row[bookingIndexes.discount]),
        rentalRevenue: parseCurrency(row[bookingIndexes.rentalRevenue]),
        cleaningFee: parseCurrency(row[bookingIndexes.cleaningFee]),
        taxAmount: 0,
        totalRevenue: parseCurrency(row[bookingIndexes.totalRevenue]),
        hostFee: parseCurrency(row[bookingIndexes.hostFee]),
        payout: parseCurrency(row[bookingIndexes.payout]),
        nights,
        bookingNumber: String(row[bookingIndexes.bookingNumber] ?? "").trim(),
        overbookingStatus: String(row[bookingIndexes.overbookingStatus] ?? "").trim(),
      };
    })
    .filter((booking) => booking.checkIn && booking.checkout);

  const expenses: ExpenseRecord[] = expenseRows
    .slice(expenseHeaderRowIndex + 1)
    .filter((row) => !rowIsEmpty(row))
    .map((row) => {
      const normalizedExpenseFields = normalizeExpenseFields({
        amountValue: row[expenseIndexes.amount],
        descriptionValue: row[expenseIndexes.description],
        noteValue: row[expenseIndexes.note],
      });

      return {
        propertyName: "Default Property",
        unitName: "",
        date: parseExcelDate(row[expenseIndexes.date]),
        category: String(row[expenseIndexes.category] ?? "").trim() || "Other",
        amount: normalizedExpenseFields.amount,
        description: normalizedExpenseFields.description,
        note: normalizedExpenseFields.note,
      };
    })
    .filter((expense) => expense.date);

  const closures = calendarRows.length > 0 ? parseCalendarClosures(calendarRows) : [];

  if (!bookings.length && !expenses.length && !closures.length) {
    throw new Error("No valid rows were found in the workbook.");
  }

  return {
    bookings,
    expenses,
    closures,
  };
}

function countMatchedColumns<T extends string>(indexes: OptionalIndexMap<T>) {
  return Object.values(indexes).filter((value) => typeof value === "number").length;
}

function getFilenameHintScore(fileName: string, hints: string[]) {
  const normalizedName = normalizeHeader(fileName);
  return hints.some((hint) => normalizedName.includes(normalizeHeader(hint))) ? 3 : 0;
}

function detectProviderSheet(
  workbook: XLSX.WorkBook,
  fileName: string,
): SheetDetectionCandidate | null {
  const candidates: SheetDetectionCandidate[] = [];

  for (const sheetName of workbook.SheetNames) {
    const rows = getSheetRows(workbook.Sheets[sheetName]);
    if (!rows.length) {
      continue;
    }

    for (let rowIndex = 0; rowIndex < Math.min(rows.length, 12); rowIndex += 1) {
      const row = rows[rowIndex];
      if (rowIsEmpty(row)) {
        continue;
      }

      for (const [source, profile] of Object.entries(providerDetectionProfiles) as Array<
        [
          Exclude<ImportedFileSource, "hostlyx_excel" | "financial_statement">,
          (typeof providerDetectionProfiles)[Exclude<ImportedFileSource, "hostlyx_excel" | "financial_statement">],
        ]
      >) {
        const indexes = mapOptionalHeaderIndexes(row, profile.columns);
        const matchedColumns = countMatchedColumns(indexes);

        if (
          typeof indexes.checkIn !== "number" ||
          (typeof indexes.checkOut !== "number" && typeof indexes.nights !== "number")
        ) {
          continue;
        }

        if (matchedColumns < 4) {
          continue;
        }

        const normalizedHeaders = row.map((cell) => normalizeHeader(cell));
        const distinctiveHits = normalizedHeaders.filter((header) =>
          profile.distinctiveHeaders.some((token) => header.includes(token)),
        ).length;

        candidates.push({
          source,
          sheetName,
          headerRowIndex: rowIndex,
          indexes,
          score:
            matchedColumns * 4 +
            distinctiveHits * 3 +
            getFilenameHintScore(fileName, profile.filenameHints),
        });
      }
    }
  }

  return candidates.sort((left, right) => right.score - left.score)[0] ?? null;
}

function getCell(row: SheetRow, index: number | undefined) {
  return typeof index === "number" ? row[index] : "";
}

function deriveProviderDates({
  checkInRaw,
  checkOutRaw,
  nights,
}: {
  checkInRaw: CellValue;
  checkOutRaw: CellValue;
  nights: number;
}) {
  let checkIn = parseExcelDate(checkInRaw);
  let checkOut = parseExcelDate(checkOutRaw);

  if (checkIn && !checkOut && nights > 0) {
    checkOut = formatISO(addDays(new Date(checkIn), nights), { representation: "date" });
  }

  if (!checkIn && checkOut && nights > 0) {
    checkIn = formatISO(addDays(new Date(checkOut), -nights), { representation: "date" });
  }

  return { checkIn, checkOut };
}

function parseProviderWorkbook(
  workbook: XLSX.WorkBook,
  fileName: string,
): ParsedImportFile {
  const detected = detectProviderSheet(workbook, fileName);

  if (!detected) {
    throw new Error(
      "Hostlyx could not detect the booking columns in this file. Export a reservations or payouts report from Airbnb or Booking.com, or use the Hostlyx workbook template.",
    );
  }

  const profile = providerDetectionProfiles[detected.source];
  const rows = getSheetRows(workbook.Sheets[detected.sheetName]);
  const warnings: ParsedImportSummary["warnings"] = [];
  const bookings: BookingRecord[] = [];
  let skippedRows = 0;
  let payoutsDetected = 0;
  let feesDetected = 0;

  if (!detected.indexes.payout) {
    warnings.push({
      code: "missing_payout_column",
      message:
        "No payout column was found. Hostlyx will derive payout from gross revenue minus fees when possible.",
    });
  }

  if (!detected.indexes.platformFee && !detected.indexes.taxes) {
    warnings.push({
      code: "missing_fee_columns",
      message:
        "No fee or tax columns were found. Platform fees will stay at 0 unless Hostlyx can infer them from gross revenue and payout.",
    });
  }

  if (detected.source === "generic_excel") {
    warnings.push({
      code: "generic_detection",
      message:
        "Hostlyx could not confidently identify the source, so this file was imported as Generic Excel.",
    });
  }

  for (const row of rows.slice(detected.headerRowIndex + 1)) {
    if (rowIsEmpty(row)) {
      continue;
    }

    const explicitNights = parseCount(getCell(row, detected.indexes.nights));
    const { checkIn, checkOut } = deriveProviderDates({
      checkInRaw: getCell(row, detected.indexes.checkIn),
      checkOutRaw: getCell(row, detected.indexes.checkOut),
      nights: explicitNights,
    });

    if (!checkIn || !checkOut) {
      skippedRows += 1;
      continue;
    }

    const dateDifference = differenceInCalendarDays(new Date(checkOut), new Date(checkIn));
    const nights = Math.max(1, explicitNights || dateDifference || 1);
    const guestName = String(getCell(row, detected.indexes.guestName) ?? "").trim() || "Guest";
    const guestCount = parseCount(getCell(row, detected.indexes.guestCount));
    const bookingReference = String(getCell(row, detected.indexes.bookingReference) ?? "").trim();
    const unitName = String(getCell(row, detected.indexes.propertyName) ?? "").trim();
    const cleaningFee = parsePositiveCurrency(getCell(row, detected.indexes.cleaningFee));
    const extraFee = parsePositiveCurrency(getCell(row, detected.indexes.extraFee));
    const taxAmount = parsePositiveCurrency(getCell(row, detected.indexes.taxes));
    let hostFee = parsePositiveCurrency(getCell(row, detected.indexes.platformFee));
    let totalRevenue = parsePositiveCurrency(getCell(row, detected.indexes.grossRevenue));
    let payout = parsePositiveCurrency(getCell(row, detected.indexes.payout));

    if (totalRevenue === 0 && payout > 0) {
      totalRevenue = payout + hostFee + taxAmount;
    }

    if (payout === 0 && totalRevenue > 0) {
      payout = Math.max(0, totalRevenue - hostFee - taxAmount);
    }

    if (hostFee === 0 && totalRevenue > 0 && payout > 0 && totalRevenue >= payout) {
      hostFee = Math.max(0, totalRevenue - payout);
    }

    if (totalRevenue <= 0 && payout <= 0 && !bookingReference && !guestName) {
      skippedRows += 1;
      continue;
    }

    if (payout > 0) {
      payoutsDetected += 1;
    }

    if (hostFee > 0 || taxAmount > 0) {
      feesDetected += 1;
    }

    bookings.push({
      propertyName: "Default Property",
      unitName,
      importedSource: detected.source,
      checkIn,
      checkout: checkOut,
      guestName,
      guestCount,
      channel:
        String(getCell(row, detected.indexes.channel) ?? "").trim() ||
        getImportedSourceLabel(detected.source),
      rentalPeriod: `${nights} nights`,
      pricePerNight: nights > 0 ? totalRevenue / nights : totalRevenue,
      extraFee,
      discount: 0,
      rentalRevenue: totalRevenue,
      cleaningFee,
      taxAmount,
      totalRevenue,
      hostFee,
      payout,
      nights,
      bookingNumber: bookingReference,
      overbookingStatus: "",
    });
  }

  if (!bookings.length) {
    throw new Error(
      "Hostlyx found the file structure, but no usable booking rows were detected after validation.",
    );
  }

  if (skippedRows > 0) {
    warnings.push({
      code: "skipped_rows",
      message: `Hostlyx skipped ${skippedRows} row${skippedRows === 1 ? "" : "s"} because the dates were missing or incomplete.`,
    });
  }

  return {
    importedSource: detected.source,
    sourceLabel: profile.label,
    bookings,
    expenses: [],
    closures: [],
    summary: {
      source: detected.source,
      sourceLabel: profile.label,
      rowsImported: bookings.length,
      bookingsImported: bookings.length,
      payoutsDetected,
      feesDetected,
      skippedRows,
      warnings,
    },
  };
}

export function parseWorkbook(buffer: ArrayBuffer) {
  const workbook = XLSX.read(buffer, {
    type: "array",
    cellDates: true,
  });

  return parseHostlyxWorkbook(workbook);
}

export function parseImportFile(buffer: ArrayBuffer, fileName: string): ParsedImportFile {
  const workbook = XLSX.read(buffer, {
    type: "array",
    cellDates: true,
  });

  const hasBookingsSheet = Boolean(getOptionalWorksheet(workbook, "Bookings"));
  const hasExpensesSheet = Boolean(getOptionalWorksheet(workbook, "Expenses"));

  if (hasBookingsSheet && hasExpensesSheet) {
    const { bookings, expenses, closures } = parseHostlyxWorkbook(workbook);
    return {
      importedSource: "hostlyx_excel",
      sourceLabel: "Generic Excel",
      bookings,
      expenses,
      closures,
      summary: {
        source: "hostlyx_excel",
        sourceLabel: "Generic Excel",
        rowsImported: bookings.length + expenses.length + closures.length,
        bookingsImported: bookings.length,
        payoutsDetected: bookings.filter((booking) => booking.payout > 0).length,
        feesDetected: bookings.filter((booking) => booking.hostFee > 0).length,
        skippedRows: 0,
        warnings: [],
      },
    };
  }

  return parseProviderWorkbook(workbook, fileName);
}

export { getImportedSourceLabel };

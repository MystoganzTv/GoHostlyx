import type {
  BookingRecord,
  CalendarEventRecord,
  ExpenseRecord,
  ImportedFileSource,
} from "@/lib/types";
import { summarizeAutoFixes } from "./autoFix";
import { matchBookingsToCalendar } from "./calendarMatch";
import { detectDuplicateBookings } from "./dedupe";
import { detectSource } from "./detectSource";
import { extractFinancialStatement } from "./financialStatement";
import { normalizeAirbnb } from "./normalizeAirbnb";
import { normalizeBooking } from "./normalizeBooking";
import { normalizeGeneric } from "./normalizeGeneric";
import { normalizeManual } from "./normalizeManual";
import { parseWorkbook } from "./parseWorkbook";
import { calculateNights, inferDatePreferenceFromSheet, parseImportDateDetailed } from "./dates";
import { parseMoney } from "./money";
import { validateBookingRow } from "./validators";
import {
  type ImportEditableBooking,
  getDetectedSourceLabel,
  type ImportBookingCandidate,
  type ImportDetectedSource,
  type ImportExpenseCandidate,
  type ImportManualMappingFieldIssue,
  type ImportManualMapping,
  type ImportManualMappingField,
  type ImportPreview,
  type ImportRowDecision,
  type ImportPreviewTableRow,
  type ImportRowResolution,
  type ImportReviewRow,
  type ImportReviewSection,
  type ImportValidationWarning,
} from "./types";
import { normalizeHeader, rowIsEmpty } from "./columnMatchers";

function hasBlockingIssues(warnings: ImportValidationWarning[]) {
  return warnings.some((warning) => warning.severity === "error");
}

function normalizeComparableText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function isExistingBookingDuplicate(
  candidate: ImportBookingCandidate,
  existingBookings: BookingRecord[],
) {
  const reference = normalizeComparableText(candidate.booking.bookingReference);
  if (reference) {
    return existingBookings.some(
      (existing) => normalizeComparableText(existing.bookingNumber) === reference,
    );
  }

  const guestName = normalizeComparableText(candidate.booking.guestName);
  return existingBookings.some((existing) => {
    return (
      normalizeComparableText(existing.guestName) === guestName &&
      existing.checkIn === candidate.booking.checkIn &&
      existing.checkout === candidate.booking.checkOut &&
      Math.abs(existing.payout - candidate.booking.payout) < 0.01
    );
  });
}

function hasMissingKeyData(candidate: ImportBookingCandidate) {
  return (
    !candidate.booking.guestName.trim() ||
    !candidate.booking.propertyName.trim() ||
    !candidate.booking.channel.trim()
  );
}

function getDecisionReason(fallback: string, context?: { message: string } | null) {
  if (context?.message) {
    return context.message;
  }

  return fallback;
}

export function classifyImportRow(
  row: ImportBookingCandidate,
  matchResult: ImportBookingCandidate["calendarMatch"],
  existingBookings: BookingRecord[],
): ImportRowDecision {
  const isDuplicate = Boolean(row.duplicate) || isExistingBookingDuplicate(row, existingBookings);
  const matchScore = matchResult?.score ?? 0;
  const matchType = matchResult?.matchType ?? "none";
  const isConflict = Boolean(matchResult?.isConflict);
  const invalidWarning =
    row.warnings.find((warning) => warning.severity === "error") ??
    row.warnings.find((warning) => warning.code === "negative_payout");
  const missingKeyData = hasMissingKeyData(row);

  if (isDuplicate) {
    return {
      status: "blocked",
      reason: getDecisionReason(
        "This booking already exists in Hostlyx and will stay blocked to avoid duplicates.",
        row.duplicate,
      ),
      matchScore,
      matchType,
      isConflict,
      isDuplicate: true,
    };
  }

  if (invalidWarning) {
    return {
      status: "blocked",
      reason: getDecisionReason(
        "This row has invalid date or payout data and cannot be imported yet.",
        invalidWarning,
      ),
      matchScore,
      matchType,
      isConflict,
      isDuplicate: false,
    };
  }

  if (isConflict) {
    return {
      status: "needs-review",
      reason: "The stay dates conflict with a blocked calendar event, so it should be reviewed after import.",
      matchScore,
      matchType,
      isConflict: true,
      isDuplicate: false,
    };
  }

  if (missingKeyData) {
    return {
      status: "needs-review",
      reason: "Some key booking details are missing, so this row should be reviewed after import.",
      matchScore,
      matchType,
      isConflict: false,
      isDuplicate: false,
    };
  }

  if (matchResult?.eventType === "booking" && matchScore >= 90) {
    return {
      status: "auto-approved",
      reason: "This booking is an exact operational match and is ready to import.",
      matchScore,
      matchType,
      isConflict: false,
      isDuplicate: false,
    };
  }

  if (matchResult?.eventType === "booking" && matchScore >= 70 && !isConflict) {
    return {
      status: "auto-approved",
      reason: "This booking matched the synced calendar strongly enough to auto-approve.",
      matchScore,
      matchType,
      isConflict: false,
      isDuplicate: false,
    };
  }

  if (matchScore >= 40 && matchScore < 70) {
    return {
      status: "needs-review",
      reason: "This row looks close to a synced calendar stay, so Hostlyx will import it and mark it for review.",
      matchScore,
      matchType,
      isConflict: false,
      isDuplicate: false,
    };
  }

  if (matchScore < 40 && !isDuplicate && !isConflict) {
    return {
      status: "auto-approved",
      reason: "No strong existing match was found, so this row is ready as a new booking.",
      matchScore,
      matchType,
      isConflict: false,
      isDuplicate: false,
    };
  }

  return {
    status: "needs-review",
    reason: "This row should be reviewed after import before you rely on it.",
    matchScore,
    matchType,
    isConflict,
    isDuplicate,
  };
}

function describeBookingCandidate(
  row: ImportBookingCandidate,
  section: ImportReviewSection,
): ImportReviewRow {
  const matchReason = row.calendarMatch?.message;
  return {
    id: `booking-${row.rowIndex}`,
    rowType: "booking",
    rowIndex: row.rowIndex,
    section,
    title: row.booking.guestName || row.booking.bookingReference || "Booking row",
    subtitle: `${row.booking.channel} • ${row.booking.checkIn || "—"} to ${row.booking.checkOut || "—"}`,
    reasons:
      section === "duplicates" && row.duplicate
        ? [row.duplicate.message, ...row.warnings.map((warning) => warning.message)]
        : section === "conflicts" && matchReason
          ? [matchReason, ...row.warnings.map((warning) => warning.message)]
        : [
              ...(matchReason && section === "warnings" ? [matchReason] : []),
              ...row.booking.autoFixesApplied,
              ...row.warnings.map((warning) => warning.message),
            ],
    canResolve: section !== "valid",
    booking:
      section === "valid"
        ? undefined
        : {
            propertyName: row.booking.propertyName,
            bookingReference: row.booking.bookingReference,
            guestName: row.booking.guestName,
            channel: row.booking.channel,
            checkIn: row.booking.checkIn,
            checkOut: row.booking.checkOut,
            guests: row.booking.guests,
            grossRevenue: row.booking.grossRevenue,
            platformFee: row.booking.platformFee,
            cleaningFee: row.booking.cleaningFee,
            taxAmount: row.booking.taxAmount,
            payout: row.booking.payout,
            status: row.booking.status,
          },
  };
}

function describeExpenseCandidate(
  row: ImportExpenseCandidate,
  section: ImportReviewSection,
): ImportReviewRow {
  return {
    id: `expense-${row.rowIndex}`,
    rowType: "expense",
    rowIndex: row.rowIndex,
    section,
    title: row.expense.category || "Expense row",
    subtitle: `${row.expense.date || "—"} • ${row.expense.description || row.expense.note || "Expense"}`,
    reasons: [...row.expense.autoFixesApplied, ...row.warnings.map((warning) => warning.message)],
  };
}

function getTableRowStatus(candidate: ImportBookingCandidate): ImportPreviewTableRow["status"] {
  if (candidate.decision?.status === "blocked") {
    return "warning";
  }

  if (candidate.decision?.status === "needs-review" && candidate.calendarMatch?.isConflict) {
    return "conflict";
  }

  if (candidate.decision?.isDuplicate) {
    return "duplicate";
  }

  if (candidate.rowStatus === "matched") {
    return "matched";
  }

  if (candidate.decision?.status === "needs-review" || candidate.warnings.length > 0) {
    return "warning";
  }

  return "new";
}

function getMatchLabel(candidate: ImportBookingCandidate) {
  if (!candidate.calendarMatch || candidate.calendarMatch.matchType === "none") {
    return "No calendar match";
  }

  if (candidate.calendarMatch.isConflict) {
    return "Calendar conflict";
  }

  if (candidate.calendarMatch.matchType === "exact") {
    return "Strong calendar match";
  }

  if (candidate.calendarMatch.matchType === "probable") {
    return "Likely calendar match";
  }

  return "Possible calendar match";
}

function categorizeBookingCandidate(candidate: ImportBookingCandidate): ImportReviewSection {
  if (candidate.decision?.status === "blocked") {
    if (candidate.duplicate) {
      return "duplicates";
    }

    return "errors";
  }

  if (candidate.decision?.status === "needs-review" && candidate.calendarMatch?.isConflict) {
    return "conflicts";
  }

  if (candidate.decision?.status === "needs-review" || candidate.warnings.length > 0) {
    return "warnings";
  }

  return "valid";
}

function categorizeExpenseCandidate(candidate: ImportExpenseCandidate): ImportReviewSection {
  if (hasBlockingIssues(candidate.warnings)) {
    return "errors";
  }

  if (candidate.warnings.length > 0) {
    return "warnings";
  }

  return "valid";
}

function getLikelyHeaderRow(workbook: ReturnType<typeof parseWorkbook>) {
  let best:
    | {
        sheetName: string;
        headerRowIndex: number;
        headers: string[];
        score: number;
      }
    | undefined;

  for (const sheet of workbook.sheets) {
    for (let rowIndex = 0; rowIndex < Math.min(sheet.rows.length, 8); rowIndex += 1) {
      const row = sheet.rows[rowIndex];
      if (rowIsEmpty(row)) {
        continue;
      }

      const headers = row.map((cell) => String(cell ?? "").trim());
      const score = headers.filter(Boolean).length;
      if (!best || score > best.score) {
        best = {
          sheetName: sheet.name,
          headerRowIndex: rowIndex,
          headers,
          score,
        };
      }
    }
  }

  return best;
}

function suggestMappedColumn(headers: string[], field: ImportManualMappingField) {
  const aliases: Record<ImportManualMappingField, string[]> = {
    guestName: ["guest", "name", "booker", "customer", "huesped", "cliente"],
    checkIn: ["arrival", "checkin", "start", "from", "fecha", "inicio", "entrada"],
    checkOut: ["departure", "checkout", "end", "finalizacion", "salida"],
    grossRevenue: ["revenue", "amount", "gross", "price", "total", "ganancias", "importe", "ingreso"],
    payout: ["payout", "net", "earnings", "received", "neto", "pago"],
    propertyName: ["property", "listing", "accommodation", "unit", "home", "propiedad", "anuncio", "alojamiento"],
  };

  const normalizedHeaders = headers.map((header) => normalizeHeader(header));
  const fieldAliases = aliases[field].map((alias) => normalizeHeader(alias));
  let bestIndex: number | null = null;
  let bestScore = 0;

  normalizedHeaders.forEach((header, index) => {
    if (!header) {
      return;
    }

    for (const alias of fieldAliases) {
      let score = 0;

      if (header === alias) {
        score = 4;
      } else if (
        alias.length >= 3 &&
        (header.includes(alias) || (header.length >= 3 && alias.includes(header)))
      ) {
        score = 3;
      } else {
        const tokens = alias.split(/[^a-z0-9]/).filter(Boolean);
        if (tokens.some((token) => header.includes(token))) {
          score = 2;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }
  });

  return bestIndex;
}

function buildManualFieldIssue(
  headers: string[],
  rows: Array<Array<string | number | boolean | Date | null | undefined>>,
  field: ImportManualMappingField,
  selectedIndex: number | null,
): ImportManualMappingFieldIssue | null {
  if (selectedIndex == null) {
    return null;
  }

  const header = headers[selectedIndex] ?? "";
  const normalizedHeader = normalizeHeader(header);
  const sampleValues = rows
    .map((row) => row[selectedIndex])
    .filter((value) => String(value ?? "").trim() !== "")
    .slice(0, 12);

  const headerGroups: Record<ImportManualMappingField, string[]> = {
    guestName: ["guest", "name", "booker", "customer", "huesped", "cliente", "contact"],
    checkIn: ["arrival", "checkin", "start", "fecha", "inicio", "entrada"],
    checkOut: ["departure", "checkout", "end", "finalizacion", "salida"],
    grossRevenue: ["revenue", "amount", "gross", "price", "total", "ganancias", "importe", "ingreso"],
    payout: ["payout", "net", "earnings", "received", "neto", "pago", "ganancias"],
    propertyName: ["property", "listing", "accommodation", "unit", "home", "propiedad", "anuncio", "alojamiento"],
  };

  const headerLooksRelevant = headerGroups[field].some((alias) => {
    const normalizedAlias = normalizeHeader(alias);
    return (
      normalizedHeader === normalizedAlias ||
      (normalizedAlias.length >= 3 &&
        (normalizedHeader.includes(normalizedAlias) || normalizedAlias.includes(normalizedHeader)))
    );
  });

  if (field === "checkIn" || field === "checkOut") {
    const datePreference = inferDatePreferenceFromSheet(headers, rows, [selectedIndex]);
    const validDateSamples = sampleValues.filter(
      (value) => !!parseImportDateDetailed(value, { datePreference }).value,
    ).length;

    if (sampleValues.length > 0 && validDateSamples === 0) {
      return {
        severity: "error",
        message: "This column does not look like a date column.",
      };
    }

    if (!headerLooksRelevant && validDateSamples < Math.min(2, sampleValues.length)) {
      return {
        severity: "warning",
        message: "This column may not be the right date field.",
      };
    }
  }

  if (field === "grossRevenue" || field === "payout") {
    const validMoneySamples = sampleValues.filter((value) => !parseMoney(value).malformed).length;

    if (sampleValues.length > 0 && validMoneySamples === 0) {
      return {
        severity: "error",
        message: "This column does not look like a money amount.",
      };
    }

    if (!headerLooksRelevant && validMoneySamples < Math.min(2, sampleValues.length)) {
      return {
        severity: "warning",
        message: "This column may not be the right amount field.",
      };
    }
  }

  if (field === "guestName") {
    const textSamples = sampleValues.filter((value) => {
      const raw = String(value ?? "").trim();
      return raw.length > 0 && !/^\d+(?:[.,]\d+)?$/.test(raw);
    }).length;

    if (sampleValues.length > 0 && textSamples === 0) {
      return {
        severity: "error",
        message: "This column does not look like guest names.",
      };
    }
  }

  return null;
}

function buildManualMappingPreview(
  workbook: ReturnType<typeof parseWorkbook>,
  manualMapping?: ImportManualMapping | null,
) {
  const headerRow = getLikelyHeaderRow(workbook);
  if (!headerRow) {
    return null;
  }

  const suggested = {
    guestName: suggestMappedColumn(headerRow.headers, "guestName"),
    checkIn: suggestMappedColumn(headerRow.headers, "checkIn"),
    checkOut: suggestMappedColumn(headerRow.headers, "checkOut"),
    grossRevenue: suggestMappedColumn(headerRow.headers, "grossRevenue"),
    payout: suggestMappedColumn(headerRow.headers, "payout"),
    propertyName: suggestMappedColumn(headerRow.headers, "propertyName"),
  };

  const selected = {
    guestName:
      manualMapping?.sheetName === headerRow.sheetName &&
      manualMapping.headerRowIndex === headerRow.headerRowIndex
        ? manualMapping.guestName
        : suggested.guestName,
    checkIn:
      manualMapping?.sheetName === headerRow.sheetName &&
      manualMapping.headerRowIndex === headerRow.headerRowIndex
        ? manualMapping.checkIn
        : suggested.checkIn,
    checkOut:
      manualMapping?.sheetName === headerRow.sheetName &&
      manualMapping.headerRowIndex === headerRow.headerRowIndex
        ? manualMapping.checkOut
        : suggested.checkOut,
    grossRevenue:
      manualMapping?.sheetName === headerRow.sheetName &&
      manualMapping.headerRowIndex === headerRow.headerRowIndex
        ? manualMapping.grossRevenue
        : suggested.grossRevenue,
    payout:
      manualMapping?.sheetName === headerRow.sheetName &&
      manualMapping.headerRowIndex === headerRow.headerRowIndex
        ? manualMapping.payout
        : suggested.payout,
    propertyName:
      manualMapping?.sheetName === headerRow.sheetName &&
      manualMapping.headerRowIndex === headerRow.headerRowIndex
        ? manualMapping.propertyName
        : suggested.propertyName,
  };

  const sheet = workbook.sheets.find((entry) => entry.name === headerRow.sheetName);
  const dataRows = sheet ? sheet.rows.slice(headerRow.headerRowIndex + 1).filter((row) => !rowIsEmpty(row)) : [];
  const fieldIssues: Partial<Record<ImportManualMappingField, ImportManualMappingFieldIssue>> = {};

  (Object.keys(selected) as ImportManualMappingField[]).forEach((field) => {
    const issue = buildManualFieldIssue(headerRow.headers, dataRows, field, selected[field]);
    if (issue) {
      fieldIssues[field] = issue;
    }
  });

  const requiredFields: ImportManualMappingField[] = [
    "guestName",
    "checkIn",
    "checkOut",
    "grossRevenue",
  ];

  return {
    message: "We couldn’t fully recognize your file. Map your columns in a few seconds to continue.",
    sheetName: headerRow.sheetName,
    headerRowIndex: headerRow.headerRowIndex,
    columns: headerRow.headers.map((label, index) => ({
      index,
      label: label || `Column ${index + 1}`,
    })),
    suggested,
    selected,
    fieldIssues,
    requiredReady:
      requiredFields.every((field) => selected[field] != null) &&
      requiredFields.every((field) => fieldIssues[field]?.severity !== "error"),
  };
}

function applyBookingOverride(
  candidate: ImportBookingCandidate,
  override: Partial<ImportEditableBooking>,
): ImportBookingCandidate {
  const booking = {
    ...candidate.booking,
    propertyName: String(override.propertyName ?? candidate.booking.propertyName ?? "").trim(),
    bookingReference: String(override.bookingReference ?? candidate.booking.bookingReference ?? "").trim(),
    guestName: String(override.guestName ?? candidate.booking.guestName ?? "").trim(),
    channel: String(override.channel ?? candidate.booking.channel ?? "").trim(),
    checkIn: String(override.checkIn ?? candidate.booking.checkIn ?? "").trim(),
    checkOut: String(override.checkOut ?? candidate.booking.checkOut ?? "").trim(),
    guests:
      typeof override.guests === "number" && Number.isFinite(override.guests)
        ? Math.max(0, Math.trunc(override.guests))
        : candidate.booking.guests,
    grossRevenue:
      typeof override.grossRevenue === "number" && Number.isFinite(override.grossRevenue)
        ? override.grossRevenue
        : candidate.booking.grossRevenue,
    platformFee:
      typeof override.platformFee === "number" && Number.isFinite(override.platformFee)
        ? Math.max(0, override.platformFee)
        : candidate.booking.platformFee,
    cleaningFee:
      typeof override.cleaningFee === "number" && Number.isFinite(override.cleaningFee)
        ? Math.max(0, override.cleaningFee)
        : candidate.booking.cleaningFee,
    taxAmount:
      typeof override.taxAmount === "number" && Number.isFinite(override.taxAmount)
        ? Math.max(0, override.taxAmount)
        : candidate.booking.taxAmount,
    payout:
      typeof override.payout === "number" && Number.isFinite(override.payout)
        ? override.payout
        : candidate.booking.payout,
    status: String(override.status ?? candidate.booking.status ?? "").trim() || "Booked",
  };

  booking.nights = calculateNights(booking.checkIn, booking.checkOut);

  const warnings = validateBookingRow({
    booking,
    rowIndex: candidate.rowIndex,
  });

  return {
    ...candidate,
    booking: {
      ...booking,
      needsReview: warnings.length > 0,
      reviewReasons: warnings.map((warning) => warning.message),
    },
    warnings,
  };
}

export function buildImportPreview(
  buffer: ArrayBuffer,
  fileName: string,
  existingBookings: BookingRecord[] = [],
  existingCalendarEvents: CalendarEventRecord[] = [],
  options?: {
    propertyName?: string;
    manualMapping?: ImportManualMapping | null;
    rowResolutions?: ImportRowResolution[];
  },
): ImportPreview {
  const workbook = parseWorkbook(buffer, fileName);
  let source = detectSource(workbook);
  const manualMapping = buildManualMappingPreview(workbook, options?.manualMapping);
  const shouldUseManualMapping = Boolean(options?.manualMapping && manualMapping?.requiredReady);

  if (source === "financial_statement") {
    const statement = extractFinancialStatement(workbook);
    const blockMessage = statement
      ? "This looks like a payout statement. Hostlyx will save it for Payouts instead of creating booking rows."
      : "This looks like a payout statement, but Hostlyx still needs a readable payout total before it can save it to Payouts.";

    return {
      source,
      sourceLabel: getDetectedSourceLabel(source),
      fileName,
      requiresManualMapping: false,
      blocksImport: !statement,
      blockMessage,
      manualMapping: null,
      totalRowsRead: workbook.sheets.reduce((sum, sheet) => sum + Math.max(0, sheet.rows.length - 1), 0),
      validRows: statement ? 1 : 0,
      warningRows: 0,
      duplicateRows: 0,
      matchedRows: 0,
      conflictRows: 0,
      newRows: 0,
      errorRows: 0,
      skippedRows: 0,
      autoFixedRows: 0,
      autoFixSummary: [],
      expensesDetected: 0,
      importableRows: statement ? 1 : 0,
      bookings: [],
      expenses: [],
      financialStatement: statement,
      previewRows: [],
      reviewRows: {
        valid: [],
        warnings: [],
        duplicates: [],
        conflicts: [],
        errors: [],
      },
      warnings: [
        {
          rowType: "file",
          rowIndex: 0,
          code: "financial_statement_file",
          message: blockMessage,
          severity: "warning",
        },
      ],
      duplicates: [],
      calendarMatches: [],
      tableRows: [],
      canImport: Boolean(statement),
    };
  }

  if (source === "unknown" && !manualMapping?.requiredReady) {
    return {
      source,
      sourceLabel: getDetectedSourceLabel(source),
      fileName,
      requiresManualMapping: true,
      blocksImport: false,
      blockMessage: null,
      manualMapping,
      totalRowsRead: workbook.sheets.reduce((sum, sheet) => sum + Math.max(0, sheet.rows.length - 1), 0),
      validRows: 0,
      warningRows: 0,
      duplicateRows: 0,
      matchedRows: 0,
      conflictRows: 0,
      newRows: 0,
      errorRows: 0,
      skippedRows: 0,
      autoFixedRows: 0,
      autoFixSummary: [],
      expensesDetected: 0,
      importableRows: 0,
      bookings: [],
      expenses: [],
      financialStatement: null,
      previewRows: [],
      reviewRows: {
        valid: [],
        warnings: [],
        duplicates: [],
        conflicts: [],
        errors: [],
      },
      warnings: [
        {
          rowType: "file",
          rowIndex: 0,
          code: "unknown_source",
          message:
            "We couldn’t fully recognize your file. Map your columns in a few seconds to continue.",
          severity: "warning",
        },
      ],
      duplicates: [],
      calendarMatches: [],
      tableRows: [],
      canImport: false,
    };
  }

  let normalized;

  try {
    normalized =
      shouldUseManualMapping
        ? normalizeManual(workbook, {
            sheetName: manualMapping?.sheetName ?? workbook.sheets[0]?.name ?? "",
            headerRowIndex: manualMapping?.headerRowIndex ?? 0,
            guestName: manualMapping?.selected.guestName ?? null,
            checkIn: manualMapping?.selected.checkIn ?? null,
            checkOut: manualMapping?.selected.checkOut ?? null,
            grossRevenue: manualMapping?.selected.grossRevenue ?? null,
            payout: manualMapping?.selected.payout ?? null,
            propertyName: manualMapping?.selected.propertyName ?? null,
          }, {
            source,
            channel:
              source === "airbnb"
                ? "Airbnb"
                : source === "booking"
                  ? "Booking.com"
                  : "Imported file",
          })
        : source === "airbnb"
        ? normalizeAirbnb(workbook)
        : source === "booking"
          ? normalizeBooking(workbook)
          : source === "generic"
            ? normalizeGeneric(workbook)
            : normalizeManual(workbook, {
                sheetName: manualMapping?.sheetName ?? workbook.sheets[0]?.name ?? "",
                headerRowIndex: manualMapping?.headerRowIndex ?? 0,
                guestName: manualMapping?.selected.guestName ?? null,
                checkIn: manualMapping?.selected.checkIn ?? null,
                checkOut: manualMapping?.selected.checkOut ?? null,
                grossRevenue: manualMapping?.selected.grossRevenue ?? null,
                payout: manualMapping?.selected.payout ?? null,
                propertyName: manualMapping?.selected.propertyName ?? null,
              });
  } catch (error) {
    const normalizationAttempts: Array<{
      source: ImportDetectedSource;
      run: () => ReturnType<typeof normalizeAirbnb>;
    }> = [
      { source: "airbnb", run: () => normalizeAirbnb(workbook) },
      { source: "booking", run: () => normalizeBooking(workbook) },
    ];

    for (const attempt of normalizationAttempts) {
      if (attempt.source === source) {
        continue;
      }

      try {
        normalized = attempt.run();
        source = attempt.source;
        break;
      } catch {
        continue;
      }
    }

    if (!normalized) {
      throw error;
    }
  }

  const bookingResolutionMap = new Map(
    (options?.rowResolutions ?? [])
      .filter((resolution): resolution is Extract<ImportRowResolution, { rowType: "booking" }> => resolution.rowType === "booking")
      .map((resolution) => [resolution.rowIndex, resolution]),
  );

  const resolvedBookings = normalized.bookings
    .filter((candidate) => bookingResolutionMap.get(candidate.rowIndex)?.action !== "skip")
    .map((candidate) => {
      const resolution = bookingResolutionMap.get(candidate.rowIndex);
      if (resolution?.action === "override") {
        return applyBookingOverride(candidate, resolution.booking);
      }

      return candidate;
    });
  const bookingsWithProperty = resolvedBookings.map((candidate) => ({
    ...candidate,
    booking: {
      ...candidate.booking,
      propertyName: candidate.booking.propertyName || options?.propertyName || "",
    },
  }));

  const { bookings: matchedBookings, calendarMatches } = matchBookingsToCalendar(
    bookingsWithProperty,
    existingCalendarEvents,
  );
  const duplicateFlags = detectDuplicateBookings(matchedBookings, existingBookings);
  const duplicatesByRowIndex = new Map(duplicateFlags.map((duplicate) => [duplicate.rowIndex, duplicate]));
  const bookingRows = matchedBookings.map((candidate) => ({
    ...candidate,
    duplicate: duplicatesByRowIndex.get(candidate.rowIndex),
    rowStatus:
      candidate.calendarMatch?.isConflict
        ? "conflict"
        : duplicatesByRowIndex.has(candidate.rowIndex)
          ? "duplicate"
          : candidate.rowStatus ?? "new",
    decision: classifyImportRow(
      {
        ...candidate,
        duplicate: duplicatesByRowIndex.get(candidate.rowIndex),
      },
      candidate.calendarMatch,
      existingBookings,
    ),
  }));

  const reviewRows: Record<ImportReviewSection, ImportReviewRow[]> = {
    valid: [],
    warnings: [],
    duplicates: [],
    conflicts: [],
    errors: [],
  };

  for (const row of bookingRows) {
    const section = categorizeBookingCandidate(row);
    reviewRows[section].push(describeBookingCandidate(row, section));
  }

  for (const row of normalized.expenses) {
    const section = categorizeExpenseCandidate(row);
    reviewRows[section].push(describeExpenseCandidate(row, section));
  }

  const validRows = reviewRows.valid.length;
  const warningRows = reviewRows.warnings.length;
  const duplicateRows = reviewRows.duplicates.length;
  const conflictRows = reviewRows.conflicts.length;
  const errorRows = reviewRows.errors.length;
  const importableRows = validRows + warningRows + duplicateRows;
  const matchedRows = bookingRows.filter((row) => row.rowStatus === "matched").length;
  const newRows = bookingRows.filter((row) => row.rowStatus === "new").length;
  const autoFixedRows =
    bookingRows.filter((row) => row.booking.autoFixesApplied.length > 0).length +
    normalized.expenses.filter((row) => row.expense.autoFixesApplied.length > 0).length;
  const autoFixSummary = summarizeAutoFixes(
    bookingRows.map((row) => row.booking),
    normalized.expenses.map((row) => row.expense),
  );
  const tableRows: ImportPreviewTableRow[] = bookingRows.map((row) => ({
    id: `booking-${row.rowIndex}`,
    rowIndex: row.rowIndex,
    guestName: row.booking.guestName || "Guest",
    propertyName: row.booking.propertyName || "Not set",
    checkIn: row.booking.checkIn,
    checkOut: row.booking.checkOut,
    channel: row.booking.channel,
    grossRevenue: row.booking.grossRevenue,
    payout: row.booking.payout,
    status: getTableRowStatus(row),
    matchLabel: getMatchLabel(row),
    matchScore: row.calendarMatch?.score ?? null,
    matchType: row.calendarMatch?.matchType ?? null,
    reasons:
      row.calendarMatch?.reasons?.length
        ? row.calendarMatch.reasons
        : row.warnings.map((warning) => warning.message),
    booking: {
      propertyName: row.booking.propertyName,
      bookingReference: row.booking.bookingReference,
      guestName: row.booking.guestName,
      channel: row.booking.channel,
      checkIn: row.booking.checkIn,
      checkOut: row.booking.checkOut,
      guests: row.booking.guests,
      grossRevenue: row.booking.grossRevenue,
      platformFee: row.booking.platformFee,
      cleaningFee: row.booking.cleaningFee,
      taxAmount: row.booking.taxAmount,
      payout: row.booking.payout,
      status: row.booking.status,
    },
    calendarMatch: row.calendarMatch ?? null,
    canResolve: !row.duplicate || hasBlockingIssues(row.warnings) || Boolean(row.calendarMatch?.isConflict),
    decisionStatus: row.decision?.status ?? "needs-review",
    decisionReason: row.decision?.reason ?? "This row needs review before import.",
    isSelectedByDefault: row.decision?.status === "auto-approved",
    isDisabled: row.decision?.status === "blocked",
    autoFixesApplied: row.booking.autoFixesApplied,
  }));

  return {
    source,
    sourceLabel: source === "unknown" ? "Mapped file" : getDetectedSourceLabel(source),
    fileName,
    requiresManualMapping: source === "unknown",
    blocksImport: false,
    blockMessage: null,
    manualMapping,
    totalRowsRead: normalized.totalRowsRead,
    validRows,
    warningRows,
    duplicateRows,
    matchedRows,
    conflictRows,
    newRows,
    errorRows,
    skippedRows: normalized.skippedRows,
    autoFixedRows,
    autoFixSummary,
    expensesDetected: normalized.expenses.length,
    importableRows,
    bookings: bookingRows,
    expenses: normalized.expenses,
    financialStatement: null,
    previewRows: bookingRows
      .filter((row) => !hasBlockingIssues(row.warnings))
      .slice(0, 5)
      .map((row) => ({
        guestName: row.booking.guestName,
        channel: row.booking.channel,
        checkIn: row.booking.checkIn,
        checkOut: row.booking.checkOut,
        grossRevenue: row.booking.grossRevenue,
        payout: row.booking.payout,
        status: getTableRowStatus(row),
      })),
    tableRows,
    reviewRows,
    warnings: [
      ...bookingRows.flatMap((row) => row.warnings),
      ...normalized.expenses.flatMap((row) => row.warnings),
    ],
    duplicates: duplicateFlags,
    calendarMatches,
    canImport: importableRows > 0,
  };
}

export function mapDetectedSourceToStoredSource(source: ImportDetectedSource): ImportedFileSource {
  switch (source) {
    case "airbnb":
      return "airbnb";
    case "booking":
      return "booking_com";
    case "financial_statement":
      return "financial_statement";
    default:
      return "generic_excel";
  }
}

export function mapPreviewToHostlyxRecords(
  preview: ImportPreview,
  propertyName: string,
): {
  importedSource: ImportedFileSource;
  bookings: BookingRecord[];
  expenses: ExpenseRecord[];
} {
  return {
    importedSource: mapDetectedSourceToStoredSource(preview.source),
    bookings: preview.bookings
      .filter((row) => !hasBlockingIssues(row.warnings))
      .filter((row) => row.rowStatus !== "conflict")
      .filter((row) => !row.duplicate)
      .map((row) => ({
        propertyId: row.booking.propertyId ?? null,
        propertyName,
        unitName: row.booking.unitName ?? "",
        importedSource: mapDetectedSourceToStoredSource(preview.source),
        checkIn: row.booking.checkIn,
        checkout: row.booking.checkOut,
        guestName: row.booking.guestName || "Guest",
        guestCount: row.booking.guests,
        guestContact: row.booking.guestContact ?? "",
        bookedAt: row.booking.bookedAt ?? "",
        adultsCount: row.booking.adultsCount ?? 0,
        childrenCount: row.booking.childrenCount ?? 0,
        infantsCount: row.booking.infantsCount ?? 0,
        channel: row.booking.channel,
        rentalPeriod: `${row.booking.nights} nights`,
        pricePerNight:
          row.booking.nights > 0
            ? row.booking.grossRevenue / row.booking.nights
            : row.booking.grossRevenue,
        extraFee: 0,
        discount: 0,
        rentalRevenue: row.booking.grossRevenue,
        cleaningFee: row.booking.cleaningFee,
        taxAmount: row.booking.taxAmount,
        totalRevenue: row.booking.grossRevenue,
        hostFee: row.booking.platformFee,
        payout: row.booking.payout,
        nights: row.booking.nights,
        bookingNumber: row.booking.bookingReference,
        overbookingStatus: row.booking.status,
        matchStatus:
          row.rowStatus === "conflict"
            ? "conflict_blocked_calendar"
            : row.rowStatus === "matched"
              ? "matched_to_calendar"
              : "unmatched",
        matchedCalendarEventId: row.calendarMatch?.calendarEventId ?? null,
        reviewStatus: row.decision?.status === "needs-review" ? "needs_review" : "ready",
        reviewReason: row.decision?.status === "needs-review" ? row.decision.reason : "",
      })),
    expenses: preview.expenses
      .filter((row) => !hasBlockingIssues(row.warnings))
      .map(({ expense }) => ({
        propertyName,
        unitName: expense.propertyName,
        date: expense.date,
        category: expense.category,
        amount: expense.amount,
        description: expense.description,
        note: expense.note,
      })),
  };
}

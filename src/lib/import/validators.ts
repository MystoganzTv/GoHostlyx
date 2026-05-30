import { differenceInCalendarDays, parseISO } from "date-fns";
import type {
  ImportValidationWarning,
  NormalizedImportBooking,
  NormalizedImportExpense,
  RawImportRow,
} from "./types";

function buildIssue(
  issue: Omit<ImportValidationWarning, "rowType" | "rowIndex">,
  rowType: "booking" | "expense",
  rowIndex: number,
): ImportValidationWarning {
  return {
    rowType,
    rowIndex,
    ...issue,
  };
}

export function rowLooksLikeSummary(rawRow: RawImportRow) {
  const text = Object.values(rawRow)
    .map((value) => String(value ?? "").trim().toLowerCase())
    .join(" ");

  return /\b(total|subtotal|summary|grand total|balance due|overall total)\b/.test(text);
}

export function rowLooksLikeSeparator(rawRow: RawImportRow) {
  const values = Object.values(rawRow).map((value) => String(value ?? "").trim());
  const nonEmptyValues = values.filter(Boolean);

  if (nonEmptyValues.length === 0) {
    return true;
  }

  return nonEmptyValues.every((value) => /^[\s\-–—_=.:/\\|]+$/.test(value));
}

export function validateBookingRow({
  booking,
  rowIndex,
  malformedRequiredMoneyFields,
  malformedOptionalMoneyFields,
  ambiguousDateFields,
  malformedDateFields,
}: {
  booking: NormalizedImportBooking;
  rowIndex: number;
  malformedRequiredMoneyFields?: string[];
  malformedOptionalMoneyFields?: string[];
  ambiguousDateFields?: string[];
  malformedDateFields?: string[];
}) {
  const warnings: ImportValidationWarning[] = [];

  if (rowLooksLikeSummary(booking.rawRow)) {
    warnings.push(
      buildIssue(
        {
          code: "summary_row",
          message: "This row looks like a total or summary line, not a booking.",
          severity: "error",
        },
        "booking",
        rowIndex,
      ),
    );
  }

  if (!booking.checkIn) {
    warnings.push(
      buildIssue(
        {
          code: "missing_check_in",
          message: "Missing check-in date.",
          severity: "error",
        },
        "booking",
        rowIndex,
      ),
    );
  }

  if (!booking.checkOut) {
    warnings.push(
      buildIssue(
        {
          code: "missing_check_out",
          message: "Missing check-out date.",
          severity: "error",
        },
        "booking",
        rowIndex,
      ),
    );
  }

  if (malformedDateFields && malformedDateFields.length > 0) {
    warnings.push(
      buildIssue(
        {
          code: "malformed_dates",
          message: `Some dates could not be read cleanly: ${malformedDateFields.join(", ")}.`,
          severity: "error",
        },
        "booking",
        rowIndex,
      ),
    );
  }

  if (ambiguousDateFields && ambiguousDateFields.length > 0) {
    warnings.push(
      buildIssue(
        {
          code: "ambiguous_dates",
          message: `Some dates may be ambiguous: ${ambiguousDateFields.join(", ")}.`,
          severity: "warning",
        },
        "booking",
        rowIndex,
      ),
    );
  }

  if (booking.nights <= 0) {
    warnings.push(
      buildIssue(
        {
          code: "invalid_stay_length",
          message: "Stay length looks invalid.",
          severity: "error",
        },
        "booking",
        rowIndex,
      ),
    );
  }

  if (booking.checkIn && booking.checkOut) {
    const checkInDate = parseISO(booking.checkIn);
    const checkOutDate = parseISO(booking.checkOut);
    const parsedNights = differenceInCalendarDays(checkOutDate, checkInDate);
    const checkInYear = checkInDate.getUTCFullYear();
    const checkOutYear = checkOutDate.getUTCFullYear();

    if (checkInYear < 2000 || checkOutYear < 2000 || checkInYear > 2100 || checkOutYear > 2100) {
      warnings.push(
        buildIssue(
          {
            code: "implausible_dates",
            message: "Stay dates look implausible. Review the imported dates before saving.",
            severity: "error",
          },
          "booking",
          rowIndex,
        ),
      );
    }

    if (parsedNights > 365) {
      warnings.push(
        buildIssue(
          {
            code: "suspicious_stay_length",
            message: "Stay length looks unusually long. Review the imported dates before saving.",
            severity: "error",
          },
          "booking",
          rowIndex,
        ),
      );
    }
  }

  if (malformedRequiredMoneyFields && malformedRequiredMoneyFields.length > 0) {
    warnings.push(
      buildIssue(
        {
          code: "malformed_money",
          message: `Hostlyx could not read these financial values clearly: ${malformedRequiredMoneyFields.join(", ")}.`,
          severity: "error",
        },
        "booking",
        rowIndex,
      ),
    );
  }

  if (malformedOptionalMoneyFields && malformedOptionalMoneyFields.length > 0) {
    warnings.push(
      buildIssue(
        {
          code: "malformed_optional_money",
          message: `Some optional values looked inconsistent: ${malformedOptionalMoneyFields.join(", ")}.`,
          severity: "warning",
        },
        "booking",
        rowIndex,
      ),
    );
  }

  if (!Number.isFinite(booking.payout)) {
    warnings.push(
      buildIssue(
        {
          code: "invalid_payout",
          message: "Payout could not be read.",
          severity: "error",
        },
        "booking",
        rowIndex,
      ),
    );
  }

  if (booking.payout < 0) {
    warnings.push(
      buildIssue(
        {
          code: "negative_payout",
          message: "Payout is negative. Review this row before importing.",
          severity: "warning",
        },
        "booking",
        rowIndex,
      ),
    );
  }

  if (
    booking.grossRevenue > 0 &&
    booking.platformFee > 0 &&
    booking.platformFee > booking.grossRevenue
  ) {
    warnings.push(
      buildIssue(
        {
          code: "fee_relationship",
          message: "Platform fee is higher than gross revenue.",
          severity: "error",
        },
        "booking",
        rowIndex,
      ),
    );
  }

  if (
    booking.grossRevenue > 0 &&
    booking.payout > 0 &&
    booking.payout > booking.grossRevenue * 1.25
  ) {
    warnings.push(
      buildIssue(
        {
          code: "payout_relationship",
          message: "Payout looks higher than expected relative to gross revenue.",
          severity: "warning",
        },
        "booking",
        rowIndex,
      ),
    );
  }

  if (
    !booking.bookingReference &&
    !booking.guestName &&
    booking.grossRevenue === 0 &&
    booking.payout === 0
  ) {
    warnings.push(
      buildIssue(
        {
          code: "suspicious_row",
          message: "This row looks incomplete and may not be a real booking.",
          severity: "warning",
        },
        "booking",
        rowIndex,
      ),
    );
  }

  return warnings;
}

export function validateExpenseRow({
  expense,
  rowIndex,
  malformedAmount,
  malformedDate,
}: {
  expense: NormalizedImportExpense;
  rowIndex: number;
  malformedAmount?: boolean;
  malformedDate?: boolean;
}) {
  const warnings: ImportValidationWarning[] = [];

  if (rowLooksLikeSummary(expense.rawRow)) {
    warnings.push(
      buildIssue(
        {
          code: "summary_row",
          message: "This row looks like a total or summary line, not an expense.",
          severity: "error",
        },
        "expense",
        rowIndex,
      ),
    );
  }

  if (!expense.date) {
    warnings.push(
      buildIssue(
        {
          code: "missing_expense_date",
          message: "Missing expense date.",
          severity: "error",
        },
        "expense",
        rowIndex,
      ),
    );
  }

  if (malformedDate) {
    warnings.push(
      buildIssue(
        {
          code: "malformed_expense_date",
          message: "Expense date could not be read cleanly.",
          severity: "error",
        },
        "expense",
        rowIndex,
      ),
    );
  }

  if (!Number.isFinite(expense.amount) || malformedAmount) {
    warnings.push(
      buildIssue(
        {
          code: "malformed_expense_amount",
          message: "Expense amount could not be read.",
          severity: "error",
        },
        "expense",
        rowIndex,
      ),
    );
  }

  return warnings;
}

export function hasErrors(warnings: ImportValidationWarning[]) {
  return warnings.some((warning) => warning.severity === "error");
}

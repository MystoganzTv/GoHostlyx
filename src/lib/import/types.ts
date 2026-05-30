export type ImportDetectedSource =
  | "airbnb"
  | "booking"
  | "generic"
  | "financial_statement"
  | "unknown";

export type ImportCellValue = string | number | boolean | Date | null | undefined;
export type ImportSheetRow = ImportCellValue[];

export type RawImportRow = Record<string, string | number | null>;

export type ImportRowType = "booking" | "expense" | "file";

export type ImportValidationWarning = {
  rowType: ImportRowType;
  rowIndex: number;
  code: string;
  message: string;
  severity: "warning" | "error";
};

export type ImportDuplicateFlag = {
  rowType: "booking" | "expense" | "file";
  rowIndex: number;
  code: string;
  message: string;
  severity: "warning";
  matchType: "reference" | "fallback";
  matchScope: "file" | "existing";
};

export type ImportCalendarMatch = {
  rowIndex: number;
  matchType: "exact" | "probable" | "weak" | "none" | "conflict";
  score: number;
  isConflict: boolean;
  calendarEventId: number;
  source: "airbnb" | "booking" | "vrbo" | "other";
  summary: string;
  startDate: string;
  endDate: string;
  eventType: "booking" | "blocked" | "unknown";
  message: string;
  reasons: string[];
};

export type ImportBookingRowStatus = "new" | "matched" | "duplicate" | "conflict";
export type ImportDecisionStatus = "auto-approved" | "needs-review" | "blocked";

export type ImportRowDecision = {
  status: ImportDecisionStatus;
  reason: string;
  matchScore: number;
  matchType: ImportCalendarMatch["matchType"];
  isConflict: boolean;
  isDuplicate: boolean;
};

export type NormalizedImportBooking = {
  source: ImportDetectedSource;
  propertyId?: number | null;
  propertyName: string;
  unitName?: string;
  bookingReference: string;
  guestName: string;
  guestContact?: string;
  bookedAt?: string;
  adultsCount?: number;
  childrenCount?: number;
  infantsCount?: number;
  channel: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  grossRevenue: number;
  platformFee: number;
  cleaningFee: number;
  taxAmount: number;
  payout: number;
  currency: string;
  status: string;
  rawRow: RawImportRow;
  autoFixesApplied: string[];
  needsReview: boolean;
  reviewReasons: string[];
};

export type NormalizedImportExpense = {
  source: ImportDetectedSource;
  propertyName: string;
  date: string;
  category: string;
  description: string;
  note: string;
  amount: number;
  rawRow: RawImportRow;
  autoFixesApplied: string[];
  needsReview: boolean;
  reviewReasons: string[];
};

export type ImportBookingCandidate = {
  rowIndex: number;
  booking: NormalizedImportBooking;
  warnings: ImportValidationWarning[];
  duplicate?: ImportDuplicateFlag;
  calendarMatch?: ImportCalendarMatch;
  rowStatus?: ImportBookingRowStatus;
  decision?: ImportRowDecision;
};

export type ImportExpenseCandidate = {
  rowIndex: number;
  expense: NormalizedImportExpense;
  warnings: ImportValidationWarning[];
};

export type ImportPreviewRow = Pick<
  NormalizedImportBooking,
  "guestName" | "channel" | "checkIn" | "checkOut" | "grossRevenue" | "payout"
> & {
  status: ImportBookingRowStatus | "warning";
};

export type ImportPreviewTableRow = {
  id: string;
  rowIndex: number;
  guestName: string;
  propertyName: string;
  checkIn: string;
  checkOut: string;
  channel: string;
  grossRevenue: number;
  payout: number;
  status: ImportBookingRowStatus | "warning";
  matchLabel: string;
  matchScore: number | null;
  matchType: ImportCalendarMatch["matchType"] | null;
  reasons: string[];
  booking: ImportEditableBooking;
  calendarMatch: ImportCalendarMatch | null;
  canResolve: boolean;
  decisionStatus: ImportDecisionStatus;
  decisionReason: string;
  isSelectedByDefault: boolean;
  isDisabled: boolean;
  autoFixesApplied: string[];
};

export type ImportEditableBooking = Pick<
  NormalizedImportBooking,
  | "propertyName"
  | "unitName"
  | "bookingReference"
  | "guestName"
  | "channel"
  | "checkIn"
  | "checkOut"
  | "guests"
  | "grossRevenue"
  | "platformFee"
  | "cleaningFee"
  | "taxAmount"
  | "payout"
  | "status"
>;

export type ImportReviewSection = "valid" | "warnings" | "duplicates" | "conflicts" | "errors";

export type ImportManualMappingField =
  | "guestName"
  | "checkIn"
  | "checkOut"
  | "grossRevenue"
  | "payout"
  | "propertyName";

export type ImportManualMappingOption = {
  index: number;
  label: string;
};

export type ImportManualMappingFieldIssue = {
  severity: "warning" | "error";
  message: string;
};

export type ImportManualMapping = {
  sheetName: string;
  headerRowIndex: number;
  guestName: number | null;
  checkIn: number | null;
  checkOut: number | null;
  grossRevenue: number | null;
  payout: number | null;
  propertyName: number | null;
};

export type ImportManualMappingPreview = {
  message: string;
  sheetName: string;
  headerRowIndex: number;
  columns: ImportManualMappingOption[];
  suggested: Record<ImportManualMappingField, number | null>;
  selected: Record<ImportManualMappingField, number | null>;
  fieldIssues: Partial<Record<ImportManualMappingField, ImportManualMappingFieldIssue>>;
  requiredReady: boolean;
};

export type ImportReviewRow = {
  id: string;
  rowType: "booking" | "expense";
  rowIndex: number;
  section: ImportReviewSection;
  title: string;
  subtitle: string;
  reasons: string[];
  canResolve?: boolean;
  booking?: ImportEditableBooking;
};

export type ImportRowResolution =
  | {
      rowType: "booking";
      rowIndex: number;
      action: "override";
      booking: Partial<ImportEditableBooking>;
    }
  | {
      rowType: "booking";
      rowIndex: number;
      action: "skip";
    };

export type ImportPreview = {
  source: ImportDetectedSource;
  sourceLabel: string;
  fileName: string;
  requiresManualMapping: boolean;
  blocksImport: boolean;
  blockMessage: string | null;
  manualMapping: ImportManualMappingPreview | null;
  totalRowsRead: number;
  validRows: number;
  warningRows: number;
  duplicateRows: number;
  matchedRows: number;
  conflictRows: number;
  newRows: number;
  errorRows: number;
  skippedRows: number;
  autoFixedRows: number;
  autoFixSummary: string[];
  expensesDetected: number;
  importableRows: number;
  bookings: ImportBookingCandidate[];
  expenses: ImportExpenseCandidate[];
  financialStatement: null | {
    source: "airbnb" | "booking";
    period: {
      start: string;
      end: string;
      label: string;
    };
    totalPayout: number;
    totalFees: number;
    totalTaxes: number;
    currency: string;
    rawData: string;
  };
  previewRows: ImportPreviewRow[];
  tableRows: ImportPreviewTableRow[];
  reviewRows: Record<ImportReviewSection, ImportReviewRow[]>;
  warnings: ImportValidationWarning[];
  duplicates: ImportDuplicateFlag[];
  calendarMatches: ImportCalendarMatch[];
  canImport: boolean;
};

export type ImportNormalizationResult = {
  source: ImportDetectedSource;
  bookings: ImportBookingCandidate[];
  expenses: ImportExpenseCandidate[];
  warnings: ImportValidationWarning[];
  duplicates: ImportDuplicateFlag[];
  skippedRows: number;
  totalRowsRead: number;
};

export type ParsedImportSheet = {
  name: string;
  normalizedName: string;
  rows: ImportSheetRow[];
};

export type ParsedImportWorkbook = {
  fileName: string;
  sheets: ParsedImportSheet[];
};

export function getDetectedSourceLabel(source: ImportDetectedSource) {
  switch (source) {
    case "airbnb":
      return "Airbnb";
    case "booking":
      return "Booking.com";
    case "generic":
      return "Generic Excel";
    case "financial_statement":
      return "Payout statement";
    default:
      return "Unknown format";
  }
}

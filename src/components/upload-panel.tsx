"use client";

import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  AlertTriangle,
  BedDouble,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  FileSpreadsheet,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import type { PropertyDefinition } from "@/lib/types";
import type { ImportEditableBooking } from "@/lib/import/types";
import { useLocale } from "@/components/locale-provider";
import { WorkspaceSelect } from "@/components/workspace-select";

type UploadPhase = "idle" | "previewing" | "ready" | "importing";
type ToastTone = "success" | "error";

type PreviewWarning = {
  rowType: "booking" | "expense" | "file";
  rowIndex: number;
  code: string;
  message: string;
  severity: "warning" | "error";
};

type PreviewDuplicate = {
  rowType: "booking";
  rowIndex: number;
  code: string;
  message: string;
  severity: "warning";
  matchType: "reference" | "fallback";
  matchScope: "file" | "existing";
};

type PreviewCalendarMatch = {
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

type PreviewRow = {
  guestName: string;
  channel: string;
  checkIn: string;
  checkOut: string;
  grossRevenue: number;
  payout: number;
  status: "new" | "matched" | "duplicate" | "conflict" | "warning";
};

type ReviewSection = "valid" | "warnings" | "duplicates" | "conflicts" | "errors";

type MappingField =
  | "guestName"
  | "checkIn"
  | "checkOut"
  | "grossRevenue"
  | "payout"
  | "propertyName";

type ManualMappingPayload = {
  sheetName: string;
  headerRowIndex: number;
  guestName: number | null;
  checkIn: number | null;
  checkOut: number | null;
  grossRevenue: number | null;
  payout: number | null;
  propertyName: number | null;
};

type ManualMappingOption = {
  index: number;
  label: string;
};

type ManualMappingFieldIssue = {
  severity: "warning" | "error";
  message: string;
};

type ManualMappingPreview = {
  message: string;
  sheetName: string;
  headerRowIndex: number;
  columns: ManualMappingOption[];
  suggested: Record<MappingField, number | null>;
  selected: Record<MappingField, number | null>;
  fieldIssues: Partial<Record<MappingField, ManualMappingFieldIssue>>;
  requiredReady: boolean;
};

type ReviewRow = {
  id: string;
  rowType: "booking" | "expense";
  rowIndex: number;
  section: ReviewSection;
  title: string;
  subtitle: string;
  reasons: string[];
  canResolve?: boolean;
  booking?: ImportEditableBooking;
};

type PreviewTableRow = {
  id: string;
  rowIndex: number;
  guestName: string;
  propertyName: string;
  checkIn: string;
  checkOut: string;
  channel: string;
  grossRevenue: number;
  payout: number;
  status: "new" | "matched" | "duplicate" | "conflict" | "warning";
  matchLabel: string;
  matchScore: number | null;
  matchType: PreviewCalendarMatch["matchType"] | null;
  reasons: string[];
  booking: ImportEditableBooking;
  calendarMatch: PreviewCalendarMatch | null;
  canResolve: boolean;
  decisionStatus: "auto-approved" | "needs-review" | "blocked";
  decisionReason: string;
  isSelectedByDefault: boolean;
  isDisabled: boolean;
  autoFixesApplied: string[];
};

type ImportPreviewPayload = {
  source: "airbnb" | "booking" | "generic" | "financial_statement" | "unknown";
  sourceLabel: string;
  fileName: string;
  requiresManualMapping: boolean;
  blocksImport: boolean;
  blockMessage: string | null;
  manualMapping: ManualMappingPreview | null;
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
  previewRows: PreviewRow[];
  tableRows: PreviewTableRow[];
  reviewRows: Record<ReviewSection, ReviewRow[]>;
  warnings: PreviewWarning[];
  duplicates: PreviewDuplicate[];
  calendarMatches: PreviewCalendarMatch[];
  canImport: boolean;
};

type ImportResponsePayload = {
  error?: string;
  message?: string;
  preview?: ImportPreviewPayload;
  committed?: ImportCommittedPayload;
};

type ImportCommittedPayload = {
  source: string;
  sourceLabel: string;
  bookingsImported: number;
  expensesImported: number;
  skippedRows: number;
  financialDocumentsImported?: number;
};

type ImportCompletePayload = {
  importedFilesCount: number;
  propertyName: string;
  hasRemainingIssues: boolean;
  bookingsImported: number;
  reviewBookingsImported: number;
  expensesImported: number;
  skippedRows: number;
  financialDocumentsImported: number;
};

type FinancialStatementRawPreview = {
  sheetName?: string;
  headers?: string[];
  previewRows?: Array<Array<string | number | boolean | null>>;
};

type UploadToast = {
  tone: ToastTone;
  message: string;
};

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (size >= 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${size} B`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompactDate(value: string, locale = "en-US") {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

async function parseResponse(response: Response) {
  const raw = await response.text();

  try {
    return raw ? (JSON.parse(raw) as ImportResponsePayload) : {};
  } catch {
    return {};
  }
}

function getSourcePresentation(source: ImportPreviewPayload["source"]) {
  switch (source) {
    case "airbnb":
      return {
        icon: BedDouble,
        badge: "Airbnb",
        description: "We detected your file format and mapped your data automatically.",
      };
    case "booking":
      return {
        icon: Building2,
        badge: "Booking.com",
        description: "We detected your file format and mapped your data automatically.",
      };
    case "generic":
      return {
        icon: FileSpreadsheet,
        badge: "Excel",
        description: "We detected your workbook structure and prepared it for review.",
      };
    case "financial_statement":
      return {
        icon: CircleDollarSign,
        badge: "Payout statement",
        description:
          "This file is for Payouts. Hostlyx can save payout totals, fees, and taxes from it when the payout amount is readable.",
      };
    default:
      return {
        icon: Sparkles,
        badge: "Mapped file",
        description: "Your file needed a quick column mapping, and Hostlyx prepared it for review.",
      };
  }
}

function getPreviewStatusPill(status: PreviewRow["status"]) {
  if (status === "matched") {
    return "border-teal-300/24 bg-teal-300/[0.08] text-teal-100";
  }

  if (status === "duplicate") {
    return "border-amber-300/24 bg-amber-300/[0.08] text-amber-100";
  }

  if (status === "conflict") {
    return "border-rose-400/24 bg-rose-400/[0.08] text-rose-100";
  }

  if (status === "warning") {
    return "border-amber-200/24 bg-amber-200/[0.08] text-amber-50";
  }

  return "border-white/10 bg-white/[0.04] text-[var(--workspace-text)]";
}

function getPreviewStatusLabel(status: PreviewRow["status"], isSpanish: boolean) {
  switch (status) {
    case "matched":
      return isSpanish ? "Lista" : "Ready";
    case "duplicate":
      return isSpanish ? "Ya existe" : "Already there";
    case "conflict":
      return isSpanish ? "Conflicto" : "Conflict";
    case "warning":
      return isSpanish ? "Revisar" : "Check needed";
    default:
      return isSpanish ? "Nueva" : "New";
  }
}

function isCanceledBookingStatus(status: string) {
  const normalized = status.trim().toLowerCase();
  return normalized.includes("canceled") || normalized.includes("cancelled");
}

export function UploadPanel({
  properties,
  title = "Bring your data",
  subtitle = "Upload your Airbnb, Booking.com, or Excel files to see your real numbers.",
  refreshOnSuccess = true,
  appearance = "default",
  onImportComplete,
  onCancel,
}: {
  properties: PropertyDefinition[];
  title?: string;
  subtitle?: string;
  refreshOnSuccess?: boolean;
  appearance?: "default" | "compact";
  onImportComplete?: (payload: ImportCompletePayload) => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const { locale } = useLocale();
  const isSpanish = locale === "es";
  const inputRef = useRef<HTMLInputElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const toastRef = useRef<HTMLDivElement | null>(null);
  const sourceDetectedRef = useRef<HTMLDivElement | null>(null);
  const mappingRef = useRef<HTMLDivElement | null>(null);
  const readyToContinueRef = useRef<HTMLDivElement | null>(null);
  const importButtonRef = useRef<HTMLButtonElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedPropertyName, setSelectedPropertyName] = useState(properties[0]?.name ?? "");
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [preview, setPreview] = useState<ImportPreviewPayload | null>(null);
  const [manualMapping, setManualMapping] = useState<ManualMappingPayload | null>(null);
  const [toast, setToast] = useState<UploadToast | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [committed, setCommitted] = useState<ImportCommittedPayload | null>(null);
  const [shouldFocusImportAction, setShouldFocusImportAction] = useState(false);

  const validExpenseRows = useMemo(() => {
    return preview?.reviewRows.valid.filter((row) => row.rowType === "expense").length ?? 0;
  }, [preview?.reviewRows.valid]);

  const importableBookingRows = useMemo(() => {
    return (
      preview?.tableRows.filter((row) => !row.isDisabled && row.status !== "duplicate" && row.status !== "conflict")
        .length ?? 0
    );
  }, [preview?.tableRows]);

  const reviewAfterImportBookingRows = useMemo(() => {
    return (
      preview?.tableRows.filter(
        (row) =>
          !row.isDisabled &&
          row.status !== "duplicate" &&
          row.status !== "conflict" &&
          row.decisionStatus === "needs-review",
      ).length ?? 0
    );
  }, [preview?.tableRows]);

  const actionableRows = useMemo(() => {
    if (!preview) {
      return 0;
    }

    return importableBookingRows + validExpenseRows;
  }, [importableBookingRows, preview, validExpenseRows]);

  const isFinancialPreview = preview?.source === "financial_statement";
  const isBlockedFinancialStatement = Boolean(
    preview &&
      preview.source === "financial_statement" &&
      preview.blocksImport,
  );
  const isFinancialStatementReady = Boolean(
    preview &&
      preview.source === "financial_statement" &&
      !preview.blocksImport &&
      preview.financialStatement &&
      preview.canImport,
  );

  const financialStatementPreviewData = useMemo<FinancialStatementRawPreview | null>(() => {
    if (!preview?.financialStatement?.rawData) {
      return null;
    }

    try {
      return JSON.parse(preview.financialStatement.rawData) as FinancialStatementRawPreview;
    } catch {
      return null;
    }
  }, [preview?.financialStatement?.rawData]);

  const isCompactAppearance = appearance === "compact";

  const bookingRowsFound = useMemo(() => {
    return preview?.tableRows.length ?? 0;
  }, [preview?.tableRows]);

  const autoApprovedBookingRows = useMemo(() => {
    return preview?.tableRows.filter((row) => row.decisionStatus === "auto-approved" && !row.isDisabled).length ?? 0;
  }, [preview?.tableRows]);

  const needsReviewBookingRows = useMemo(() => {
    return preview?.tableRows.filter((row) => row.decisionStatus === "needs-review").length ?? 0;
  }, [preview?.tableRows]);

  const blockedBookingRows = useMemo(() => {
    return preview?.tableRows.filter((row) => row.decisionStatus === "blocked" || row.isDisabled).length ?? 0;
  }, [preview?.tableRows]);

  const canceledBookingRows = useMemo(() => {
    return preview?.tableRows.filter((row) => isCanceledBookingStatus(row.booking.status)).length ?? 0;
  }, [preview?.tableRows]);

  const existingDuplicateRows = useMemo(() => {
    return preview?.duplicates.filter((duplicate) => duplicate.matchScope === "existing").length ?? 0;
  }, [preview?.duplicates]);

  const fileDuplicateRows = useMemo(() => {
    return preview?.duplicates.filter((duplicate) => duplicate.matchScope === "file").length ?? 0;
  }, [preview?.duplicates]);

  const hasBookingPreview = bookingRowsFound > 0;

  const needsFocusedMapping = useMemo(() => {
    if (!preview?.manualMapping) {
      return false;
    }

    if (preview.blocksImport) {
      return false;
    }

    return preview.importableRows === 0;
  }, [preview]);

  const currentManualMapping = useMemo(() => {
    if (!preview?.manualMapping) {
      return null;
    }

    return manualMapping ?? {
      sheetName: preview.manualMapping.sheetName,
      headerRowIndex: preview.manualMapping.headerRowIndex,
      guestName: preview.manualMapping.selected.guestName,
      checkIn: preview.manualMapping.selected.checkIn,
      checkOut: preview.manualMapping.selected.checkOut,
      grossRevenue: preview.manualMapping.selected.grossRevenue,
      payout: preview.manualMapping.selected.payout,
      propertyName: preview.manualMapping.selected.propertyName,
    };
  }, [manualMapping, preview]);

  const currentManualReady = useMemo(() => {
    if (!currentManualMapping) {
      return false;
    }

    return (
      currentManualMapping.guestName != null &&
      currentManualMapping.checkIn != null &&
      currentManualMapping.checkOut != null &&
      currentManualMapping.grossRevenue != null &&
      (!preview?.manualMapping?.fieldIssues.guestName ||
        preview.manualMapping.fieldIssues.guestName.severity !== "error") &&
      (!preview?.manualMapping?.fieldIssues.checkIn ||
        preview.manualMapping.fieldIssues.checkIn.severity !== "error") &&
      (!preview?.manualMapping?.fieldIssues.checkOut ||
        preview.manualMapping.fieldIssues.checkOut.severity !== "error") &&
      (!preview?.manualMapping?.fieldIssues.grossRevenue ||
        preview.manualMapping.fieldIssues.grossRevenue.severity !== "error")
    );
  }, [currentManualMapping, preview]);

  const currentManualIssues = useMemo(() => {
    if (!preview?.manualMapping) {
      return {};
    }

    return preview.manualMapping.fieldIssues;
  }, [preview]);

  const shouldShowManualMapping = useMemo(() => {
    if (!preview?.manualMapping || !currentManualMapping) {
      return false;
    }

    return preview.requiresManualMapping || needsFocusedMapping;
  }, [currentManualMapping, needsFocusedMapping, preview]);

  async function requestPreview(options?: {
    preserveToast?: boolean;
    focusImportAction?: boolean;
  }) {
    if (!selectedFile) {
      return null;
    }

    setPhase("previewing");
    if (!options?.preserveToast) {
      setToast(null);
    }

    try {
      const formData = new FormData();
      formData.set("action", "preview");
      if (manualMapping) {
        formData.set("manualMapping", JSON.stringify(manualMapping));
      }
      formData.append("file", selectedFile);

      const response = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });
      const payload = await parseResponse(response);

      if (!response.ok || !payload.preview) {
        throw new Error(payload.error ?? "Hostlyx could not preview this file.");
      }

      setPreview(payload.preview);
      setManualMapping(
        payload.preview.manualMapping
          ? {
              sheetName: payload.preview.manualMapping.sheetName,
              headerRowIndex: payload.preview.manualMapping.headerRowIndex,
              guestName: payload.preview.manualMapping.selected.guestName,
              checkIn: payload.preview.manualMapping.selected.checkIn,
              checkOut: payload.preview.manualMapping.selected.checkOut,
              grossRevenue: payload.preview.manualMapping.selected.grossRevenue,
              payout: payload.preview.manualMapping.selected.payout,
              propertyName: payload.preview.manualMapping.selected.propertyName,
            }
          : null,
      );
      setPhase("ready");
      setShouldFocusImportAction(options?.focusImportAction ?? true);
      return payload.preview;
    } catch (error) {
      setPhase("idle");
      setToast({
        tone: "error",
        message: error instanceof Error ? error.message : "Preview failed.",
      });
      return null;
    }
  }

  function resetSelection(nextFile: File | null) {
    setSelectedFile(nextFile);
    setPreview(null);
    setManualMapping(null);
    setToast(null);
    setCommitted(null);
    setPhase(nextFile ? "idle" : "idle");
    if (inputRef.current && !nextFile) {
      inputRef.current.value = "";
    }
  }

  async function handlePreview() {
    if (!selectedFile) {
      setToast({
        tone: "error",
        message: "Choose an Airbnb, Booking.com, or Hostlyx file before previewing the import.",
      });
      return;
    }

    await requestPreview({
      focusImportAction: true,
    });
  }

  async function handleImport() {
    if (!selectedFile) {
      setToast({
        tone: "error",
        message: "Choose a file first so Hostlyx can review it before importing.",
      });
      return;
    }

    if (!preview) {
      setToast({
        tone: "error",
        message: "Preview the file first so you can review issues before importing.",
      });
      return;
    }

    if (preview.blocksImport) {
      setToast({
        tone: "error",
        message:
          isBlockedFinancialStatement
            ? preview.blockMessage ?? "This payout statement still needs a readable payout total."
            : preview.blockMessage ?? "This file is not the right format for booking imports.",
      });
      return;
    }

    if (!preview.canImport || actionableRows <= 0) {
      setToast({
        tone: "error",
        message: needsFocusedMapping
          ? "We need a quick column check before Hostlyx can continue."
          : "There are no usable rows left to import from this file.",
      });
      return;
    }

    setPhase("importing");
    setToast(null);

    try {
      const formData = new FormData();
      formData.set("action", "commit");
      formData.set("propertyName", selectedPropertyName);
      if (manualMapping) {
        formData.set("manualMapping", JSON.stringify(manualMapping));
      }
      formData.append("file", selectedFile);

      const response = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });
      const payload = await parseResponse(response);

      if (!response.ok) {
        throw new Error(payload.error ?? "Import failed.");
      }

      const committedPayload = payload.committed ?? null;
      const hasRemainingIssues =
        preview.errorRows > 0 ||
        preview.skippedRows > 0 ||
        preview.duplicateRows > 0 ||
        preview.conflictRows > 0;

      setToast({
        tone: "success",
        message: hasRemainingIssues
          ? `Imported ${committedPayload?.bookingsImported ?? 0} booking${committedPayload?.bookingsImported === 1 ? "" : "s"} and ${committedPayload?.expensesImported ?? 0} expense${committedPayload?.expensesImported === 1 ? "" : "s"}. Anything that still needs attention can be reviewed in Bookings.`
          : payload.message ?? "Import completed.",
      });

      if (refreshOnSuccess) {
        router.refresh();
      }

      onImportComplete?.({
        importedFilesCount: 1,
        propertyName: selectedPropertyName,
        hasRemainingIssues,
        bookingsImported: committedPayload?.bookingsImported ?? 0,
        reviewBookingsImported: reviewAfterImportBookingRows,
        expensesImported: committedPayload?.expensesImported ?? 0,
        skippedRows: committedPayload?.skippedRows ?? 0,
        financialDocumentsImported: committedPayload?.financialDocumentsImported ?? 0,
      });

      if (hasRemainingIssues) {
        await requestPreview({
          preserveToast: true,
          focusImportAction: false,
        });
        return;
      }

      setPhase("idle");
      setCommitted(committedPayload);
      setSelectedFile(null);
      setPreview(null);
      setManualMapping(null);

      if (inputRef.current) {
        inputRef.current.value = "";
      }
    } catch (error) {
      setPhase("ready");
      setToast({
        tone: "error",
        message: error instanceof Error ? error.message : "Import failed.",
      });
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    resetSelection(file);
  }

  function openFilePicker() {
    inputRef.current?.click();
  }

  function handleCancel() {
    if (onCancel) {
      onCancel();
      return;
    }

    resetSelection(null);
  }

  function updateManualField(field: MappingField, value: string) {
    const previewManualMapping = preview?.manualMapping;

    if (!previewManualMapping) {
      return;
    }

    setManualMapping((current) => ({
      sheetName: current?.sheetName ?? previewManualMapping.sheetName,
      headerRowIndex: current?.headerRowIndex ?? previewManualMapping.headerRowIndex,
      guestName: current?.guestName ?? previewManualMapping.selected.guestName,
      checkIn: current?.checkIn ?? previewManualMapping.selected.checkIn,
      checkOut: current?.checkOut ?? previewManualMapping.selected.checkOut,
      grossRevenue: current?.grossRevenue ?? previewManualMapping.selected.grossRevenue,
      payout: current?.payout ?? previewManualMapping.selected.payout,
      propertyName: current?.propertyName ?? previewManualMapping.selected.propertyName,
      [field]: value === "" ? null : Number(value),
    }));
  }

  function scrollToMapping() {
    mappingRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }

  function scrollToImportAction() {
    readyToContinueRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    window.setTimeout(() => {
      importButtonRef.current?.focus({ preventScroll: true });
    }, 80);
  }

  useEffect(() => {
    if (!toast || toast.tone !== "error") {
      return;
    }

    const timer = window.setTimeout(() => {
      const target = toastRef.current ?? panelRef.current;
      target?.scrollIntoView({
        behavior: "smooth",
        block: target === panelRef.current ? "start" : "center",
      });
    }, 80);

    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!committed || !onCancel) {
      return;
    }

    const timer = window.setTimeout(() => {
      onCancel();
    }, 1800);

    return () => window.clearTimeout(timer);
  }, [committed, onCancel]);

  useEffect(() => {
    if (!shouldFocusImportAction) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (needsFocusedMapping) {
        scrollToMapping();
        setShouldFocusImportAction(false);
        return;
      }

      if (actionableRows > 0) {
        scrollToImportAction();
      }

      setShouldFocusImportAction(false);
    }, 80);

    return () => window.clearTimeout(timer);
  }, [actionableRows, needsFocusedMapping, shouldFocusImportAction]);

  useEffect(() => {
    if (!preview?.tableRows.length) {
      return;
    }
  }, [preview?.tableRows]);

  if (committed) {
    return (
      <div className="relative">
        <div className="workspace-card overflow-hidden rounded-[34px] border border-[var(--workspace-border)] bg-[linear-gradient(180deg,rgba(10,20,38,0.98),rgba(10,18,33,0.96))] p-6 sm:p-7">
          {toast ? (
            <div
              ref={toastRef}
              className={`mb-5 rounded-[24px] border px-4 py-4 shadow-[0_24px_60px_rgba(15,23,42,0.22)] ${
                toast.tone === "success"
                  ? "border-emerald-400/24 bg-[rgba(7,28,26,0.96)] text-emerald-100"
                  : "border-rose-400/24 bg-[rgba(40,12,18,0.96)] text-rose-100"
              }`}
            >
              <div className="flex items-start gap-3">
                {toast.tone === "success" ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    {toast.tone === "success" ? "Import completed" : "Import needs attention"}
                  </p>
                  <p className="mt-1 text-sm leading-6 opacity-90">{toast.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setToast(null)}
                  className="rounded-full border border-white/10 p-2 transition hover:bg-white/5"
                  aria-label="Dismiss import notification"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : null}

          <div className="rounded-[28px] border border-emerald-400/18 bg-[radial-gradient(circle_at_top,rgba(125,211,197,0.18),transparent_58%),rgba(255,255,255,0.02)] p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/18 bg-emerald-400/[0.08] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-100">
                  <ShieldCheck className="h-4 w-4" />
                  Import complete
                </div>
                <div>
                  <h3 className="text-3xl font-semibold tracking-[-0.05em] text-[var(--workspace-text)]">
                    Your data is ready
                  </h3>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--workspace-muted)]">
                    Your financial overview has been updated.
                  </p>
                </div>
              </div>

              <div className="workspace-soft-card rounded-[24px] px-4 py-4 text-sm text-[var(--workspace-muted)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                  Source
                </p>
                <p className="mt-2 text-base font-medium text-[var(--workspace-text)]">{committed.sourceLabel}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {(
                committed.financialDocumentsImported
                  ? [
                      ["Payout statements imported", committed.financialDocumentsImported, "text-[var(--workspace-text)]"],
                      ["Bookings imported", committed.bookingsImported, "text-[var(--workspace-text)]"],
                      ["Rows skipped", committed.skippedRows, "text-[var(--workspace-muted)]"],
                    ]
                  : [
                      ["Bookings imported", committed.bookingsImported, "text-[var(--workspace-text)]"],
                      ["Expenses imported", committed.expensesImported, "text-[var(--workspace-text)]"],
                      ["Rows skipped", committed.skippedRows, "text-[var(--workspace-muted)]"],
                    ]
              ).map(([label, value, tone]) => (
                <div
                  key={String(label)}
                  className="rounded-[24px] border border-[var(--workspace-border)] bg-[rgba(255,255,255,0.03)] px-5 py-5"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                    {label}
                  </p>
                  <p className={`mt-3 text-3xl font-semibold ${tone}`}>{formatCurrency(Number(value))}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="workspace-button-primary inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition"
              >
                Go to dashboard
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => resetSelection(null)}
                className="workspace-button-secondary inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold transition"
              >
                Import another file
              </button>
            </div>

            {onCancel ? (
              <p className="mt-4 text-sm text-[var(--workspace-muted)]">
                Everything imported perfectly. Closing this window...
              </p>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        ref={panelRef}
        className="workspace-card overflow-hidden rounded-[34px] border border-[var(--workspace-border)] bg-[linear-gradient(180deg,rgba(10,20,38,0.98),rgba(10,18,33,0.96))] p-5 sm:p-7"
      >
        {toast ? (
          <div
            ref={toastRef}
            className={`mb-5 rounded-[24px] border px-4 py-4 shadow-[0_24px_60px_rgba(15,23,42,0.22)] ${
              toast.tone === "success"
                ? "border-emerald-400/24 bg-[rgba(7,28,26,0.96)] text-emerald-100"
                : "border-rose-400/24 bg-[rgba(40,12,18,0.96)] text-rose-100"
            }`}
          >
            <div className="flex items-start gap-3">
              {toast.tone === "success" ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {toast.tone === "success" ? "Import completed" : "Import needs attention"}
                </p>
                <p className="mt-1 text-sm leading-6 opacity-90">{toast.message}</p>
              </div>
              <button
                type="button"
                onClick={() => setToast(null)}
                className="rounded-full border border-white/10 p-2 transition hover:bg-white/5"
                aria-label="Dismiss import notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}

        <div className="relative">
          <div className={`flex flex-wrap items-start justify-between gap-4 ${isCompactAppearance ? "sm:gap-3" : ""}`}>
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--workspace-border)] bg-white/[0.03] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--workspace-muted)]">
                <Sparkles className="h-4 w-4 text-[var(--workspace-accent)]" />
                {isCompactAppearance ? "Payouts" : "Import Center"}
              </div>
              <div>
                <h2
                  className={`font-semibold tracking-[-0.05em] text-[var(--workspace-text)] ${
                    isCompactAppearance ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl"
                  }`}
                >
                  {title}
                </h2>
                <p
                  className={`max-w-2xl text-sm text-[var(--workspace-muted)] ${
                    isCompactAppearance ? "mt-2 leading-6" : "mt-3 leading-7"
                  }`}
                >
                  {subtitle}
                </p>
              </div>
            </div>
            <div
              className={`workspace-soft-card text-right text-sm text-[var(--workspace-muted)] ${
                isCompactAppearance ? "rounded-[22px] px-4 py-3" : "rounded-[26px] px-4 py-4"
              }`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                Supported
              </p>
              <p className={`font-medium text-[var(--workspace-text)] ${isCompactAppearance ? "mt-1 text-sm" : "mt-2 text-base"}`}>
                CSV & XLSX
              </p>
            </div>
          </div>

        <div className={`${isCompactAppearance ? "mt-6" : "mt-8"} space-y-6`}>
          <input
            ref={inputRef}
            type="file"
            name="file"
            accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={handleFileChange}
          />

          <div className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              Target property
            </span>
            {properties.length > 1 ? (
              <WorkspaceSelect
                value={selectedPropertyName}
                onChange={setSelectedPropertyName}
                options={properties.map((property) => ({
                  value: property.name,
                  label: property.name,
                  description:
                    property.units.length > 0
                      ? `${property.units.length} listing${property.units.length === 1 ? "" : "s"}`
                      : "Single-home property",
                }))}
                placeholder="Select a property"
              />
            ) : (
              <div className="rounded-[18px] border border-[var(--workspace-border)] bg-[var(--workspace-panel)] px-4 py-3 text-sm text-[var(--workspace-text)]">
                {selectedPropertyName}
              </div>
            )}
          </div>

          <div
            className={`workspace-soft-card group cursor-pointer rounded-[28px] border border-dashed p-6 transition sm:p-7 ${
              isDragging
                ? "border-[var(--workspace-accent)] bg-[rgba(125,211,197,0.08)]"
                : "border-[var(--workspace-border)] hover:border-[var(--workspace-accent)]/40 hover:bg-white/[0.03]"
            }`}
            onClick={openFilePicker}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragEnter={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              if (event.currentTarget === event.target) {
                setIsDragging(false);
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              resetSelection(event.dataTransfer.files?.[0] ?? null);
            }}
          >
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] border border-[var(--workspace-border)] bg-[rgba(125,211,197,0.08)] text-[var(--workspace-accent)]">
                  {phase === "previewing" || phase === "importing" ? (
                    <LoaderCircle className="h-6 w-6 animate-spin" />
                  ) : (
                    <UploadCloud className="h-6 w-6 transition group-hover:scale-105" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-medium text-[var(--workspace-text)]">
                    {selectedFile ? selectedFile.name : "Drag and drop your file"}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--workspace-muted)]">
                    {selectedFile
                      ? `${formatFileSize(selectedFile.size)} uploaded${phase === "previewing" ? " • Analyzing your data..." : ""}`
                      : "Upload your Airbnb, Booking.com, or Hostlyx Excel export. Hostlyx will preview everything before saving anything."}
                  </p>
                  {!selectedFile ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {["Airbnb", "Booking.com", "Excel"].map((entry) => (
                        <span
                          key={entry}
                          className="rounded-full border border-[var(--workspace-border)] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-[var(--workspace-muted)]"
                        >
                          {entry}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {phase === "previewing" ? (
                    <p className="mt-3 text-sm font-medium text-[var(--workspace-text)]">Analyzing your data...</p>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap gap-3" onClick={(event) => event.stopPropagation()}>
                {selectedFile ? (
                  <button
                    type="button"
                    onClick={() => resetSelection(null)}
                    className="workspace-button-secondary inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition"
                  >
                    Remove
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={openFilePicker}
                  className="workspace-button-secondary inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition"
                >
                  {selectedFile ? "Replace file" : "Browse files"}
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handlePreview}
              disabled={!selectedFile || phase === "previewing" || phase === "importing"}
              className="workspace-button-primary inline-flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {phase === "previewing" ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Analyzing your data...
                </>
              ) : (
                "Preview import"
              )}
            </button>

            <button
              type="button"
              onClick={handleCancel}
              className="workspace-button-secondary inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition"
            >
              Cancel
            </button>
          </div>

          {preview ? (
            <div className="space-y-5">
              <div
                ref={sourceDetectedRef}
                className="workspace-soft-card rounded-[28px] border border-[var(--workspace-border)] p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-[var(--workspace-border)] bg-white/[0.04]">
                      {(() => {
                        const Icon = getSourcePresentation(preview.source).icon;
                        return <Icon className="h-5 w-5 text-[var(--workspace-accent)]" />;
                      })()}
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                        Source detected
                      </p>
                      <p className="mt-2 text-xl font-semibold text-[var(--workspace-text)]">
                        {getSourcePresentation(preview.source).badge}
                      </p>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--workspace-muted)]">
                        {preview.blocksImport
                          ? preview.blockMessage
                          : preview.source === "financial_statement"
                          ? "This file is a payout statement. Hostlyx will save payout totals for Payouts, but it will not create booking rows from it."
                          : preview.requiresManualMapping
                          ? preview.manualMapping?.message
                          : getSourcePresentation(preview.source).description}
                      </p>
                      {preview.blocksImport ? (
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <span
                            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                              isBlockedFinancialStatement
                                ? "border-amber-400/20 bg-amber-300/[0.08] text-amber-100"
                                : "border-rose-400/20 bg-rose-300/[0.08] text-rose-100"
                            }`}
                          >
                            {isBlockedFinancialStatement
                              ? "We still need a readable payout total"
                              : "Use a reservations or earnings export instead"}
                          </span>
                        </div>
                      ) : isFinancialStatementReady ? (
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <span className="rounded-full border border-[var(--workspace-accent)]/24 bg-[rgba(125,211,197,0.12)] px-3 py-1.5 text-xs font-medium text-[var(--workspace-accent)]">
                            Payout statement ready
                          </span>
                          <button
                            type="button"
                            onClick={handleImport}
                            disabled={phase === "importing" || phase === "previewing"}
                            className="workspace-button-primary inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {phase === "importing" ? "Saving payout statement..." : "Save payout statement"}
                          </button>
                        </div>
                      ) : needsFocusedMapping ? (
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <span className="rounded-full border border-amber-400/20 bg-amber-300/[0.08] px-3 py-1.5 text-xs font-medium text-amber-100">
                            We need a quick column check before preview can continue.
                          </span>
                          <button
                            type="button"
                            onClick={scrollToMapping}
                            className="workspace-button-secondary inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-semibold transition"
                          >
                            Map columns manually
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                      preview.blocksImport
                        ? isBlockedFinancialStatement
                          ? "border-amber-400/24 bg-amber-400/10 text-amber-100"
                          : "border-rose-400/24 bg-rose-400/10 text-rose-100"
                        : preview.source === "financial_statement"
                        ? "border-[var(--workspace-accent)]/24 bg-[rgba(125,211,197,0.12)] text-[var(--workspace-accent)]"
                        : preview.errorRows === 0 && preview.duplicateRows === 0 && preview.warningRows === 0
                        ? "border-emerald-400/24 bg-emerald-400/10 text-emerald-100"
                        : "border-amber-400/24 bg-amber-400/10 text-amber-100"
                    }`}
                  >
                    {preview.blocksImport
                      ? isBlockedFinancialStatement
                        ? "Payout statement incomplete"
                        : "Wrong file type"
                      : isFinancialStatementReady
                      ? "Payout statement ready"
                      : preview.source === "financial_statement"
                      ? "Needs payout total"
                      : preview.requiresManualMapping
                      ? "Manual mapping"
                      : preview.errorRows === 0 && preview.duplicateRows === 0 && preview.warningRows === 0
                        ? "Ready to import"
                        : "Needs review"}
                  </span>
                </div>
              </div>

              {preview.blocksImport ? (
                <div
                  className={`rounded-[28px] border p-5 sm:p-6 ${
                    isBlockedFinancialStatement
                      ? "border-amber-400/18 bg-amber-300/[0.07]"
                      : "border-rose-400/18 bg-rose-300/[0.07]"
                  }`}
                >
                  <p
                    className={`text-sm font-medium ${
                      isBlockedFinancialStatement ? "text-amber-50/95" : "text-rose-50/95"
                    }`}
                  >
                    {isBlockedFinancialStatement
                      ? "Hostlyx recognized a payout statement, but the payout total is still missing or unreadable."
                      : "This file is useful for invoices and VAT records, but it is not the right source for bookings."}
                  </p>
                  <p
                    className={`mt-2 text-sm leading-6 ${
                      isBlockedFinancialStatement ? "text-amber-50/75" : "text-rose-50/75"
                    }`}
                  >
                    {isBlockedFinancialStatement
                      ? "Try a cleaner statement export, or one that includes a column like payout, amount paid out, or actual amount paid out, then upload it again."
                      : "Export your Airbnb reservations or earnings file instead, then upload it here to populate bookings, payout, and stay dates."}
                  </p>
                </div>
              ) : null}

              {shouldShowManualMapping ? (
                <div
                  ref={mappingRef}
                  className={`rounded-[28px] border p-5 sm:p-6 ${
                    needsFocusedMapping
                      ? "border-amber-400/20 bg-amber-300/[0.08]"
                      : "border-[var(--workspace-accent)]/20 bg-[rgba(125,211,197,0.06)]"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-[var(--workspace-text)]">Map your columns</p>
                      <p className="text-sm leading-6 text-[var(--workspace-muted)]">
                        {needsFocusedMapping
                          ? "Hostlyx read the file, but key columns still need your review before we can show a clean preview."
                          : preview.manualMapping?.message}
                      </p>
                    </div>
                    {needsFocusedMapping ? (
                      <span className="rounded-full border border-amber-400/20 bg-amber-300/[0.08] px-3 py-1.5 text-xs font-medium text-amber-100">
                        Required now
                      </span>
                    ) : null}
                  </div>

                  {!needsFocusedMapping ? (
                    <p className="mt-4 text-sm leading-6 text-[var(--workspace-muted)]">
                      {preview.manualMapping?.message}
                    </p>
                  ) : null}

                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {([
                      ["guestName", "Guest Name", true],
                      ["checkIn", "Check-in", true],
                      ["checkOut", "Check-out", true],
                      ["grossRevenue", "Revenue (gross)", true],
                      ["payout", "Payout", false],
                      ["propertyName", "Property", false],
                    ] as Array<[MappingField, string, boolean]>).map(([field, label, required]) => {
                      const issue = currentManualIssues[field];
                      const hasError = issue?.severity === "error";
                      const hasWarning = issue?.severity === "warning";

                      return (
                        <label key={field} className="space-y-2">
                          <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                            {label}
                            {required ? (
                              <span className="ml-1 text-[var(--workspace-accent)]">*</span>
                            ) : (
                              <span className="ml-1 text-[10px] text-[var(--workspace-muted)]/80">(optional)</span>
                            )}
                          </span>
                          <select
                            value={currentManualMapping?.[field] ?? ""}
                            onChange={(event) => updateManualField(field, event.target.value)}
                            className={`w-full rounded-[18px] border bg-[var(--workspace-panel)] px-4 py-3 text-sm text-[var(--workspace-text)] outline-none transition focus:border-[var(--workspace-accent)] ${
                              hasError
                                ? "border-rose-400/30"
                                : hasWarning
                                  ? "border-amber-400/30"
                                  : "border-[var(--workspace-border)]"
                            }`}
                          >
                            <option value="">Select a column</option>
                            {(preview.manualMapping?.columns ?? []).map((column) => (
                              <option key={`${field}-${column.index}`} value={column.index}>
                                {column.label}
                              </option>
                            ))}
                          </select>
                          {issue ? (
                            <p
                              className={`text-xs leading-5 ${
                                issue.severity === "error"
                                  ? "text-rose-100/90"
                                  : "text-amber-100/85"
                              }`}
                            >
                              {issue.message}
                            </p>
                          ) : null}
                        </label>
                      );
                    })}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-[var(--workspace-border)] bg-white/[0.02] px-4 py-4">
                    <p className="text-sm text-[var(--workspace-muted)]">
                      {currentManualReady
                        ? "Required fields are mapped. Preview again to continue."
                        : "Map Guest Name, Check-in, Check-out, and Revenue with valid columns to continue."}
                    </p>
                    <button
                      type="button"
                      onClick={handlePreview}
                      disabled={!currentManualReady || phase === "previewing"}
                      className="workspace-button-primary inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {phase === "previewing" ? "Analyzing..." : "Preview with mapping"}
                    </button>
                  </div>
                </div>
              ) : null}

              {isFinancialPreview && !preview.blocksImport && preview.financialStatement ? (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      ["Payout source", preview.financialStatement.source === "airbnb" ? "Airbnb" : "Booking.com", "text-[var(--workspace-text)]", "border-[var(--workspace-border)] bg-[var(--workspace-panel)]"],
                      ["Actual payout", formatCurrency(preview.financialStatement.totalPayout), "text-teal-100", "border-[var(--workspace-accent)]/18 bg-[rgba(125,211,197,0.08)]"],
                      ["Fees detected", formatCurrency(preview.financialStatement.totalFees), "text-amber-100", "border-amber-400/20 bg-amber-300/[0.08]"],
                      ["Taxes detected", formatCurrency(preview.financialStatement.totalTaxes), "text-[var(--workspace-text)]", "border-[var(--workspace-border)] bg-[var(--workspace-panel)]"],
                    ].map(([label, value, tone, surface]) => (
                      <div
                        key={String(label)}
                        className={`rounded-[22px] border px-4 py-5 ${surface}`}
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                          {label}
                        </p>
                        <p className={`mt-3 text-3xl font-semibold ${tone}`}>
                          {value}
                        </p>
                        {label === "Payout source" ? (
                          <p className="mt-2 text-xs leading-5 text-[var(--workspace-muted)]">
                            {preview.financialStatement?.period.label}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                    <div className="rounded-[24px] border border-[var(--workspace-border)] bg-[var(--workspace-panel)] p-5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                        Payout summary
                      </p>
                      <p className="mt-2 text-lg font-medium text-[var(--workspace-text)]">
                        {preview.financialStatement.period.label}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[var(--workspace-muted)]">
                        Hostlyx will save this document as a payout statement, separate from bookings, and use it in Payouts.
                      </p>

                      <div className="mt-5 grid gap-4 md:grid-cols-2">
                        <div className="rounded-[20px] border border-[var(--workspace-border)] bg-white/[0.02] px-4 py-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                            What gets saved
                          </p>
                          <p className="mt-2 text-sm leading-6 text-[var(--workspace-text)]">
                            Actual payout, fees, taxes, source, currency, and statement period.
                          </p>
                        </div>
                        <div className="rounded-[20px] border border-[var(--workspace-border)] bg-white/[0.02] px-4 py-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                            Why bookings stay at 0
                          </p>
                          <p className="mt-2 text-sm leading-6 text-[var(--workspace-text)]">
                            Hostlyx will not create bookings from this file or mix it into operational calendar events.
                          </p>
                        </div>
                      </div>

                      {financialStatementPreviewData?.previewRows?.length ? (
                        <div className="mt-5 rounded-[20px] border border-[var(--workspace-border)] bg-white/[0.02] px-4 py-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                                Statement rows sampled
                              </p>
                              <p className="mt-2 text-sm leading-6 text-[var(--workspace-muted)]">
                                These are raw statement lines Hostlyx used to calculate payout, fees, and taxes.
                              </p>
                            </div>
                            {financialStatementPreviewData.sheetName ? (
                              <span className="rounded-full border border-[var(--workspace-border)] bg-white/[0.02] px-3 py-1.5 text-xs font-medium text-[var(--workspace-muted)]">
                                {financialStatementPreviewData.sheetName}
                              </span>
                            ) : null}
                          </div>

                          <div className="mt-4 overflow-x-auto">
                            <table className="min-w-full text-left text-sm">
                              <thead className="text-[11px] uppercase tracking-[0.16em] text-[var(--workspace-muted)]">
                                <tr>
                                  {(financialStatementPreviewData.headers ?? []).slice(0, 6).map((header, index) => (
                                    <th key={`${header}-${index}`} className="pb-3 pr-4 font-medium">
                                      {header || `Column ${index + 1}`}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[var(--workspace-border)]/60 text-[var(--workspace-text)]">
                                {financialStatementPreviewData.previewRows.slice(0, 5).map((row, rowIndex) => (
                                  <tr key={`statement-row-${rowIndex}`}>
                                    {(row ?? []).slice(0, 6).map((cell, cellIndex) => (
                                      <td
                                        key={`statement-cell-${rowIndex}-${cellIndex}`}
                                        className="py-3 pr-4 align-top text-sm leading-6 text-[var(--workspace-text)]"
                                      >
                                        {String(cell ?? "—")}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div
                      ref={readyToContinueRef}
                      className="rounded-[24px] border border-[var(--workspace-accent)]/18 bg-[rgba(125,211,197,0.07)] p-5"
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                        Ready to continue
                      </p>
                      <p className="mt-2 text-lg font-medium text-[var(--workspace-text)]">
                        1 payout statement ready to import
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[var(--workspace-muted)]">
                        Nothing will be saved until you confirm this payout statement import.
                      </p>

                      <div className="mt-5 rounded-[18px] border border-[var(--workspace-accent)]/18 bg-[rgba(125,211,197,0.08)] px-4 py-4 text-sm text-[var(--workspace-text)]">
                        This file will feed Payouts so you can compare expected payout against what Airbnb or Booking.com says it paid out.
                      </div>

                      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                        <button
                          ref={importButtonRef}
                          type="button"
                          onClick={handleImport}
                          disabled={!isFinancialStatementReady || phase === "importing" || phase === "previewing"}
                          className="workspace-button-primary inline-flex flex-1 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {phase === "importing" ? (
                            <>
                              <LoaderCircle className="h-4 w-4 animate-spin" />
                              Save payout statement
                            </>
                          ) : (
                            "Save payout statement"
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={handleCancel}
                          className="workspace-button-secondary inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : !needsFocusedMapping && !preview.blocksImport ? (
                <div className="space-y-5">
                  <div className="rounded-[24px] border border-[var(--workspace-border)] bg-[var(--workspace-panel)] p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                          Import review
                        </p>
                        <p className="mt-2 text-lg font-medium text-[var(--workspace-text)]">
                          {preview.sourceLabel} · {preview.fileName}
                        </p>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--workspace-muted)]">
                          {hasBookingPreview
                            ? `This file contains ${preview.totalRowsRead} booking rows. ${importableBookingRows} can be imported now, ${reviewAfterImportBookingRows} will be flagged for review in Bookings, and ${blockedBookingRows} will stay out.`
                            : "We checked your file against synced calendar data to catch duplicates and conflicts before import."}
                        </p>
                      </div>
                      <div className="rounded-[18px] border border-[var(--workspace-border)] bg-white/[0.03] px-4 py-4 text-right">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                          {hasBookingPreview ? "Rows in file" : "Total rows found"}
                        </p>
                        <p className="mt-2 text-3xl font-semibold text-[var(--workspace-text)]">
                          {preview.totalRowsRead}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                      {(
                        hasBookingPreview
                          ? [
                              ["Ready now", String(autoApprovedBookingRows), "border-emerald-400/18 bg-emerald-300/[0.08] text-emerald-100"],
                              ["Need review", String(needsReviewBookingRows), "border-yellow-300/18 bg-yellow-300/[0.08] text-yellow-100"],
                              ["Blocked", String(blockedBookingRows), "border-rose-400/18 bg-rose-300/[0.08] text-rose-100"],
                              ["Canceled in file", String(canceledBookingRows), "border-white/10 bg-white/[0.02] text-[var(--workspace-text)]"],
                              ["Matched to calendar", String(preview.matchedRows), "border-teal-400/18 bg-teal-300/[0.08] text-teal-100"],
                              ["Already in workspace", String(existingDuplicateRows), "border-amber-400/18 bg-amber-300/[0.08] text-amber-100"],
                            ]
                          : [
                              ["New bookings", String(preview.newRows), "border-white/10 bg-white/[0.02] text-[var(--workspace-text)]"],
                              ["Matched to calendar", String(preview.matchedRows), "border-teal-400/18 bg-teal-300/[0.08] text-teal-100"],
                              ["Duplicates", String(preview.duplicateRows), "border-amber-400/18 bg-amber-300/[0.08] text-amber-100"],
                              ["Conflicts", String(preview.conflictRows), "border-rose-400/18 bg-rose-300/[0.08] text-rose-100"],
                              ["Warnings", String(preview.warningRows + preview.errorRows), "border-yellow-300/18 bg-yellow-300/[0.08] text-yellow-100"],
                              ["Auto-fixed", String(preview.autoFixedRows), "border-[var(--workspace-accent)]/18 bg-[rgba(125,211,197,0.08)] text-teal-100"],
                            ]
                      ).map(([label, value, classes]) => (
                        <div key={String(label)} className={`rounded-[20px] border px-4 py-4 ${classes}`}>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--workspace-muted)]">
                            {label}
                          </p>
                          <p className="mt-3 text-3xl font-semibold">{value}</p>
                        </div>
                      ))}
                    </div>

                    {hasBookingPreview ? (
                      <div className="mt-5 rounded-[20px] border border-[var(--workspace-border)] bg-white/[0.02] px-4 py-4 text-sm leading-6 text-[var(--workspace-muted)]">
                        <p>
                          Hostlyx read <span className="font-medium text-[var(--workspace-text)]">{preview.totalRowsRead}</span> rows from this file.
                          <span className="font-medium text-[var(--workspace-text)]"> {importableBookingRows}</span> can be imported right now.
                          <span className="font-medium text-[var(--workspace-text)]"> {reviewAfterImportBookingRows}</span> will land in Bookings with a review note, and
                          <span className="font-medium text-[var(--workspace-text)]"> {blockedBookingRows}</span> are blocked, including
                          <span className="font-medium text-[var(--workspace-text)]"> {existingDuplicateRows}</span> already in your workspace
                          {fileDuplicateRows > 0 ? (
                            <>
                              {" "}and <span className="font-medium text-[var(--workspace-text)]">{fileDuplicateRows}</span> duplicated inside the uploaded file
                            </>
                          ) : null}
                          .
                        </p>
                        {canceledBookingRows > 0 ? (
                          <p className="mt-2">
                            <span className="font-medium text-[var(--workspace-text)]">{canceledBookingRows}</span> rows are canceled reservations in the source file, so they still count as file history even if they are not the main operational stays you expect to import.
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-[24px] border border-teal-300/18 bg-teal-300/[0.08] p-5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-100/70">
                        {isSpanish ? "Se importarán ahora" : "Importing now"}
                      </p>
                      <p className="mt-3 text-3xl font-semibold text-teal-100">
                        {importableBookingRows}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-teal-100/80">
                        {isSpanish
                          ? "Reservas utilizables que Hostlyx puede guardar ya mismo."
                          : "Usable bookings Hostlyx can save right away."}
                      </p>
                    </div>
                    <div className="rounded-[24px] border border-amber-300/18 bg-amber-300/[0.08] p-5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-100/70">
                        {isSpanish ? "Irán a revisión" : "Going to review"}
                      </p>
                      <p className="mt-3 text-3xl font-semibold text-amber-100">
                        {reviewAfterImportBookingRows}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-amber-100/85">
                        {isSpanish
                          ? "Entrarán en Reservas con una nota para que las corrijas allí, no aquí."
                          : "These will land in Bookings with a note so you can fix them there, not here."}
                      </p>
                    </div>
                    <div className="rounded-[24px] border border-rose-300/18 bg-rose-300/[0.08] p-5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-100/70">
                        {isSpanish ? "No se importarán" : "Not importing"}
                      </p>
                      <p className="mt-3 text-3xl font-semibold text-rose-100">
                        {blockedBookingRows}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-rose-100/80">
                        {isSpanish
                          ? "Duplicadas, bloqueadas o claramente inválidas. Esas sí deben corregirse en el archivo fuente."
                          : "Duplicates, blocked rows, or clearly invalid data. Those should be fixed in the source file."}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-[var(--workspace-border)] bg-[var(--workspace-panel)] p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                      {isSpanish ? "Qué pasará después" : "What happens next"}
                    </p>
                    <div className="mt-4 grid gap-3 lg:grid-cols-3">
                      <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-4 text-sm text-[var(--workspace-text)]">
                        {isSpanish
                          ? "1. Hostlyx importará todas las filas utilizables sin obligarte a aprobar una por una."
                          : "1. Hostlyx will import every usable row without forcing you to approve them one by one."}
                      </div>
                      <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-4 text-sm text-[var(--workspace-text)]">
                        {isSpanish
                          ? "2. Las reservas dudosas quedarán marcadas en Reservas como 'necesitan revisión'."
                          : "2. Uncertain bookings will be marked in Bookings as 'need review'."}
                      </div>
                      <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-4 text-sm text-[var(--workspace-text)]">
                        {isSpanish
                          ? "3. Allí podrás editarlas o marcarlas como revisadas sin volver a este modal."
                          : "3. From there you can edit them or mark them reviewed without coming back to this modal."}
                      </div>
                    </div>
                  </div>

                  {preview.previewRows.length > 0 ? (
                    <div className="rounded-[24px] border border-[var(--workspace-border)] bg-[var(--workspace-panel)] p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                            {isSpanish ? "Muestra rápida" : "Quick sample"}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-[var(--workspace-muted)]">
                            {isSpanish
                              ? "Solo una vista corta del archivo. La corrección real ocurre después dentro de Reservas."
                              : "Just a short sample of the file. The real correction happens later inside Bookings."}
                          </p>
                        </div>
                        <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-[var(--workspace-muted)]">
                          {preview.previewRows.length} {isSpanish ? "filas mostradas" : "rows shown"}
                        </span>
                      </div>

                      <div className="mt-4 grid gap-3 lg:grid-cols-2">
                        {preview.previewRows.map((row, index) => (
                          <div
                            key={`preview-row-${index}-${row.guestName}`}
                            className="rounded-[20px] border border-white/8 bg-white/[0.03] px-4 py-4"
                          >
                            <div className="flex flex-wrap items-center gap-3">
                              <p className="text-base font-medium text-[var(--workspace-text)]">
                                {row.guestName || (isSpanish ? "Reserva importada" : "Imported booking")}
                              </p>
                              <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.08em] ${getPreviewStatusPill(row.status)}`}>
                                {getPreviewStatusLabel(row.status, isSpanish)}
                              </span>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--workspace-muted)]">
                              <span className="rounded-full border border-white/8 bg-white/[0.02] px-3 py-1.5">
                                {row.channel}
                              </span>
                              <span className="rounded-full border border-white/8 bg-white/[0.02] px-3 py-1.5">
                                {formatCompactDate(row.checkIn, isSpanish ? "es-ES" : "en-US")}
                              </span>
                              <span className="rounded-full border border-white/8 bg-white/[0.02] px-3 py-1.5">
                                {formatCompactDate(row.checkOut, isSpanish ? "es-ES" : "en-US")}
                              </span>
                            </div>
                            <p className="mt-3 text-sm text-[var(--workspace-text)]">
                              {isSpanish ? "Ingreso bruto" : "Gross revenue"} · {formatCurrency(row.grossRevenue)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div
                    ref={readyToContinueRef}
                    className="rounded-[24px] border border-[var(--workspace-border)] bg-[var(--workspace-panel)] p-5"
                  >
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                      <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-center">
                        <div className="rounded-full border border-teal-300/18 bg-teal-300/[0.08] px-3 py-2 text-sm text-teal-100">
                          {importableBookingRows} {isSpanish ? "se importan ahora" : "importing now"}
                        </div>
                        <div className="rounded-full border border-amber-300/18 bg-amber-300/[0.08] px-3 py-2 text-sm text-amber-100">
                          {reviewAfterImportBookingRows} {isSpanish ? "van a revisión" : "going to review"}
                        </div>
                        <div className="rounded-full border border-rose-300/18 bg-rose-300/[0.08] px-3 py-2 text-sm text-rose-100">
                          {blockedBookingRows + existingDuplicateRows + fileDuplicateRows} {isSpanish ? "no se importan" : "not importing"}
                        </div>
                      </div>

                      <p className="text-sm text-[var(--workspace-muted)]">
                        {isSpanish
                          ? `${actionableRows} fila${actionableRows === 1 ? "" : "s"} lista${actionableRows === 1 ? "" : "s"} para importar`
                          : `${actionableRows} rows ready to import`}
                      </p>

                      <div className="flex flex-col gap-3 sm:flex-row">
                        <button
                          ref={importButtonRef}
                          type="button"
                          onClick={handleImport}
                          disabled={actionableRows <= 0 || phase === "importing" || phase === "previewing"}
                          className="workspace-button-primary inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-[220px]"
                        >
                          {phase === "importing" ? (
                            <>
                              <LoaderCircle className="h-4 w-4 animate-spin" />
                              {isSpanish ? "Importando reservas" : "Importing bookings"}
                            </>
                          ) : (
                            isSpanish ? "Importar y revisar después" : "Import and review later"
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={handleCancel}
                          className="workspace-button-secondary inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold transition"
                        >
                          {isSpanish ? "Cancelar" : "Cancel"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="workspace-soft-card rounded-[28px] border border-[var(--workspace-border)] px-6 py-6 text-sm text-[var(--workspace-muted)]">
              Upload a file to see detected source, a clean import summary, and a preview before anything is saved.
            </div>
          )}
        </div>
        </div>
      </div>

    </div>
  );
}

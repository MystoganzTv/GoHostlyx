import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { requireUserEmail } from "@/lib/auth";
import {
  appendFinancialStatementImport,
  appendImportData,
  getBookings,
  getCalendarEvents,
  getPropertyDefinitions,
} from "@/lib/db";
import { buildImportPreview, mapPreviewToHostlyxRecords } from "@/lib/import/importPipeline";
import type { ImportManualMapping, ImportRowResolution } from "@/lib/import/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const ownerEmail = await requireUserEmail();

    if (!ownerEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const action = String(formData.get("action") ?? "preview").trim().toLowerCase();
    const requestedPropertyName = String(formData.get("propertyName") ?? "").trim();
    const fileValue = formData.get("file");
    const manualMappingValue = formData.get("manualMapping");
    const rowResolutionsValue = formData.get("rowResolutions");

    if (!(fileValue instanceof File) || fileValue.size <= 0) {
      return NextResponse.json(
        { error: "Attach a valid Airbnb, Booking.com, or Hostlyx file first." },
        { status: 400 },
      );
    }

    if (!/\.(csv|xlsx|xls)$/i.test(fileValue.name)) {
      return NextResponse.json(
        { error: "Only CSV or Excel files are supported for import preview." },
        { status: 400 },
      );
    }

    const buffer = await fileValue.arrayBuffer();
    const [existingBookings, existingCalendarEvents] = await Promise.all([
      getBookings(ownerEmail),
      getCalendarEvents(ownerEmail),
    ]);
    let manualMapping: ImportManualMapping | null = null;
    let rowResolutions: ImportRowResolution[] = [];

    if (typeof manualMappingValue === "string" && manualMappingValue.trim()) {
      try {
        manualMapping = JSON.parse(manualMappingValue) as ImportManualMapping;
      } catch {
        return NextResponse.json(
          { error: "Hostlyx could not read the manual column mapping." },
          { status: 400 },
        );
      }
    }

    if (typeof rowResolutionsValue === "string" && rowResolutionsValue.trim()) {
      try {
        rowResolutions = JSON.parse(rowResolutionsValue) as ImportRowResolution[];
      } catch {
        return NextResponse.json(
          { error: "Hostlyx could not read the row fixes from this import review." },
          { status: 400 },
        );
      }
    }

    const preview = buildImportPreview(buffer, fileValue.name, existingBookings, existingCalendarEvents, {
      propertyName: requestedPropertyName,
      manualMapping,
      rowResolutions,
    });

    if (action !== "commit") {
      return NextResponse.json({
        preview: {
          source: preview.source,
          sourceLabel: preview.sourceLabel,
          fileName: preview.fileName,
          requiresManualMapping: preview.requiresManualMapping,
          blocksImport: preview.blocksImport,
          blockMessage: preview.blockMessage,
          manualMapping: preview.manualMapping,
          totalRowsRead: preview.totalRowsRead,
          validRows: preview.validRows,
          warningRows: preview.warningRows,
          duplicateRows: preview.duplicateRows,
          matchedRows: preview.matchedRows,
          conflictRows: preview.conflictRows,
          newRows: preview.newRows,
          errorRows: preview.errorRows,
          skippedRows: preview.skippedRows,
          autoFixedRows: preview.autoFixedRows,
          autoFixSummary: preview.autoFixSummary,
          expensesDetected: preview.expensesDetected,
          importableRows: preview.importableRows,
          financialStatement: preview.financialStatement,
          previewRows: preview.previewRows,
          tableRows: preview.tableRows,
          reviewRows: preview.reviewRows,
          warnings: preview.warnings,
          duplicates: preview.duplicates,
          calendarMatches: preview.calendarMatches,
          canImport: preview.canImport,
        },
      });
    }

    if (!preview.canImport) {
      return NextResponse.json(
        {
          error: preview.requiresManualMapping
            ? "We couldn’t fully recognize your file. Map your columns in a few seconds to continue."
            : preview.source === "financial_statement"
            ? preview.blockMessage ?? "This payout statement still needs one more review before Hostlyx can import it."
            : "This file needs attention before Hostlyx can import it.",
        },
        { status: 400 },
      );
    }

    const propertyDefinitions = await getPropertyDefinitions(ownerEmail);

    if (propertyDefinitions.length === 0) {
      return NextResponse.json(
        { error: "Create your first property before importing data." },
        { status: 400 },
      );
    }

    const targetPropertyName = requestedPropertyName || propertyDefinitions[0]?.name || "";

    if (
      !targetPropertyName ||
      !propertyDefinitions.some(
        (property) => property.name.toLowerCase() === targetPropertyName.toLowerCase(),
      )
    ) {
      return NextResponse.json(
        { error: "Choose a valid property for this import." },
        { status: 400 },
      );
    }

    const workbookHash = createHash("sha256")
      .update(Buffer.from(buffer))
      .digest("hex");

    if (preview.source === "financial_statement" && preview.financialStatement) {
      const result = await appendFinancialStatementImport({
        ownerEmail,
        fileName: fileValue.name,
        workbookHash,
        propertyName: targetPropertyName,
        source: "upload",
        document: {
          propertyName: targetPropertyName,
          source: preview.financialStatement.source,
          period: preview.financialStatement.period,
          totalPayout: preview.financialStatement.totalPayout,
          totalFees: preview.financialStatement.totalFees,
          totalTaxes: preview.financialStatement.totalTaxes,
          currency: preview.financialStatement.currency,
          rawData: preview.financialStatement.rawData,
        },
      });

      return NextResponse.json({
        message: `Imported 1 payout statement into ${targetPropertyName}.`,
        committed: {
          source: preview.source,
          sourceLabel: preview.sourceLabel,
          bookingsImported: 0,
          expensesImported: 0,
          skippedRows: 0,
          financialDocumentsImported: result.financialDocumentsCount,
        },
      });
    }

    const mapped = mapPreviewToHostlyxRecords(preview, targetPropertyName);

    if (mapped.bookings.length === 0 && mapped.expenses.length === 0) {
      return NextResponse.json(
        {
          error:
            "Everything in this file is blocked, duplicated, canceled, or still missing key data. Fix the source file or use Bookings to review imported rows after the next attempt.",
        },
        { status: 400 },
      );
    }

    const result = await appendImportData({
      ownerEmail,
      fileName: fileValue.name,
      workbookHash,
      propertyName: targetPropertyName,
      source: "upload",
      importedSource: mapped.importedSource,
      bookings: mapped.bookings,
      expenses: mapped.expenses,
      closures: [],
      allowDuplicateBookings: false,
    });

    return NextResponse.json({
      message: `Imported ${result.bookingsCount} bookings and ${result.expensesCount} expenses into ${targetPropertyName}.`,
      committed: {
        source: preview.source,
        sourceLabel: preview.sourceLabel,
        bookingsImported: result.bookingsCount,
        expensesImported: result.expensesCount,
        skippedRows: preview.skippedRows + preview.duplicateRows,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "The file could not be processed.",
      },
      { status: 400 },
    );
  }
}

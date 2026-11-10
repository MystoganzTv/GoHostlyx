import type {
  AdminUserSummary,
  BookingRecord,
  BookingReviewStatus,
  CalendarEventRecord,
  CalendarEventSource,
  CalendarEventType,
  CalendarClosureRecord,
  CountryCode,
  ExpenseRecord,
  FinancialDocumentRecord,
  IcalFeedRecord,
  IcalFeedSyncStatus,
  ImportedFileSource,
  ImportSource,
  ImportSummary,
  PropertyDefinition,
  SubscriptionPlan,
  SubscriptionState,
  SubscriptionStatus,
  UserSettings,
} from "./types";
import type { StoredSubscription } from "./db-types";
import { isAdminOwnerEmail } from "./admin";
import {
  getRowValue,
  mapBookingRecord,
  mapCalendarClosureRecord,
  mapCalendarEventRecord,
  mapExpenseRecord,
  mapFinancialDocumentRecord,
  mapIcalFeedRecord,
  mapImportSummary,
  normalizeTimestampValue,
} from "./db-mappers";
import {
  ensureDatabase,
  getDefaultUserSettings,
  getPostgresPool,
  normalizeOwnerEmail,
} from "./db-core";
import {
  getCountryForCurrency,
  getCurrencyForCountry,
  normalizeCountryCode,
} from "./markets";
import {
  getTrialEndDate,
  normalizeSubscriptionPlan,
  normalizeSubscriptionStatus,
} from "./subscription";
import { getDefaultTaxRateByCountry, normalizeTaxRate } from "./tax";


function cloneSubscription(subscription: StoredSubscription): SubscriptionState {
  return {
    plan: subscription.plan,
    status: subscription.status,
    trialStartedAt: subscription.trialStartedAt,
    trialEndsAt: subscription.trialEndsAt,
    activatedAt: subscription.activatedAt,
    updatedAt: subscription.updatedAt,
    stripeCustomerId: subscription.stripeCustomerId,
    stripeSubscriptionId: subscription.stripeSubscriptionId,
    stripePriceId: subscription.stripePriceId,
  };
}

async function upsertStoredSubscription(nextSubscription: StoredSubscription) {
  const pool = getPostgresPool();
  await pool.query(
    `
      INSERT INTO subscriptions (
        owner_email,
        plan,
        status,
        trial_started_at,
        trial_ends_at,
        activated_at,
        updated_at,
        stripe_customer_id,
        stripe_subscription_id,
        stripe_price_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (owner_email)
      DO UPDATE SET
        plan = EXCLUDED.plan,
        status = EXCLUDED.status,
        trial_started_at = EXCLUDED.trial_started_at,
        trial_ends_at = EXCLUDED.trial_ends_at,
        activated_at = EXCLUDED.activated_at,
        updated_at = EXCLUDED.updated_at,
        stripe_customer_id = EXCLUDED.stripe_customer_id,
        stripe_subscription_id = EXCLUDED.stripe_subscription_id,
        stripe_price_id = EXCLUDED.stripe_price_id
    `,
    [
      nextSubscription.ownerEmail,
      nextSubscription.plan,
      nextSubscription.status,
      nextSubscription.trialStartedAt,
      nextSubscription.trialEndsAt,
      nextSubscription.activatedAt,
      nextSubscription.updatedAt,
      nextSubscription.stripeCustomerId,
      nextSubscription.stripeSubscriptionId,
      nextSubscription.stripePriceId,
    ],
  );

}

/** Tables that reference a property by its name (property_name column). */
const propertyNamedTables = [
  "bookings",
  "expenses",
  "imports",
  "calendar_closures",
  "calendar_events",
  "ical_feeds",
  "financial_documents",
] as const;

async function syncPropertyDefinitionsFromRecords(ownerEmail: string) {
  await ensureDatabase();
  const normalizedEmail = normalizeOwnerEmail(ownerEmail);
  const fallbackCountryCode: CountryCode = "US";
  const createdAt = new Date().toISOString();

  const pool = getPostgresPool();
  const [propertiesResult, bookingResult, expenseResult, importResult] = await Promise.all([
    pool.query("SELECT name FROM properties WHERE owner_email = $1", [normalizedEmail]),
    pool.query(
      "SELECT DISTINCT property_name AS propertyName FROM bookings WHERE owner_email = $1 AND property_name <> ''",
      [normalizedEmail],
    ),
    pool.query(
      "SELECT DISTINCT property_name AS propertyName FROM expenses WHERE owner_email = $1 AND property_name <> ''",
      [normalizedEmail],
    ),
    pool.query(
      "SELECT DISTINCT property_name AS propertyName FROM imports WHERE owner_email = $1 AND property_name <> ''",
      [normalizedEmail],
    ),
  ]);

  const existingNames = new Set(
    propertiesResult.rows.map((row) =>
      String(getRowValue(row as Record<string, unknown>, "name")).trim().toLowerCase(),
    ),
  );
  const discoveredNames = new Set<string>();

  for (const row of [...bookingResult.rows, ...expenseResult.rows, ...importResult.rows]) {
    const name = String(
      getRowValue(row as Record<string, unknown>, "propertyName", "propertyname") ?? "",
    ).trim();

    if (name) {
      discoveredNames.add(name);
    }
  }

  for (const discoveredName of discoveredNames) {
    const normalizedName = discoveredName.toLowerCase();
    if (existingNames.has(normalizedName)) {
      continue;
    }

    await pool.query(
      `
        INSERT INTO properties (owner_email, name, country_code, created_at)
        VALUES ($1, $2, $3, $4)
      `,
      [normalizedEmail, discoveredName, fallbackCountryCode, createdAt],
    );
    existingNames.add(normalizedName);
  }

}

function normalizeFingerprintValue(value: string) {
  return value.trim().toLowerCase();
}

function formatFingerprintNumber(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

function createBookingFingerprint(booking: BookingRecord) {
  return [
    normalizeFingerprintValue(booking.propertyName),
    normalizeFingerprintValue(booking.unitName),
    booking.checkIn,
    booking.checkout,
    normalizeFingerprintValue(booking.guestName),
    booking.guestCount,
    normalizeFingerprintValue(booking.channel),
    normalizeFingerprintValue(booking.rentalPeriod),
    formatFingerprintNumber(booking.pricePerNight),
    formatFingerprintNumber(booking.extraFee),
    formatFingerprintNumber(booking.discount),
    formatFingerprintNumber(booking.rentalRevenue),
    formatFingerprintNumber(booking.cleaningFee),
    formatFingerprintNumber(booking.totalRevenue),
    formatFingerprintNumber(booking.hostFee),
    formatFingerprintNumber(booking.payout),
    booking.nights,
  ].join("|");
}

function createExpenseFingerprint(expense: ExpenseRecord) {
  return [
    normalizeFingerprintValue(expense.propertyName),
    normalizeFingerprintValue(expense.unitName),
    expense.date,
    normalizeFingerprintValue(expense.category),
    formatFingerprintNumber(expense.amount),
    normalizeFingerprintValue(expense.description),
    normalizeFingerprintValue(expense.note),
  ].join("|");
}

function createClosureFingerprint(closure: CalendarClosureRecord) {
  return [
    normalizeFingerprintValue(closure.propertyName),
    normalizeFingerprintValue(closure.unitName),
    closure.date,
    normalizeFingerprintValue(closure.reason),
    normalizeFingerprintValue(closure.note),
    normalizeFingerprintValue(closure.statusLabel),
    closure.guestCount,
    closure.nights,
  ].join("|");
}

type ImportDataResult = {
  importId: number;
  importedAt: string;
  bookingsCount: number;
  expensesCount: number;
  closuresCount: number;
  skippedBookingsCount: number;
  skippedExpensesCount: number;
  skippedClosuresCount: number;
};

type WorkbookImportMatch = {
  workbookHash: string;
  fileName: string;
  propertyName: string;
  importedAt: string;
};

type DeleteImportResult = {
  deletedImportId: number;
  deletedFileName: string;
  deletedPropertyName: string;
  deletedBookingsCount: number;
  deletedExpensesCount: number;
};

type FinancialStatementImportResult = {
  importId: number;
  importedAt: string;
  financialDocumentsCount: number;
};

export async function appendImportData({
  ownerEmail,
  fileName,
  workbookHash,
  propertyName,
  source,
  importedSource,
  bookings,
  expenses,
  closures,
  allowDuplicateBookings = false,
}: {
  ownerEmail: string;
  fileName: string;
  workbookHash: string;
  propertyName: string;
  source: ImportSource;
  importedSource: ImportedFileSource;
  bookings: BookingRecord[];
  expenses: ExpenseRecord[];
  closures: CalendarClosureRecord[];
  allowDuplicateBookings?: boolean;
}): Promise<ImportDataResult> {
  await ensureDatabase();
  const normalizedEmail = normalizeOwnerEmail(ownerEmail);

  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingBookings = await client.query(
      `
        SELECT
          property_name AS propertyName,
          unit_name AS unitName,
          check_in AS checkIn,
          checkout,
          imported_source AS importedSource,
          guest_name AS guestName,
          guest_count AS guestCount,
          channel,
          rental_period AS rentalPeriod,
          price_per_night AS pricePerNight,
          extra_fee AS extraFee,
          discount,
          rental_revenue AS rentalRevenue,
          cleaning_fee AS cleaningFee,
          tax_amount AS taxAmount,
          total_revenue AS totalRevenue,
          host_fee AS hostFee,
          payout,
          nights
        FROM bookings
        WHERE owner_email = $1 AND source = 'upload'
      `,
      [normalizedEmail],
    );
    const existingExpenses = await client.query(
      `
        SELECT
          property_name AS propertyName,
          unit_name AS unitName,
          date,
          category,
          amount,
          description,
          note
        FROM expenses
        WHERE owner_email = $1 AND source = 'upload'
      `,
      [normalizedEmail],
    );
    const existingClosures = await client.query(
      `
        SELECT
          property_name AS propertyName,
          unit_name AS unitName,
          date,
          reason,
          note,
          status_label AS statusLabel,
          guest_count AS guestCount,
          nights
        FROM calendar_closures
        WHERE owner_email = $1 AND source = 'upload'
      `,
      [normalizedEmail],
    );

    const bookingFingerprints = new Set(
      existingBookings.rows.map((row) => createBookingFingerprint(mapBookingRecord(row))),
    );
    const expenseFingerprints = new Set(
      existingExpenses.rows.map((row) => createExpenseFingerprint(mapExpenseRecord(row))),
    );
    const closureFingerprints = new Set(
      existingClosures.rows.map((row) =>
        createClosureFingerprint(mapCalendarClosureRecord(row as Record<string, unknown>)),
      ),
    );

    const freshBookings = allowDuplicateBookings
      ? bookings
      : bookings.filter((booking) => {
          const fingerprint = createBookingFingerprint(booking);
          if (bookingFingerprints.has(fingerprint)) {
            return false;
          }

          bookingFingerprints.add(fingerprint);
          return true;
        });
    const freshExpenses = expenses.filter((expense) => {
      const fingerprint = createExpenseFingerprint(expense);
      if (expenseFingerprints.has(fingerprint)) {
        return false;
      }

      expenseFingerprints.add(fingerprint);
      return true;
    });
    const freshClosures = closures.filter((closure) => {
      const fingerprint = createClosureFingerprint(closure);
      if (closureFingerprints.has(fingerprint)) {
        return false;
      }

      closureFingerprints.add(fingerprint);
      return true;
    });

    const importedAt = new Date().toISOString();

    const importResult = await client.query(
      `
        INSERT INTO imports (owner_email, file_name, workbook_hash, property_name, source, imported_source, imported_at, bookings_count, expenses_count)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
      `,
      [
        normalizedEmail,
        fileName,
        workbookHash,
        propertyName,
        source,
        importedSource,
        importedAt,
        freshBookings.length,
        freshExpenses.length,
      ],
    );

    const importId = Number(importResult.rows[0]?.id ?? 0);

    for (const booking of freshBookings) {
      const inserted = await client.query(
        `
        INSERT INTO bookings (
            owner_email, import_id, source, property_id, property_name, unit_name, check_in, checkout, guest_name, guest_count,
            guest_contact, booked_at, adults_count, children_count, infants_count, imported_source, channel, rental_period, price_per_night, extra_fee, discount, rental_revenue,
            cleaning_fee, tax_amount, total_revenue, host_fee, payout, nights, booking_number, overbooking_status,
            match_status, matched_calendar_event_id, review_status, review_reason
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34)
          RETURNING id
        `,
        [
          normalizedEmail,
          importId,
          source,
          booking.propertyId,
          booking.propertyName,
          booking.unitName,
          booking.checkIn,
          booking.checkout,
          booking.guestName,
          booking.guestCount,
          booking.guestContact ?? "",
          booking.bookedAt ?? "",
          booking.adultsCount ?? 0,
          booking.childrenCount ?? 0,
          booking.infantsCount ?? 0,
          booking.importedSource ?? importedSource,
          booking.channel,
          booking.rentalPeriod,
          booking.pricePerNight,
          booking.extraFee,
          booking.discount,
          booking.rentalRevenue,
          booking.cleaningFee,
          booking.taxAmount,
          booking.totalRevenue,
          booking.hostFee,
          booking.payout,
          booking.nights,
          booking.bookingNumber,
          booking.overbookingStatus,
          booking.matchStatus ?? "unmatched",
          booking.matchedCalendarEventId ?? null,
          booking.reviewStatus ?? "ready",
          booking.reviewReason ?? "",
        ],
      );

      const insertedBookingId = Number(inserted.rows[0]?.id ?? 0);
      if (insertedBookingId > 0 && booking.matchedCalendarEventId) {
        await client.query(
          `
            UPDATE calendar_events
            SET linked_booking_id = $1
            WHERE id = $2 AND owner_email = $3
          `,
          [insertedBookingId, booking.matchedCalendarEventId, normalizedEmail],
        );
      }
    }

    for (const expense of freshExpenses) {
      await client.query(
        `
          INSERT INTO expenses (
            owner_email, import_id, source, property_name, unit_name, date, category, amount, description, note
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `,
        [
          normalizedEmail,
          importId,
          source,
          expense.propertyName,
          expense.unitName,
          expense.date,
          expense.category,
          expense.amount,
          expense.description,
          expense.note,
        ],
      );
    }

    for (const closure of freshClosures) {
      await client.query(
        `
          INSERT INTO calendar_closures (
            owner_email, import_id, source, property_name, unit_name, date, reason, note, status_label, guest_count, nights
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `,
        [
          normalizedEmail,
          importId,
          source,
          closure.propertyName,
          closure.unitName,
          closure.date,
          closure.reason,
          closure.note,
          closure.statusLabel,
          closure.guestCount,
          closure.nights,
        ],
      );
    }

    await client.query("COMMIT");

    return {
      importId,
      importedAt,
      bookingsCount: freshBookings.length,
      expensesCount: freshExpenses.length,
      closuresCount: freshClosures.length,
      skippedBookingsCount: bookings.length - freshBookings.length,
      skippedExpensesCount: expenses.length - freshExpenses.length,
      skippedClosuresCount: closures.length - freshClosures.length,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getLatestImport(ownerEmail: string): Promise<ImportSummary | null> {
  await ensureDatabase();
  const normalizedEmail = normalizeOwnerEmail(ownerEmail);

  const pool = getPostgresPool();
  const result = await pool.query(
    `
      SELECT
        id,
        file_name AS fileName,
        property_name AS propertyName,
        source,
        imported_source AS importedSource,
        imported_at AS importedAt,
        bookings_count AS bookingsCount,
        expenses_count AS expensesCount
      FROM imports
      WHERE owner_email = $1
      ORDER BY imported_at DESC
      LIMIT 1
    `,
    [normalizedEmail],
  );

  return result.rows[0] ? mapImportSummary(result.rows[0]) : null;
}

export async function getImportSummaries(ownerEmail: string): Promise<ImportSummary[]> {
  await ensureDatabase();
  const normalizedEmail = normalizeOwnerEmail(ownerEmail);

  const pool = getPostgresPool();
  const result = await pool.query(
    `
      SELECT
        id,
        file_name AS fileName,
        property_name AS propertyName,
        source,
        imported_source AS importedSource,
        imported_at AS importedAt,
        bookings_count AS bookingsCount,
        expenses_count AS expensesCount
      FROM imports
      WHERE owner_email = $1
      ORDER BY imported_at DESC
    `,
    [normalizedEmail],
  );

  return result.rows.map((row) => mapImportSummary(row as Record<string, unknown>));
}

export async function getImportedWorkbookMatches(
  ownerEmail: string,
  workbookHashes: string[],
): Promise<WorkbookImportMatch[]> {
  await ensureDatabase();
  const normalizedEmail = normalizeOwnerEmail(ownerEmail);
  const normalizedHashes = Array.from(
    new Set(
      workbookHashes
        .map((hash) => hash.trim().toLowerCase())
        .filter(Boolean),
    ),
  );

  if (normalizedHashes.length === 0) {
    return [];
  }

  const pool = getPostgresPool();
  const result = await pool.query(
    `
      SELECT
        workbook_hash AS "workbookHash",
        file_name AS "fileName",
        property_name AS "propertyName",
        imported_at AS "importedAt"
      FROM imports
      WHERE owner_email = $1
        AND workbook_hash = ANY($2::text[])
    `,
    [normalizedEmail, normalizedHashes],
  );

  return result.rows.map((row) => ({
    workbookHash: String(getRowValue(row as Record<string, unknown>, "workbookHash")),
    fileName: String(getRowValue(row as Record<string, unknown>, "fileName", "filename")),
    propertyName:
      String(getRowValue(row as Record<string, unknown>, "propertyName", "propertyname")) ||
      "Default Property",
    importedAt: normalizeTimestampValue(
      getRowValue(row as Record<string, unknown>, "importedAt", "importedat"),
      new Date().toISOString(),
    ),
  }));
}

export async function deleteImportBatch({
  ownerEmail,
  importId,
}: {
  ownerEmail: string;
  importId: number;
}): Promise<DeleteImportResult> {
  await ensureDatabase();
  const normalizedEmail = normalizeOwnerEmail(ownerEmail);

  if (!Number.isFinite(importId) || importId <= 0) {
    throw new Error("Import not found.");
  }

  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const importResult = await client.query(
      `
        SELECT
          id,
          file_name AS fileName,
          property_name AS propertyName
        FROM imports
        WHERE owner_email = $1 AND id = $2
        LIMIT 1
      `,
      [normalizedEmail, importId],
    );

    const importRow = importResult.rows[0] as Record<string, unknown> | undefined;

    if (!importRow) {
      throw new Error("Import not found.");
    }

    const bookingDelete = await client.query(
      "DELETE FROM bookings WHERE owner_email = $1 AND import_id = $2",
      [normalizedEmail, importId],
    );
    const expenseDelete = await client.query(
      "DELETE FROM expenses WHERE owner_email = $1 AND import_id = $2",
      [normalizedEmail, importId],
    );
    await client.query(
      "DELETE FROM financial_documents WHERE owner_email = $1 AND import_id = $2",
      [normalizedEmail, importId],
    );
    await client.query(
      "DELETE FROM calendar_closures WHERE owner_email = $1 AND import_id = $2",
      [normalizedEmail, importId],
    );
    await client.query("DELETE FROM imports WHERE owner_email = $1 AND id = $2", [
      normalizedEmail,
      importId,
    ]);

    await client.query("COMMIT");

    return {
      deletedImportId: importId,
      deletedFileName: String(getRowValue(importRow, "fileName", "filename")),
      deletedPropertyName:
        String(getRowValue(importRow, "propertyName", "propertyname")) || "Default Property",
      deletedBookingsCount: bookingDelete.rowCount ?? 0,
      deletedExpensesCount: expenseDelete.rowCount ?? 0,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function appendFinancialStatementImport({
  ownerEmail,
  fileName,
  workbookHash,
  propertyName,
  source,
  document,
}: {
  ownerEmail: string;
  fileName: string;
  workbookHash: string;
  propertyName: string;
  source: ImportSource;
  document: FinancialDocumentRecord;
}): Promise<FinancialStatementImportResult> {
  await ensureDatabase();
  const normalizedEmail = normalizeOwnerEmail(ownerEmail);
  const importedAt = new Date().toISOString();

  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const importResult = await client.query(
      `
        INSERT INTO imports (owner_email, file_name, workbook_hash, property_name, source, imported_source, imported_at, bookings_count, expenses_count)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 0)
        RETURNING id
      `,
      [
        normalizedEmail,
        fileName,
        workbookHash,
        propertyName,
        source,
        "financial_statement",
        importedAt,
      ],
    );

    const importId = Number(importResult.rows[0]?.id ?? 0);

    await client.query(
      `
        INSERT INTO financial_documents (
          owner_email, import_id, property_name, source, period_start, period_end, period_label,
          total_payout, total_fees, total_taxes, currency, raw_data, imported_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `,
      [
        normalizedEmail,
        importId,
        propertyName,
        document.source,
        document.period.start,
        document.period.end,
        document.period.label,
        document.totalPayout,
        document.totalFees,
        document.totalTaxes,
        document.currency,
        document.rawData,
        importedAt,
      ],
    );

    await client.query("COMMIT");

    return {
      importId,
      importedAt,
      financialDocumentsCount: 1,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getFinancialDocuments(ownerEmail: string): Promise<FinancialDocumentRecord[]> {
  await ensureDatabase();
  const normalizedEmail = normalizeOwnerEmail(ownerEmail);

  const pool = getPostgresPool();
  const result = await pool.query(
    `
      SELECT
        id,
        import_id AS importId,
        property_name AS propertyName,
        source,
        period_start AS periodStart,
        period_end AS periodEnd,
        period_label AS periodLabel,
        total_payout AS totalPayout,
        total_fees AS totalFees,
        total_taxes AS totalTaxes,
        currency,
        raw_data AS rawData,
        imported_at AS importedAt
      FROM financial_documents
      WHERE owner_email = $1
      ORDER BY imported_at DESC
    `,
    [normalizedEmail],
  );

  return result.rows.map((row) => mapFinancialDocumentRecord(row as Record<string, unknown>));
}

export async function getBookings(ownerEmail: string): Promise<BookingRecord[]> {
  await ensureDatabase();
  const normalizedEmail = normalizeOwnerEmail(ownerEmail);

  const pool = getPostgresPool();
  const result = await pool.query(
    `
      SELECT
        id,
        import_id AS importId,
        source,
        imported_source AS importedSource,
        property_id AS propertyId,
        property_name AS propertyName,
        unit_name AS unitName,
        check_in AS checkIn,
        checkout,
        guest_name AS guestName,
        guest_count AS guestCount,
        guest_contact AS guestContact,
        booked_at AS bookedAt,
        adults_count AS adultsCount,
        children_count AS childrenCount,
        infants_count AS infantsCount,
        channel,
        rental_period AS rentalPeriod,
        price_per_night AS pricePerNight,
        extra_fee AS extraFee,
        discount,
        rental_revenue AS rentalRevenue,
        cleaning_fee AS cleaningFee,
        tax_amount AS taxAmount,
        total_revenue AS totalRevenue,
        host_fee AS hostFee,
        payout,
        nights,
        booking_number AS bookingNumber,
        overbooking_status AS overbookingStatus,
        match_status AS matchStatus,
        matched_calendar_event_id AS matchedCalendarEventId,
        review_status AS reviewStatus,
        review_reason AS reviewReason
      FROM bookings
      WHERE owner_email = $1
      ORDER BY check_in ASC
    `,
    [normalizedEmail],
  );

  return result.rows.map(mapBookingRecord);
}

export async function getExpenses(ownerEmail: string): Promise<ExpenseRecord[]> {
  await ensureDatabase();
  const normalizedEmail = normalizeOwnerEmail(ownerEmail);

  const pool = getPostgresPool();
  const result = await pool.query(
    `
      SELECT
        id,
        import_id AS importId,
        source,
        property_name AS propertyName,
        unit_name AS unitName,
        date,
        category,
        amount,
        description,
        note
      FROM expenses
      WHERE owner_email = $1
      ORDER BY date ASC
    `,
    [normalizedEmail],
  );

  return result.rows.map(mapExpenseRecord);
}

export async function getCalendarClosures(ownerEmail: string): Promise<CalendarClosureRecord[]> {
  await ensureDatabase();
  const normalizedEmail = normalizeOwnerEmail(ownerEmail);

  const pool = getPostgresPool();
  const result = await pool.query(
    `
      SELECT
        id,
        import_id AS importId,
        source,
        property_name AS propertyName,
        unit_name AS unitName,
        date,
        reason,
        note,
        status_label AS statusLabel,
        guest_count AS guestCount,
        nights
      FROM calendar_closures
      WHERE owner_email = $1
      ORDER BY date ASC
    `,
    [normalizedEmail],
  );

  return result.rows.map((row) => mapCalendarClosureRecord(row as Record<string, unknown>));
}

export async function getCalendarEvents(ownerEmail: string): Promise<CalendarEventRecord[]> {
  await ensureDatabase();
  const normalizedEmail = normalizeOwnerEmail(ownerEmail);

  const pool = getPostgresPool();
  const result = await pool.query(
    `
      SELECT
        id,
        import_id AS importId,
        ical_feed_id AS icalFeedId,
        property_id AS propertyId,
        property_name AS propertyName,
        unit_name AS unitName,
        source,
        external_event_id AS externalEventId,
        summary,
        description,
        start_date AS startDate,
        end_date AS endDate,
        event_type AS eventType,
        linked_booking_id AS linkedBookingId,
        last_synced_at AS lastSyncedAt
      FROM calendar_events
      WHERE owner_email = $1
      ORDER BY start_date ASC
    `,
    [normalizedEmail],
  );

  return result.rows.map((row) => mapCalendarEventRecord(row as Record<string, unknown>));
}

export async function getIcalFeeds(
  ownerEmail: string,
  options?: {
    includeInactive?: boolean;
  },
): Promise<IcalFeedRecord[]> {
  await ensureDatabase();
  const normalizedEmail = normalizeOwnerEmail(ownerEmail);
  const includeInactive = options?.includeInactive ?? false;

  const pool = getPostgresPool();
  const result = await pool.query(
    `
      SELECT
        feed.id,
        feed.workspace_id AS workspaceId,
        feed.property_id AS propertyId,
        feed.property_name AS propertyName,
        feed.listing_id AS listingId,
        feed.listing_name AS listingName,
        feed.source,
        feed.feed_url AS feedUrl,
        feed.is_active AS isActive,
        feed.last_synced_at AS lastSyncedAt,
        feed.last_sync_status AS lastSyncStatus,
        feed.last_error AS lastError,
        COUNT(event.id) AS eventCount
      FROM ical_feeds feed
      LEFT JOIN calendar_events event
        ON event.ical_feed_id = feed.id
       AND event.owner_email = feed.owner_email
      WHERE feed.owner_email = $1
        AND ($2::boolean = TRUE OR feed.is_active = TRUE)
      GROUP BY feed.id
      ORDER BY feed.is_active DESC, feed.property_name ASC, feed.listing_name ASC, feed.source ASC
    `,
    [normalizedEmail, includeInactive],
  );

  return result.rows.map((row) => mapIcalFeedRecord(row as Record<string, unknown>));
}

export async function getIcalFeedById({
  ownerEmail,
  feedId,
}: {
  ownerEmail: string;
  feedId: number;
}): Promise<IcalFeedRecord | null> {
  const feeds = await getIcalFeeds(ownerEmail, { includeInactive: true });
  return feeds.find((feed) => feed.id === feedId) ?? null;
}

export async function upsertIcalFeed({
  ownerEmail,
  propertyId,
  propertyName,
  listingId,
  listingName,
  source,
  feedUrl,
}: {
  ownerEmail: string;
  propertyId: number;
  propertyName: string;
  listingId?: number | null;
  listingName: string;
  source: CalendarEventSource;
  feedUrl: string;
}): Promise<number> {
  await ensureDatabase();
  const normalizedEmail = normalizeOwnerEmail(ownerEmail);
  const normalizedPropertyName = propertyName.trim() || "Default Property";
  const normalizedListingName = listingName.trim();
  const normalizedFeedUrl = feedUrl.trim();
  const normalizedListingId = listingId ?? null;

  const pool = getPostgresPool();
  const duplicate = await pool.query(
    `
      SELECT id
      FROM ical_feeds
      WHERE owner_email = $1
        AND property_id = $2
        AND COALESCE(listing_id, 0) = COALESCE($3, 0)
        AND source = $4
      LIMIT 1
    `,
    [normalizedEmail, propertyId, normalizedListingId, source],
  );

  if (duplicate.rows[0]) {
    const result = await pool.query(
      `
        UPDATE ical_feeds
        SET
          workspace_id = $1,
          property_name = $2,
          listing_name = $3,
          feed_url = $4,
          is_active = TRUE,
          last_sync_status = 'pending',
          last_error = NULL
        WHERE id = $5 AND owner_email = $6
        RETURNING id
      `,
      [
        normalizedEmail,
        normalizedPropertyName,
        normalizedListingName,
        normalizedFeedUrl,
        Number(duplicate.rows[0]?.id ?? 0),
        normalizedEmail,
      ],
    );

    return Number(result.rows[0]?.id ?? 0);
  }

  const result = await pool.query(
    `
      INSERT INTO ical_feeds (
        owner_email,
        workspace_id,
        property_id,
        property_name,
        listing_id,
        listing_name,
        source,
        feed_url,
        is_active,
        last_sync_status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, 'pending')
      RETURNING id
    `,
    [
      normalizedEmail,
      normalizedEmail,
      propertyId,
      normalizedPropertyName,
      normalizedListingId,
      normalizedListingName,
      source,
      normalizedFeedUrl,
    ],
  );

  return Number(result.rows[0]?.id ?? 0);
}

export async function updateIcalFeedSyncState({
  ownerEmail,
  feedId,
  status,
  syncedAt,
  error,
}: {
  ownerEmail: string;
  feedId: number;
  status: IcalFeedSyncStatus;
  syncedAt?: string | null;
  error?: string | null;
}) {
  await ensureDatabase();
  const normalizedEmail = normalizeOwnerEmail(ownerEmail);

  const pool = getPostgresPool();
  await pool.query(
    `
      UPDATE ical_feeds
      SET
        last_sync_status = $1,
        last_synced_at = COALESCE($2, last_synced_at),
        last_error = $3
      WHERE id = $4 AND owner_email = $5
    `,
    [status, syncedAt ?? null, error ?? null, feedId, normalizedEmail],
  );
}

export async function replaceCalendarEventsForFeed({
  ownerEmail,
  feed,
  events,
  syncedAt,
}: {
  ownerEmail: string;
  feed: Pick<IcalFeedRecord, "id" | "propertyId" | "propertyName" | "listingName" | "source">;
  events: Array<{
    externalEventId: string;
    summary: string;
    description: string;
    startDate: string;
    endDate: string;
    eventType: CalendarEventType;
  }>;
  syncedAt: string;
}) {
  await ensureDatabase();
  const normalizedEmail = normalizeOwnerEmail(ownerEmail);
  const normalizedPropertyName = feed.propertyName.trim();
  const normalizedUnitName = feed.listingName.trim();
  const feedId = Number(feed.id ?? 0);

  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      `
        DELETE FROM calendar_events
        WHERE owner_email = $1 AND ical_feed_id = $2
      `,
      [normalizedEmail, feedId],
    );

    for (const event of events) {
      await client.query(
        `
          INSERT INTO calendar_events (
            owner_email,
            import_id,
            ical_feed_id,
            property_id,
            property_name,
            unit_name,
            source,
            external_event_id,
            summary,
            description,
            start_date,
            end_date,
            event_type,
            linked_booking_id,
            last_synced_at
          )
          VALUES ($1, 0, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NULL, $13)
        `,
        [
          normalizedEmail,
          feedId,
          feed.propertyId ?? null,
          normalizedPropertyName,
          normalizedUnitName,
          feed.source,
          event.externalEventId,
          event.summary,
          event.description,
          event.startDate,
          event.endDate,
          event.eventType,
          syncedAt,
        ],
      );
    }

    await client.query("COMMIT");
    return;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function disconnectIcalFeed({
  ownerEmail,
  feedId,
}: {
  ownerEmail: string;
  feedId: number;
}) {
  await ensureDatabase();
  const normalizedEmail = normalizeOwnerEmail(ownerEmail);

  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      `
        UPDATE ical_feeds
        SET is_active = FALSE, last_error = NULL
        WHERE id = $1 AND owner_email = $2
      `,
      [feedId, normalizedEmail],
    );
    await client.query(
      "DELETE FROM calendar_events WHERE owner_email = $1 AND ical_feed_id = $2",
      [normalizedEmail, feedId],
    );
    await client.query("COMMIT");
    return;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getPropertyDefinitions(
  ownerEmail: string,
): Promise<PropertyDefinition[]> {
  await syncPropertyDefinitionsFromRecords(ownerEmail);
  const normalizedEmail = normalizeOwnerEmail(ownerEmail);

  const pool = getPostgresPool();
  const [propertiesResult, unitsResult] = await Promise.all([
    pool.query(
      `
        SELECT id, name, country_code AS countryCode
        FROM properties
        WHERE owner_email = $1
        ORDER BY name ASC
      `,
      [normalizedEmail],
    ),
    pool.query(
      `
        SELECT id, property_id AS propertyId, name
        FROM property_units
        WHERE owner_email = $1
        ORDER BY name ASC
      `,
      [normalizedEmail],
    ),
  ]);

  return propertiesResult.rows.map((propertyRow) => ({
    id: Number(getRowValue(propertyRow as Record<string, unknown>, "id")),
    name: String(getRowValue(propertyRow as Record<string, unknown>, "name")),
    countryCode: normalizeCountryCode(
      String(getRowValue(propertyRow as Record<string, unknown>, "countryCode", "countrycode") ?? "US"),
    ),
    units: unitsResult.rows
      .filter(
        (unitRow) =>
          Number(getRowValue(unitRow as Record<string, unknown>, "propertyId", "propertyid")) ===
          Number(getRowValue(propertyRow as Record<string, unknown>, "id")),
      )
      .map((unitRow) => ({
        id: Number(getRowValue(unitRow as Record<string, unknown>, "id")),
        name: String(getRowValue(unitRow as Record<string, unknown>, "name")),
      })),
  }));
}

export async function createPropertyDefinition({
  ownerEmail,
  name,
  countryCode,
}: {
  ownerEmail: string;
  name: string;
  countryCode: CountryCode;
}): Promise<number> {
  await ensureDatabase();
  const normalizedEmail = normalizeOwnerEmail(ownerEmail);
  const normalizedName = name.trim();
  const normalizedCountryCode = normalizeCountryCode(countryCode);

  if (!normalizedName) {
    throw new Error("Enter a property name.");
  }

  const createdAt = new Date().toISOString();

  const pool = getPostgresPool();
  const duplicate = await pool.query(
    "SELECT id FROM properties WHERE owner_email = $1 AND LOWER(name) = LOWER($2) LIMIT 1",
    [normalizedEmail, normalizedName],
  );

  if (duplicate.rows[0]) {
    throw new Error("That property already exists.");
  }

  const result = await pool.query(
    `
      INSERT INTO properties (owner_email, name, country_code, created_at)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `,
    [normalizedEmail, normalizedName, normalizedCountryCode, createdAt],
  );

  return Number(result.rows[0]?.id ?? 0);
}

export async function createPropertyUnit({
  ownerEmail,
  propertyId,
  name,
}: {
  ownerEmail: string;
  propertyId: number;
  name: string;
}): Promise<number> {
  await ensureDatabase();
  const normalizedEmail = normalizeOwnerEmail(ownerEmail);
  const normalizedName = name.trim();

  if (!normalizedName) {
    throw new Error("Enter a unit name.");
  }

  const createdAt = new Date().toISOString();

  const pool = getPostgresPool();
  const propertyResult = await pool.query(
    "SELECT id FROM properties WHERE id = $1 AND owner_email = $2 LIMIT 1",
    [propertyId, normalizedEmail],
  );

  if (!propertyResult.rows[0]) {
    throw new Error("Property not found.");
  }

  const duplicate = await pool.query(
    "SELECT id FROM property_units WHERE property_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1",
    [propertyId, normalizedName],
  );

  if (duplicate.rows[0]) {
    throw new Error("That unit already exists for this property.");
  }

  const result = await pool.query(
    `
      INSERT INTO property_units (property_id, owner_email, name, created_at)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `,
    [propertyId, normalizedEmail, normalizedName, createdAt],
  );

  return Number(result.rows[0]?.id ?? 0);
}

export async function updatePropertyDefinition({
  ownerEmail,
  propertyId,
  name,
  countryCode,
}: {
  ownerEmail: string;
  propertyId: number;
  name: string;
  countryCode: CountryCode;
}) {
  await ensureDatabase();
  const normalizedEmail = normalizeOwnerEmail(ownerEmail);
  const normalizedName = name.trim();
  const normalizedCountryCode = normalizeCountryCode(countryCode);

  if (!normalizedName) {
    throw new Error("Enter a property name.");
  }

  const pool = getPostgresPool();
  const propertyResult = await pool.query(
    "SELECT id, name FROM properties WHERE id = $1 AND owner_email = $2 LIMIT 1",
    [propertyId, normalizedEmail],
  );
  const propertyRow = propertyResult.rows[0] as Record<string, unknown> | undefined;

  if (!propertyRow) {
    throw new Error("Property not found.");
  }

  const currentName = String(getRowValue(propertyRow, "name"));
  const duplicate = await pool.query(
    "SELECT id FROM properties WHERE owner_email = $1 AND LOWER(name) = LOWER($2) AND id <> $3 LIMIT 1",
    [normalizedEmail, normalizedName, propertyId],
  );

  if (duplicate.rows[0]) {
    throw new Error("That property already exists.");
  }

  // Every table that stores the property by name has to follow the rename.
  // Missing one (imports used to be missed) leaves rows under the old name, and
  // syncPropertyDefinitionsFromRecords then recreates the old property from them.
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      "UPDATE properties SET name = $1, country_code = $2 WHERE id = $3 AND owner_email = $4",
      [normalizedName, normalizedCountryCode, propertyId, normalizedEmail],
    );

    for (const table of propertyNamedTables) {
      await client.query(
        `UPDATE ${table} SET property_name = $1 WHERE owner_email = $2 AND LOWER(TRIM(property_name)) = LOWER(TRIM($3))`,
        [normalizedName, normalizedEmail, currentName],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deletePropertyDefinition({
  ownerEmail,
  propertyId,
  deleteLinkedData = false,
}: {
  ownerEmail: string;
  propertyId: number;
  deleteLinkedData?: boolean;
}) {
  await ensureDatabase();
  const normalizedEmail = normalizeOwnerEmail(ownerEmail);

  const pool = getPostgresPool();
  const [propertyResult, propertiesCountResult] = await Promise.all([
    pool.query("SELECT id, name FROM properties WHERE id = $1 AND owner_email = $2 LIMIT 1", [
      propertyId,
      normalizedEmail,
    ]),
    pool.query("SELECT COUNT(*) AS count FROM properties WHERE owner_email = $1", [normalizedEmail]),
  ]);
  const propertyRow = propertyResult.rows[0] as Record<string, unknown> | undefined;

  if (!propertyRow) {
    throw new Error("Property not found.");
  }

  const propertyName = String(getRowValue(propertyRow, "name"));
  const [bookingUsage, expenseUsage, importUsage, closureUsage, eventUsage, feedUsage] = await Promise.all([
    pool.query(
      "SELECT COUNT(*) AS count FROM bookings WHERE owner_email = $1 AND LOWER(TRIM(property_name)) = LOWER(TRIM($2))",
      [normalizedEmail, propertyName],
    ),
    pool.query(
      "SELECT COUNT(*) AS count FROM expenses WHERE owner_email = $1 AND LOWER(TRIM(property_name)) = LOWER(TRIM($2))",
      [normalizedEmail, propertyName],
    ),
    pool.query(
      "SELECT COUNT(*) AS count FROM imports WHERE owner_email = $1 AND LOWER(TRIM(property_name)) = LOWER(TRIM($2))",
      [normalizedEmail, propertyName],
    ),
    pool.query(
      "SELECT COUNT(*) AS count FROM calendar_closures WHERE owner_email = $1 AND LOWER(TRIM(property_name)) = LOWER(TRIM($2))",
      [normalizedEmail, propertyName],
    ),
    pool.query(
      "SELECT COUNT(*) AS count FROM calendar_events WHERE owner_email = $1 AND LOWER(TRIM(property_name)) = LOWER(TRIM($2))",
      [normalizedEmail, propertyName],
    ),
    pool.query(
      "SELECT COUNT(*) AS count FROM ical_feeds WHERE owner_email = $1 AND LOWER(TRIM(property_name)) = LOWER(TRIM($2)) AND is_active = TRUE",
      [normalizedEmail, propertyName],
    ),
  ]);

  const bookingCount = Number(
    getRowValue(bookingUsage.rows[0] as Record<string, unknown>, "count"),
  );
  const expenseCount = Number(
    getRowValue(expenseUsage.rows[0] as Record<string, unknown>, "count"),
  );
  const importCount = Number(
    getRowValue(importUsage.rows[0] as Record<string, unknown>, "count"),
  );
  const closureCount = Number(
    getRowValue(closureUsage.rows[0] as Record<string, unknown>, "count"),
  );
  const propertiesCount = Number(
    getRowValue(propertiesCountResult.rows[0] as Record<string, unknown>, "count"),
  );
  const eventCount = Number(
    getRowValue(eventUsage.rows[0] as Record<string, unknown>, "count"),
  );
  const feedCount = Number(
    getRowValue(feedUsage.rows[0] as Record<string, unknown>, "count"),
  );

  if ((bookingCount > 0 || expenseCount > 0 || importCount > 0 || closureCount > 0 || eventCount > 0 || feedCount > 0) && !deleteLinkedData) {
    throw new Error("This property still has linked imports, bookings, closed days, calendar feeds, or expenses. Confirm destructive delete to remove everything tied to it.");
  }

  // BEGIN/COMMIT must run on one connection: on the pool each query can land
  // on a different client, which made this "transaction" a no-op.
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    if (deleteLinkedData) {
      for (const table of propertyNamedTables) {
        await client.query(
          `DELETE FROM ${table} WHERE owner_email = $1 AND LOWER(TRIM(property_name)) = LOWER(TRIM($2))`,
          [normalizedEmail, propertyName],
        );
      }
    }

    await client.query("DELETE FROM property_units WHERE property_id = $1 AND owner_email = $2", [
      propertyId,
      normalizedEmail,
    ]);
    await client.query("DELETE FROM properties WHERE id = $1 AND owner_email = $2", [
      propertyId,
      normalizedEmail,
    ]);

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return {
    deletedPropertyName: propertyName,
    deletedBookingsCount: deleteLinkedData ? bookingCount : 0,
    deletedExpensesCount: deleteLinkedData ? expenseCount : 0,
    deletedImportsCount: deleteLinkedData ? importCount : 0,
    deletedLinkedData: deleteLinkedData,
    removedLastProperty: propertiesCount <= 1,
  };
}

export async function insertManualBooking({
  ownerEmail,
  booking,
}: {
  ownerEmail: string;
  booking: BookingRecord;
}) {
  await ensureDatabase();
  const normalizedEmail = normalizeOwnerEmail(ownerEmail);

  const pool = getPostgresPool();
  const result = await pool.query(
    `
      INSERT INTO bookings (
        owner_email, import_id, source, property_name, unit_name, check_in, checkout, guest_name, guest_count,
        channel, rental_period, price_per_night, extra_fee, discount, rental_revenue,
        cleaning_fee, tax_amount, total_revenue, host_fee, payout, nights, booking_number, overbooking_status
      )
      VALUES ($1, 0, 'manual', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      RETURNING id
    `,
    [
      normalizedEmail,
      booking.propertyName,
      booking.unitName,
      booking.checkIn,
      booking.checkout,
      booking.guestName,
      booking.guestCount,
      booking.channel,
      booking.rentalPeriod,
      booking.pricePerNight,
      booking.extraFee,
      booking.discount,
      booking.rentalRevenue,
      booking.cleaningFee,
      booking.taxAmount,
      booking.totalRevenue,
      booking.hostFee,
      booking.payout,
      booking.nights,
      booking.bookingNumber,
      booking.overbookingStatus,
    ],
  );

  return Number(result.rows[0]?.id ?? 0);
}

export async function insertManualExpense({
  ownerEmail,
  expense,
}: {
  ownerEmail: string;
  expense: ExpenseRecord;
}) {
  await ensureDatabase();
  const normalizedEmail = normalizeOwnerEmail(ownerEmail);

  const pool = getPostgresPool();
  const result = await pool.query(
    `
      INSERT INTO expenses (
        owner_email, import_id, source, property_name, unit_name, date, category, amount, description, note
      )
      VALUES ($1, 0, 'manual', $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `,
    [
      normalizedEmail,
      expense.propertyName,
      expense.unitName,
      expense.date,
      expense.category,
      expense.amount,
      expense.description,
      expense.note,
    ],
  );

  return Number(result.rows[0]?.id ?? 0);
}

export async function updateBookingRecord({
  ownerEmail,
  bookingId,
  booking,
}: {
  ownerEmail: string;
  bookingId: number;
  booking: BookingRecord;
}) {
  await ensureDatabase();
  const normalizedEmail = normalizeOwnerEmail(ownerEmail);

  const pool = getPostgresPool();
  const result = await pool.query(
    `
      UPDATE bookings
      SET
        property_name = $3,
        unit_name = $4,
        check_in = $5,
        checkout = $6,
        guest_name = $7,
        guest_count = $8,
        channel = $9,
        rental_period = $10,
        price_per_night = $11,
        extra_fee = $12,
        discount = $13,
        rental_revenue = $14,
        cleaning_fee = $15,
        tax_amount = $16,
        total_revenue = $17,
        host_fee = $18,
        payout = $19,
        nights = $20,
        booking_number = $21,
        overbooking_status = $22,
        review_status = 'ready',
        review_reason = ''
      WHERE id = $1 AND owner_email = $2
    `,
    [
      bookingId,
      normalizedEmail,
      booking.propertyName,
      booking.unitName,
      booking.checkIn,
      booking.checkout,
      booking.guestName,
      booking.guestCount,
      booking.channel,
      booking.rentalPeriod,
      booking.pricePerNight,
      booking.extraFee,
      booking.discount,
      booking.rentalRevenue,
      booking.cleaningFee,
      booking.taxAmount,
      booking.totalRevenue,
      booking.hostFee,
      booking.payout,
      booking.nights,
      booking.bookingNumber,
      booking.overbookingStatus,
    ],
  );

  return (result.rowCount ?? 0) > 0;
}

export async function updateBookingReviewState({
  ownerEmail,
  bookingId,
  reviewStatus,
  reviewReason,
}: {
  ownerEmail: string;
  bookingId: number;
  reviewStatus: BookingReviewStatus;
  reviewReason?: string;
}) {
  await ensureDatabase();
  const normalizedEmail = normalizeOwnerEmail(ownerEmail);
  const normalizedReason = reviewStatus === "needs_review" ? (reviewReason ?? "").trim() : "";

  const pool = getPostgresPool();
  const result = await pool.query(
    `
      UPDATE bookings
      SET review_status = $3, review_reason = $4
      WHERE id = $1 AND owner_email = $2
    `,
    [bookingId, normalizedEmail, reviewStatus, normalizedReason],
  );

  return (result.rowCount ?? 0) > 0;
}

export async function deleteBookingRecord({
  ownerEmail,
  bookingId,
}: {
  ownerEmail: string;
  bookingId: number;
}) {
  await ensureDatabase();
  const normalizedEmail = normalizeOwnerEmail(ownerEmail);

  const pool = getPostgresPool();
  const result = await pool.query(
    "DELETE FROM bookings WHERE id = $1 AND owner_email = $2",
    [bookingId, normalizedEmail],
  );

  return (result.rowCount ?? 0) > 0;
}

export async function updateExpenseRecord({
  ownerEmail,
  expenseId,
  expense,
}: {
  ownerEmail: string;
  expenseId: number;
  expense: ExpenseRecord;
}) {
  await ensureDatabase();
  const normalizedEmail = normalizeOwnerEmail(ownerEmail);

  const pool = getPostgresPool();
  const result = await pool.query(
    `
      UPDATE expenses
      SET
        property_name = $3,
        unit_name = $4,
        date = $5,
        category = $6,
        amount = $7,
        description = $8,
        note = $9
      WHERE id = $1 AND owner_email = $2
    `,
    [
      expenseId,
      normalizedEmail,
      expense.propertyName,
      expense.unitName,
      expense.date,
      expense.category,
      expense.amount,
      expense.description,
      expense.note,
    ],
  );

  return (result.rowCount ?? 0) > 0;
}

export async function deleteExpenseRecord({
  ownerEmail,
  expenseId,
}: {
  ownerEmail: string;
  expenseId: number;
}) {
  await ensureDatabase();
  const normalizedEmail = normalizeOwnerEmail(ownerEmail);

  const pool = getPostgresPool();
  const result = await pool.query(
    "DELETE FROM expenses WHERE id = $1 AND owner_email = $2",
    [expenseId, normalizedEmail],
  );

  return (result.rowCount ?? 0) > 0;
}

export async function getUserSettings(
  ownerEmail: string,
  fallbackBusinessName: string,
): Promise<UserSettings> {
  await ensureDatabase();
  const normalizedEmail = normalizeOwnerEmail(ownerEmail);
  const defaults = getDefaultUserSettings(fallbackBusinessName);

  const pool = getPostgresPool();
  const result = await pool.query(
    `
      SELECT
        business_name AS businessName,
        primary_country_code AS primaryCountryCode,
        currency_code AS currencyCode,
        tax_country_code AS taxCountryCode,
        tax_rate AS taxRate
      FROM user_settings
      WHERE owner_email = $1
    `,
    [normalizedEmail],
  );

  if (!result.rows[0]) {
    return defaults;
  }

  const primaryCountryCode = normalizeCountryCode(
    String(
      result.rows[0].primarycountrycode ??
        result.rows[0].primaryCountryCode ??
        getCountryForCurrency(
          String(result.rows[0].currencycode ?? result.rows[0].currencyCode ?? defaults.currencyCode),
        ),
    ),
  );
  const taxCountryCode = normalizeCountryCode(
    String(
      result.rows[0].taxcountrycode ??
        result.rows[0].taxCountryCode ??
        primaryCountryCode,
    ),
  );

  return {
    businessName: String(result.rows[0].businessname ?? result.rows[0].businessName ?? defaults.businessName),
    primaryCountryCode,
    currencyCode: getCurrencyForCountry(primaryCountryCode),
    taxCountryCode,
    taxRate: normalizeTaxRate(
      result.rows[0].taxrate ?? result.rows[0].taxRate ?? getDefaultTaxRateByCountry(taxCountryCode),
    ),
  };
}

export async function upsertUserSettings({
  ownerEmail,
  businessName,
  primaryCountryCode,
  taxCountryCode,
  taxRate,
}: {
  ownerEmail: string;
  businessName: string;
  primaryCountryCode: CountryCode;
  taxCountryCode?: CountryCode;
  taxRate?: number;
}) {
  await ensureDatabase();
  const normalizedEmail = normalizeOwnerEmail(ownerEmail);
  const normalizedBusinessName = businessName.trim() || "My rental business";
  const normalizedPrimaryCountryCode = normalizeCountryCode(primaryCountryCode);
  const normalizedCurrencyCode = getCurrencyForCountry(normalizedPrimaryCountryCode);
  const existingSettings = await getUserSettings(normalizedEmail, normalizedBusinessName);
  const normalizedTaxCountryCode = normalizeCountryCode(
    taxCountryCode ?? existingSettings.taxCountryCode ?? normalizedPrimaryCountryCode,
  );
  const normalizedTaxRate = normalizeTaxRate(
    taxRate ?? existingSettings.taxRate ?? getDefaultTaxRateByCountry(normalizedTaxCountryCode),
  );
  const updatedAt = new Date().toISOString();

  const pool = getPostgresPool();
  await pool.query(
    `
      INSERT INTO user_settings (
        owner_email,
        business_name,
        primary_country_code,
        currency_code,
        tax_country_code,
        tax_rate,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (owner_email)
      DO UPDATE SET
        business_name = EXCLUDED.business_name,
        primary_country_code = EXCLUDED.primary_country_code,
        currency_code = EXCLUDED.currency_code,
        tax_country_code = EXCLUDED.tax_country_code,
        tax_rate = EXCLUDED.tax_rate,
        updated_at = EXCLUDED.updated_at
    `,
    [
      normalizedEmail,
      normalizedBusinessName,
      normalizedPrimaryCountryCode,
      normalizedCurrencyCode,
      normalizedTaxCountryCode,
      normalizedTaxRate,
      updatedAt,
    ],
  );

}

export async function getAuthUserByEmail(email: string) {
  await ensureDatabase();
  const normalizedEmail = normalizeOwnerEmail(email);

  const pool = getPostgresPool();
  const result = await pool.query(
    `
      SELECT
        owner_email AS ownerEmail,
        full_name AS fullName,
        password_hash AS passwordHash,
        is_verified AS isVerified,
        verification_code_hash AS verificationCodeHash,
        verification_expires_at AS verificationExpiresAt,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM auth_users
      WHERE owner_email = $1
    `,
    [normalizedEmail],
  );

  if (result.rows.length === 0) {
    return null;
  }

  return {
    ownerEmail: String(result.rows[0].owneremail ?? result.rows[0].ownerEmail),
    fullName: String(result.rows[0].fullname ?? result.rows[0].fullName),
    passwordHash: String(result.rows[0].passwordhash ?? result.rows[0].passwordHash),
    isVerified: Boolean(result.rows[0].isverified ?? result.rows[0].isVerified),
    verificationCodeHash:
      result.rows[0].verificationcodehash ?? result.rows[0].verificationCodeHash
        ? String(result.rows[0].verificationcodehash ?? result.rows[0].verificationCodeHash)
        : null,
    verificationExpiresAt: normalizeTimestampValue(
      result.rows[0].verificationexpiresat ?? result.rows[0].verificationExpiresAt,
      "",
    ) || null,
    createdAt: normalizeTimestampValue(
      result.rows[0].createdat ?? result.rows[0].createdAt,
      new Date().toISOString(),
    ),
    updatedAt: normalizeTimestampValue(
      result.rows[0].updatedat ?? result.rows[0].updatedAt,
      new Date().toISOString(),
    ),
  };
}

export async function createAuthUser({
  email,
  fullName,
  passwordHash,
  isVerified = true,
  verificationCodeHash = null,
  verificationExpiresAt = null,
}: {
  email: string;
  fullName: string;
  passwordHash: string;
  isVerified?: boolean;
  verificationCodeHash?: string | null;
  verificationExpiresAt?: string | null;
}) {
  await ensureDatabase();
  const normalizedEmail = normalizeOwnerEmail(email);
  const normalizedFullName = fullName.trim() || normalizedEmail;
  const existingUser = await getAuthUserByEmail(normalizedEmail);

  if (existingUser) {
    throw new Error("An account with that email already exists.");
  }

  const createdAt = new Date().toISOString();

  const pool = getPostgresPool();
  await pool.query(
    `
      INSERT INTO auth_users (
        owner_email,
        full_name,
        password_hash,
        is_verified,
        verification_code_hash,
        verification_expires_at,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `,
    [
      normalizedEmail,
      normalizedFullName,
      passwordHash,
      isVerified,
      verificationCodeHash,
      verificationExpiresAt,
      createdAt,
      createdAt,
    ],
  );

}

export async function upsertPendingAuthUser({
  email,
  fullName,
  passwordHash,
  verificationCodeHash,
  verificationExpiresAt,
}: {
  email: string;
  fullName: string;
  passwordHash: string;
  verificationCodeHash: string;
  verificationExpiresAt: string;
}) {
  await ensureDatabase();
  const normalizedEmail = normalizeOwnerEmail(email);
  const normalizedFullName = fullName.trim() || normalizedEmail;
  const updatedAt = new Date().toISOString();

  const pool = getPostgresPool();
  await pool.query(
    `
      INSERT INTO auth_users (
        owner_email,
        full_name,
        password_hash,
        is_verified,
        verification_code_hash,
        verification_expires_at,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, FALSE, $4, $5, $6, $6)
      ON CONFLICT (owner_email) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        password_hash = EXCLUDED.password_hash,
        is_verified = FALSE,
        verification_code_hash = EXCLUDED.verification_code_hash,
        verification_expires_at = EXCLUDED.verification_expires_at,
        updated_at = EXCLUDED.updated_at
    `,
    [
      normalizedEmail,
      normalizedFullName,
      passwordHash,
      verificationCodeHash,
      verificationExpiresAt,
      updatedAt,
    ],
  );

}

export async function markAuthUserVerified({
  email,
}: {
  email: string;
}) {
  await ensureDatabase();
  const normalizedEmail = normalizeOwnerEmail(email);
  const updatedAt = new Date().toISOString();

  const pool = getPostgresPool();
  await pool.query(
    `
      UPDATE auth_users
      SET
        is_verified = TRUE,
        verification_code_hash = NULL,
        verification_expires_at = NULL,
        updated_at = $2
      WHERE owner_email = $1
    `,
    [normalizedEmail, updatedAt],
  );
}

function createDefaultStoredSubscription(ownerEmail: string): StoredSubscription {
  const trialStartedAt = new Date().toISOString();
  return {
    ownerEmail,
    plan: "trial",
    status: "trialing",
    trialStartedAt,
    trialEndsAt: getTrialEndDate(trialStartedAt),
    activatedAt: null,
    updatedAt: trialStartedAt,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    stripePriceId: null,
  };
}

function normalizeStoredSubscription(
  ownerEmail: string,
  row: Record<string, unknown> | StoredSubscription,
): StoredSubscription {
  const trialStartedAtFallback = new Date().toISOString();
  const trialEndsAtFallback = getTrialEndDate(trialStartedAtFallback);
  const updatedAtFallback = trialStartedAtFallback;
  const activatedAtValue = getRowValue(
    row as Record<string, unknown>,
    "activatedAt",
    "activated_at",
    "activatedat",
  );

  return {
    ownerEmail,
    plan: normalizeSubscriptionPlan(
      String(getRowValue(row as Record<string, unknown>, "plan") ?? "trial"),
    ),
    status: normalizeSubscriptionStatus(
      String(getRowValue(row as Record<string, unknown>, "status") ?? "trialing"),
    ),
    trialStartedAt: normalizeTimestampValue(
      getRowValue(row as Record<string, unknown>, "trialStartedAt", "trial_started_at", "trialstartedat"),
      trialStartedAtFallback,
    ),
    trialEndsAt: normalizeTimestampValue(
      getRowValue(row as Record<string, unknown>, "trialEndsAt", "trial_ends_at", "trialendsat"),
      trialEndsAtFallback,
    ),
    activatedAt:
      activatedAtValue == null
        ? null
        : normalizeTimestampValue(activatedAtValue, trialStartedAtFallback),
    updatedAt: normalizeTimestampValue(
      getRowValue(row as Record<string, unknown>, "updatedAt", "updated_at", "updatedat"),
      updatedAtFallback,
    ),
    stripeCustomerId: (() => {
      const value = getRowValue(
        row as Record<string, unknown>,
        "stripeCustomerId",
        "stripe_customer_id",
        "stripecustomerid",
      );
      return typeof value === "string" && value.trim() ? value : null;
    })(),
    stripeSubscriptionId: (() => {
      const value = getRowValue(
        row as Record<string, unknown>,
        "stripeSubscriptionId",
        "stripe_subscription_id",
        "stripesubscriptionid",
      );
      return typeof value === "string" && value.trim() ? value : null;
    })(),
    stripePriceId: (() => {
      const value = getRowValue(
        row as Record<string, unknown>,
        "stripePriceId",
        "stripe_price_id",
        "stripepriceid",
      );
      return typeof value === "string" && value.trim() ? value : null;
    })(),
  };
}

async function expireTrialSubscriptionIfNeeded(
  ownerEmail: string,
  subscription: StoredSubscription,
) {
  if (
    subscription.status !== "trialing" ||
    new Date(subscription.trialEndsAt).getTime() > Date.now()
  ) {
    return subscription;
  }

  const expiredSubscription: StoredSubscription = {
    ...subscription,
    status: "expired",
    updatedAt: new Date().toISOString(),
  };

  const pool = getPostgresPool();
  await pool.query(
    `
      UPDATE subscriptions
      SET status = $2, updated_at = $3
      WHERE owner_email = $1
    `,
    [ownerEmail, expiredSubscription.status, expiredSubscription.updatedAt],
  );
  return expiredSubscription;
}

async function ensureAdminProSubscription(subscription: StoredSubscription) {
  if (
    !isAdminOwnerEmail(subscription.ownerEmail) ||
    (subscription.status === "active" &&
      (subscription.plan === "pro" || subscription.plan === "portfolio"))
  ) {
    return subscription;
  }

  const updatedAt = new Date().toISOString();
  const nextSubscription: StoredSubscription = {
    ...subscription,
    plan: "pro",
    status: "active",
    activatedAt: subscription.activatedAt ?? updatedAt,
    updatedAt,
  };

  await upsertStoredSubscription(nextSubscription);
  return nextSubscription;
}

export async function getSubscriptionState(ownerEmail: string): Promise<SubscriptionState> {
  await ensureDatabase();
  const normalizedEmail = normalizeOwnerEmail(ownerEmail);

  const pool = getPostgresPool();
  const result = await pool.query(
    `
      SELECT
        owner_email AS ownerEmail,
        plan,
        status,
        trial_started_at AS trialStartedAt,
        trial_ends_at AS trialEndsAt,
        activated_at AS activatedAt,
        updated_at AS updatedAt,
        stripe_customer_id AS stripeCustomerId,
        stripe_subscription_id AS stripeSubscriptionId,
        stripe_price_id AS stripePriceId
      FROM subscriptions
      WHERE owner_email = $1
    `,
    [normalizedEmail],
  );

  const storedSubscription = result.rows[0]
    ? normalizeStoredSubscription(normalizedEmail, result.rows[0] as Record<string, unknown>)
    : null;

  if (!storedSubscription) {
    const nextSubscription = createDefaultStoredSubscription(normalizedEmail);
    await pool.query(
      `
        INSERT INTO subscriptions (
          owner_email,
          plan,
          status,
          trial_started_at,
          trial_ends_at,
          activated_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        nextSubscription.ownerEmail,
        nextSubscription.plan,
        nextSubscription.status,
        nextSubscription.trialStartedAt,
        nextSubscription.trialEndsAt,
        nextSubscription.activatedAt,
        nextSubscription.updatedAt,
      ],
    );

    return cloneSubscription(await ensureAdminProSubscription(nextSubscription));
  }

  return cloneSubscription(
    await ensureAdminProSubscription(
      await expireTrialSubscriptionIfNeeded(normalizedEmail, storedSubscription),
    ),
  );
}

export async function updateSubscriptionPlan({
  ownerEmail,
  plan,
  stripeCustomerId,
  stripeSubscriptionId,
  stripePriceId,
}: {
  ownerEmail: string;
  plan: SubscriptionPlan;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripePriceId?: string | null;
}) {
  await ensureDatabase();
  const normalizedEmail = normalizeOwnerEmail(ownerEmail);
  const currentSubscription = await getSubscriptionState(normalizedEmail);
  const updatedAt = new Date().toISOString();
  const nextSubscription: StoredSubscription = {
    ownerEmail: normalizedEmail,
    plan,
    status: "active",
    trialStartedAt: currentSubscription.trialStartedAt,
    trialEndsAt: currentSubscription.trialEndsAt,
    activatedAt: updatedAt,
    updatedAt,
    stripeCustomerId: stripeCustomerId ?? currentSubscription.stripeCustomerId,
    stripeSubscriptionId: stripeSubscriptionId ?? currentSubscription.stripeSubscriptionId,
    stripePriceId: stripePriceId ?? currentSubscription.stripePriceId,
  };

  await upsertStoredSubscription(nextSubscription);
}

export async function revokeSubscriptionAccess(ownerEmail: string) {
  await ensureDatabase();
  const normalizedEmail = normalizeOwnerEmail(ownerEmail);
  const currentSubscription = await getSubscriptionState(normalizedEmail);
  const updatedAt = new Date().toISOString();

  await upsertStoredSubscription({
    ownerEmail: normalizedEmail,
    plan: "trial",
    status: "expired",
    trialStartedAt: currentSubscription.trialStartedAt,
    trialEndsAt: currentSubscription.trialEndsAt,
    activatedAt: currentSubscription.activatedAt,
    updatedAt,
    stripeCustomerId: currentSubscription.stripeCustomerId,
    stripeSubscriptionId: currentSubscription.stripeSubscriptionId,
    stripePriceId: currentSubscription.stripePriceId,
  });
}

export async function updateSubscriptionStripeReferences({
  ownerEmail,
  stripeCustomerId,
  stripeSubscriptionId,
  stripePriceId,
}: {
  ownerEmail: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripePriceId?: string | null;
}) {
  await ensureDatabase();
  const normalizedEmail = normalizeOwnerEmail(ownerEmail);
  const currentSubscription = await getSubscriptionState(normalizedEmail);

  await upsertStoredSubscription({
    ownerEmail: normalizedEmail,
    plan: currentSubscription.plan,
    status: currentSubscription.status,
    trialStartedAt: currentSubscription.trialStartedAt,
    trialEndsAt: currentSubscription.trialEndsAt,
    activatedAt: currentSubscription.activatedAt,
    updatedAt: new Date().toISOString(),
    stripeCustomerId: stripeCustomerId ?? currentSubscription.stripeCustomerId,
    stripeSubscriptionId: stripeSubscriptionId ?? currentSubscription.stripeSubscriptionId,
    stripePriceId: stripePriceId ?? currentSubscription.stripePriceId,
  });
}

export async function syncSubscriptionFromStripe({
  ownerEmail,
  plan,
  status,
  stripeCustomerId,
  stripeSubscriptionId,
  stripePriceId,
}: {
  ownerEmail: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripePriceId?: string | null;
}) {
  await ensureDatabase();
  const normalizedEmail = normalizeOwnerEmail(ownerEmail);
  const currentSubscription = await getSubscriptionState(normalizedEmail);
  const updatedAt = new Date().toISOString();

  await upsertStoredSubscription({
    ownerEmail: normalizedEmail,
    plan,
    status,
    trialStartedAt: currentSubscription.trialStartedAt,
    trialEndsAt: currentSubscription.trialEndsAt,
    activatedAt:
      status === "active" ? currentSubscription.activatedAt ?? updatedAt : currentSubscription.activatedAt,
    updatedAt,
    stripeCustomerId: stripeCustomerId ?? currentSubscription.stripeCustomerId,
    stripeSubscriptionId: stripeSubscriptionId ?? currentSubscription.stripeSubscriptionId,
    stripePriceId: stripePriceId ?? currentSubscription.stripePriceId,
  });
}

export async function findOwnerEmailByStripeCustomerId(stripeCustomerId: string) {
  await ensureDatabase();
  const normalizedCustomerId = stripeCustomerId.trim();

  if (!normalizedCustomerId) {
    return null;
  }

  const pool = getPostgresPool();
  const result = await pool.query(
    "SELECT owner_email AS ownerEmail FROM subscriptions WHERE stripe_customer_id = $1 LIMIT 1",
    [normalizedCustomerId],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  const value = row ? getRowValue(row, "ownerEmail") : null;
  return typeof value === "string" && value ? value : null;
}

async function getUserRecordCounts(ownerEmail: string) {
  const normalizedEmail = normalizeOwnerEmail(ownerEmail);

  const pool = getPostgresPool();
  const [properties, imports, bookings, expenses] = await Promise.all([
    pool.query("SELECT COUNT(*) AS count FROM properties WHERE owner_email = $1", [normalizedEmail]),
    pool.query("SELECT COUNT(*) AS count FROM imports WHERE owner_email = $1", [normalizedEmail]),
    pool.query("SELECT COUNT(*) AS count FROM bookings WHERE owner_email = $1", [normalizedEmail]),
    pool.query("SELECT COUNT(*) AS count FROM expenses WHERE owner_email = $1", [normalizedEmail]),
  ]);

  return {
    propertiesCount: Number(getRowValue(properties.rows[0] as Record<string, unknown>, "count") ?? 0),
    importsCount: Number(getRowValue(imports.rows[0] as Record<string, unknown>, "count") ?? 0),
    bookingsCount: Number(getRowValue(bookings.rows[0] as Record<string, unknown>, "count") ?? 0),
    expensesCount: Number(getRowValue(expenses.rows[0] as Record<string, unknown>, "count") ?? 0),
  };
}

export async function listAdminUsers(): Promise<AdminUserSummary[]> {
  await ensureDatabase();
  const ownerEmails = new Set<string>();

  const pool = getPostgresPool();
  const result = await pool.query(
    `
      SELECT owner_email AS ownerEmail FROM user_settings
      UNION
      SELECT owner_email AS ownerEmail FROM subscriptions
      UNION
      SELECT owner_email AS ownerEmail FROM auth_users
      UNION
      SELECT owner_email AS ownerEmail FROM properties
      UNION
      SELECT owner_email AS ownerEmail FROM imports
      UNION
      SELECT owner_email AS ownerEmail FROM bookings
      UNION
      SELECT owner_email AS ownerEmail FROM expenses
    `,
  );

  for (const row of result.rows) {
    const email = String(getRowValue(row as Record<string, unknown>, "ownerEmail", "owneremail") ?? "").trim();
    if (email) {
      ownerEmails.add(email.toLowerCase());
    }
  }

  const users = await Promise.all(
    Array.from(ownerEmails)
      .sort((left, right) => left.localeCompare(right))
      .map(async (ownerEmail) => {
        const businessName = (await getUserSettings(ownerEmail, ownerEmail.split("@")[0] ?? "Workspace")).businessName;
        const subscription = await getSubscriptionState(ownerEmail);
        const counts = await getUserRecordCounts(ownerEmail);

        return {
          ownerEmail,
          businessName,
          subscription,
          isAdmin: isAdminOwnerEmail(ownerEmail),
          ...counts,
        } satisfies AdminUserSummary;
      }),
  );

  return users.sort((left, right) => {
    if (left.isAdmin && !right.isAdmin) {
      return -1;
    }
    if (!left.isAdmin && right.isAdmin) {
      return 1;
    }
    return left.businessName.localeCompare(right.businessName);
  });
}

export async function deleteManagedUser(ownerEmail: string) {
  await ensureDatabase();
  const normalizedEmail = normalizeOwnerEmail(ownerEmail);

  if (isAdminOwnerEmail(normalizedEmail)) {
    throw new Error("The primary admin account cannot be deleted.");
  }

  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM bookings WHERE owner_email = $1", [normalizedEmail]);
    await client.query("DELETE FROM expenses WHERE owner_email = $1", [normalizedEmail]);
    await client.query("DELETE FROM calendar_closures WHERE owner_email = $1", [normalizedEmail]);
    await client.query("DELETE FROM calendar_events WHERE owner_email = $1", [normalizedEmail]);
    await client.query("DELETE FROM ical_feeds WHERE owner_email = $1", [normalizedEmail]);
    await client.query("DELETE FROM financial_documents WHERE owner_email = $1", [normalizedEmail]);
    await client.query("DELETE FROM imports WHERE owner_email = $1", [normalizedEmail]);
    await client.query("DELETE FROM property_units WHERE owner_email = $1", [normalizedEmail]);
    await client.query("DELETE FROM properties WHERE owner_email = $1", [normalizedEmail]);
    await client.query("DELETE FROM user_settings WHERE owner_email = $1", [normalizedEmail]);
    await client.query("DELETE FROM subscriptions WHERE owner_email = $1", [normalizedEmail]);
    await client.query("DELETE FROM auth_users WHERE owner_email = $1", [normalizedEmail]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

}

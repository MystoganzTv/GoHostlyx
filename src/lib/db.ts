import { createRequire } from "node:module";
import { Pool } from "pg";
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
  PropertyUnit,
  SubscriptionPlan,
  SubscriptionState,
  SubscriptionStatus,
  UserSettings,
} from "./types";
import type {
  MemoryStore,
  StoredAuthUser,
  StoredBooking,
  StoredCalendarClosure,
  StoredCalendarEvent,
  StoredExpense,
  StoredFinancialDocument,
  StoredIcalFeed,
  StoredImport,
  StoredProperty,
  StoredPropertyUnit,
  StoredSubscription,
  StoredUserSettings,
} from "./db-types";
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
import { getSQLiteDatabasePath, initializeSQLiteSchema } from "./db-schema";
import { runPostgresSchema } from "./db-schema-pg";
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

type SQLiteDatabase = import("better-sqlite3").Database;
type SQLiteModule = typeof import("better-sqlite3");

const require = createRequire(import.meta.url);

let sqliteDatabase: SQLiteDatabase | null = null;
let sqliteModule: SQLiteModule | null = null;
let postgresPool: Pool | null = null;
let postgresInitialization: Promise<void> | null = null;

declare global {
  var __gohostlyxMemoryStore: MemoryStore | undefined;
}

function isPostgresConfigured() {
  return Boolean(getDatabaseConnectionString());
}

function getDatabaseConnectionString() {
  return process.env.DATABASE_URL ?? "";
}

function shouldUseSQLiteFallback() {
  return !isPostgresConfigured() && process.env.NODE_ENV !== "production";
}

function shouldUseMemoryFallback() {
  return !isPostgresConfigured() && !shouldUseSQLiteFallback();
}

function normalizeOwnerEmail(ownerEmail: string) {
  return ownerEmail.trim().toLowerCase();
}

function getDefaultUserSettings(fallbackBusinessName: string): UserSettings {
  const primaryCountryCode = "US";
  return {
    businessName: fallbackBusinessName.trim() || "My rental business",
    primaryCountryCode,
    currencyCode: getCurrencyForCountry(primaryCountryCode),
    taxCountryCode: primaryCountryCode,
    taxRate: getDefaultTaxRateByCountry(primaryCountryCode),
  };
}

function getSQLiteModule() {
  if (!sqliteModule) {
    sqliteModule = require("better-sqlite3") as SQLiteModule;
  }

  return sqliteModule;
}

function getMemoryStore() {
  if (!globalThis.__gohostlyxMemoryStore) {
    globalThis.__gohostlyxMemoryStore = {
      nextImportId: 1,
      nextBookingId: 1,
      nextExpenseId: 1,
      nextClosureId: 1,
      nextCalendarEventId: 1,
      nextIcalFeedId: 1,
      nextFinancialDocumentId: 1,
      nextPropertyId: 1,
      nextPropertyUnitId: 1,
      imports: [],
      bookings: [],
      expenses: [],
      closures: [],
      calendarEvents: [],
      icalFeeds: [],
      financialDocuments: [],
      settings: [],
      authUsers: [],
      subscriptions: [],
      properties: [],
      propertyUnits: [],
    };
  }

  if (!globalThis.__gohostlyxMemoryStore.authUsers) {
    globalThis.__gohostlyxMemoryStore.authUsers = [];
  }

  if (!globalThis.__gohostlyxMemoryStore.subscriptions) {
    globalThis.__gohostlyxMemoryStore.subscriptions = [];
  }

  if (!globalThis.__gohostlyxMemoryStore.financialDocuments) {
    globalThis.__gohostlyxMemoryStore.financialDocuments = [];
  }

  if (!globalThis.__gohostlyxMemoryStore.calendarEvents) {
    globalThis.__gohostlyxMemoryStore.calendarEvents = [];
  }

  if (!globalThis.__gohostlyxMemoryStore.icalFeeds) {
    globalThis.__gohostlyxMemoryStore.icalFeeds = [];
  }

  if (!globalThis.__gohostlyxMemoryStore.nextCalendarEventId) {
    globalThis.__gohostlyxMemoryStore.nextCalendarEventId = 1;
  }

  if (!globalThis.__gohostlyxMemoryStore.nextIcalFeedId) {
    globalThis.__gohostlyxMemoryStore.nextIcalFeedId = 1;
  }

  if (!globalThis.__gohostlyxMemoryStore.nextFinancialDocumentId) {
    globalThis.__gohostlyxMemoryStore.nextFinancialDocumentId = 1;
  }

  return globalThis.__gohostlyxMemoryStore;
}


function getSQLiteDatabase() {
  if (!sqliteDatabase) {
    const SQLite = getSQLiteModule();
    sqliteDatabase = new SQLite(getSQLiteDatabasePath());
    sqliteDatabase.pragma("journal_mode = WAL");
    initializeSQLiteSchema(sqliteDatabase);
  }

  return sqliteDatabase;
}

function getPostgresSslConfig() {
  // Outside production we connect without TLS settings (local/dev databases).
  if (process.env.NODE_ENV !== "production") {
    return undefined;
  }

  // Preferred: validate the server certificate against a provided CA.
  const ca = process.env.DATABASE_CA_CERT;
  if (ca) {
    return { ca, rejectUnauthorized: true };
  }

  // Escape hatch for managed providers whose certs aren't in Node's trust
  // store. Set DATABASE_SSL_INSECURE=true only if the connection otherwise
  // fails — it disables certificate validation (MITM risk).
  if (process.env.DATABASE_SSL_INSECURE === "true") {
    return { rejectUnauthorized: false };
  }

  // Secure default: validate against the system CA bundle.
  return { rejectUnauthorized: true };
}

function getPostgresPool() {
  if (!postgresPool) {
    postgresPool = new Pool({
      connectionString: getDatabaseConnectionString(),
      ssl: getPostgresSslConfig(),
    });
  }

  return postgresPool;
}

async function initializePostgresSchema() {
  if (!isPostgresConfigured()) {
    return;
  }

  if (!postgresInitialization) {
    const pool = getPostgresPool();

    postgresInitialization = runPostgresSchema(pool);
  }

  await postgresInitialization;
}

async function ensureDatabase() {
  if (isPostgresConfigured()) {
    await initializePostgresSchema();
    return;
  }

  if (shouldUseSQLiteFallback()) {
    getSQLiteDatabase();
    return;
  }

  getMemoryStore();
}

function cloneImportSummary(importSummary: StoredImport): ImportSummary {
  return {
    id: importSummary.id,
    fileName: importSummary.fileName,
    propertyName: importSummary.propertyName,
    source: importSummary.source,
    importedSource: importSummary.importedSource,
    importedAt: importSummary.importedAt,
    bookingsCount: importSummary.bookingsCount,
    expensesCount: importSummary.expensesCount,
  };
}

function cloneBookingRecord(booking: StoredBooking): BookingRecord {
  return {
    id: booking.id,
    importId: booking.importId,
    source: booking.source,
    importedSource: booking.importedSource,
    propertyId: booking.propertyId,
    propertyName: booking.propertyName,
    unitName: booking.unitName,
    checkIn: booking.checkIn,
    checkout: booking.checkout,
    guestName: booking.guestName,
    guestCount: booking.guestCount,
    guestContact: booking.guestContact,
    bookedAt: booking.bookedAt,
    adultsCount: booking.adultsCount,
    childrenCount: booking.childrenCount,
    infantsCount: booking.infantsCount,
    channel: booking.channel,
    rentalPeriod: booking.rentalPeriod,
    pricePerNight: booking.pricePerNight,
    extraFee: booking.extraFee,
    discount: booking.discount,
    rentalRevenue: booking.rentalRevenue,
    cleaningFee: booking.cleaningFee,
    taxAmount: booking.taxAmount,
    totalRevenue: booking.totalRevenue,
    hostFee: booking.hostFee,
    payout: booking.payout,
    nights: booking.nights,
    bookingNumber: booking.bookingNumber,
    overbookingStatus: booking.overbookingStatus,
    matchStatus: booking.matchStatus,
    matchedCalendarEventId: booking.matchedCalendarEventId,
  };
}

function cloneExpenseRecord(expense: StoredExpense): ExpenseRecord {
  return {
    id: expense.id,
    importId: expense.importId,
    source: expense.source,
    propertyName: expense.propertyName,
    unitName: expense.unitName,
    date: expense.date,
    category: expense.category,
    amount: expense.amount,
    description: expense.description,
    note: expense.note,
  };
}

function cloneCalendarClosureRecord(closure: StoredCalendarClosure): CalendarClosureRecord {
  return {
    id: closure.id,
    importId: closure.importId,
    source: closure.source,
    propertyName: closure.propertyName,
    unitName: closure.unitName,
    date: closure.date,
    reason: closure.reason,
    note: closure.note,
    statusLabel: closure.statusLabel,
    guestCount: closure.guestCount,
    nights: closure.nights,
  };
}

function cloneCalendarEventRecord(event: StoredCalendarEvent): CalendarEventRecord {
  return {
    id: event.id,
    importId: event.importId,
    icalFeedId: event.icalFeedId,
    propertyId: event.propertyId,
    propertyName: event.propertyName,
    unitName: event.unitName,
    source: event.source,
    externalEventId: event.externalEventId,
    summary: event.summary,
    description: event.description,
    startDate: event.startDate,
    endDate: event.endDate,
    eventType: event.eventType,
    linkedBookingId: event.linkedBookingId,
    lastSyncedAt: event.lastSyncedAt,
  };
}

function cloneIcalFeedRecord(feed: StoredIcalFeed): IcalFeedRecord {
  return {
    id: feed.id,
    workspaceId: feed.workspaceId,
    propertyId: feed.propertyId,
    listingId: feed.listingId,
    propertyName: feed.propertyName,
    listingName: feed.listingName,
    source: feed.source,
    feedUrl: feed.feedUrl,
    isActive: feed.isActive,
    lastSyncedAt: feed.lastSyncedAt,
    lastSyncStatus: feed.lastSyncStatus,
    lastError: feed.lastError,
    eventCount: feed.eventCount,
  };
}

function cloneFinancialDocumentRecord(document: StoredFinancialDocument): FinancialDocumentRecord {
  return {
    id: document.id,
    importId: document.importId,
    propertyName: document.propertyName,
    source: document.source,
    period: {
      start: document.period.start,
      end: document.period.end,
      label: document.period.label,
    },
    totalPayout: document.totalPayout,
    totalFees: document.totalFees,
    totalTaxes: document.totalTaxes,
    currency: document.currency,
    rawData: document.rawData,
    importedAt: document.importedAt,
  };
}

function cloneUserSettings(settings: StoredUserSettings): UserSettings {
  return {
    businessName: settings.businessName,
    primaryCountryCode: settings.primaryCountryCode,
    currencyCode: settings.currencyCode,
    taxCountryCode: settings.taxCountryCode,
    taxRate: settings.taxRate,
  };
}

function cloneAuthUser(authUser: StoredAuthUser) {
  return {
    ownerEmail: authUser.ownerEmail,
    fullName: authUser.fullName,
    passwordHash: authUser.passwordHash,
    isVerified: authUser.isVerified,
    verificationCodeHash: authUser.verificationCodeHash,
    verificationExpiresAt: authUser.verificationExpiresAt,
    createdAt: authUser.createdAt,
    updatedAt: authUser.updatedAt,
  };
}

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
  if (isPostgresConfigured()) {
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

    return;
  }

  if (shouldUseMemoryFallback()) {
    const store = getMemoryStore();
    const index = store.subscriptions.findIndex((entry) => entry.ownerEmail === nextSubscription.ownerEmail);

    if (index >= 0) {
      store.subscriptions[index] = nextSubscription;
    } else {
      store.subscriptions.push(nextSubscription);
    }

    return;
  }

  const db = getSQLiteDatabase();
  db.prepare(
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
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(owner_email) DO UPDATE SET
        plan = excluded.plan,
        status = excluded.status,
        trial_started_at = excluded.trial_started_at,
        trial_ends_at = excluded.trial_ends_at,
        activated_at = excluded.activated_at,
        updated_at = excluded.updated_at,
        stripe_customer_id = excluded.stripe_customer_id,
        stripe_subscription_id = excluded.stripe_subscription_id,
        stripe_price_id = excluded.stripe_price_id
    `,
  ).run(
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
  );
}

function clonePropertyUnit(unit: StoredPropertyUnit): PropertyUnit {
  return {
    id: unit.id,
    name: unit.name,
  };
}

function buildPropertyDefinition(
  property: StoredProperty,
  units: StoredPropertyUnit[],
): PropertyDefinition {
  return {
    id: property.id,
    name: property.name,
    countryCode: property.countryCode,
    units: units
      .filter((unit) => unit.propertyId === property.id)
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(clonePropertyUnit),
  };
}

async function syncPropertyDefinitionsFromRecords(ownerEmail: string) {
  await ensureDatabase();
  const normalizedEmail = normalizeOwnerEmail(ownerEmail);
  const fallbackCountryCode: CountryCode = "US";
  const createdAt = new Date().toISOString();

  if (isPostgresConfigured()) {
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

    return;
  }

  if (shouldUseMemoryFallback()) {
    const store = getMemoryStore();
    const existingNames = new Set(
      store.properties
        .filter((property) => property.ownerEmail === normalizedEmail)
        .map((property) => property.name.trim().toLowerCase()),
    );
    const discoveredNames = new Set<string>();

    for (const booking of store.bookings) {
      if (booking.ownerEmail === normalizedEmail && booking.propertyName.trim()) {
        discoveredNames.add(booking.propertyName.trim());
      }
    }

    for (const expense of store.expenses) {
      if (expense.ownerEmail === normalizedEmail && expense.propertyName.trim()) {
        discoveredNames.add(expense.propertyName.trim());
      }
    }

    for (const importSummary of store.imports) {
      if (importSummary.ownerEmail === normalizedEmail && importSummary.propertyName.trim()) {
        discoveredNames.add(importSummary.propertyName.trim());
      }
    }

    for (const discoveredName of discoveredNames) {
      const normalizedName = discoveredName.toLowerCase();
      if (existingNames.has(normalizedName)) {
        continue;
      }

      store.properties.push({
        id: store.nextPropertyId++,
        ownerEmail: normalizedEmail,
        name: discoveredName,
        countryCode: fallbackCountryCode,
      });
      existingNames.add(normalizedName);
    }

    return;
  }

  const db = getSQLiteDatabase();
  const propertyRows = db
    .prepare("SELECT name FROM properties WHERE owner_email = ?")
    .all(normalizedEmail) as Array<Record<string, unknown>>;
  const bookingRows = db
    .prepare(
      "SELECT DISTINCT property_name AS propertyName FROM bookings WHERE owner_email = ? AND property_name <> ''",
    )
    .all(normalizedEmail) as Array<Record<string, unknown>>;
  const expenseRows = db
    .prepare(
      "SELECT DISTINCT property_name AS propertyName FROM expenses WHERE owner_email = ? AND property_name <> ''",
    )
    .all(normalizedEmail) as Array<Record<string, unknown>>;
  const importRows = db
    .prepare(
      "SELECT DISTINCT property_name AS propertyName FROM imports WHERE owner_email = ? AND property_name <> ''",
    )
    .all(normalizedEmail) as Array<Record<string, unknown>>;

  const existingNames = new Set(
    propertyRows.map((row) => String(getRowValue(row, "name") ?? "").trim().toLowerCase()),
  );
  const discoveredNames = new Set<string>();

  for (const row of [...bookingRows, ...expenseRows, ...importRows]) {
    const name = String(getRowValue(row, "propertyName", "propertyname") ?? "").trim();
    if (name) {
      discoveredNames.add(name);
    }
  }

  const insertProperty = db.prepare(
    `
      INSERT INTO properties (owner_email, name, country_code, created_at)
      VALUES (?, ?, ?, ?)
    `,
  );

  for (const discoveredName of discoveredNames) {
    const normalizedName = discoveredName.toLowerCase();
    if (existingNames.has(normalizedName)) {
      continue;
    }

    insertProperty.run(normalizedEmail, discoveredName, fallbackCountryCode, createdAt);
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

  if (isPostgresConfigured()) {
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

  if (shouldUseMemoryFallback()) {
    const store = getMemoryStore();
    const importedAt = new Date().toISOString();
    const importId = store.nextImportId++;

    const bookingFingerprints = new Set(
      store.bookings
        .filter((booking) => booking.ownerEmail === normalizedEmail && booking.source === "upload")
        .map(createBookingFingerprint),
    );
    const expenseFingerprints = new Set(
      store.expenses
        .filter((expense) => expense.ownerEmail === normalizedEmail && expense.source === "upload")
        .map(createExpenseFingerprint),
    );
    const closureFingerprints = new Set(
      store.closures
        .filter((closure) => closure.ownerEmail === normalizedEmail && closure.source === "upload")
        .map(createClosureFingerprint),
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

    store.imports.push({
      id: importId,
      ownerEmail: normalizedEmail,
      fileName,
      workbookHash,
      propertyName,
      source,
      importedSource,
      importedAt,
      bookingsCount: freshBookings.length,
      expensesCount: freshExpenses.length,
    });

    for (const booking of freshBookings) {
      store.bookings.push({
        ...booking,
        id: store.nextBookingId++,
        importId,
        ownerEmail: normalizedEmail,
        source,
        importedSource: booking.importedSource ?? importedSource,
        propertyId: booking.propertyId ?? null,
        guestContact: booking.guestContact ?? "",
        bookedAt: booking.bookedAt ?? "",
        adultsCount: booking.adultsCount ?? 0,
        childrenCount: booking.childrenCount ?? 0,
        infantsCount: booking.infantsCount ?? 0,
        matchStatus: booking.matchStatus ?? "unmatched",
        matchedCalendarEventId: booking.matchedCalendarEventId ?? null,
        reviewStatus: booking.reviewStatus ?? "ready",
        reviewReason: booking.reviewReason ?? "",
      });

      if (booking.matchedCalendarEventId) {
        const matchedIndex = store.calendarEvents.findIndex(
          (event) =>
            event.ownerEmail === normalizedEmail && event.id === booking.matchedCalendarEventId,
        );

        if (matchedIndex >= 0) {
          store.calendarEvents[matchedIndex] = {
            ...store.calendarEvents[matchedIndex],
            linkedBookingId: store.nextBookingId - 1,
          };
        }
      }
    }

    for (const expense of freshExpenses) {
      store.expenses.push({
        ...expense,
        id: store.nextExpenseId++,
        importId,
        ownerEmail: normalizedEmail,
        source,
      });
    }

    for (const closure of freshClosures) {
      store.closures.push({
        ...closure,
        id: store.nextClosureId++,
        importId,
        ownerEmail: normalizedEmail,
        source,
      });
    }

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
  }

  const db = getSQLiteDatabase();
  const transaction = db.transaction(() => {
    const existingBookings = db
      .prepare(
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
          WHERE owner_email = ? AND source = 'upload'
        `,
      )
      .all(normalizedEmail)
      .map((row) => mapBookingRecord(row as Record<string, unknown>));

    const existingExpenses = db
      .prepare(
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
          WHERE owner_email = ? AND source = 'upload'
        `,
      )
      .all(normalizedEmail)
      .map((row) => mapExpenseRecord(row as Record<string, unknown>));
    const existingClosures = db
      .prepare(
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
          WHERE owner_email = ? AND source = 'upload'
        `,
      )
      .all(normalizedEmail)
      .map((row) => mapCalendarClosureRecord(row as Record<string, unknown>));

    const bookingFingerprints = new Set(existingBookings.map(createBookingFingerprint));
    const expenseFingerprints = new Set(existingExpenses.map(createExpenseFingerprint));
    const closureFingerprints = new Set(existingClosures.map(createClosureFingerprint));
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

    const result = db
      .prepare(
        `
          INSERT INTO imports (owner_email, file_name, workbook_hash, property_name, source, imported_source, imported_at, bookings_count, expenses_count)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        normalizedEmail,
        fileName,
        workbookHash,
        propertyName,
        source,
        importedSource,
        importedAt,
        freshBookings.length,
        freshExpenses.length,
      );

    const importId = Number(result.lastInsertRowid);

    const insertBooking = db.prepare(`
      INSERT INTO bookings (
        owner_email, import_id, source, property_id, property_name, unit_name, check_in, checkout, guest_name, guest_count,
        guest_contact, booked_at, adults_count, children_count, infants_count, imported_source, channel, rental_period, price_per_night, extra_fee, discount, rental_revenue,
        cleaning_fee, tax_amount, total_revenue, host_fee, payout, nights, booking_number, overbooking_status,
        match_status, matched_calendar_event_id, review_status, review_reason
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertExpense = db.prepare(`
      INSERT INTO expenses (
        owner_email, import_id, source, property_name, unit_name, date, category, amount, description, note
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertClosure = db.prepare(`
      INSERT INTO calendar_closures (
        owner_email, import_id, source, property_name, unit_name, date, reason, note, status_label, guest_count, nights
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const booking of freshBookings) {
      const bookingInsertResult = insertBooking.run(
        normalizedEmail,
        importId,
        source,
        booking.propertyId ?? null,
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
      );

      if (booking.matchedCalendarEventId) {
        db.prepare(
          `
            UPDATE calendar_events
            SET linked_booking_id = ?
            WHERE id = ? AND owner_email = ?
          `,
        ).run(Number(bookingInsertResult.lastInsertRowid), booking.matchedCalendarEventId, normalizedEmail);
      }
    }

    for (const expense of freshExpenses) {
      insertExpense.run(
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
      );
    }

    for (const closure of freshClosures) {
      insertClosure.run(
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
      );
    }

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
  });

  return transaction();
}

export async function getLatestImport(ownerEmail: string): Promise<ImportSummary | null> {
  await ensureDatabase();
  const normalizedEmail = normalizeOwnerEmail(ownerEmail);

  if (isPostgresConfigured()) {
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

  if (shouldUseMemoryFallback()) {
    const store = getMemoryStore();
    const latestImport = store.imports
      .filter((entry) => entry.ownerEmail === normalizedEmail)
      .sort((left, right) => right.importedAt.localeCompare(left.importedAt))[0];

    return latestImport ? cloneImportSummary(latestImport) : null;
  }

  const db = getSQLiteDatabase();
  const row = db
    .prepare(
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
        WHERE owner_email = ?
        ORDER BY imported_at DESC
        LIMIT 1
      `,
    )
    .get(normalizedEmail) as Record<string, unknown> | undefined;

  return row ? mapImportSummary(row) : null;
}

export async function getImportSummaries(ownerEmail: string): Promise<ImportSummary[]> {
  await ensureDatabase();
  const normalizedEmail = normalizeOwnerEmail(ownerEmail);

  if (isPostgresConfigured()) {
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

  if (shouldUseMemoryFallback()) {
    const store = getMemoryStore();
    return store.imports
      .filter((entry) => entry.ownerEmail === normalizedEmail)
      .sort((left, right) => right.importedAt.localeCompare(left.importedAt))
      .map(cloneImportSummary);
  }

  const db = getSQLiteDatabase();
  return db
    .prepare(
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
        WHERE owner_email = ?
        ORDER BY imported_at DESC
      `,
    )
    .all(normalizedEmail)
    .map((row) => mapImportSummary(row as Record<string, unknown>));
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

  if (isPostgresConfigured()) {
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

  if (shouldUseMemoryFallback()) {
    const store = getMemoryStore();
    const hashSet = new Set(normalizedHashes);

    return store.imports
      .filter(
        (entry) =>
          entry.ownerEmail === normalizedEmail &&
          entry.workbookHash &&
          hashSet.has(entry.workbookHash.toLowerCase()),
      )
      .map((entry) => ({
        workbookHash: entry.workbookHash,
        fileName: entry.fileName,
        propertyName: entry.propertyName,
        importedAt: entry.importedAt,
      }));
  }

  const db = getSQLiteDatabase();
  const placeholders = normalizedHashes.map(() => "?").join(", ");
  const rows = db
    .prepare(
      `
        SELECT
          workbook_hash AS workbookHash,
          file_name AS fileName,
          property_name AS propertyName,
          imported_at AS importedAt
        FROM imports
        WHERE owner_email = ?
          AND workbook_hash IN (${placeholders})
      `,
    )
    .all(normalizedEmail, ...normalizedHashes) as Record<string, unknown>[];

  return rows.map((row) => ({
    workbookHash: String(getRowValue(row, "workbookHash", "workbookhash")),
    fileName: String(getRowValue(row, "fileName", "filename")),
    propertyName: String(getRowValue(row, "propertyName", "propertyname")) || "Default Property",
    importedAt: normalizeTimestampValue(
      getRowValue(row, "importedAt", "importedat"),
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

  if (isPostgresConfigured()) {
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

  if (shouldUseMemoryFallback()) {
    const store = getMemoryStore();
    const importRow = store.imports.find(
      (entry) => entry.ownerEmail === normalizedEmail && entry.id === importId,
    );

    if (!importRow) {
      throw new Error("Import not found.");
    }

    const deletedBookingsCount = store.bookings.filter(
      (booking) => booking.ownerEmail === normalizedEmail && booking.importId === importId,
    ).length;
    const deletedExpensesCount = store.expenses.filter(
      (expense) => expense.ownerEmail === normalizedEmail && expense.importId === importId,
    ).length;

    store.bookings = store.bookings.filter(
      (booking) => !(booking.ownerEmail === normalizedEmail && booking.importId === importId),
    );
    store.expenses = store.expenses.filter(
      (expense) => !(expense.ownerEmail === normalizedEmail && expense.importId === importId),
    );
    store.financialDocuments = store.financialDocuments.filter(
      (document) => !(document.ownerEmail === normalizedEmail && document.importId === importId),
    );
    store.closures = store.closures.filter(
      (closure) => !(closure.ownerEmail === normalizedEmail && closure.importId === importId),
    );
    store.imports = store.imports.filter(
      (entry) => !(entry.ownerEmail === normalizedEmail && entry.id === importId),
    );

    return {
      deletedImportId: importId,
      deletedFileName: importRow.fileName,
      deletedPropertyName: importRow.propertyName,
      deletedBookingsCount,
      deletedExpensesCount,
    };
  }

  const db = getSQLiteDatabase();
  const importRow = db
    .prepare(
      `
        SELECT
          id,
          file_name AS fileName,
          property_name AS propertyName
        FROM imports
        WHERE owner_email = ? AND id = ?
        LIMIT 1
      `,
    )
    .get(normalizedEmail, importId) as Record<string, unknown> | undefined;

  if (!importRow) {
    throw new Error("Import not found.");
  }

  let deletedBookingsCount = 0;
  let deletedExpensesCount = 0;

  const transaction = db.transaction(() => {
    deletedBookingsCount =
      db
        .prepare("DELETE FROM bookings WHERE owner_email = ? AND import_id = ?")
        .run(normalizedEmail, importId).changes ?? 0;
    deletedExpensesCount =
      db
        .prepare("DELETE FROM expenses WHERE owner_email = ? AND import_id = ?")
        .run(normalizedEmail, importId).changes ?? 0;
    db.prepare("DELETE FROM financial_documents WHERE owner_email = ? AND import_id = ?").run(
      normalizedEmail,
      importId,
    );
    db.prepare("DELETE FROM calendar_closures WHERE owner_email = ? AND import_id = ?").run(
      normalizedEmail,
      importId,
    );
    db.prepare("DELETE FROM imports WHERE owner_email = ? AND id = ?").run(
      normalizedEmail,
      importId,
    );
  });

  transaction();

  return {
    deletedImportId: importId,
    deletedFileName: String(getRowValue(importRow, "fileName", "filename")),
    deletedPropertyName:
      String(getRowValue(importRow, "propertyName", "propertyname")) || "Default Property",
    deletedBookingsCount,
    deletedExpensesCount,
  };
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

  if (isPostgresConfigured()) {
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

  if (shouldUseMemoryFallback()) {
    const store = getMemoryStore();
    const importId = store.nextImportId++;

    store.imports.push({
      id: importId,
      ownerEmail: normalizedEmail,
      fileName,
      workbookHash,
      propertyName,
      source,
      importedSource: "financial_statement",
      importedAt,
      bookingsCount: 0,
      expensesCount: 0,
    });

    store.financialDocuments.push({
      id: store.nextFinancialDocumentId++,
      importId,
      ownerEmail: normalizedEmail,
      propertyName,
      source: document.source,
      period: { ...document.period },
      totalPayout: document.totalPayout,
      totalFees: document.totalFees,
      totalTaxes: document.totalTaxes,
      currency: document.currency,
      rawData: document.rawData,
      importedAt,
    });

    return {
      importId,
      importedAt,
      financialDocumentsCount: 1,
    };
  }

  const db = getSQLiteDatabase();
  const result = db
    .prepare(
      `
        INSERT INTO imports (owner_email, file_name, workbook_hash, property_name, source, imported_source, imported_at, bookings_count, expenses_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0)
      `,
    )
    .run(
      normalizedEmail,
      fileName,
      workbookHash,
      propertyName,
      source,
      "financial_statement",
      importedAt,
    );
  const importId = Number(result.lastInsertRowid ?? 0);

  db.prepare(
    `
      INSERT INTO financial_documents (
        owner_email, import_id, property_name, source, period_start, period_end, period_label,
        total_payout, total_fees, total_taxes, currency, raw_data, imported_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  ).run(
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
  );

  return {
    importId,
    importedAt,
    financialDocumentsCount: 1,
  };
}

export async function getFinancialDocuments(ownerEmail: string): Promise<FinancialDocumentRecord[]> {
  await ensureDatabase();
  const normalizedEmail = normalizeOwnerEmail(ownerEmail);

  if (isPostgresConfigured()) {
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

  if (shouldUseMemoryFallback()) {
    const store = getMemoryStore();
    return store.financialDocuments
      .filter((document) => document.ownerEmail === normalizedEmail)
      .sort((left, right) => right.importedAt.localeCompare(left.importedAt))
      .map(cloneFinancialDocumentRecord);
  }

  const db = getSQLiteDatabase();
  return db
    .prepare(
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
        WHERE owner_email = ?
        ORDER BY imported_at DESC
      `,
    )
    .all(normalizedEmail)
    .map((row) => mapFinancialDocumentRecord(row as Record<string, unknown>));
}

export async function getBookings(ownerEmail: string): Promise<BookingRecord[]> {
  await ensureDatabase();
  const normalizedEmail = normalizeOwnerEmail(ownerEmail);

  if (isPostgresConfigured()) {
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

  if (shouldUseMemoryFallback()) {
    const store = getMemoryStore();

    return store.bookings
      .filter((booking) => booking.ownerEmail === normalizedEmail)
      .sort((left, right) => left.checkIn.localeCompare(right.checkIn))
      .map(cloneBookingRecord);
  }

  const db = getSQLiteDatabase();
  return db
    .prepare(
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
        WHERE owner_email = ?
        ORDER BY check_in ASC
      `,
    )
    .all(normalizedEmail)
    .map((row) => mapBookingRecord(row as Record<string, unknown>));
}

export async function getExpenses(ownerEmail: string): Promise<ExpenseRecord[]> {
  await ensureDatabase();
  const normalizedEmail = normalizeOwnerEmail(ownerEmail);

  if (isPostgresConfigured()) {
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

  if (shouldUseMemoryFallback()) {
    const store = getMemoryStore();

    return store.expenses
      .filter((expense) => expense.ownerEmail === normalizedEmail)
      .sort((left, right) => left.date.localeCompare(right.date))
      .map(cloneExpenseRecord);
  }

  const db = getSQLiteDatabase();
  return db
    .prepare(
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
        WHERE owner_email = ?
        ORDER BY date ASC
      `,
    )
    .all(normalizedEmail)
    .map((row) => mapExpenseRecord(row as Record<string, unknown>));
}

export async function getCalendarClosures(ownerEmail: string): Promise<CalendarClosureRecord[]> {
  await ensureDatabase();
  const normalizedEmail = normalizeOwnerEmail(ownerEmail);

  if (isPostgresConfigured()) {
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

  if (shouldUseMemoryFallback()) {
    const store = getMemoryStore();

    return store.closures
      .filter((closure) => closure.ownerEmail === normalizedEmail)
      .sort((left, right) => left.date.localeCompare(right.date))
      .map(cloneCalendarClosureRecord);
  }

  const db = getSQLiteDatabase();
  return db
    .prepare(
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
        WHERE owner_email = ?
        ORDER BY date ASC
      `,
    )
    .all(normalizedEmail)
    .map((row) => mapCalendarClosureRecord(row as Record<string, unknown>));
}

export async function getCalendarEvents(ownerEmail: string): Promise<CalendarEventRecord[]> {
  await ensureDatabase();
  const normalizedEmail = normalizeOwnerEmail(ownerEmail);

  if (isPostgresConfigured()) {
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

  if (shouldUseMemoryFallback()) {
    const store = getMemoryStore();

    return store.calendarEvents
      .filter((event) => event.ownerEmail === normalizedEmail)
      .sort((left, right) => left.startDate.localeCompare(right.startDate))
      .map(cloneCalendarEventRecord);
  }

  const db = getSQLiteDatabase();
  return db
    .prepare(
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
        WHERE owner_email = ?
        ORDER BY start_date ASC
      `,
    )
    .all(normalizedEmail)
    .map((row) => mapCalendarEventRecord(row as Record<string, unknown>));
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

  if (isPostgresConfigured()) {
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

  if (shouldUseMemoryFallback()) {
    const store = getMemoryStore();

    return store.icalFeeds
      .filter((feed) => feed.ownerEmail === normalizedEmail)
      .filter((feed) => includeInactive || feed.isActive)
      .sort((left, right) => {
        if (left.isActive !== right.isActive) {
          return left.isActive ? -1 : 1;
        }

        if (left.propertyName !== right.propertyName) {
          return left.propertyName.localeCompare(right.propertyName);
        }

        if (left.listingName !== right.listingName) {
          return left.listingName.localeCompare(right.listingName);
        }

        return left.source.localeCompare(right.source);
      })
      .map((feed) => ({
        ...cloneIcalFeedRecord(feed),
        eventCount: store.calendarEvents.filter(
          (event) => event.ownerEmail === normalizedEmail && event.icalFeedId === feed.id,
        ).length,
      }));
  }

  const db = getSQLiteDatabase();
  return db
    .prepare(
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
        WHERE feed.owner_email = ?
          AND (? = 1 OR feed.is_active = 1)
        GROUP BY feed.id
        ORDER BY feed.is_active DESC, feed.property_name ASC, feed.listing_name ASC, feed.source ASC
      `,
    )
    .all(normalizedEmail, includeInactive ? 1 : 0)
    .map((row) => mapIcalFeedRecord(row as Record<string, unknown>));
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

  if (isPostgresConfigured()) {
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

  if (shouldUseMemoryFallback()) {
    const store = getMemoryStore();
    const existingFeed = store.icalFeeds.find(
      (feed) =>
        feed.ownerEmail === normalizedEmail &&
        feed.propertyId === propertyId &&
        (feed.listingId ?? 0) === (normalizedListingId ?? 0) &&
        feed.source === source,
    );

    if (existingFeed) {
      existingFeed.workspaceId = normalizedEmail;
      existingFeed.propertyName = normalizedPropertyName;
      existingFeed.listingName = normalizedListingName;
      existingFeed.feedUrl = normalizedFeedUrl;
      existingFeed.isActive = true;
      existingFeed.lastSyncStatus = "pending";
      existingFeed.lastError = null;
      return existingFeed.id;
    }

    const id = store.nextIcalFeedId++;
    store.icalFeeds.push({
      id,
      ownerEmail: normalizedEmail,
      workspaceId: normalizedEmail,
      propertyId,
      propertyName: normalizedPropertyName,
      listingId: normalizedListingId,
      listingName: normalizedListingName,
      source,
      feedUrl: normalizedFeedUrl,
      isActive: true,
      lastSyncedAt: null,
      lastSyncStatus: "pending",
      lastError: null,
      eventCount: 0,
    });
    return id;
  }

  const db = getSQLiteDatabase();
  const existingFeed = db
    .prepare(
      `
        SELECT id
        FROM ical_feeds
        WHERE owner_email = ?
          AND property_id = ?
          AND COALESCE(listing_id, 0) = COALESCE(?, 0)
          AND source = ?
        LIMIT 1
      `,
    )
    .get(normalizedEmail, propertyId, normalizedListingId, source) as { id?: number } | undefined;

  if (existingFeed?.id) {
    db.prepare(
      `
        UPDATE ical_feeds
        SET
          workspace_id = ?,
          property_name = ?,
          listing_name = ?,
          feed_url = ?,
          is_active = 1,
          last_sync_status = 'pending',
          last_error = NULL
        WHERE id = ? AND owner_email = ?
      `,
    ).run(
      normalizedEmail,
      normalizedPropertyName,
      normalizedListingName,
      normalizedFeedUrl,
      existingFeed.id,
      normalizedEmail,
    );

    return Number(existingFeed.id);
  }

  const result = db
    .prepare(
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
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'pending')
      `,
    )
    .run(
      normalizedEmail,
      normalizedEmail,
      propertyId,
      normalizedPropertyName,
      normalizedListingId,
      normalizedListingName,
      source,
      normalizedFeedUrl,
    );

  return Number(result.lastInsertRowid);
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

  if (isPostgresConfigured()) {
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
    return;
  }

  if (shouldUseMemoryFallback()) {
    const store = getMemoryStore();
    const feed = store.icalFeeds.find(
      (entry) => entry.id === feedId && entry.ownerEmail === normalizedEmail,
    );

    if (!feed) {
      return;
    }

    feed.lastSyncStatus = status;
    if (typeof syncedAt !== "undefined") {
      feed.lastSyncedAt = syncedAt;
    }
    feed.lastError = error ?? null;
    return;
  }

  const db = getSQLiteDatabase();
  db.prepare(
    `
      UPDATE ical_feeds
      SET
        last_sync_status = ?,
        last_synced_at = COALESCE(?, last_synced_at),
        last_error = ?
      WHERE id = ? AND owner_email = ?
    `,
  ).run(status, syncedAt ?? null, error ?? null, feedId, normalizedEmail);
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

  if (isPostgresConfigured()) {
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

  if (shouldUseMemoryFallback()) {
    const store = getMemoryStore();
    store.calendarEvents = store.calendarEvents.filter(
      (event) =>
        !(
          event.ownerEmail === normalizedEmail &&
          event.icalFeedId === feedId
        ),
    );

    for (const event of events) {
      store.calendarEvents.push({
        id: store.nextCalendarEventId++,
        importId: 0,
        ownerEmail: normalizedEmail,
        icalFeedId: feedId,
        propertyId: feed.propertyId ?? null,
        propertyName: normalizedPropertyName,
        unitName: normalizedUnitName,
        source: feed.source,
        externalEventId: event.externalEventId,
        summary: event.summary,
        description: event.description,
        startDate: event.startDate,
        endDate: event.endDate,
        eventType: event.eventType,
        linkedBookingId: null,
        lastSyncedAt: syncedAt,
      });
    }

    return;
  }

  const db = getSQLiteDatabase();
  const transaction = db.transaction(() => {
    db.prepare(
      `
        DELETE FROM calendar_events
        WHERE owner_email = ?
          AND ical_feed_id = ?
      `,
    ).run(normalizedEmail, feedId);

    const insertEvent = db.prepare(
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
        VALUES (?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
      `,
    );

    for (const event of events) {
      insertEvent.run(
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
      );
    }
  });

  transaction();
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

  if (isPostgresConfigured()) {
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

  if (shouldUseMemoryFallback()) {
    const store = getMemoryStore();
    const feed = store.icalFeeds.find(
      (entry) => entry.id === feedId && entry.ownerEmail === normalizedEmail,
    );

    if (feed) {
      feed.isActive = false;
      feed.lastError = null;
    }

    store.calendarEvents = store.calendarEvents.filter(
      (event) => !(event.ownerEmail === normalizedEmail && event.icalFeedId === feedId),
    );
    return;
  }

  const db = getSQLiteDatabase();
  const transaction = db.transaction(() => {
    db.prepare(
      `
        UPDATE ical_feeds
        SET is_active = 0, last_error = NULL
        WHERE id = ? AND owner_email = ?
      `,
    ).run(feedId, normalizedEmail);
    db.prepare(
      "DELETE FROM calendar_events WHERE owner_email = ? AND ical_feed_id = ?",
    ).run(normalizedEmail, feedId);
  });

  transaction();
}

export async function getPropertyDefinitions(
  ownerEmail: string,
): Promise<PropertyDefinition[]> {
  await syncPropertyDefinitionsFromRecords(ownerEmail);
  const normalizedEmail = normalizeOwnerEmail(ownerEmail);

  if (isPostgresConfigured()) {
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

  if (shouldUseMemoryFallback()) {
    const store = getMemoryStore();
    const properties = store.properties
      .filter((property) => property.ownerEmail === normalizedEmail)
      .sort((left, right) => left.name.localeCompare(right.name));
    const units = store.propertyUnits.filter((unit) => unit.ownerEmail === normalizedEmail);

    return properties.map((property) => buildPropertyDefinition(property, units));
  }

  const db = getSQLiteDatabase();
  const propertyRows = db
    .prepare(
      `
        SELECT id, name, country_code AS countryCode
        FROM properties
        WHERE owner_email = ?
        ORDER BY name ASC
      `,
    )
    .all(normalizedEmail) as Array<Record<string, unknown>>;
  const unitRows = db
    .prepare(
      `
        SELECT id, property_id AS propertyId, name
        FROM property_units
        WHERE owner_email = ?
        ORDER BY name ASC
      `,
    )
    .all(normalizedEmail) as Array<Record<string, unknown>>;

  return propertyRows.map((propertyRow) => ({
    id: Number(getRowValue(propertyRow, "id")),
    name: String(getRowValue(propertyRow, "name")),
    countryCode: normalizeCountryCode(
      String(getRowValue(propertyRow, "countryCode", "countrycode") ?? "US"),
    ),
    units: unitRows
      .filter(
        (unitRow) =>
          Number(getRowValue(unitRow, "propertyId", "propertyid")) ===
          Number(getRowValue(propertyRow, "id")),
      )
      .map((unitRow) => ({
        id: Number(getRowValue(unitRow, "id")),
        name: String(getRowValue(unitRow, "name")),
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

  if (isPostgresConfigured()) {
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

  if (shouldUseMemoryFallback()) {
    const store = getMemoryStore();
    const duplicate = store.properties.find(
      (property) =>
        property.ownerEmail === normalizedEmail &&
        property.name.toLowerCase() === normalizedName.toLowerCase(),
    );

    if (duplicate) {
      throw new Error("That property already exists.");
    }

    const id = store.nextPropertyId++;
    store.properties.push({
      id,
      ownerEmail: normalizedEmail,
      name: normalizedName,
      countryCode: normalizedCountryCode,
    });
    return id;
  }

  const db = getSQLiteDatabase();
  const duplicate = db
    .prepare(
      "SELECT id FROM properties WHERE owner_email = ? AND LOWER(name) = LOWER(?) LIMIT 1",
    )
    .get(normalizedEmail, normalizedName) as { id?: number } | undefined;

  if (duplicate?.id) {
    throw new Error("That property already exists.");
  }

  const result = db
    .prepare(
      `
        INSERT INTO properties (owner_email, name, country_code, created_at)
        VALUES (?, ?, ?, ?)
      `,
    )
    .run(normalizedEmail, normalizedName, normalizedCountryCode, createdAt);

  return Number(result.lastInsertRowid);
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

  if (isPostgresConfigured()) {
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

  if (shouldUseMemoryFallback()) {
    const store = getMemoryStore();
    const property = store.properties.find(
      (entry) => entry.id === propertyId && entry.ownerEmail === normalizedEmail,
    );

    if (!property) {
      throw new Error("Property not found.");
    }

    const duplicate = store.propertyUnits.find(
      (unit) => unit.propertyId === propertyId && unit.name.toLowerCase() === normalizedName.toLowerCase(),
    );

    if (duplicate) {
      throw new Error("That unit already exists for this property.");
    }

    const id = store.nextPropertyUnitId++;
    store.propertyUnits.push({
      id,
      propertyId,
      ownerEmail: normalizedEmail,
      name: normalizedName,
    });
    return id;
  }

  const db = getSQLiteDatabase();
  const property = db
    .prepare("SELECT id FROM properties WHERE id = ? AND owner_email = ? LIMIT 1")
    .get(propertyId, normalizedEmail) as { id?: number } | undefined;

  if (!property?.id) {
    throw new Error("Property not found.");
  }

  const duplicate = db
    .prepare("SELECT id FROM property_units WHERE property_id = ? AND LOWER(name) = LOWER(?) LIMIT 1")
    .get(propertyId, normalizedName) as { id?: number } | undefined;

  if (duplicate?.id) {
    throw new Error("That unit already exists for this property.");
  }

  const result = db
    .prepare(
      `
        INSERT INTO property_units (property_id, owner_email, name, created_at)
        VALUES (?, ?, ?, ?)
      `,
    )
    .run(propertyId, normalizedEmail, normalizedName, createdAt);

  return Number(result.lastInsertRowid);
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

  if (isPostgresConfigured()) {
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

    await pool.query(
      "UPDATE properties SET name = $1, country_code = $2 WHERE id = $3 AND owner_email = $4",
      [normalizedName, normalizedCountryCode, propertyId, normalizedEmail],
    );
    await pool.query(
      "UPDATE bookings SET property_name = $1 WHERE owner_email = $2 AND property_name = $3",
      [normalizedName, normalizedEmail, currentName],
    );
    await pool.query(
      "UPDATE expenses SET property_name = $1 WHERE owner_email = $2 AND property_name = $3",
      [normalizedName, normalizedEmail, currentName],
    );
    await pool.query(
      "UPDATE calendar_events SET property_name = $1 WHERE owner_email = $2 AND property_name = $3",
      [normalizedName, normalizedEmail, currentName],
    );
    await pool.query(
      "UPDATE ical_feeds SET property_name = $1 WHERE owner_email = $2 AND property_name = $3",
      [normalizedName, normalizedEmail, currentName],
    );

    return;
  }

  if (shouldUseMemoryFallback()) {
    const store = getMemoryStore();
    const property = store.properties.find(
      (entry) => entry.id === propertyId && entry.ownerEmail === normalizedEmail,
    );

    if (!property) {
      throw new Error("Property not found.");
    }

    const duplicate = store.properties.find(
      (entry) =>
        entry.ownerEmail === normalizedEmail &&
        entry.id !== propertyId &&
        entry.name.toLowerCase() === normalizedName.toLowerCase(),
    );

    if (duplicate) {
      throw new Error("That property already exists.");
    }

    const currentName = property.name;
    property.name = normalizedName;
    property.countryCode = normalizedCountryCode;

    for (const booking of store.bookings) {
      if (booking.ownerEmail === normalizedEmail && booking.propertyName === currentName) {
        booking.propertyName = normalizedName;
      }
    }

    for (const expense of store.expenses) {
      if (expense.ownerEmail === normalizedEmail && expense.propertyName === currentName) {
        expense.propertyName = normalizedName;
      }
    }

    for (const event of store.calendarEvents) {
      if (event.ownerEmail === normalizedEmail && event.propertyName === currentName) {
        event.propertyName = normalizedName;
      }
    }

    for (const feed of store.icalFeeds) {
      if (feed.ownerEmail === normalizedEmail && feed.propertyName === currentName) {
        feed.propertyName = normalizedName;
      }
    }

    return;
  }

  const db = getSQLiteDatabase();
  const property = db
    .prepare("SELECT id, name FROM properties WHERE id = ? AND owner_email = ? LIMIT 1")
    .get(propertyId, normalizedEmail) as { id?: number; name?: string } | undefined;

  if (!property?.id || !property.name) {
    throw new Error("Property not found.");
  }

  const duplicate = db
    .prepare(
      "SELECT id FROM properties WHERE owner_email = ? AND LOWER(name) = LOWER(?) AND id <> ? LIMIT 1",
    )
    .get(normalizedEmail, normalizedName, propertyId) as { id?: number } | undefined;

  if (duplicate?.id) {
    throw new Error("That property already exists.");
  }

  db.prepare("UPDATE properties SET name = ?, country_code = ? WHERE id = ? AND owner_email = ?").run(
    normalizedName,
    normalizedCountryCode,
    propertyId,
    normalizedEmail,
  );
  db.prepare("UPDATE bookings SET property_name = ? WHERE owner_email = ? AND property_name = ?").run(
    normalizedName,
    normalizedEmail,
    property.name,
  );
  db.prepare("UPDATE expenses SET property_name = ? WHERE owner_email = ? AND property_name = ?").run(
    normalizedName,
    normalizedEmail,
    property.name,
  );
  db.prepare("UPDATE calendar_events SET property_name = ? WHERE owner_email = ? AND property_name = ?").run(
    normalizedName,
    normalizedEmail,
    property.name,
  );
  db.prepare("UPDATE ical_feeds SET property_name = ? WHERE owner_email = ? AND property_name = ?").run(
    normalizedName,
    normalizedEmail,
    property.name,
  );
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

  if (isPostgresConfigured()) {
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
        "SELECT COUNT(*) AS count FROM bookings WHERE owner_email = $1 AND property_name = $2",
        [normalizedEmail, propertyName],
      ),
      pool.query(
        "SELECT COUNT(*) AS count FROM expenses WHERE owner_email = $1 AND property_name = $2",
        [normalizedEmail, propertyName],
      ),
      pool.query(
        "SELECT COUNT(*) AS count FROM imports WHERE owner_email = $1 AND property_name = $2",
        [normalizedEmail, propertyName],
      ),
      pool.query(
        "SELECT COUNT(*) AS count FROM calendar_closures WHERE owner_email = $1 AND property_name = $2",
        [normalizedEmail, propertyName],
      ),
      pool.query(
        "SELECT COUNT(*) AS count FROM calendar_events WHERE owner_email = $1 AND property_name = $2",
        [normalizedEmail, propertyName],
      ),
      pool.query(
        "SELECT COUNT(*) AS count FROM ical_feeds WHERE owner_email = $1 AND property_name = $2 AND is_active = TRUE",
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

    await pool.query("BEGIN");

    try {
      if (deleteLinkedData) {
        await pool.query(
          "DELETE FROM bookings WHERE owner_email = $1 AND property_name = $2",
          [normalizedEmail, propertyName],
        );
      await pool.query(
        "DELETE FROM expenses WHERE owner_email = $1 AND property_name = $2",
        [normalizedEmail, propertyName],
      );
      await pool.query(
        "DELETE FROM calendar_closures WHERE owner_email = $1 AND property_name = $2",
        [normalizedEmail, propertyName],
      );
      await pool.query(
        "DELETE FROM financial_documents WHERE owner_email = $1 AND property_name = $2",
        [normalizedEmail, propertyName],
      );
      await pool.query(
        "DELETE FROM calendar_events WHERE owner_email = $1 AND property_name = $2",
        [normalizedEmail, propertyName],
      );
      await pool.query(
        "DELETE FROM ical_feeds WHERE owner_email = $1 AND property_name = $2",
        [normalizedEmail, propertyName],
      );
      await pool.query(
        "DELETE FROM imports WHERE owner_email = $1 AND property_name = $2",
        [normalizedEmail, propertyName],
        );
      }

      await pool.query("DELETE FROM property_units WHERE property_id = $1 AND owner_email = $2", [
        propertyId,
        normalizedEmail,
      ]);
      await pool.query("DELETE FROM properties WHERE id = $1 AND owner_email = $2", [
        propertyId,
        normalizedEmail,
      ]);

      await pool.query("COMMIT");
    } catch (error) {
      await pool.query("ROLLBACK");
      throw error;
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

  if (shouldUseMemoryFallback()) {
    const store = getMemoryStore();
    const property = store.properties.find(
      (entry) => entry.id === propertyId && entry.ownerEmail === normalizedEmail,
    );

    if (!property) {
      throw new Error("Property not found.");
    }

    const bookingCount = store.bookings.filter(
      (booking) => booking.ownerEmail === normalizedEmail && booking.propertyName === property.name,
    ).length;
    const expenseCount = store.expenses.filter(
      (expense) => expense.ownerEmail === normalizedEmail && expense.propertyName === property.name,
    ).length;
    const importCount = store.imports.filter(
      (entry) => entry.ownerEmail === normalizedEmail && entry.propertyName === property.name,
    ).length;
    const closureCount = store.closures.filter(
      (closure) => closure.ownerEmail === normalizedEmail && closure.propertyName === property.name,
    ).length;
    const eventCount = store.calendarEvents.filter(
      (event) => event.ownerEmail === normalizedEmail && event.propertyName === property.name,
    ).length;
    const feedCount = store.icalFeeds.filter(
      (feed) => feed.ownerEmail === normalizedEmail && feed.propertyName === property.name && feed.isActive,
    ).length;

    if ((bookingCount > 0 || expenseCount > 0 || importCount > 0 || closureCount > 0 || eventCount > 0 || feedCount > 0) && !deleteLinkedData) {
      throw new Error("This property still has linked imports, bookings, closed days, calendar feeds, or expenses. Confirm destructive delete to remove everything tied to it.");
    }

    if (deleteLinkedData) {
      store.bookings = store.bookings.filter(
        (booking) => !(booking.ownerEmail === normalizedEmail && booking.propertyName === property.name),
      );
      store.expenses = store.expenses.filter(
        (expense) => !(expense.ownerEmail === normalizedEmail && expense.propertyName === property.name),
      );
      store.closures = store.closures.filter(
        (closure) => !(closure.ownerEmail === normalizedEmail && closure.propertyName === property.name),
      );
      store.financialDocuments = store.financialDocuments.filter(
        (document) => !(document.ownerEmail === normalizedEmail && document.propertyName === property.name),
      );
      store.calendarEvents = store.calendarEvents.filter(
        (event) => !(event.ownerEmail === normalizedEmail && event.propertyName === property.name),
      );
      store.icalFeeds = store.icalFeeds.filter(
        (feed) => !(feed.ownerEmail === normalizedEmail && feed.propertyName === property.name),
      );
      store.imports = store.imports.filter(
        (entry) => !(entry.ownerEmail === normalizedEmail && entry.propertyName === property.name),
      );
    }

    store.propertyUnits = store.propertyUnits.filter(
      (unit) => !(unit.ownerEmail === normalizedEmail && unit.propertyId === propertyId),
    );
    store.properties = store.properties.filter(
      (entry) => !(entry.ownerEmail === normalizedEmail && entry.id === propertyId),
    );

    return {
      deletedPropertyName: property.name,
      deletedBookingsCount: deleteLinkedData ? bookingCount : 0,
      deletedExpensesCount: deleteLinkedData ? expenseCount : 0,
      deletedImportsCount: deleteLinkedData ? importCount : 0,
      deletedLinkedData: deleteLinkedData,
      removedLastProperty:
        store.properties.filter((entry) => entry.ownerEmail === normalizedEmail).length === 0,
    };
  }

  const db = getSQLiteDatabase();
  const property = db
    .prepare("SELECT id, name FROM properties WHERE id = ? AND owner_email = ? LIMIT 1")
    .get(propertyId, normalizedEmail) as { id?: number; name?: string } | undefined;

  if (!property?.id || !property.name) {
    throw new Error("Property not found.");
  }

  const bookingUsage = db
    .prepare("SELECT COUNT(*) AS count FROM bookings WHERE owner_email = ? AND property_name = ?")
    .get(normalizedEmail, property.name) as { count?: number } | undefined;
  const expenseUsage = db
    .prepare("SELECT COUNT(*) AS count FROM expenses WHERE owner_email = ? AND property_name = ?")
    .get(normalizedEmail, property.name) as { count?: number } | undefined;
  const importUsage = db
    .prepare("SELECT COUNT(*) AS count FROM imports WHERE owner_email = ? AND property_name = ?")
    .get(normalizedEmail, property.name) as { count?: number } | undefined;
  const closureUsage = db
    .prepare("SELECT COUNT(*) AS count FROM calendar_closures WHERE owner_email = ? AND property_name = ?")
    .get(normalizedEmail, property.name) as { count?: number } | undefined;
  const eventUsage = db
    .prepare("SELECT COUNT(*) AS count FROM calendar_events WHERE owner_email = ? AND property_name = ?")
    .get(normalizedEmail, property.name) as { count?: number } | undefined;
  const feedUsage = db
    .prepare("SELECT COUNT(*) AS count FROM ical_feeds WHERE owner_email = ? AND property_name = ? AND is_active = 1")
    .get(normalizedEmail, property.name) as { count?: number } | undefined;
  const propertiesCount = db
    .prepare("SELECT COUNT(*) AS count FROM properties WHERE owner_email = ?")
    .get(normalizedEmail) as { count?: number } | undefined;

  const bookingCount = bookingUsage?.count ?? 0;
  const expenseCount = expenseUsage?.count ?? 0;
  const importCount = importUsage?.count ?? 0;
  const closureCount = closureUsage?.count ?? 0;
  const eventCount = eventUsage?.count ?? 0;
  const feedCount = feedUsage?.count ?? 0;

  if ((bookingCount > 0 || expenseCount > 0 || importCount > 0 || closureCount > 0 || eventCount > 0 || feedCount > 0) && !deleteLinkedData) {
    throw new Error("This property still has linked imports, bookings, closed days, calendar feeds, or expenses. Confirm destructive delete to remove everything tied to it.");
  }

  const transaction = db.transaction(() => {
    if (deleteLinkedData) {
      db.prepare("DELETE FROM bookings WHERE owner_email = ? AND property_name = ?").run(
        normalizedEmail,
        property.name,
      );
      db.prepare("DELETE FROM expenses WHERE owner_email = ? AND property_name = ?").run(
        normalizedEmail,
        property.name,
      );
      db.prepare("DELETE FROM calendar_closures WHERE owner_email = ? AND property_name = ?").run(
        normalizedEmail,
        property.name,
      );
      db.prepare("DELETE FROM financial_documents WHERE owner_email = ? AND property_name = ?").run(
        normalizedEmail,
        property.name,
      );
      db.prepare("DELETE FROM calendar_events WHERE owner_email = ? AND property_name = ?").run(
        normalizedEmail,
        property.name,
      );
      db.prepare("DELETE FROM ical_feeds WHERE owner_email = ? AND property_name = ?").run(
        normalizedEmail,
        property.name,
      );
      db.prepare("DELETE FROM imports WHERE owner_email = ? AND property_name = ?").run(
        normalizedEmail,
        property.name,
      );
    }

    db.prepare("DELETE FROM property_units WHERE property_id = ? AND owner_email = ?").run(
      propertyId,
      normalizedEmail,
    );
    db.prepare("DELETE FROM properties WHERE id = ? AND owner_email = ?").run(
      propertyId,
      normalizedEmail,
    );
  });

  transaction();

  return {
    deletedPropertyName: property.name,
    deletedBookingsCount: deleteLinkedData ? bookingCount : 0,
    deletedExpensesCount: deleteLinkedData ? expenseCount : 0,
    deletedImportsCount: deleteLinkedData ? importCount : 0,
    deletedLinkedData: deleteLinkedData,
    removedLastProperty: (propertiesCount?.count ?? 0) <= 1,
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

  if (isPostgresConfigured()) {
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

  if (shouldUseMemoryFallback()) {
    const store = getMemoryStore();
    const id = store.nextBookingId++;

    store.bookings.push({
      ...booking,
      id,
      importId: 0,
      ownerEmail: normalizedEmail,
      source: "manual",
      importedSource: booking.importedSource ?? "generic_excel",
      propertyId: booking.propertyId ?? null,
      guestContact: booking.guestContact ?? "",
      bookedAt: booking.bookedAt ?? "",
      adultsCount: booking.adultsCount ?? 0,
      childrenCount: booking.childrenCount ?? 0,
      infantsCount: booking.infantsCount ?? 0,
      matchStatus: booking.matchStatus ?? "unmatched",
      matchedCalendarEventId: booking.matchedCalendarEventId ?? null,
      reviewStatus: booking.reviewStatus ?? "ready",
      reviewReason: booking.reviewReason ?? "",
    });

    return id;
  }

  const db = getSQLiteDatabase();
  const result = db
    .prepare(
      `
        INSERT INTO bookings (
          owner_email, import_id, source, property_name, unit_name, check_in, checkout, guest_name, guest_count,
          channel, rental_period, price_per_night, extra_fee, discount, rental_revenue,
          cleaning_fee, tax_amount, total_revenue, host_fee, payout, nights, booking_number, overbooking_status
        )
        VALUES (?, 0, 'manual', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
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
    );

  return Number(result.lastInsertRowid);
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

  if (isPostgresConfigured()) {
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

  if (shouldUseMemoryFallback()) {
    const store = getMemoryStore();
    const id = store.nextExpenseId++;

    store.expenses.push({
      ...expense,
      id,
      importId: 0,
      ownerEmail: normalizedEmail,
      source: "manual",
    });

    return id;
  }

  const db = getSQLiteDatabase();
  const result = db
    .prepare(
      `
        INSERT INTO expenses (
          owner_email, import_id, source, property_name, unit_name, date, category, amount, description, note
        )
        VALUES (?, 0, 'manual', ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      normalizedEmail,
      expense.propertyName,
      expense.unitName,
      expense.date,
      expense.category,
      expense.amount,
      expense.description,
      expense.note,
    );

  return Number(result.lastInsertRowid);
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

  if (isPostgresConfigured()) {
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

  if (shouldUseMemoryFallback()) {
    const store = getMemoryStore();
    const index = store.bookings.findIndex(
      (entry) => entry.id === bookingId && entry.ownerEmail === normalizedEmail,
    );

    if (index < 0) {
      return false;
    }

    store.bookings[index] = {
      ...store.bookings[index],
      ...booking,
      id: store.bookings[index].id,
      importId: store.bookings[index].importId,
      ownerEmail: normalizedEmail,
      source: store.bookings[index].source,
      reviewStatus: "ready",
      reviewReason: "",
    };

    return true;
  }

  const db = getSQLiteDatabase();
  const result = db.prepare(
    `
      UPDATE bookings
      SET
        property_name = ?,
        unit_name = ?,
        check_in = ?,
        checkout = ?,
        guest_name = ?,
        guest_count = ?,
        channel = ?,
        rental_period = ?,
        price_per_night = ?,
        extra_fee = ?,
        discount = ?,
        rental_revenue = ?,
        cleaning_fee = ?,
        tax_amount = ?,
        total_revenue = ?,
        host_fee = ?,
        payout = ?,
        nights = ?,
        booking_number = ?,
        overbooking_status = ?,
        review_status = 'ready',
        review_reason = ''
      WHERE id = ? AND owner_email = ?
    `,
  ).run(
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
    bookingId,
    normalizedEmail,
  );

  return result.changes > 0;
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

  if (isPostgresConfigured()) {
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

  if (shouldUseMemoryFallback()) {
    const store = getMemoryStore();
    const index = store.bookings.findIndex(
      (entry) => entry.id === bookingId && entry.ownerEmail === normalizedEmail,
    );

    if (index < 0) {
      return false;
    }

    store.bookings[index] = {
      ...store.bookings[index],
      reviewStatus,
      reviewReason: normalizedReason,
    };

    return true;
  }

  const db = getSQLiteDatabase();
  const result = db.prepare(
    `
      UPDATE bookings
      SET review_status = ?, review_reason = ?
      WHERE id = ? AND owner_email = ?
    `,
  ).run(reviewStatus, normalizedReason, bookingId, normalizedEmail);

  return result.changes > 0;
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

  if (isPostgresConfigured()) {
    const pool = getPostgresPool();
    const result = await pool.query(
      "DELETE FROM bookings WHERE id = $1 AND owner_email = $2",
      [bookingId, normalizedEmail],
    );

    return (result.rowCount ?? 0) > 0;
  }

  if (shouldUseMemoryFallback()) {
    const store = getMemoryStore();
    const before = store.bookings.length;
    store.bookings = store.bookings.filter(
      (entry) => !(entry.id === bookingId && entry.ownerEmail === normalizedEmail),
    );
    return store.bookings.length < before;
  }

  const db = getSQLiteDatabase();
  const result = db
    .prepare("DELETE FROM bookings WHERE id = ? AND owner_email = ?")
    .run(bookingId, normalizedEmail);

  return result.changes > 0;
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

  if (isPostgresConfigured()) {
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

  if (shouldUseMemoryFallback()) {
    const store = getMemoryStore();
    const index = store.expenses.findIndex(
      (entry) => entry.id === expenseId && entry.ownerEmail === normalizedEmail,
    );

    if (index < 0) {
      return false;
    }

    store.expenses[index] = {
      ...store.expenses[index],
      ...expense,
      id: store.expenses[index].id,
      importId: store.expenses[index].importId,
      ownerEmail: normalizedEmail,
      source: store.expenses[index].source,
    };

    return true;
  }

  const db = getSQLiteDatabase();
  const result = db.prepare(
    `
      UPDATE expenses
      SET
        property_name = ?,
        unit_name = ?,
        date = ?,
        category = ?,
        amount = ?,
        description = ?,
        note = ?
      WHERE id = ? AND owner_email = ?
    `,
  ).run(
    expense.propertyName,
    expense.unitName,
    expense.date,
    expense.category,
    expense.amount,
    expense.description,
    expense.note,
    expenseId,
    normalizedEmail,
  );

  return result.changes > 0;
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

  if (isPostgresConfigured()) {
    const pool = getPostgresPool();
    const result = await pool.query(
      "DELETE FROM expenses WHERE id = $1 AND owner_email = $2",
      [expenseId, normalizedEmail],
    );

    return (result.rowCount ?? 0) > 0;
  }

  if (shouldUseMemoryFallback()) {
    const store = getMemoryStore();
    const before = store.expenses.length;
    store.expenses = store.expenses.filter(
      (entry) => !(entry.id === expenseId && entry.ownerEmail === normalizedEmail),
    );
    return store.expenses.length < before;
  }

  const db = getSQLiteDatabase();
  const result = db
    .prepare("DELETE FROM expenses WHERE id = ? AND owner_email = ?")
    .run(expenseId, normalizedEmail);

  return result.changes > 0;
}

export async function getUserSettings(
  ownerEmail: string,
  fallbackBusinessName: string,
): Promise<UserSettings> {
  await ensureDatabase();
  const normalizedEmail = normalizeOwnerEmail(ownerEmail);
  const defaults = getDefaultUserSettings(fallbackBusinessName);

  if (isPostgresConfigured()) {
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

  if (shouldUseMemoryFallback()) {
    const store = getMemoryStore();
    const settings = store.settings.find((entry) => entry.ownerEmail === normalizedEmail);
    return settings ? cloneUserSettings(settings) : defaults;
  }

  const db = getSQLiteDatabase();
  const row = db
    .prepare(
      `
        SELECT
          business_name AS businessName,
          primary_country_code AS primaryCountryCode,
          currency_code AS currencyCode,
          tax_country_code AS taxCountryCode,
          tax_rate AS taxRate
        FROM user_settings
        WHERE owner_email = ?
      `,
    )
    .get(normalizedEmail) as Record<string, unknown> | undefined;

  if (!row) {
    return defaults;
  }

  const primaryCountryCode = normalizeCountryCode(
    String(
      getRowValue(row, "primaryCountryCode", "primarycountrycode") ??
        getCountryForCurrency(
          String(getRowValue(row, "currencyCode", "currencycode") ?? defaults.currencyCode),
        ),
    ),
  );
  const taxCountryCode = normalizeCountryCode(
    String(
      getRowValue(row, "taxCountryCode", "taxcountrycode") ?? primaryCountryCode,
    ),
  );
  const rawTaxRate = getRowValue(row, "taxRate", "taxrate");

  return {
    businessName: String(getRowValue(row, "businessName", "businessname") ?? defaults.businessName),
    primaryCountryCode,
    currencyCode: getCurrencyForCountry(primaryCountryCode),
    taxCountryCode,
    taxRate: normalizeTaxRate(
      typeof rawTaxRate === "number" || typeof rawTaxRate === "string"
        ? rawTaxRate
        : getDefaultTaxRateByCountry(taxCountryCode),
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

  if (isPostgresConfigured()) {
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

    return;
  }

  if (shouldUseMemoryFallback()) {
    const store = getMemoryStore();
    const existingIndex = store.settings.findIndex((entry) => entry.ownerEmail === normalizedEmail);
    const nextSettings: StoredUserSettings = {
      ownerEmail: normalizedEmail,
      businessName: normalizedBusinessName,
      primaryCountryCode: normalizedPrimaryCountryCode,
      currencyCode: normalizedCurrencyCode,
      taxCountryCode: normalizedTaxCountryCode,
      taxRate: normalizedTaxRate,
    };

    if (existingIndex >= 0) {
      store.settings[existingIndex] = nextSettings;
    } else {
      store.settings.push(nextSettings);
    }

    return;
  }

  const db = getSQLiteDatabase();
  db.prepare(
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
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(owner_email) DO UPDATE SET
        business_name = excluded.business_name,
        primary_country_code = excluded.primary_country_code,
        currency_code = excluded.currency_code,
        tax_country_code = excluded.tax_country_code,
        tax_rate = excluded.tax_rate,
        updated_at = excluded.updated_at
    `,
  ).run(
    normalizedEmail,
    normalizedBusinessName,
    normalizedPrimaryCountryCode,
    normalizedCurrencyCode,
    normalizedTaxCountryCode,
    normalizedTaxRate,
    updatedAt,
  );
}

export async function getAuthUserByEmail(email: string) {
  await ensureDatabase();
  const normalizedEmail = normalizeOwnerEmail(email);

  if (isPostgresConfigured()) {
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

  if (shouldUseMemoryFallback()) {
    const store = getMemoryStore();
    const authUser = store.authUsers.find((entry) => entry.ownerEmail === normalizedEmail);
    return authUser ? cloneAuthUser(authUser) : null;
  }

  const db = getSQLiteDatabase();
  const row = db
    .prepare(
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
        WHERE owner_email = ?
      `,
    )
    .get(normalizedEmail) as Record<string, unknown> | undefined;

  if (!row) {
    return null;
  }

  return {
    ownerEmail: String(getRowValue(row, "ownerEmail", "owneremail")),
    fullName: String(getRowValue(row, "fullName", "fullname")),
    passwordHash: String(getRowValue(row, "passwordHash", "passwordhash")),
    isVerified: Boolean(getRowValue(row, "isVerified", "isverified") ?? true),
    verificationCodeHash:
      getRowValue(row, "verificationCodeHash", "verificationcodehash") != null
        ? String(getRowValue(row, "verificationCodeHash", "verificationcodehash"))
        : null,
    verificationExpiresAt: normalizeTimestampValue(
      getRowValue(row, "verificationExpiresAt", "verificationexpiresat"),
      "",
    ) || null,
    createdAt: normalizeTimestampValue(
      getRowValue(row, "createdAt", "createdat"),
      new Date().toISOString(),
    ),
    updatedAt: normalizeTimestampValue(
      getRowValue(row, "updatedAt", "updatedat"),
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

  if (isPostgresConfigured()) {
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

    return;
  }

  if (shouldUseMemoryFallback()) {
    const store = getMemoryStore();
    store.authUsers.push({
      ownerEmail: normalizedEmail,
      fullName: normalizedFullName,
      passwordHash,
      isVerified,
      verificationCodeHash,
      verificationExpiresAt,
      createdAt,
      updatedAt: createdAt,
    });
    return;
  }

  const db = getSQLiteDatabase();
  db.prepare(
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
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
  ).run(
    normalizedEmail,
    normalizedFullName,
    passwordHash,
    isVerified ? 1 : 0,
    verificationCodeHash,
    verificationExpiresAt,
    createdAt,
    createdAt,
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

  if (isPostgresConfigured()) {
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

    return;
  }

  if (shouldUseMemoryFallback()) {
    const store = getMemoryStore();
    const existing = store.authUsers.find((entry) => entry.ownerEmail === normalizedEmail);

    if (existing) {
      existing.fullName = normalizedFullName;
      existing.passwordHash = passwordHash;
      existing.isVerified = false;
      existing.verificationCodeHash = verificationCodeHash;
      existing.verificationExpiresAt = verificationExpiresAt;
      existing.updatedAt = updatedAt;
      return;
    }

    store.authUsers.push({
      ownerEmail: normalizedEmail,
      fullName: normalizedFullName,
      passwordHash,
      isVerified: false,
      verificationCodeHash,
      verificationExpiresAt,
      createdAt: updatedAt,
      updatedAt,
    });
    return;
  }

  const db = getSQLiteDatabase();
  db.prepare(
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
      VALUES (?, ?, ?, 0, ?, ?, ?, ?)
      ON CONFLICT(owner_email) DO UPDATE SET
        full_name = excluded.full_name,
        password_hash = excluded.password_hash,
        is_verified = 0,
        verification_code_hash = excluded.verification_code_hash,
        verification_expires_at = excluded.verification_expires_at,
        updated_at = excluded.updated_at
    `,
  ).run(
    normalizedEmail,
    normalizedFullName,
    passwordHash,
    verificationCodeHash,
    verificationExpiresAt,
    updatedAt,
    updatedAt,
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

  if (isPostgresConfigured()) {
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
    return;
  }

  if (shouldUseMemoryFallback()) {
    const store = getMemoryStore();
    const existing = store.authUsers.find((entry) => entry.ownerEmail === normalizedEmail);
    if (existing) {
      existing.isVerified = true;
      existing.verificationCodeHash = null;
      existing.verificationExpiresAt = null;
      existing.updatedAt = updatedAt;
    }
    return;
  }

  const db = getSQLiteDatabase();
  db.prepare(
    `
      UPDATE auth_users
      SET
        is_verified = 1,
        verification_code_hash = NULL,
        verification_expires_at = NULL,
        updated_at = ?
      WHERE owner_email = ?
    `,
  ).run(updatedAt, normalizedEmail);
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

  if (isPostgresConfigured()) {
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

  if (shouldUseMemoryFallback()) {
    const store = getMemoryStore();
    const index = store.subscriptions.findIndex((entry) => entry.ownerEmail === ownerEmail);

    if (index >= 0) {
      store.subscriptions[index] = expiredSubscription;
    }

    return expiredSubscription;
  }

  const db = getSQLiteDatabase();
  db.prepare(
    `
      UPDATE subscriptions
      SET status = ?, updated_at = ?
      WHERE owner_email = ?
    `,
  ).run(expiredSubscription.status, expiredSubscription.updatedAt, ownerEmail);

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

  if (isPostgresConfigured()) {
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

  if (shouldUseMemoryFallback()) {
    const store = getMemoryStore();
    const subscription = store.subscriptions.find((entry) => entry.ownerEmail === normalizedEmail);

    if (!subscription) {
      const nextSubscription = createDefaultStoredSubscription(normalizedEmail);
      store.subscriptions.push(nextSubscription);
      return cloneSubscription(await ensureAdminProSubscription(nextSubscription));
    }

    return cloneSubscription(
      await ensureAdminProSubscription(
        await expireTrialSubscriptionIfNeeded(normalizedEmail, subscription),
      ),
    );
  }

  const db = getSQLiteDatabase();
  const row = db
    .prepare(
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
        WHERE owner_email = ?
      `,
    )
    .get(normalizedEmail) as Record<string, unknown> | undefined;

  if (!row) {
    const nextSubscription = createDefaultStoredSubscription(normalizedEmail);
    db.prepare(
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
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
    ).run(
      nextSubscription.ownerEmail,
      nextSubscription.plan,
      nextSubscription.status,
      nextSubscription.trialStartedAt,
      nextSubscription.trialEndsAt,
      nextSubscription.activatedAt,
      nextSubscription.updatedAt,
    );

    return cloneSubscription(await ensureAdminProSubscription(nextSubscription));
  }

  const storedSubscription = normalizeStoredSubscription(normalizedEmail, row);
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

  if (isPostgresConfigured()) {
    const pool = getPostgresPool();
    const result = await pool.query(
      "SELECT owner_email AS ownerEmail FROM subscriptions WHERE stripe_customer_id = $1 LIMIT 1",
      [normalizedCustomerId],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    const value = row ? getRowValue(row, "ownerEmail") : null;
    return typeof value === "string" && value ? value : null;
  }

  if (shouldUseMemoryFallback()) {
    const store = getMemoryStore();
    return (
      store.subscriptions.find((entry) => entry.stripeCustomerId === normalizedCustomerId)?.ownerEmail ??
      null
    );
  }

  const db = getSQLiteDatabase();
  const row = db
    .prepare("SELECT owner_email AS ownerEmail FROM subscriptions WHERE stripe_customer_id = ? LIMIT 1")
    .get(normalizedCustomerId) as Record<string, unknown> | undefined;
  const value = row ? getRowValue(row, "ownerEmail") : null;
  return typeof value === "string" && value ? value : null;
}

async function getUserRecordCounts(ownerEmail: string) {
  const normalizedEmail = normalizeOwnerEmail(ownerEmail);

  if (isPostgresConfigured()) {
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

  if (shouldUseMemoryFallback()) {
    const store = getMemoryStore();
    return {
      propertiesCount: store.properties.filter((entry) => entry.ownerEmail === normalizedEmail).length,
      importsCount: store.imports.filter((entry) => entry.ownerEmail === normalizedEmail).length,
      bookingsCount: store.bookings.filter((entry) => entry.ownerEmail === normalizedEmail).length,
      expensesCount: store.expenses.filter((entry) => entry.ownerEmail === normalizedEmail).length,
    };
  }

  const db = getSQLiteDatabase();
  const [properties, imports, bookings, expenses] = [
    db.prepare("SELECT COUNT(*) AS count FROM properties WHERE owner_email = ?").get(normalizedEmail),
    db.prepare("SELECT COUNT(*) AS count FROM imports WHERE owner_email = ?").get(normalizedEmail),
    db.prepare("SELECT COUNT(*) AS count FROM bookings WHERE owner_email = ?").get(normalizedEmail),
    db.prepare("SELECT COUNT(*) AS count FROM expenses WHERE owner_email = ?").get(normalizedEmail),
  ] as Array<Record<string, unknown> | undefined>;

  return {
    propertiesCount: Number(getRowValue(properties ?? {}, "count") ?? 0),
    importsCount: Number(getRowValue(imports ?? {}, "count") ?? 0),
    bookingsCount: Number(getRowValue(bookings ?? {}, "count") ?? 0),
    expensesCount: Number(getRowValue(expenses ?? {}, "count") ?? 0),
  };
}

export async function listAdminUsers(): Promise<AdminUserSummary[]> {
  await ensureDatabase();
  const ownerEmails = new Set<string>();

  if (isPostgresConfigured()) {
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
  } else if (shouldUseMemoryFallback()) {
    const store = getMemoryStore();
    for (const collection of [
      store.settings,
      store.subscriptions,
      store.authUsers,
      store.properties,
      store.imports,
      store.bookings,
      store.expenses,
    ]) {
      for (const entry of collection) {
        if ("ownerEmail" in entry && typeof entry.ownerEmail === "string" && entry.ownerEmail.trim()) {
          ownerEmails.add(entry.ownerEmail.toLowerCase());
        }
      }
    }
  } else {
    const db = getSQLiteDatabase();
    const rows = db.prepare(
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
    ).all() as Array<Record<string, unknown>>;

    for (const row of rows) {
      const email = String(getRowValue(row, "ownerEmail", "owneremail") ?? "").trim();
      if (email) {
        ownerEmails.add(email.toLowerCase());
      }
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

  if (isPostgresConfigured()) {
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

    return;
  }

  if (shouldUseMemoryFallback()) {
    const store = getMemoryStore();
    store.bookings = store.bookings.filter((entry) => entry.ownerEmail !== normalizedEmail);
    store.expenses = store.expenses.filter((entry) => entry.ownerEmail !== normalizedEmail);
    store.closures = store.closures.filter((entry) => entry.ownerEmail !== normalizedEmail);
    store.calendarEvents = store.calendarEvents.filter((entry) => entry.ownerEmail !== normalizedEmail);
    store.icalFeeds = store.icalFeeds.filter((entry) => entry.ownerEmail !== normalizedEmail);
    store.financialDocuments = store.financialDocuments.filter((entry) => entry.ownerEmail !== normalizedEmail);
    store.imports = store.imports.filter((entry) => entry.ownerEmail !== normalizedEmail);
    store.propertyUnits = store.propertyUnits.filter((entry) => entry.ownerEmail !== normalizedEmail);
    store.properties = store.properties.filter((entry) => entry.ownerEmail !== normalizedEmail);
    store.settings = store.settings.filter((entry) => entry.ownerEmail !== normalizedEmail);
    store.subscriptions = store.subscriptions.filter((entry) => entry.ownerEmail !== normalizedEmail);
    store.authUsers = store.authUsers.filter((entry) => entry.ownerEmail !== normalizedEmail);
    return;
  }

  const db = getSQLiteDatabase();
  db.prepare("DELETE FROM bookings WHERE owner_email = ?").run(normalizedEmail);
  db.prepare("DELETE FROM expenses WHERE owner_email = ?").run(normalizedEmail);
  db.prepare("DELETE FROM calendar_closures WHERE owner_email = ?").run(normalizedEmail);
  db.prepare("DELETE FROM calendar_events WHERE owner_email = ?").run(normalizedEmail);
  db.prepare("DELETE FROM ical_feeds WHERE owner_email = ?").run(normalizedEmail);
  db.prepare("DELETE FROM financial_documents WHERE owner_email = ?").run(normalizedEmail);
  db.prepare("DELETE FROM imports WHERE owner_email = ?").run(normalizedEmail);
  db.prepare("DELETE FROM property_units WHERE owner_email = ?").run(normalizedEmail);
  db.prepare("DELETE FROM properties WHERE owner_email = ?").run(normalizedEmail);
  db.prepare("DELETE FROM user_settings WHERE owner_email = ?").run(normalizedEmail);
  db.prepare("DELETE FROM subscriptions WHERE owner_email = ?").run(normalizedEmail);
  db.prepare("DELETE FROM auth_users WHERE owner_email = ?").run(normalizedEmail);
}

import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { Pool } from "pg";
import type {
  BookingRecord,
  CalendarClosureRecord,
  CountryCode,
  ExpenseRecord,
  ImportSource,
  ImportSummary,
  PropertyDefinition,
  PropertyUnit,
  UserSettings,
} from "./types";
import type { DashboardWidgetLayoutState } from "./dashboard-widget-layout";
import { normalizeExpenseFields } from "./expense-normalization";
import {
  getCountryForCurrency,
  getCurrencyForCountry,
  normalizeCountryCode,
} from "./markets";
import { getDefaultTaxRateByCountry, normalizeTaxRate } from "./tax";

type SQLiteDatabase = import("better-sqlite3").Database;
type SQLiteModule = typeof import("better-sqlite3");

type StoredImport = ImportSummary & {
  ownerEmail: string;
  workbookHash: string;
};

type StoredBooking = Required<BookingRecord> & {
  ownerEmail: string;
};

type StoredExpense = Required<ExpenseRecord> & {
  ownerEmail: string;
};

type StoredCalendarClosure = Required<CalendarClosureRecord> & {
  ownerEmail: string;
};

type StoredUserSettings = UserSettings & {
  ownerEmail: string;
};

type StoredAuthUser = {
  ownerEmail: string;
  fullName: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
};

type StoredProperty = {
  id: number;
  ownerEmail: string;
  name: string;
  countryCode: CountryCode;
};

type StoredPropertyUnit = {
  id: number;
  propertyId: number;
  ownerEmail: string;
  name: string;
};

type StoredDashboardLayout = {
  ownerEmail: string;
  layoutKey: string;
  layoutJson: string;
  updatedAt: string;
};

type MemoryStore = {
  nextImportId: number;
  nextBookingId: number;
  nextExpenseId: number;
  nextClosureId: number;
  nextPropertyId: number;
  nextPropertyUnitId: number;
  imports: StoredImport[];
  bookings: StoredBooking[];
  expenses: StoredExpense[];
  closures: StoredCalendarClosure[];
  settings: StoredUserSettings[];
  authUsers: StoredAuthUser[];
  properties: StoredProperty[];
  propertyUnits: StoredPropertyUnit[];
  dashboardLayouts: StoredDashboardLayout[];
};

const require = createRequire(import.meta.url);

let sqliteDatabase: SQLiteDatabase | null = null;
let sqliteModule: SQLiteModule | null = null;
let postgresPool: Pool | null = null;
let postgresInitialization: Promise<void> | null = null;

declare global {
  var __hostlyxMemoryStore: MemoryStore | undefined;
}

function isPostgresConfigured() {
  return Boolean(getDatabaseConnectionString());
}

function getDatabaseConnectionString() {
  return process.env.DATABASE_URL ?? process.env.NETLIFY_DATABASE_URL ?? "";
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
  if (!globalThis.__hostlyxMemoryStore) {
    globalThis.__hostlyxMemoryStore = {
      nextImportId: 1,
      nextBookingId: 1,
      nextExpenseId: 1,
      nextClosureId: 1,
      nextPropertyId: 1,
      nextPropertyUnitId: 1,
      imports: [],
      bookings: [],
      expenses: [],
      closures: [],
      settings: [],
      authUsers: [],
      properties: [],
      propertyUnits: [],
      dashboardLayouts: [],
    };
  }

  if (!globalThis.__hostlyxMemoryStore.authUsers) {
    globalThis.__hostlyxMemoryStore.authUsers = [];
  }

  return globalThis.__hostlyxMemoryStore;
}

function hasColumn(db: SQLiteDatabase, tableName: string, columnName: string) {
  const columns = db
    .prepare(`PRAGMA table_info(${tableName})`)
    .all() as Array<{ name: string }>;

  return columns.some((column) => column.name === columnName);
}

function getSQLiteDatabasePath() {
  const directory = path.join(process.cwd(), "data");
  mkdirSync(directory, { recursive: true });
  return path.join(directory, "hostlyx.sqlite");
}

function initializeSQLiteSchema(db: SQLiteDatabase) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS imports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_email TEXT NOT NULL DEFAULT 'legacy',
      file_name TEXT NOT NULL,
      workbook_hash TEXT NOT NULL DEFAULT '',
      property_name TEXT NOT NULL DEFAULT 'Default Property',
      source TEXT NOT NULL,
      imported_at TEXT NOT NULL,
      bookings_count INTEGER NOT NULL,
      expenses_count INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_email TEXT NOT NULL DEFAULT 'legacy',
      import_id INTEGER NOT NULL,
      source TEXT NOT NULL DEFAULT 'upload',
      property_name TEXT NOT NULL DEFAULT 'Default Property',
      unit_name TEXT NOT NULL DEFAULT '',
      check_in TEXT NOT NULL,
      checkout TEXT NOT NULL,
      guest_name TEXT NOT NULL,
      guest_count INTEGER NOT NULL,
      channel TEXT NOT NULL,
      rental_period TEXT NOT NULL,
      price_per_night REAL NOT NULL,
      extra_fee REAL NOT NULL,
      discount REAL NOT NULL,
      rental_revenue REAL NOT NULL,
      cleaning_fee REAL NOT NULL,
      total_revenue REAL NOT NULL,
      host_fee REAL NOT NULL,
      payout REAL NOT NULL,
      nights INTEGER NOT NULL,
      booking_number TEXT NOT NULL DEFAULT '',
      overbooking_status TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_email TEXT NOT NULL DEFAULT 'legacy',
      import_id INTEGER NOT NULL,
      source TEXT NOT NULL DEFAULT 'upload',
      property_name TEXT NOT NULL DEFAULT 'Default Property',
      unit_name TEXT NOT NULL DEFAULT '',
      date TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT NOT NULL,
      note TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS calendar_closures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_email TEXT NOT NULL DEFAULT 'legacy',
      import_id INTEGER NOT NULL,
      source TEXT NOT NULL DEFAULT 'upload',
      property_name TEXT NOT NULL DEFAULT 'Default Property',
      unit_name TEXT NOT NULL DEFAULT '',
      date TEXT NOT NULL,
      reason TEXT NOT NULL,
      note TEXT NOT NULL,
      status_label TEXT NOT NULL DEFAULT 'Closed',
      guest_count INTEGER NOT NULL DEFAULT 0,
      nights INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      owner_email TEXT PRIMARY KEY,
      business_name TEXT NOT NULL,
      primary_country_code TEXT NOT NULL DEFAULT 'US',
      currency_code TEXT NOT NULL DEFAULT 'USD',
      tax_country_code TEXT NOT NULL DEFAULT 'US',
      tax_rate REAL NOT NULL DEFAULT 25,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS auth_users (
      owner_email TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS properties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_email TEXT NOT NULL,
      name TEXT NOT NULL,
      country_code TEXT NOT NULL DEFAULT 'US',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS property_units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL,
      owner_email TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dashboard_layouts (
      owner_email TEXT NOT NULL,
      layout_key TEXT NOT NULL,
      layout_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (owner_email, layout_key)
    );

    CREATE INDEX IF NOT EXISTS idx_imports_owner_email ON imports(owner_email);
    CREATE INDEX IF NOT EXISTS idx_bookings_owner_check_in ON bookings(owner_email, check_in);
    CREATE INDEX IF NOT EXISTS idx_bookings_owner_channel ON bookings(owner_email, channel);
    CREATE INDEX IF NOT EXISTS idx_expenses_owner_date ON expenses(owner_email, date);
    CREATE INDEX IF NOT EXISTS idx_calendar_closures_owner_date ON calendar_closures(owner_email, date);
    CREATE INDEX IF NOT EXISTS idx_auth_users_owner_email ON auth_users(owner_email);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_properties_owner_name ON properties(owner_email, name);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_property_units_property_name ON property_units(property_id, name);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboard_layouts_owner_key ON dashboard_layouts(owner_email, layout_key);
  `);

  if (!hasColumn(db, "imports", "owner_email")) {
    db.exec("ALTER TABLE imports ADD COLUMN owner_email TEXT NOT NULL DEFAULT 'legacy';");
  }

  if (!hasColumn(db, "imports", "property_name")) {
    db.exec("ALTER TABLE imports ADD COLUMN property_name TEXT NOT NULL DEFAULT 'Default Property';");
  }

  if (!hasColumn(db, "imports", "workbook_hash")) {
    db.exec("ALTER TABLE imports ADD COLUMN workbook_hash TEXT NOT NULL DEFAULT '';");
  }

  db.exec(`
    UPDATE imports
    SET property_name = COALESCE(
      (
        SELECT bookings.property_name
        FROM bookings
        WHERE bookings.import_id = imports.id
          AND bookings.owner_email = imports.owner_email
          AND bookings.property_name <> ''
        LIMIT 1
      ),
      (
        SELECT expenses.property_name
        FROM expenses
        WHERE expenses.import_id = imports.id
          AND expenses.owner_email = imports.owner_email
          AND expenses.property_name <> ''
        LIMIT 1
      ),
      property_name
    )
    WHERE property_name = 'Default Property'
  `);

  if (!hasColumn(db, "bookings", "owner_email")) {
    db.exec("ALTER TABLE bookings ADD COLUMN owner_email TEXT NOT NULL DEFAULT 'legacy';");
  }

  if (!hasColumn(db, "bookings", "source")) {
    db.exec("ALTER TABLE bookings ADD COLUMN source TEXT NOT NULL DEFAULT 'upload';");
  }

  if (!hasColumn(db, "bookings", "property_name")) {
    db.exec("ALTER TABLE bookings ADD COLUMN property_name TEXT NOT NULL DEFAULT 'Default Property';");
  }

  if (!hasColumn(db, "bookings", "unit_name")) {
    db.exec("ALTER TABLE bookings ADD COLUMN unit_name TEXT NOT NULL DEFAULT '';");
  }

  if (!hasColumn(db, "bookings", "booking_number")) {
    db.exec("ALTER TABLE bookings ADD COLUMN booking_number TEXT NOT NULL DEFAULT '';");
  }

  if (!hasColumn(db, "bookings", "overbooking_status")) {
    db.exec("ALTER TABLE bookings ADD COLUMN overbooking_status TEXT NOT NULL DEFAULT '';");
  }

  if (!hasColumn(db, "expenses", "owner_email")) {
    db.exec("ALTER TABLE expenses ADD COLUMN owner_email TEXT NOT NULL DEFAULT 'legacy';");
  }

  if (!hasColumn(db, "expenses", "source")) {
    db.exec("ALTER TABLE expenses ADD COLUMN source TEXT NOT NULL DEFAULT 'upload';");
  }

  if (!hasColumn(db, "expenses", "property_name")) {
    db.exec("ALTER TABLE expenses ADD COLUMN property_name TEXT NOT NULL DEFAULT 'Default Property';");
  }

  if (!hasColumn(db, "expenses", "unit_name")) {
    db.exec("ALTER TABLE expenses ADD COLUMN unit_name TEXT NOT NULL DEFAULT '';");
  }

  if (!hasColumn(db, "calendar_closures", "owner_email")) {
    db.exec("ALTER TABLE calendar_closures ADD COLUMN owner_email TEXT NOT NULL DEFAULT 'legacy';");
  }

  if (!hasColumn(db, "calendar_closures", "source")) {
    db.exec("ALTER TABLE calendar_closures ADD COLUMN source TEXT NOT NULL DEFAULT 'upload';");
  }

  if (!hasColumn(db, "calendar_closures", "property_name")) {
    db.exec("ALTER TABLE calendar_closures ADD COLUMN property_name TEXT NOT NULL DEFAULT 'Default Property';");
  }

  if (!hasColumn(db, "calendar_closures", "unit_name")) {
    db.exec("ALTER TABLE calendar_closures ADD COLUMN unit_name TEXT NOT NULL DEFAULT '';");
  }

  if (!hasColumn(db, "calendar_closures", "status_label")) {
    db.exec("ALTER TABLE calendar_closures ADD COLUMN status_label TEXT NOT NULL DEFAULT 'Closed';");
  }

  if (!hasColumn(db, "calendar_closures", "guest_count")) {
    db.exec("ALTER TABLE calendar_closures ADD COLUMN guest_count INTEGER NOT NULL DEFAULT 0;");
  }

  if (!hasColumn(db, "calendar_closures", "nights")) {
    db.exec("ALTER TABLE calendar_closures ADD COLUMN nights INTEGER NOT NULL DEFAULT 0;");
  }

  if (!hasColumn(db, "user_settings", "primary_country_code")) {
    db.exec("ALTER TABLE user_settings ADD COLUMN primary_country_code TEXT NOT NULL DEFAULT 'US';");
  }

  if (!hasColumn(db, "user_settings", "tax_country_code")) {
    db.exec("ALTER TABLE user_settings ADD COLUMN tax_country_code TEXT NOT NULL DEFAULT 'US';");
  }

  if (!hasColumn(db, "user_settings", "tax_rate")) {
    db.exec("ALTER TABLE user_settings ADD COLUMN tax_rate REAL NOT NULL DEFAULT 25;");
  }

  if (!hasColumn(db, "properties", "country_code")) {
    db.exec("ALTER TABLE properties ADD COLUMN country_code TEXT NOT NULL DEFAULT 'US';");
  }
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

function getPostgresPool() {
  if (!postgresPool) {
    postgresPool = new Pool({
      connectionString: getDatabaseConnectionString(),
      ssl:
        process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : undefined,
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

    postgresInitialization = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS imports (
          id BIGSERIAL PRIMARY KEY,
          owner_email TEXT NOT NULL,
          file_name TEXT NOT NULL,
          workbook_hash TEXT NOT NULL DEFAULT '',
          property_name TEXT NOT NULL DEFAULT 'Default Property',
          source TEXT NOT NULL,
          imported_at TIMESTAMPTZ NOT NULL,
          bookings_count INTEGER NOT NULL,
          expenses_count INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS bookings (
          id BIGSERIAL PRIMARY KEY,
          owner_email TEXT NOT NULL,
          import_id BIGINT NOT NULL DEFAULT 0,
          source TEXT NOT NULL DEFAULT 'upload',
          property_name TEXT NOT NULL DEFAULT 'Default Property',
          unit_name TEXT NOT NULL DEFAULT '',
          check_in TEXT NOT NULL,
          checkout TEXT NOT NULL,
          guest_name TEXT NOT NULL,
          guest_count INTEGER NOT NULL,
          channel TEXT NOT NULL,
          rental_period TEXT NOT NULL,
          price_per_night DOUBLE PRECISION NOT NULL,
          extra_fee DOUBLE PRECISION NOT NULL,
          discount DOUBLE PRECISION NOT NULL,
          rental_revenue DOUBLE PRECISION NOT NULL,
          cleaning_fee DOUBLE PRECISION NOT NULL,
          total_revenue DOUBLE PRECISION NOT NULL,
          host_fee DOUBLE PRECISION NOT NULL,
          payout DOUBLE PRECISION NOT NULL,
          nights INTEGER NOT NULL,
          booking_number TEXT NOT NULL DEFAULT '',
          overbooking_status TEXT NOT NULL DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS expenses (
          id BIGSERIAL PRIMARY KEY,
          owner_email TEXT NOT NULL,
          import_id BIGINT NOT NULL DEFAULT 0,
          source TEXT NOT NULL DEFAULT 'upload',
          property_name TEXT NOT NULL DEFAULT 'Default Property',
          unit_name TEXT NOT NULL DEFAULT '',
          date TEXT NOT NULL,
          category TEXT NOT NULL,
          amount DOUBLE PRECISION NOT NULL,
          description TEXT NOT NULL,
          note TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS calendar_closures (
          id BIGSERIAL PRIMARY KEY,
          owner_email TEXT NOT NULL,
          import_id BIGINT NOT NULL DEFAULT 0,
          source TEXT NOT NULL DEFAULT 'upload',
          property_name TEXT NOT NULL DEFAULT 'Default Property',
          unit_name TEXT NOT NULL DEFAULT '',
          date TEXT NOT NULL,
          reason TEXT NOT NULL,
          note TEXT NOT NULL,
          status_label TEXT NOT NULL DEFAULT 'Closed',
          guest_count INTEGER NOT NULL DEFAULT 0,
          nights INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS user_settings (
          owner_email TEXT PRIMARY KEY,
          business_name TEXT NOT NULL,
          primary_country_code TEXT NOT NULL DEFAULT 'US',
          currency_code TEXT NOT NULL DEFAULT 'USD',
          tax_country_code TEXT NOT NULL DEFAULT 'US',
          tax_rate DOUBLE PRECISION NOT NULL DEFAULT 25,
          updated_at TIMESTAMPTZ NOT NULL
        );

        CREATE TABLE IF NOT EXISTS auth_users (
          owner_email TEXT PRIMARY KEY,
          full_name TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL
        );

        CREATE TABLE IF NOT EXISTS properties (
          id BIGSERIAL PRIMARY KEY,
          owner_email TEXT NOT NULL,
          name TEXT NOT NULL,
          country_code TEXT NOT NULL DEFAULT 'US',
          created_at TIMESTAMPTZ NOT NULL
        );

        CREATE TABLE IF NOT EXISTS property_units (
          id BIGSERIAL PRIMARY KEY,
          property_id BIGINT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
          owner_email TEXT NOT NULL,
          name TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL
        );

        CREATE TABLE IF NOT EXISTS dashboard_layouts (
          owner_email TEXT NOT NULL,
          layout_key TEXT NOT NULL,
          layout_json TEXT NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL,
          PRIMARY KEY (owner_email, layout_key)
        );

        CREATE INDEX IF NOT EXISTS idx_imports_owner_email ON imports(owner_email);
        CREATE INDEX IF NOT EXISTS idx_bookings_owner_check_in ON bookings(owner_email, check_in);
        CREATE INDEX IF NOT EXISTS idx_bookings_owner_channel ON bookings(owner_email, channel);
        CREATE INDEX IF NOT EXISTS idx_expenses_owner_date ON expenses(owner_email, date);
        CREATE INDEX IF NOT EXISTS idx_calendar_closures_owner_date ON calendar_closures(owner_email, date);
        CREATE INDEX IF NOT EXISTS idx_auth_users_owner_email ON auth_users(owner_email);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_properties_owner_name ON properties(owner_email, name);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_property_units_property_name ON property_units(property_id, name);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboard_layouts_owner_key ON dashboard_layouts(owner_email, layout_key);
      `);

      await pool.query(`
        ALTER TABLE imports
        ADD COLUMN IF NOT EXISTS property_name TEXT NOT NULL DEFAULT 'Default Property'
      `);
      await pool.query(`
        UPDATE imports
        SET property_name = COALESCE(
          (
            SELECT bookings.property_name
            FROM bookings
            WHERE bookings.import_id = imports.id
              AND bookings.owner_email = imports.owner_email
              AND bookings.property_name <> ''
            LIMIT 1
          ),
          (
            SELECT expenses.property_name
            FROM expenses
            WHERE expenses.import_id = imports.id
              AND expenses.owner_email = imports.owner_email
              AND expenses.property_name <> ''
            LIMIT 1
          ),
          imports.property_name
        )
        WHERE imports.property_name = 'Default Property'
      `);
      await pool.query(`
        ALTER TABLE user_settings
        ADD COLUMN IF NOT EXISTS primary_country_code TEXT NOT NULL DEFAULT 'US'
      `);
      await pool.query(`
        ALTER TABLE user_settings
        ADD COLUMN IF NOT EXISTS tax_country_code TEXT NOT NULL DEFAULT 'US'
      `);
      await pool.query(`
        ALTER TABLE user_settings
        ADD COLUMN IF NOT EXISTS tax_rate DOUBLE PRECISION NOT NULL DEFAULT 25
      `);
      await pool.query(`
        ALTER TABLE properties
        ADD COLUMN IF NOT EXISTS country_code TEXT NOT NULL DEFAULT 'US'
      `);
      await pool.query(`
        ALTER TABLE bookings
        ADD COLUMN IF NOT EXISTS property_name TEXT NOT NULL DEFAULT 'Default Property'
      `);
      await pool.query(`
        ALTER TABLE imports
        ADD COLUMN IF NOT EXISTS workbook_hash TEXT NOT NULL DEFAULT ''
      `);
      await pool.query(`
        ALTER TABLE bookings
        ADD COLUMN IF NOT EXISTS unit_name TEXT NOT NULL DEFAULT ''
      `);
      await pool.query(`
        ALTER TABLE bookings
        ADD COLUMN IF NOT EXISTS booking_number TEXT NOT NULL DEFAULT ''
      `);
      await pool.query(`
        ALTER TABLE bookings
        ADD COLUMN IF NOT EXISTS overbooking_status TEXT NOT NULL DEFAULT ''
      `);
      await pool.query(`
        ALTER TABLE expenses
        ADD COLUMN IF NOT EXISTS property_name TEXT NOT NULL DEFAULT 'Default Property'
      `);
      await pool.query(`
        ALTER TABLE expenses
        ADD COLUMN IF NOT EXISTS unit_name TEXT NOT NULL DEFAULT ''
      `);
      await pool.query(`
        ALTER TABLE calendar_closures
        ADD COLUMN IF NOT EXISTS property_name TEXT NOT NULL DEFAULT 'Default Property'
      `);
      await pool.query(`
        ALTER TABLE calendar_closures
        ADD COLUMN IF NOT EXISTS unit_name TEXT NOT NULL DEFAULT ''
      `);
      await pool.query(`
        ALTER TABLE calendar_closures
        ADD COLUMN IF NOT EXISTS status_label TEXT NOT NULL DEFAULT 'Closed'
      `);
      await pool.query(`
        ALTER TABLE calendar_closures
        ADD COLUMN IF NOT EXISTS guest_count INTEGER NOT NULL DEFAULT 0
      `);
      await pool.query(`
        ALTER TABLE calendar_closures
        ADD COLUMN IF NOT EXISTS nights INTEGER NOT NULL DEFAULT 0
      `);
    })();
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

function mapImportSummary(row: Record<string, unknown>): ImportSummary {
  const importedAt = getRowValue(row, "importedAt", "importedat");

  return {
    id: Number(getRowValue(row, "id")),
    fileName: String(getRowValue(row, "fileName", "filename")),
    propertyName:
      String(getRowValue(row, "propertyName", "propertyname")) || "Default Property",
    source: String(getRowValue(row, "source")) as ImportSource,
    importedAt:
      importedAt instanceof Date
        ? importedAt.toISOString()
        : String(importedAt),
    bookingsCount: Number(getRowValue(row, "bookingsCount", "bookingscount")),
    expensesCount: Number(getRowValue(row, "expensesCount", "expensescount")),
  };
}

function mapBookingRecord(row: Record<string, unknown>): BookingRecord {
  return {
    id: Number(getRowValue(row, "id")),
    importId: Number(getRowValue(row, "importId", "importid")),
    source: String(getRowValue(row, "source")) as ImportSource,
    propertyName: String(getRowValue(row, "propertyName", "propertyname")) || "Default Property",
    unitName: String(getRowValue(row, "unitName", "unitname")),
    checkIn: String(getRowValue(row, "checkIn", "checkin")),
    checkout: String(getRowValue(row, "checkout")),
    guestName: String(getRowValue(row, "guestName", "guestname")),
    guestCount: Number(getRowValue(row, "guestCount", "guestcount")),
    channel: String(getRowValue(row, "channel")),
    rentalPeriod: String(getRowValue(row, "rentalPeriod", "rentalperiod")),
    pricePerNight: Number(getRowValue(row, "pricePerNight", "pricepernight")),
    extraFee: Number(getRowValue(row, "extraFee", "extrafee")),
    discount: Number(getRowValue(row, "discount")),
    rentalRevenue: Number(getRowValue(row, "rentalRevenue", "rentalrevenue")),
    cleaningFee: Number(getRowValue(row, "cleaningFee", "cleaningfee")),
    totalRevenue: Number(getRowValue(row, "totalRevenue", "totalrevenue")),
    hostFee: Number(getRowValue(row, "hostFee", "hostfee")),
    payout: Number(getRowValue(row, "payout")),
    nights: Number(getRowValue(row, "nights")),
    bookingNumber: String(getRowValue(row, "bookingNumber", "bookingnumber") ?? ""),
    overbookingStatus: String(
      getRowValue(row, "overbookingStatus", "overbookingstatus") ?? "",
    ),
  };
}

function mapExpenseRecord(row: Record<string, unknown>): ExpenseRecord {
  const normalizedExpenseFields = normalizeExpenseFields({
    amountValue: getRowValue(row, "amount"),
    descriptionValue: getRowValue(row, "description"),
    noteValue: getRowValue(row, "note"),
  });

  return {
    id: Number(getRowValue(row, "id")),
    importId: Number(getRowValue(row, "importId", "importid")),
    source: String(getRowValue(row, "source")) as ImportSource,
    propertyName: String(getRowValue(row, "propertyName", "propertyname")) || "Default Property",
    unitName: String(getRowValue(row, "unitName", "unitname")),
    date: String(getRowValue(row, "date")),
    category: String(getRowValue(row, "category")),
    amount: normalizedExpenseFields.amount,
    description: normalizedExpenseFields.description,
    note: normalizedExpenseFields.note,
  };
}

function mapCalendarClosureRecord(row: Record<string, unknown>): CalendarClosureRecord {
  return {
    id: Number(getRowValue(row, "id")),
    importId: Number(getRowValue(row, "importId", "importid")),
    source: String(getRowValue(row, "source")) as ImportSource,
    propertyName: String(getRowValue(row, "propertyName", "propertyname")) || "Default Property",
    unitName: String(getRowValue(row, "unitName", "unitname")),
    date: String(getRowValue(row, "date")),
    reason: String(getRowValue(row, "reason")),
    note: String(getRowValue(row, "note")),
    statusLabel:
      String(getRowValue(row, "statusLabel", "statuslabel")) || "Closed",
    guestCount: Number(getRowValue(row, "guestCount", "guestcount") ?? 0),
    nights: Number(getRowValue(row, "nights") ?? 0),
  };
}

function getRowValue(row: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    if (key in row) {
      return row[key];
    }
  }

  return undefined;
}

function cloneImportSummary(importSummary: StoredImport): ImportSummary {
  return {
    id: importSummary.id,
    fileName: importSummary.fileName,
    propertyName: importSummary.propertyName,
    source: importSummary.source,
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
    propertyName: booking.propertyName,
    unitName: booking.unitName,
    checkIn: booking.checkIn,
    checkout: booking.checkout,
    guestName: booking.guestName,
    guestCount: booking.guestCount,
    channel: booking.channel,
    rentalPeriod: booking.rentalPeriod,
    pricePerNight: booking.pricePerNight,
    extraFee: booking.extraFee,
    discount: booking.discount,
    rentalRevenue: booking.rentalRevenue,
    cleaningFee: booking.cleaningFee,
    totalRevenue: booking.totalRevenue,
    hostFee: booking.hostFee,
    payout: booking.payout,
    nights: booking.nights,
    bookingNumber: booking.bookingNumber,
    overbookingStatus: booking.overbookingStatus,
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
    createdAt: authUser.createdAt,
    updatedAt: authUser.updatedAt,
  };
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

export async function appendImportData({
  ownerEmail,
  fileName,
  workbookHash,
  propertyName,
  source,
  bookings,
  expenses,
  closures,
}: {
  ownerEmail: string;
  fileName: string;
  workbookHash: string;
  propertyName: string;
  source: ImportSource;
  bookings: BookingRecord[];
  expenses: ExpenseRecord[];
  closures: CalendarClosureRecord[];
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
            guest_name AS guestName,
            guest_count AS guestCount,
            channel,
            rental_period AS rentalPeriod,
            price_per_night AS pricePerNight,
            extra_fee AS extraFee,
            discount,
            rental_revenue AS rentalRevenue,
            cleaning_fee AS cleaningFee,
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

      const freshBookings = bookings.filter((booking) => {
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
          INSERT INTO imports (owner_email, file_name, workbook_hash, property_name, source, imported_at, bookings_count, expenses_count)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id
        `,
        [
          normalizedEmail,
          fileName,
          workbookHash,
          propertyName,
          source,
          importedAt,
          freshBookings.length,
          freshExpenses.length,
        ],
      );

      const importId = Number(importResult.rows[0]?.id ?? 0);

      for (const booking of freshBookings) {
        await client.query(
          `
            INSERT INTO bookings (
              owner_email, import_id, source, property_name, unit_name, check_in, checkout, guest_name, guest_count,
              channel, rental_period, price_per_night, extra_fee, discount, rental_revenue,
              cleaning_fee, total_revenue, host_fee, payout, nights, booking_number, overbooking_status
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
          `,
          [
            normalizedEmail,
            importId,
            source,
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
            booking.totalRevenue,
            booking.hostFee,
            booking.payout,
            booking.nights,
            booking.bookingNumber,
            booking.overbookingStatus,
          ],
        );
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

    const freshBookings = bookings.filter((booking) => {
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
      });
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
            guest_name AS guestName,
            guest_count AS guestCount,
            channel,
            rental_period AS rentalPeriod,
            price_per_night AS pricePerNight,
            extra_fee AS extraFee,
            discount,
            rental_revenue AS rentalRevenue,
            cleaning_fee AS cleaningFee,
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
    const freshBookings = bookings.filter((booking) => {
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
          INSERT INTO imports (owner_email, file_name, workbook_hash, property_name, source, imported_at, bookings_count, expenses_count)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        normalizedEmail,
        fileName,
        workbookHash,
        propertyName,
        source,
        importedAt,
        freshBookings.length,
        freshExpenses.length,
      );

    const importId = Number(result.lastInsertRowid);

    const insertBooking = db.prepare(`
      INSERT INTO bookings (
        owner_email, import_id, source, property_name, unit_name, check_in, checkout, guest_name, guest_count,
        channel, rental_period, price_per_night, extra_fee, discount, rental_revenue,
        cleaning_fee, total_revenue, host_fee, payout, nights, booking_number, overbooking_status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      insertBooking.run(
        normalizedEmail,
        importId,
        source,
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
        booking.totalRevenue,
        booking.hostFee,
        booking.payout,
        booking.nights,
        booking.bookingNumber,
        booking.overbookingStatus,
      );
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
      importedAt: String(getRowValue(row as Record<string, unknown>, "importedAt", "importedat")),
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
    importedAt: String(getRowValue(row, "importedAt", "importedat")),
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
          property_name AS propertyName,
          unit_name AS unitName,
          check_in AS checkIn,
          checkout,
          guest_name AS guestName,
          guest_count AS guestCount,
          channel,
          rental_period AS rentalPeriod,
          price_per_night AS pricePerNight,
          extra_fee AS extraFee,
          discount,
          rental_revenue AS rentalRevenue,
          cleaning_fee AS cleaningFee,
          total_revenue AS totalRevenue,
          host_fee AS hostFee,
          payout,
          nights,
          booking_number AS bookingNumber,
          overbooking_status AS overbookingStatus
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
          property_name AS propertyName,
          unit_name AS unitName,
          check_in AS checkIn,
          checkout,
          guest_name AS guestName,
          guest_count AS guestCount,
          channel,
          rental_period AS rentalPeriod,
          price_per_night AS pricePerNight,
          extra_fee AS extraFee,
          discount,
          rental_revenue AS rentalRevenue,
          cleaning_fee AS cleaningFee,
          total_revenue AS totalRevenue,
          host_fee AS hostFee,
          payout,
          nights,
          booking_number AS bookingNumber,
          overbooking_status AS overbookingStatus
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
    const [bookingUsage, expenseUsage, importUsage, closureUsage] = await Promise.all([
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

    if ((bookingCount > 0 || expenseCount > 0 || importCount > 0 || closureCount > 0) && !deleteLinkedData) {
      throw new Error("This property still has linked imports, bookings, closed days, or expenses. Confirm destructive delete to remove everything tied to it.");
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

    if ((bookingCount > 0 || expenseCount > 0 || importCount > 0 || closureCount > 0) && !deleteLinkedData) {
      throw new Error("This property still has linked imports, bookings, closed days, or expenses. Confirm destructive delete to remove everything tied to it.");
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
  const propertiesCount = db
    .prepare("SELECT COUNT(*) AS count FROM properties WHERE owner_email = ?")
    .get(normalizedEmail) as { count?: number } | undefined;

  const bookingCount = bookingUsage?.count ?? 0;
  const expenseCount = expenseUsage?.count ?? 0;
  const importCount = importUsage?.count ?? 0;
  const closureCount = closureUsage?.count ?? 0;

  if ((bookingCount > 0 || expenseCount > 0 || importCount > 0 || closureCount > 0) && !deleteLinkedData) {
    throw new Error("This property still has linked imports, bookings, closed days, or expenses. Confirm destructive delete to remove everything tied to it.");
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
          cleaning_fee, total_revenue, host_fee, payout, nights, booking_number, overbooking_status
        )
        VALUES ($1, 0, 'manual', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
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
          cleaning_fee, total_revenue, host_fee, payout, nights, booking_number, overbooking_status
        )
        VALUES (?, 0, 'manual', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          total_revenue = $16,
          host_fee = $17,
          payout = $18,
          nights = $19,
          booking_number = $20,
          overbooking_status = $21
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
        total_revenue = ?,
        host_fee = ?,
        payout = ?,
        nights = ?,
        booking_number = ?,
        overbooking_status = ?
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

export async function getDashboardLayoutState(
  ownerEmail: string,
  layoutKey: string,
): Promise<DashboardWidgetLayoutState | null> {
  await ensureDatabase();
  const normalizedEmail = normalizeOwnerEmail(ownerEmail);

  if (isPostgresConfigured()) {
    const pool = getPostgresPool();
    const result = await pool.query(
      `
        SELECT layout_json AS layoutJson
        FROM dashboard_layouts
        WHERE owner_email = $1
          AND layout_key = $2
      `,
      [normalizedEmail, layoutKey],
    );

    if (!result.rows[0]) {
      return null;
    }

    try {
      return JSON.parse(String(result.rows[0].layoutjson ?? result.rows[0].layoutJson));
    } catch {
      return null;
    }
  }

  if (shouldUseMemoryFallback()) {
    const store = getMemoryStore();
    const layout = store.dashboardLayouts.find(
      (entry) => entry.ownerEmail === normalizedEmail && entry.layoutKey === layoutKey,
    );

    if (!layout) {
      return null;
    }

    try {
      return JSON.parse(layout.layoutJson);
    } catch {
      return null;
    }
  }

  const db = getSQLiteDatabase();
  const row = db
    .prepare(
      `
        SELECT layout_json AS layoutJson
        FROM dashboard_layouts
        WHERE owner_email = ?
          AND layout_key = ?
      `,
    )
    .get(normalizedEmail, layoutKey) as Record<string, unknown> | undefined;

  if (!row) {
    return null;
  }

  try {
    return JSON.parse(String(getRowValue(row, "layoutJson", "layoutjson") ?? ""));
  } catch {
    return null;
  }
}

export async function upsertDashboardLayoutState({
  ownerEmail,
  layoutKey,
  layoutState,
}: {
  ownerEmail: string;
  layoutKey: string;
  layoutState: DashboardWidgetLayoutState;
}) {
  await ensureDatabase();
  const normalizedEmail = normalizeOwnerEmail(ownerEmail);
  const layoutJson = JSON.stringify(layoutState);
  const updatedAt = new Date().toISOString();

  if (isPostgresConfigured()) {
    const pool = getPostgresPool();
    await pool.query(
      `
        INSERT INTO dashboard_layouts (
          owner_email,
          layout_key,
          layout_json,
          updated_at
        )
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (owner_email, layout_key)
        DO UPDATE SET
          layout_json = EXCLUDED.layout_json,
          updated_at = EXCLUDED.updated_at
      `,
      [normalizedEmail, layoutKey, layoutJson, updatedAt],
    );

    return;
  }

  if (shouldUseMemoryFallback()) {
    const store = getMemoryStore();
    const existingIndex = store.dashboardLayouts.findIndex(
      (entry) => entry.ownerEmail === normalizedEmail && entry.layoutKey === layoutKey,
    );
    const nextEntry: StoredDashboardLayout = {
      ownerEmail: normalizedEmail,
      layoutKey,
      layoutJson,
      updatedAt,
    };

    if (existingIndex >= 0) {
      store.dashboardLayouts[existingIndex] = nextEntry;
    } else {
      store.dashboardLayouts.push(nextEntry);
    }

    return;
  }

  const db = getSQLiteDatabase();
  db.prepare(
    `
      INSERT INTO dashboard_layouts (
        owner_email,
        layout_key,
        layout_json,
        updated_at
      )
      VALUES (?, ?, ?, ?)
      ON CONFLICT(owner_email, layout_key) DO UPDATE SET
        layout_json = excluded.layout_json,
        updated_at = excluded.updated_at
    `,
  ).run(normalizedEmail, layoutKey, layoutJson, updatedAt);
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
      createdAt: String(result.rows[0].createdat ?? result.rows[0].createdAt),
      updatedAt: String(result.rows[0].updatedat ?? result.rows[0].updatedAt),
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
    createdAt: String(getRowValue(row, "createdAt", "createdat")),
    updatedAt: String(getRowValue(row, "updatedAt", "updatedat")),
  };
}

export async function createAuthUser({
  email,
  fullName,
  passwordHash,
}: {
  email: string;
  fullName: string;
  passwordHash: string;
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
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5)
      `,
      [normalizedEmail, normalizedFullName, passwordHash, createdAt, createdAt],
    );

    return;
  }

  if (shouldUseMemoryFallback()) {
    const store = getMemoryStore();
    store.authUsers.push({
      ownerEmail: normalizedEmail,
      fullName: normalizedFullName,
      passwordHash,
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
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?)
    `,
  ).run(normalizedEmail, normalizedFullName, passwordHash, createdAt, createdAt);
}

// Database connection and shared state layer, extracted from db.ts.
// Owns the SQLite/Postgres/in-memory singletons and the accessors used by the
// per-domain query functions. Depends on the schema modules but nothing else
// in the data layer, so there are no import cycles.

import { createRequire } from "node:module";
import { Pool } from "pg";
import type { UserSettings } from "./types";
import type { MemoryStore } from "./db-types";
import { getSQLiteDatabasePath, initializeSQLiteSchema } from "./db-schema";
import { runPostgresSchema } from "./db-schema-pg";
import { getCurrencyForCountry } from "./markets";
import { getDefaultTaxRateByCountry } from "./tax";

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

export function isPostgresConfigured() {
  return Boolean(getDatabaseConnectionString());
}

function getDatabaseConnectionString() {
  return process.env.DATABASE_URL ?? "";
}

function shouldUseSQLiteFallback() {
  return !isPostgresConfigured() && process.env.NODE_ENV !== "production";
}

export function shouldUseMemoryFallback() {
  return !isPostgresConfigured() && !shouldUseSQLiteFallback();
}

export function normalizeOwnerEmail(ownerEmail: string) {
  return ownerEmail.trim().toLowerCase();
}

export function getDefaultUserSettings(fallbackBusinessName: string): UserSettings {
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

export function getMemoryStore() {
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


export function getSQLiteDatabase() {
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

export function getPostgresPool() {
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

export async function ensureDatabase() {
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

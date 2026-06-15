// SQLite schema creation and migrations, extracted from db.ts.
// These functions take a better-sqlite3 Database as a parameter and hold no
// module-level state, so they live cleanly outside the main data module.

import { mkdirSync } from "node:fs";
import path from "node:path";

type SQLiteDatabase = import("better-sqlite3").Database;

export function hasColumn(db: SQLiteDatabase, tableName: string, columnName: string) {
  const columns = db
    .prepare(`PRAGMA table_info(${tableName})`)
    .all() as Array<{ name: string }>;

  return columns.some((column) => column.name === columnName);
}

export function getSQLiteDatabasePath() {
  const directory = path.join(process.cwd(), "data");
  mkdirSync(directory, { recursive: true });
  return path.join(directory, "gohostlyx.sqlite");
}

export function initializeSQLiteSchema(db: SQLiteDatabase) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS imports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_email TEXT NOT NULL DEFAULT 'legacy',
      file_name TEXT NOT NULL,
      workbook_hash TEXT NOT NULL DEFAULT '',
      property_name TEXT NOT NULL DEFAULT 'Default Property',
      source TEXT NOT NULL,
      imported_source TEXT NOT NULL DEFAULT 'generic_excel',
      imported_at TEXT NOT NULL,
      bookings_count INTEGER NOT NULL,
      expenses_count INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_email TEXT NOT NULL DEFAULT 'legacy',
      import_id INTEGER NOT NULL,
      source TEXT NOT NULL DEFAULT 'upload',
      imported_source TEXT NOT NULL DEFAULT 'generic_excel',
      property_id INTEGER,
      property_name TEXT NOT NULL DEFAULT 'Default Property',
      unit_name TEXT NOT NULL DEFAULT '',
      check_in TEXT NOT NULL,
      checkout TEXT NOT NULL,
      guest_name TEXT NOT NULL,
      guest_count INTEGER NOT NULL,
      guest_contact TEXT NOT NULL DEFAULT '',
      booked_at TEXT NOT NULL DEFAULT '',
      adults_count INTEGER NOT NULL DEFAULT 0,
      children_count INTEGER NOT NULL DEFAULT 0,
      infants_count INTEGER NOT NULL DEFAULT 0,
      channel TEXT NOT NULL,
      rental_period TEXT NOT NULL,
      price_per_night REAL NOT NULL,
      extra_fee REAL NOT NULL,
      discount REAL NOT NULL,
      rental_revenue REAL NOT NULL,
      cleaning_fee REAL NOT NULL,
      tax_amount REAL NOT NULL DEFAULT 0,
      total_revenue REAL NOT NULL,
      host_fee REAL NOT NULL,
      payout REAL NOT NULL,
      nights INTEGER NOT NULL,
      booking_number TEXT NOT NULL DEFAULT '',
      overbooking_status TEXT NOT NULL DEFAULT '',
      match_status TEXT NOT NULL DEFAULT 'unmatched',
      matched_calendar_event_id INTEGER,
      review_status TEXT NOT NULL DEFAULT 'ready',
      review_reason TEXT NOT NULL DEFAULT ''
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

    CREATE TABLE IF NOT EXISTS calendar_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_email TEXT NOT NULL DEFAULT 'legacy',
      import_id INTEGER NOT NULL DEFAULT 0,
      ical_feed_id INTEGER,
      property_id INTEGER,
      property_name TEXT NOT NULL DEFAULT 'Default Property',
      unit_name TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'other',
      external_event_id TEXT NOT NULL DEFAULT '',
      summary TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      event_type TEXT NOT NULL DEFAULT 'unknown',
      linked_booking_id INTEGER,
      last_synced_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ical_feeds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_email TEXT NOT NULL DEFAULT 'legacy',
      workspace_id TEXT NOT NULL DEFAULT 'legacy',
      property_id INTEGER NOT NULL,
      property_name TEXT NOT NULL DEFAULT 'Default Property',
      listing_id INTEGER,
      listing_name TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'other',
      feed_url TEXT NOT NULL DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      last_synced_at TEXT,
      last_sync_status TEXT NOT NULL DEFAULT 'never',
      last_error TEXT
    );

    CREATE TABLE IF NOT EXISTS financial_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_email TEXT NOT NULL DEFAULT 'legacy',
      import_id INTEGER NOT NULL DEFAULT 0,
      property_name TEXT NOT NULL DEFAULT 'Default Property',
      source TEXT NOT NULL,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      period_label TEXT NOT NULL,
      total_payout REAL NOT NULL DEFAULT 0,
      total_fees REAL NOT NULL DEFAULT 0,
      total_taxes REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT '',
      raw_data TEXT NOT NULL DEFAULT '{}',
      imported_at TEXT NOT NULL
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
      is_verified INTEGER NOT NULL DEFAULT 1,
      verification_code_hash TEXT,
      verification_expires_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      owner_email TEXT PRIMARY KEY,
      plan TEXT NOT NULL DEFAULT 'trial',
      status TEXT NOT NULL DEFAULT 'trialing',
      trial_started_at TEXT NOT NULL,
      trial_ends_at TEXT NOT NULL,
      activated_at TEXT,
      updated_at TEXT NOT NULL,
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      stripe_price_id TEXT
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
    CREATE INDEX IF NOT EXISTS idx_calendar_events_owner_start ON calendar_events(owner_email, start_date);
    CREATE INDEX IF NOT EXISTS idx_calendar_events_feed_id ON calendar_events(ical_feed_id);
    CREATE INDEX IF NOT EXISTS idx_ical_feeds_owner_active ON ical_feeds(owner_email, is_active);
    CREATE INDEX IF NOT EXISTS idx_financial_documents_owner_import ON financial_documents(owner_email, import_id);
    CREATE INDEX IF NOT EXISTS idx_financial_documents_owner_period ON financial_documents(owner_email, period_start, period_end);
    CREATE INDEX IF NOT EXISTS idx_auth_users_owner_email ON auth_users(owner_email);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_owner_email ON subscriptions(owner_email);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_properties_owner_name ON properties(owner_email, name);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_property_units_property_name ON property_units(property_id, name);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboard_layouts_owner_key ON dashboard_layouts(owner_email, layout_key);
  `);

  if (!hasColumn(db, "imports", "owner_email")) {
    db.exec("ALTER TABLE imports ADD COLUMN owner_email TEXT NOT NULL DEFAULT 'legacy';");
  }

  if (!hasColumn(db, "subscriptions", "stripe_customer_id")) {
    db.exec("ALTER TABLE subscriptions ADD COLUMN stripe_customer_id TEXT;");
  }

  if (!hasColumn(db, "subscriptions", "stripe_subscription_id")) {
    db.exec("ALTER TABLE subscriptions ADD COLUMN stripe_subscription_id TEXT;");
  }

  if (!hasColumn(db, "subscriptions", "stripe_price_id")) {
    db.exec("ALTER TABLE subscriptions ADD COLUMN stripe_price_id TEXT;");
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

  if (!hasColumn(db, "bookings", "imported_source")) {
    db.exec("ALTER TABLE bookings ADD COLUMN imported_source TEXT NOT NULL DEFAULT 'generic_excel';");
  }

  if (!hasColumn(db, "bookings", "property_id")) {
    db.exec("ALTER TABLE bookings ADD COLUMN property_id INTEGER;");
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

  if (!hasColumn(db, "bookings", "guest_contact")) {
    db.exec("ALTER TABLE bookings ADD COLUMN guest_contact TEXT NOT NULL DEFAULT '';");
  }

  if (!hasColumn(db, "bookings", "booked_at")) {
    db.exec("ALTER TABLE bookings ADD COLUMN booked_at TEXT NOT NULL DEFAULT '';");
  }

  if (!hasColumn(db, "bookings", "adults_count")) {
    db.exec("ALTER TABLE bookings ADD COLUMN adults_count INTEGER NOT NULL DEFAULT 0;");
  }

  if (!hasColumn(db, "bookings", "children_count")) {
    db.exec("ALTER TABLE bookings ADD COLUMN children_count INTEGER NOT NULL DEFAULT 0;");
  }

  if (!hasColumn(db, "bookings", "infants_count")) {
    db.exec("ALTER TABLE bookings ADD COLUMN infants_count INTEGER NOT NULL DEFAULT 0;");
  }

  if (!hasColumn(db, "bookings", "tax_amount")) {
    db.exec("ALTER TABLE bookings ADD COLUMN tax_amount REAL NOT NULL DEFAULT 0;");
  }

  if (!hasColumn(db, "bookings", "match_status")) {
    db.exec("ALTER TABLE bookings ADD COLUMN match_status TEXT NOT NULL DEFAULT 'unmatched';");
  }

  if (!hasColumn(db, "bookings", "matched_calendar_event_id")) {
    db.exec("ALTER TABLE bookings ADD COLUMN matched_calendar_event_id INTEGER;");
  }

  if (!hasColumn(db, "bookings", "review_status")) {
    db.exec("ALTER TABLE bookings ADD COLUMN review_status TEXT NOT NULL DEFAULT 'ready';");
  }

  if (!hasColumn(db, "bookings", "review_reason")) {
    db.exec("ALTER TABLE bookings ADD COLUMN review_reason TEXT NOT NULL DEFAULT '';");
  }

  if (!hasColumn(db, "imports", "imported_source")) {
    db.exec("ALTER TABLE imports ADD COLUMN imported_source TEXT NOT NULL DEFAULT 'generic_excel';");
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

  if (!hasColumn(db, "auth_users", "is_verified")) {
    db.exec("ALTER TABLE auth_users ADD COLUMN is_verified INTEGER NOT NULL DEFAULT 1;");
  }

  if (!hasColumn(db, "auth_users", "verification_code_hash")) {
    db.exec("ALTER TABLE auth_users ADD COLUMN verification_code_hash TEXT;");
  }

  if (!hasColumn(db, "auth_users", "verification_expires_at")) {
    db.exec("ALTER TABLE auth_users ADD COLUMN verification_expires_at TEXT;");
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

  db.exec(`
    CREATE TABLE IF NOT EXISTS calendar_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_email TEXT NOT NULL DEFAULT 'legacy',
      import_id INTEGER NOT NULL DEFAULT 0,
      ical_feed_id INTEGER,
      property_id INTEGER,
      property_name TEXT NOT NULL DEFAULT 'Default Property',
      unit_name TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'other',
      external_event_id TEXT NOT NULL DEFAULT '',
      summary TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      event_type TEXT NOT NULL DEFAULT 'unknown',
      linked_booking_id INTEGER,
      last_synced_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ical_feeds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_email TEXT NOT NULL DEFAULT 'legacy',
      workspace_id TEXT NOT NULL DEFAULT 'legacy',
      property_id INTEGER NOT NULL,
      property_name TEXT NOT NULL DEFAULT 'Default Property',
      listing_id INTEGER,
      listing_name TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'other',
      feed_url TEXT NOT NULL DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      last_synced_at TEXT,
      last_sync_status TEXT NOT NULL DEFAULT 'never',
      last_error TEXT
    );
  `);

  if (!hasColumn(db, "calendar_events", "owner_email")) {
    db.exec("ALTER TABLE calendar_events ADD COLUMN owner_email TEXT NOT NULL DEFAULT 'legacy';");
  }

  if (!hasColumn(db, "calendar_events", "import_id")) {
    db.exec("ALTER TABLE calendar_events ADD COLUMN import_id INTEGER NOT NULL DEFAULT 0;");
  }

  if (!hasColumn(db, "calendar_events", "ical_feed_id")) {
    db.exec("ALTER TABLE calendar_events ADD COLUMN ical_feed_id INTEGER;");
  }

  if (!hasColumn(db, "calendar_events", "property_id")) {
    db.exec("ALTER TABLE calendar_events ADD COLUMN property_id INTEGER;");
  }

  if (!hasColumn(db, "calendar_events", "property_name")) {
    db.exec("ALTER TABLE calendar_events ADD COLUMN property_name TEXT NOT NULL DEFAULT 'Default Property';");
  }

  if (!hasColumn(db, "calendar_events", "unit_name")) {
    db.exec("ALTER TABLE calendar_events ADD COLUMN unit_name TEXT NOT NULL DEFAULT '';");
  }

  if (!hasColumn(db, "calendar_events", "source")) {
    db.exec("ALTER TABLE calendar_events ADD COLUMN source TEXT NOT NULL DEFAULT 'other';");
  }

  if (!hasColumn(db, "calendar_events", "external_event_id")) {
    db.exec("ALTER TABLE calendar_events ADD COLUMN external_event_id TEXT NOT NULL DEFAULT '';");
  }

  if (!hasColumn(db, "calendar_events", "summary")) {
    db.exec("ALTER TABLE calendar_events ADD COLUMN summary TEXT NOT NULL DEFAULT '';");
  }

  if (!hasColumn(db, "calendar_events", "description")) {
    db.exec("ALTER TABLE calendar_events ADD COLUMN description TEXT NOT NULL DEFAULT '';");
  }

  if (!hasColumn(db, "calendar_events", "start_date")) {
    db.exec("ALTER TABLE calendar_events ADD COLUMN start_date TEXT NOT NULL DEFAULT '';");
  }

  if (!hasColumn(db, "calendar_events", "end_date")) {
    db.exec("ALTER TABLE calendar_events ADD COLUMN end_date TEXT NOT NULL DEFAULT '';");
  }

  if (!hasColumn(db, "calendar_events", "event_type")) {
    db.exec("ALTER TABLE calendar_events ADD COLUMN event_type TEXT NOT NULL DEFAULT 'unknown';");
  }

  if (!hasColumn(db, "calendar_events", "linked_booking_id")) {
    db.exec("ALTER TABLE calendar_events ADD COLUMN linked_booking_id INTEGER;");
  }

  if (!hasColumn(db, "calendar_events", "last_synced_at")) {
    db.exec("ALTER TABLE calendar_events ADD COLUMN last_synced_at TEXT NOT NULL DEFAULT '';");
  }

  if (!hasColumn(db, "ical_feeds", "owner_email")) {
    db.exec("ALTER TABLE ical_feeds ADD COLUMN owner_email TEXT NOT NULL DEFAULT 'legacy';");
  }

  if (!hasColumn(db, "ical_feeds", "workspace_id")) {
    db.exec("ALTER TABLE ical_feeds ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'legacy';");
  }

  if (!hasColumn(db, "ical_feeds", "property_id")) {
    db.exec("ALTER TABLE ical_feeds ADD COLUMN property_id INTEGER NOT NULL DEFAULT 0;");
  }

  if (!hasColumn(db, "ical_feeds", "property_name")) {
    db.exec("ALTER TABLE ical_feeds ADD COLUMN property_name TEXT NOT NULL DEFAULT 'Default Property';");
  }

  if (!hasColumn(db, "ical_feeds", "listing_id")) {
    db.exec("ALTER TABLE ical_feeds ADD COLUMN listing_id INTEGER;");
  }

  if (!hasColumn(db, "ical_feeds", "listing_name")) {
    db.exec("ALTER TABLE ical_feeds ADD COLUMN listing_name TEXT NOT NULL DEFAULT '';");
  }

  if (!hasColumn(db, "ical_feeds", "source")) {
    db.exec("ALTER TABLE ical_feeds ADD COLUMN source TEXT NOT NULL DEFAULT 'other';");
  }

  if (!hasColumn(db, "ical_feeds", "feed_url")) {
    db.exec("ALTER TABLE ical_feeds ADD COLUMN feed_url TEXT NOT NULL DEFAULT '';");
  }

  if (!hasColumn(db, "ical_feeds", "is_active")) {
    db.exec("ALTER TABLE ical_feeds ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;");
  }

  if (!hasColumn(db, "ical_feeds", "last_synced_at")) {
    db.exec("ALTER TABLE ical_feeds ADD COLUMN last_synced_at TEXT;");
  }

  if (!hasColumn(db, "ical_feeds", "last_sync_status")) {
    db.exec("ALTER TABLE ical_feeds ADD COLUMN last_sync_status TEXT NOT NULL DEFAULT 'never';");
  }

  if (!hasColumn(db, "ical_feeds", "last_error")) {
    db.exec("ALTER TABLE ical_feeds ADD COLUMN last_error TEXT;");
  }

  if (!hasColumn(db, "financial_documents", "owner_email")) {
    db.exec("ALTER TABLE financial_documents ADD COLUMN owner_email TEXT NOT NULL DEFAULT 'legacy';");
  }

  if (!hasColumn(db, "financial_documents", "import_id")) {
    db.exec("ALTER TABLE financial_documents ADD COLUMN import_id INTEGER NOT NULL DEFAULT 0;");
  }

  if (!hasColumn(db, "financial_documents", "property_name")) {
    db.exec("ALTER TABLE financial_documents ADD COLUMN property_name TEXT NOT NULL DEFAULT 'Default Property';");
  }

  if (!hasColumn(db, "financial_documents", "source")) {
    db.exec("ALTER TABLE financial_documents ADD COLUMN source TEXT NOT NULL DEFAULT 'airbnb';");
  }

  if (!hasColumn(db, "financial_documents", "period_start")) {
    db.exec("ALTER TABLE financial_documents ADD COLUMN period_start TEXT NOT NULL DEFAULT '';");
  }

  if (!hasColumn(db, "financial_documents", "period_end")) {
    db.exec("ALTER TABLE financial_documents ADD COLUMN period_end TEXT NOT NULL DEFAULT '';");
  }

  if (!hasColumn(db, "financial_documents", "period_label")) {
    db.exec("ALTER TABLE financial_documents ADD COLUMN period_label TEXT NOT NULL DEFAULT '';");
  }

  if (!hasColumn(db, "financial_documents", "total_payout")) {
    db.exec("ALTER TABLE financial_documents ADD COLUMN total_payout REAL NOT NULL DEFAULT 0;");
  }

  if (!hasColumn(db, "financial_documents", "total_fees")) {
    db.exec("ALTER TABLE financial_documents ADD COLUMN total_fees REAL NOT NULL DEFAULT 0;");
  }

  if (!hasColumn(db, "financial_documents", "total_taxes")) {
    db.exec("ALTER TABLE financial_documents ADD COLUMN total_taxes REAL NOT NULL DEFAULT 0;");
  }

  if (!hasColumn(db, "financial_documents", "currency")) {
    db.exec("ALTER TABLE financial_documents ADD COLUMN currency TEXT NOT NULL DEFAULT '';");
  }

  if (!hasColumn(db, "financial_documents", "raw_data")) {
    db.exec("ALTER TABLE financial_documents ADD COLUMN raw_data TEXT NOT NULL DEFAULT '{}';");
  }

  if (!hasColumn(db, "financial_documents", "imported_at")) {
    db.exec("ALTER TABLE financial_documents ADD COLUMN imported_at TEXT NOT NULL DEFAULT '';");
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

  db.exec("CREATE INDEX IF NOT EXISTS idx_calendar_events_feed_id ON calendar_events(ical_feed_id);");
  db.exec("CREATE INDEX IF NOT EXISTS idx_ical_feeds_owner_active ON ical_feeds(owner_email, is_active);");

  if (!hasColumn(db, "properties", "country_code")) {
    db.exec("ALTER TABLE properties ADD COLUMN country_code TEXT NOT NULL DEFAULT 'US';");
  }
}

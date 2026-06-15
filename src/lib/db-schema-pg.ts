import type { Pool } from "pg";

// Postgres schema creation and migrations, extracted from db.ts.
// Pure DDL runner: the caller owns the pool, the guard and the memoization.
export async function runPostgresSchema(pool: Pool) {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS imports (
          id BIGSERIAL PRIMARY KEY,
          owner_email TEXT NOT NULL,
          file_name TEXT NOT NULL,
          workbook_hash TEXT NOT NULL DEFAULT '',
          property_name TEXT NOT NULL DEFAULT 'Default Property',
          source TEXT NOT NULL,
          imported_source TEXT NOT NULL DEFAULT 'generic_excel',
          imported_at TIMESTAMPTZ NOT NULL,
          bookings_count INTEGER NOT NULL,
          expenses_count INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS bookings (
          id BIGSERIAL PRIMARY KEY,
          owner_email TEXT NOT NULL,
          import_id BIGINT NOT NULL DEFAULT 0,
          source TEXT NOT NULL DEFAULT 'upload',
          imported_source TEXT NOT NULL DEFAULT 'generic_excel',
          property_id BIGINT,
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
          overbooking_status TEXT NOT NULL DEFAULT '',
          match_status TEXT NOT NULL DEFAULT 'unmatched',
          matched_calendar_event_id BIGINT,
          review_status TEXT NOT NULL DEFAULT 'ready',
          review_reason TEXT NOT NULL DEFAULT ''
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

        CREATE TABLE IF NOT EXISTS calendar_events (
          id BIGSERIAL PRIMARY KEY,
          owner_email TEXT NOT NULL,
          import_id BIGINT NOT NULL DEFAULT 0,
          ical_feed_id BIGINT,
          property_id BIGINT,
          property_name TEXT NOT NULL DEFAULT 'Default Property',
          unit_name TEXT NOT NULL DEFAULT '',
          source TEXT NOT NULL DEFAULT 'other',
          external_event_id TEXT NOT NULL DEFAULT '',
          summary TEXT NOT NULL DEFAULT '',
          description TEXT NOT NULL DEFAULT '',
          start_date TEXT NOT NULL,
          end_date TEXT NOT NULL,
          event_type TEXT NOT NULL DEFAULT 'unknown',
          linked_booking_id BIGINT,
          last_synced_at TIMESTAMPTZ NOT NULL
        );

        CREATE TABLE IF NOT EXISTS ical_feeds (
          id BIGSERIAL PRIMARY KEY,
          owner_email TEXT NOT NULL,
          workspace_id TEXT NOT NULL,
          property_id BIGINT NOT NULL,
          property_name TEXT NOT NULL DEFAULT 'Default Property',
          listing_id BIGINT,
          listing_name TEXT NOT NULL DEFAULT '',
          source TEXT NOT NULL DEFAULT 'other',
          feed_url TEXT NOT NULL DEFAULT '',
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          last_synced_at TIMESTAMPTZ,
          last_sync_status TEXT NOT NULL DEFAULT 'never',
          last_error TEXT
        );

        CREATE TABLE IF NOT EXISTS financial_documents (
          id BIGSERIAL PRIMARY KEY,
          owner_email TEXT NOT NULL,
          import_id BIGINT NOT NULL DEFAULT 0,
          property_name TEXT NOT NULL DEFAULT 'Default Property',
          source TEXT NOT NULL,
          period_start TEXT NOT NULL,
          period_end TEXT NOT NULL,
          period_label TEXT NOT NULL,
          total_payout DOUBLE PRECISION NOT NULL DEFAULT 0,
          total_fees DOUBLE PRECISION NOT NULL DEFAULT 0,
          total_taxes DOUBLE PRECISION NOT NULL DEFAULT 0,
          currency TEXT NOT NULL DEFAULT '',
          raw_data TEXT NOT NULL DEFAULT '{}',
          imported_at TIMESTAMPTZ NOT NULL
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
          is_verified BOOLEAN NOT NULL DEFAULT TRUE,
          verification_code_hash TEXT,
          verification_expires_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL
        );

        CREATE TABLE IF NOT EXISTS subscriptions (
          owner_email TEXT PRIMARY KEY,
          plan TEXT NOT NULL DEFAULT 'trial',
          status TEXT NOT NULL DEFAULT 'trialing',
          trial_started_at TIMESTAMPTZ NOT NULL,
          trial_ends_at TIMESTAMPTZ NOT NULL,
          activated_at TIMESTAMPTZ,
          updated_at TIMESTAMPTZ NOT NULL,
          stripe_customer_id TEXT,
          stripe_subscription_id TEXT,
          stripe_price_id TEXT
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

      await pool.query(`
        ALTER TABLE imports
        ADD COLUMN IF NOT EXISTS property_name TEXT NOT NULL DEFAULT 'Default Property'
      `);
      await pool.query(`
        ALTER TABLE subscriptions
        ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT
      `);
      await pool.query(`
        ALTER TABLE subscriptions
        ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT
      `);
      await pool.query(`
        ALTER TABLE subscriptions
        ADD COLUMN IF NOT EXISTS stripe_price_id TEXT
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
        ALTER TABLE bookings
        ADD COLUMN IF NOT EXISTS imported_source TEXT NOT NULL DEFAULT 'generic_excel'
      `);
      await pool.query(`
        ALTER TABLE bookings
        ADD COLUMN IF NOT EXISTS property_id BIGINT
      `);
      await pool.query(`
        ALTER TABLE imports
        ADD COLUMN IF NOT EXISTS workbook_hash TEXT NOT NULL DEFAULT ''
      `);
      await pool.query(`
        ALTER TABLE imports
        ADD COLUMN IF NOT EXISTS imported_source TEXT NOT NULL DEFAULT 'generic_excel'
      `);
      await pool.query(`
        ALTER TABLE auth_users
        ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT TRUE
      `);
      await pool.query(`
        ALTER TABLE auth_users
        ADD COLUMN IF NOT EXISTS verification_code_hash TEXT
      `);
      await pool.query(`
        ALTER TABLE auth_users
        ADD COLUMN IF NOT EXISTS verification_expires_at TIMESTAMPTZ
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
        ALTER TABLE bookings
        ADD COLUMN IF NOT EXISTS guest_contact TEXT NOT NULL DEFAULT ''
      `);
      await pool.query(`
        ALTER TABLE bookings
        ADD COLUMN IF NOT EXISTS booked_at TEXT NOT NULL DEFAULT ''
      `);
      await pool.query(`
        ALTER TABLE bookings
        ADD COLUMN IF NOT EXISTS adults_count INTEGER NOT NULL DEFAULT 0
      `);
      await pool.query(`
        ALTER TABLE bookings
        ADD COLUMN IF NOT EXISTS children_count INTEGER NOT NULL DEFAULT 0
      `);
      await pool.query(`
        ALTER TABLE bookings
        ADD COLUMN IF NOT EXISTS infants_count INTEGER NOT NULL DEFAULT 0
      `);
      await pool.query(`
        ALTER TABLE bookings
        ADD COLUMN IF NOT EXISTS tax_amount DOUBLE PRECISION NOT NULL DEFAULT 0
      `);
      await pool.query(`
        ALTER TABLE bookings
        ADD COLUMN IF NOT EXISTS match_status TEXT NOT NULL DEFAULT 'unmatched'
      `);
      await pool.query(`
        ALTER TABLE bookings
        ADD COLUMN IF NOT EXISTS matched_calendar_event_id BIGINT
      `);
      await pool.query(`
        ALTER TABLE bookings
        ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'ready'
      `);
      await pool.query(`
        ALTER TABLE bookings
        ADD COLUMN IF NOT EXISTS review_reason TEXT NOT NULL DEFAULT ''
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
      await pool.query(`
        ALTER TABLE calendar_events
        ADD COLUMN IF NOT EXISTS owner_email TEXT NOT NULL DEFAULT 'legacy'
      `);
      await pool.query(`
        ALTER TABLE calendar_events
        ADD COLUMN IF NOT EXISTS import_id BIGINT NOT NULL DEFAULT 0
      `);
      await pool.query(`
        ALTER TABLE calendar_events
        ADD COLUMN IF NOT EXISTS ical_feed_id BIGINT
      `);
      await pool.query(`
        ALTER TABLE calendar_events
        ADD COLUMN IF NOT EXISTS property_id BIGINT
      `);
      await pool.query(`
        ALTER TABLE calendar_events
        ADD COLUMN IF NOT EXISTS property_name TEXT NOT NULL DEFAULT 'Default Property'
      `);
      await pool.query(`
        ALTER TABLE calendar_events
        ADD COLUMN IF NOT EXISTS unit_name TEXT NOT NULL DEFAULT ''
      `);
      await pool.query(`
        ALTER TABLE calendar_events
        ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'other'
      `);
      await pool.query(`
        ALTER TABLE calendar_events
        ADD COLUMN IF NOT EXISTS external_event_id TEXT NOT NULL DEFAULT ''
      `);
      await pool.query(`
        ALTER TABLE calendar_events
        ADD COLUMN IF NOT EXISTS summary TEXT NOT NULL DEFAULT ''
      `);
      await pool.query(`
        ALTER TABLE calendar_events
        ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT ''
      `);
      await pool.query(`
        ALTER TABLE calendar_events
        ADD COLUMN IF NOT EXISTS start_date TEXT NOT NULL DEFAULT ''
      `);
      await pool.query(`
        ALTER TABLE calendar_events
        ADD COLUMN IF NOT EXISTS end_date TEXT NOT NULL DEFAULT ''
      `);
      await pool.query(`
        ALTER TABLE calendar_events
        ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'unknown'
      `);
      await pool.query(`
        ALTER TABLE calendar_events
        ADD COLUMN IF NOT EXISTS linked_booking_id BIGINT
      `);
      await pool.query(`
        ALTER TABLE calendar_events
        ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      `);
      await pool.query(`
        ALTER TABLE ical_feeds
        ADD COLUMN IF NOT EXISTS owner_email TEXT NOT NULL DEFAULT 'legacy'
      `);
      await pool.query(`
        ALTER TABLE ical_feeds
        ADD COLUMN IF NOT EXISTS workspace_id TEXT NOT NULL DEFAULT 'legacy'
      `);
      await pool.query(`
        ALTER TABLE ical_feeds
        ADD COLUMN IF NOT EXISTS property_id BIGINT NOT NULL DEFAULT 0
      `);
      await pool.query(`
        ALTER TABLE ical_feeds
        ADD COLUMN IF NOT EXISTS property_name TEXT NOT NULL DEFAULT 'Default Property'
      `);
      await pool.query(`
        ALTER TABLE ical_feeds
        ADD COLUMN IF NOT EXISTS listing_id BIGINT
      `);
      await pool.query(`
        ALTER TABLE ical_feeds
        ADD COLUMN IF NOT EXISTS listing_name TEXT NOT NULL DEFAULT ''
      `);
      await pool.query(`
        ALTER TABLE ical_feeds
        ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'other'
      `);
      await pool.query(`
        ALTER TABLE ical_feeds
        ADD COLUMN IF NOT EXISTS feed_url TEXT NOT NULL DEFAULT ''
      `);
      await pool.query(`
        ALTER TABLE ical_feeds
        ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE
      `);
      await pool.query(`
        ALTER TABLE ical_feeds
        ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ
      `);
      await pool.query(`
        ALTER TABLE ical_feeds
        ADD COLUMN IF NOT EXISTS last_sync_status TEXT NOT NULL DEFAULT 'never'
      `);
      await pool.query(`
        ALTER TABLE ical_feeds
        ADD COLUMN IF NOT EXISTS last_error TEXT
      `);
      await pool.query(`
        ALTER TABLE financial_documents
        ADD COLUMN IF NOT EXISTS owner_email TEXT NOT NULL DEFAULT 'legacy'
      `);
      await pool.query(`
        ALTER TABLE financial_documents
        ADD COLUMN IF NOT EXISTS import_id BIGINT NOT NULL DEFAULT 0
      `);
      await pool.query(`
        ALTER TABLE financial_documents
        ADD COLUMN IF NOT EXISTS property_name TEXT NOT NULL DEFAULT 'Default Property'
      `);
      await pool.query(`
        ALTER TABLE financial_documents
        ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'airbnb'
      `);
      await pool.query(`
        ALTER TABLE financial_documents
        ADD COLUMN IF NOT EXISTS period_start TEXT NOT NULL DEFAULT ''
      `);
      await pool.query(`
        ALTER TABLE financial_documents
        ADD COLUMN IF NOT EXISTS period_end TEXT NOT NULL DEFAULT ''
      `);
      await pool.query(`
        ALTER TABLE financial_documents
        ADD COLUMN IF NOT EXISTS period_label TEXT NOT NULL DEFAULT ''
      `);
      await pool.query(`
        ALTER TABLE financial_documents
        ADD COLUMN IF NOT EXISTS total_payout DOUBLE PRECISION NOT NULL DEFAULT 0
      `);
      await pool.query(`
        ALTER TABLE financial_documents
        ADD COLUMN IF NOT EXISTS total_fees DOUBLE PRECISION NOT NULL DEFAULT 0
      `);
      await pool.query(`
        ALTER TABLE financial_documents
        ADD COLUMN IF NOT EXISTS total_taxes DOUBLE PRECISION NOT NULL DEFAULT 0
      `);
      await pool.query(`
        ALTER TABLE financial_documents
        ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT ''
      `);
      await pool.query(`
        ALTER TABLE financial_documents
        ADD COLUMN IF NOT EXISTS raw_data TEXT NOT NULL DEFAULT '{}'
      `);
      await pool.query(`
        ALTER TABLE financial_documents
        ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      `);
}

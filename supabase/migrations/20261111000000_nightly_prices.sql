SET client_min_messages = warning;

-- Nightly prices: the price a listing showed on a channel's calendar for each
-- date, booked or not. Bookings only say what guests paid on the nights that
-- sold; this keeps what the host asked on every night, so the calendar can show
-- this year's price next to last year's.
--
-- Dates are 'YYYY-MM-DD' text like the other tables (bookings, closures).

CREATE TABLE IF NOT EXISTS public.nightly_prices (
  id BIGSERIAL PRIMARY KEY,
  owner_email TEXT NOT NULL,
  property_id BIGINT REFERENCES public.properties (id),
  property_name TEXT NOT NULL DEFAULT '',
  channel TEXT NOT NULL DEFAULT 'Airbnb',
  date TEXT NOT NULL CHECK (date ~ '^\d{4}-\d{2}-\d{2}$'),
  price DOUBLE PRECISION NOT NULL CHECK (price >= 0),
  source TEXT NOT NULL DEFAULT 'upload',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One price per listing, channel and night; uploads overwrite it.
CREATE UNIQUE INDEX IF NOT EXISTS idx_nightly_prices_owner_property_channel_date
  ON public.nightly_prices (owner_email, property_id, channel, date);
CREATE INDEX IF NOT EXISTS idx_nightly_prices_property_id
  ON public.nightly_prices (property_id);

ALTER TABLE public.nightly_prices ENABLE ROW LEVEL SECURITY;

-- Same property link as every other table (see 20261110120000).
DROP TRIGGER IF EXISTS nightly_prices_link_property ON public.nightly_prices;
CREATE TRIGGER nightly_prices_link_property
  BEFORE INSERT OR UPDATE OF property_id, property_name ON public.nightly_prices
  FOR EACH ROW EXECUTE FUNCTION public.link_record_to_property();

CREATE OR REPLACE FUNCTION public.rename_property_records()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  UPDATE public.bookings SET property_name = NEW.name WHERE property_id = NEW.id;
  UPDATE public.expenses SET property_name = NEW.name WHERE property_id = NEW.id;
  UPDATE public.imports SET property_name = NEW.name WHERE property_id = NEW.id;
  UPDATE public.calendar_closures SET property_name = NEW.name WHERE property_id = NEW.id;
  UPDATE public.calendar_events SET property_name = NEW.name WHERE property_id = NEW.id;
  UPDATE public.ical_feeds SET property_name = NEW.name WHERE property_id = NEW.id;
  UPDATE public.financial_documents SET property_name = NEW.name WHERE property_id = NEW.id;
  UPDATE public.nightly_prices SET property_name = NEW.name WHERE property_id = NEW.id;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rename_property_records() FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rename_property_records() FROM anon, authenticated';
  END IF;
END;
$$;

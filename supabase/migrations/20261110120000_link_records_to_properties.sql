-- Link every record to its property by id instead of by name.
--
-- Until now bookings, expenses, imports and the other tables pointed at a
-- property only through a property_name text column, and the app recreated
-- properties from any name it found. Renaming a property while one table kept
-- the old name brought the old property back as a duplicate.
--
-- After this migration:
--   * every table that stores property_name also stores property_id, with a
--     foreign key to properties (NO ACTION: a property cannot be deleted while
--     records still point at it, so nothing is ever orphaned silently);
--   * a BEFORE trigger fills property_id from the name on insert (creating the
--     property if it does not exist yet, as the app used to do on read) and
--     keeps property_name equal to the property's current name;
--   * renaming a property updates property_name everywhere through its id.

-- 1. Columns --------------------------------------------------------------

ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS property_id BIGINT;
ALTER TABLE public.imports ADD COLUMN IF NOT EXISTS property_id BIGINT;
ALTER TABLE public.calendar_closures ADD COLUMN IF NOT EXISTS property_id BIGINT;
ALTER TABLE public.financial_documents ADD COLUMN IF NOT EXISTS property_id BIGINT;

-- ical_feeds used 0 for "no property"; a foreign key needs NULL instead.
ALTER TABLE public.ical_feeds ALTER COLUMN property_id DROP NOT NULL;
ALTER TABLE public.ical_feeds ALTER COLUMN property_id DROP DEFAULT;
UPDATE public.ical_feeds SET property_id = NULL WHERE property_id = 0;

-- 2. Backfill -------------------------------------------------------------

-- Every property name in use gets a property row (what the app's read-time
-- sync used to do).
INSERT INTO public.properties (owner_email, name, country_code, created_at)
SELECT DISTINCT ON (used.owner_email, LOWER(TRIM(used.property_name)))
  used.owner_email,
  TRIM(used.property_name),
  'US',
  NOW()
FROM (
  SELECT owner_email, property_name FROM public.bookings
  UNION ALL SELECT owner_email, property_name FROM public.expenses
  UNION ALL SELECT owner_email, property_name FROM public.imports
  UNION ALL SELECT owner_email, property_name FROM public.calendar_closures
  UNION ALL SELECT owner_email, property_name FROM public.calendar_events
  UNION ALL SELECT owner_email, property_name FROM public.ical_feeds
  UNION ALL SELECT owner_email, property_name FROM public.financial_documents
) AS used
WHERE TRIM(used.property_name) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM public.properties AS existing
    WHERE existing.owner_email = used.owner_email
      AND LOWER(TRIM(existing.name)) = LOWER(TRIM(used.property_name))
  )
ORDER BY used.owner_email, LOWER(TRIM(used.property_name));

-- One canonical property per (owner, name): the oldest one.
CREATE TEMPORARY TABLE property_lookup AS
SELECT DISTINCT ON (owner_email, LOWER(TRIM(name)))
  id,
  owner_email,
  name,
  LOWER(TRIM(name)) AS name_key
FROM public.properties
ORDER BY owner_email, LOWER(TRIM(name)), id;

-- Link by name. The name is what every screen has shown so far, so it wins
-- over any older property_id value.
UPDATE public.bookings AS t SET property_id = p.id, property_name = p.name
FROM property_lookup AS p
WHERE p.owner_email = t.owner_email AND p.name_key = LOWER(TRIM(t.property_name));

UPDATE public.expenses AS t SET property_id = p.id, property_name = p.name
FROM property_lookup AS p
WHERE p.owner_email = t.owner_email AND p.name_key = LOWER(TRIM(t.property_name));

UPDATE public.imports AS t SET property_id = p.id, property_name = p.name
FROM property_lookup AS p
WHERE p.owner_email = t.owner_email AND p.name_key = LOWER(TRIM(t.property_name));

UPDATE public.calendar_closures AS t SET property_id = p.id, property_name = p.name
FROM property_lookup AS p
WHERE p.owner_email = t.owner_email AND p.name_key = LOWER(TRIM(t.property_name));

UPDATE public.calendar_events AS t SET property_id = p.id, property_name = p.name
FROM property_lookup AS p
WHERE p.owner_email = t.owner_email AND p.name_key = LOWER(TRIM(t.property_name));

UPDATE public.ical_feeds AS t SET property_id = p.id, property_name = p.name
FROM property_lookup AS p
WHERE p.owner_email = t.owner_email AND p.name_key = LOWER(TRIM(t.property_name));

UPDATE public.financial_documents AS t SET property_id = p.id, property_name = p.name
FROM property_lookup AS p
WHERE p.owner_email = t.owner_email AND p.name_key = LOWER(TRIM(t.property_name));

DROP TABLE property_lookup;

-- Anything left with an id that points nowhere is cleared so the foreign key
-- can be added.
UPDATE public.bookings SET property_id = NULL
WHERE property_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.properties WHERE id = bookings.property_id);
UPDATE public.calendar_events SET property_id = NULL
WHERE property_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.properties WHERE id = calendar_events.property_id);
UPDATE public.ical_feeds SET property_id = NULL
WHERE property_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.properties WHERE id = ical_feeds.property_id);

-- 3. Foreign keys and indexes ---------------------------------------------

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties (id);
ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties (id);
ALTER TABLE public.imports
  ADD CONSTRAINT imports_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties (id);
ALTER TABLE public.calendar_closures
  ADD CONSTRAINT calendar_closures_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties (id);
ALTER TABLE public.calendar_events
  ADD CONSTRAINT calendar_events_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties (id);
ALTER TABLE public.ical_feeds
  ADD CONSTRAINT ical_feeds_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties (id);
ALTER TABLE public.financial_documents
  ADD CONSTRAINT financial_documents_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties (id);

CREATE INDEX IF NOT EXISTS idx_bookings_property_id ON public.bookings (property_id);
CREATE INDEX IF NOT EXISTS idx_expenses_property_id ON public.expenses (property_id);
CREATE INDEX IF NOT EXISTS idx_imports_property_id ON public.imports (property_id);
CREATE INDEX IF NOT EXISTS idx_calendar_closures_property_id ON public.calendar_closures (property_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_property_id ON public.calendar_events (property_id);
CREATE INDEX IF NOT EXISTS idx_ical_feeds_property_id ON public.ical_feeds (property_id);
CREATE INDEX IF NOT EXISTS idx_financial_documents_property_id ON public.financial_documents (property_id);
CREATE INDEX IF NOT EXISTS idx_properties_owner_name_lower ON public.properties (owner_email, LOWER(TRIM(name)));

-- 4. Keep the link and the name in step -----------------------------------

CREATE OR REPLACE FUNCTION public.link_record_to_property()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  linked_id BIGINT;
  linked_name TEXT;
BEGIN
  -- A known id wins: copy that property's current name onto the record.
  IF NEW.property_id IS NOT NULL THEN
    SELECT p.name INTO linked_name
    FROM public.properties AS p
    WHERE p.id = NEW.property_id AND p.owner_email = NEW.owner_email;

    IF linked_name IS NOT NULL THEN
      NEW.property_name := linked_name;
      RETURN NEW;
    END IF;

    NEW.property_id := NULL;
  END IF;

  IF TRIM(COALESCE(NEW.property_name, '')) = '' THEN
    RETURN NEW;
  END IF;

  SELECT p.id, p.name INTO linked_id, linked_name
  FROM public.properties AS p
  WHERE p.owner_email = NEW.owner_email
    AND LOWER(TRIM(p.name)) = LOWER(TRIM(NEW.property_name))
  ORDER BY p.id
  LIMIT 1;

  IF linked_id IS NULL THEN
    INSERT INTO public.properties (owner_email, name, country_code, created_at)
    VALUES (NEW.owner_email, TRIM(NEW.property_name), 'US', NOW())
    RETURNING id, name INTO linked_id, linked_name;
  END IF;

  NEW.property_id := linked_id;
  NEW.property_name := linked_name;
  RETURN NEW;
END;
$$;

CREATE TRIGGER bookings_link_property
  BEFORE INSERT OR UPDATE OF property_id, property_name ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.link_record_to_property();
CREATE TRIGGER expenses_link_property
  BEFORE INSERT OR UPDATE OF property_id, property_name ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.link_record_to_property();
CREATE TRIGGER imports_link_property
  BEFORE INSERT OR UPDATE OF property_id, property_name ON public.imports
  FOR EACH ROW EXECUTE FUNCTION public.link_record_to_property();
CREATE TRIGGER calendar_closures_link_property
  BEFORE INSERT OR UPDATE OF property_id, property_name ON public.calendar_closures
  FOR EACH ROW EXECUTE FUNCTION public.link_record_to_property();
CREATE TRIGGER calendar_events_link_property
  BEFORE INSERT OR UPDATE OF property_id, property_name ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.link_record_to_property();
CREATE TRIGGER ical_feeds_link_property
  BEFORE INSERT OR UPDATE OF property_id, property_name ON public.ical_feeds
  FOR EACH ROW EXECUTE FUNCTION public.link_record_to_property();
CREATE TRIGGER financial_documents_link_property
  BEFORE INSERT OR UPDATE OF property_id, property_name ON public.financial_documents
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
  RETURN NEW;
END;
$$;

CREATE TRIGGER properties_rename_records
  AFTER UPDATE OF name ON public.properties
  FOR EACH ROW
  WHEN (OLD.name IS DISTINCT FROM NEW.name)
  EXECUTE FUNCTION public.rename_property_records();

-- These functions only run as triggers; nobody should call them directly.
REVOKE EXECUTE ON FUNCTION public.link_record_to_property() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rename_property_records() FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.link_record_to_property() FROM anon, authenticated';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rename_property_records() FROM anon, authenticated';
  END IF;
END;
$$;
